const http = require('http');
const https = require('https');
const fs = require('fs');
const ini = require('ini');

// 默认值对象
const DEFAULT_CONFIG = {
    server: {
        protocol: 'http',
        host: ['localhost']
    },
    proxy: {},
    https:{
        key:'./private.key',
        cert:'./certificate.pem'
    }
};

// 读取 INI 配置文件
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

// 合并默认配置和实际配置
const finalConfig = {
    server: {
       ...DEFAULT_CONFIG.server,
       ...config.server
    },
    proxy: {
       ...DEFAULT_CONFIG.proxy,
       ...config.proxy
    },
    https:{
        ...DEFAULT_CONFIG.https,
        ...config.https
    }
};

// 解析 server 部分的配置
const serverConfig = finalConfig.server;
const protocol = serverConfig.protocol;
const hosts = Array.isArray(serverConfig.host)
   ? serverConfig.host
    : serverConfig.host ? serverConfig.host.split(';') : DEFAULT_CONFIG.server.host;

// 根据请求路径查找目标服务器
function findTarget(path) {
    const proxyConfig = finalConfig.proxy;
    for (const [source, targetInfo] of Object.entries(proxyConfig)) {
        if (path.startsWith(source)) {
            const [targetProtocol = 'http', host = 'localhost', port] = targetInfo.split(':');
            return { protocol: targetProtocol, host, port };
        }
    }
    return null;
}

// 创建 HTTP 或 HTTPS 代理服务器
const createServer = protocol === 'https'
   ? (handler) => https.createServer({
        key: fs.readFileSync(finalConfig.https.key),
        cert: fs.readFileSync(finalConfig.https.cert)
    }, handler)
    : http.createServer;

const server = createServer((req, res) => {
    const target = findTarget(req.url);
    if (!target) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('No mapping found for this path');
        return;
    }

    const options = {
        hostname: target.host,
        port: target.port,
        path: req.url,
        method: req.method,
        headers: req.headers
    };

    const proxyReq = (target.protocol === 'https' ? https : http).request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Proxy error occurred');
    });

    req.pipe(proxyReq);
});

// 启动服务器监听多个主机
hosts.forEach((host) => {
    const port = protocol === 'https' ? 443 : 80;
    server.listen(port, host, () => {
        console.log(`${protocol.toUpperCase()} proxy server is listening on ${host}:${port}`);
    });
});