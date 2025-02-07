const http = require('http');
const https = require('https');
const fs = require('fs');
const ini = require('ini');
const statusCodes = require('./status_codes');
const winston = require('winston');

// 配置 winston 日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}][${level}][${message}]`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/proxy_error.log', level: 'error', maxsize: 100 * 1024 * 1024 }),
        new winston.transports.File({ filename: 'logs/proxy_combined.log', maxsize: 100 * 1024 * 1024 })
    ]
});

// 配置文件读取策略
class ConfigReader {
    constructor(configPath) {
        this.configPath = configPath;
    }

    readConfig() {
        try {
            const configFileContent = fs.readFileSync(this.configPath, 'utf-8');
            return ini.parse(configFileContent);
        } catch (error) {
            logger.error(`${statusCodes.E001}: ${error.message}`);
            throw new Error(statusCodes.E001);
        }
    }
}
const configReader = new ConfigReader('config.ini');
const config = configReader.readConfig();
// 路径映射生成策略
class PathMapGenerator {
    generatePathMap(config) {
        const pathToConfigMap = {};
        for (const section in config) {
            if (section !== 'main' && config[section].port && config[section].entry) {
                const path = config[section].entry;
                pathToConfigMap[path] = {
                    port: parseInt(config[section].port, 10),
                    entry: path
                };
            }
        }
        return pathToConfigMap;
    }
}

// 服务器创建策略接口
class ServerCreationStrategy {
    createServer(handleRequest) {
        throw new Error('Method "createServer" must be implemented.');
    }
}

// HTTP 服务器创建策略
class HttpServerCreationStrategy extends ServerCreationStrategy {
    createServer(handleRequest) {
        return http.createServer(handleRequest);
    }
}

// HTTPS 服务器创建策略
class HttpsServerCreationStrategy extends ServerCreationStrategy {
    constructor(cert, key) {
        super();
        this.cert = cert;
        this.key = key;
    }

    createServer(handleRequest) {
        return https.createServer({
            cert: this.cert,
            key: this.key,
            secureOptions: require('constants').SSL_OP_NO_SSLv3 | require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1,
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.3',
            ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384'
        }, handleRequest);
    }
}

// 请求处理函数
function handleRequest(pathToConfigMap, req, res) {
    //查找IP
    let clientIp = req.socket.remoteAddress;
    const forwardedHeader = req.headers['forwarded'];
    if (forwardedHeader) {
        const parts = forwardedHeader.split(';');
        for (const part of parts) {
            if (part.startsWith('for=')) {
                clientIp = part.slice(4).replace(/["']/g, '');
                break;
            }
        }
    }
    logger.info(`(${clientIp})${statusCodes.N002}: ${req.url}`);

    let targetConfig = null;
    for (const path in pathToConfigMap) {
        if (req.url.startsWith(path)) {
            targetConfig = pathToConfigMap[path];
            break;
        }
    }

    if (!targetConfig) {
        logger.error(`(${clientIp})${statusCodes.N004}: ${req.url}`);
        res.statusCode = 404;
        return;
    }
    if (config.main.DEBUG === true) {
        // 设置 CORS 响应头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    // 防止 XSS 攻击
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // 防止 MIME 类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 启用 HSTS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // 防止信息泄露
    res.removeHeader('X-Powered-By');

    // 去除 entry 路径前缀
    const newPath = req.url.replace(targetConfig.entry, '');

    // 创建对目标服务器的请求
    const options = {
        hostname: 'localhost',
        port: targetConfig.port,
        path: newPath,
        method: req.method,
        headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        logger.error(`${statusCodes.E007}: ${error.message}`);
        res.statusCode = 500;
        res.end('Internal Server Error');
    });

    req.pipe(proxyReq);
}

// 验证主配置信息
function validateMainConfig(mainConfig) {
    if (!mainConfig) {
        logger.error(statusCodes.E002);
        throw new Error(statusCodes.E002);
    }
    if (!mainConfig.protocol) {
        logger.error(statusCodes.E003);
        throw new Error(statusCodes.E003);
    }
    if (mainConfig.protocol === 'https') {
        if (!mainConfig.cert) {
            logger.error(statusCodes.E004);
            throw new Error(statusCodes.E004);
        }
        if (!mainConfig.key) {
            logger.error(statusCodes.E005);
            throw new Error(statusCodes.E005);
        }
    }
}

// 读取证书和私钥文件
function readCertAndKey(certPath, keyPath) {
    try {
        const cert = fs.readFileSync(certPath);
        const key = fs.readFileSync(keyPath);
        return { cert, key };
    } catch (error) {
        logger.error(`${statusCodes.E006}: ${error.message}`);
        throw new Error(statusCodes.E006);
    }
}

// 主函数
function main() {
    try {
        const mainConfig = config.main;
        validateMainConfig(mainConfig);

        const protocol = mainConfig.protocol;
        let cert, key;
        if (protocol === 'https') {
            const { cert: readCert, key: readKey } = readCertAndKey(mainConfig.cert, mainConfig.key);
            cert = readCert;
            key = readKey;
        }

        const pathMapGenerator = new PathMapGenerator();
        const pathToConfigMap = pathMapGenerator.generatePathMap(config);

        let serverCreationStrategy;
        if (protocol === 'https') {
            serverCreationStrategy = new HttpsServerCreationStrategy(cert, key);
        } else {
            serverCreationStrategy = new HttpServerCreationStrategy();
        }

        const proxyServer = serverCreationStrategy.createServer((req, res) => {
            handleRequest(pathToConfigMap, req, res);
        });

        const port = protocol === 'https' ? 443 : 80;
        proxyServer.listen(port, () => {
            logger.info(`${statusCodes.N001}，端口: ${port}`);
            console.log(`[${protocol}]${statusCodes.N001}，端口: ${port}`);
        });
    } catch (error) {
        logger.error(`${error.message}`);
    }
}

main();