const fs = require('fs');
const path = require('path');
const winston = require('winston');
const crypto = require('crypto');
const ini = require('ini');
// 日志映射表
const logMessageMap = {
    'E001': '数据文件不存在，创建初始文件',
    'E002': '数据文件内容为空，重新写入初始文件',
    'E003': '数据文件格式错误，重新写入初始文件',
    'E004': '读取数据文件时发生其他错误',
    'E005': '保存数据文件时发生错误',
    'E006': '配置文件不存在，使用默认配置',
    'E007': '配置文件内容不正确或不可读，使用默认配置',
    'E008': '配置文件不可写，无法保存随机密钥',
    'E009': '无法创建初始数据文件'
};

// 配置 winston 日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}][${level}][${message}]`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/db_core_error.log', level: 'error', maxsize: 100 * 1024 * 1024 }),
        new winston.transports.File({ filename: 'logs/db_core_combined.log', maxsize: 100 * 1024 * 1024 })
    ]
});
// 配置文件路径
const configFilePath = 'config.ini';

// 默认配置
const defaultConfig = {
    db: {
        encrypt: true,
        encryptionMethod: 'whole',
        secretKey: null
    }
};

// 读取配置文件
function readConfig() {
    try {
        const configData = fs.readFileSync(configFilePath, 'utf-8');
        const parsedConfig = ini.parse(configData);
        return {
            encrypt: parsedConfig.db && parsedConfig.db.encrypt === 'yes' ? true : false,
            encryptionMethod: parsedConfig.db && parsedConfig.db.encryptionMethod || 'whole',
            secretKey: parsedConfig.db && parsedConfig.db.secretKey
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info('E006');
        } else {
            logger.info('E007');
        }
        return defaultConfig.db;
    }
}

const config = readConfig();
const isEncrypted = config.encrypt;

const encryptionMethod = config.encryptionMethod;

// 生成随机密钥
function generateRandomKey() {
    return crypto.randomBytes(32).toString('hex');
}

// 如果没有传入密钥且配置文件中也没有密钥，则生成一个新的随机密钥并尝试保存到配置文件中
function ensureSecretKey(secretKey) {
    if (!secretKey && !config.secretKey) {
        const newSecretKey = generateRandomKey();
        try {
            let existingConfig = {};
            if (fs.existsSync(configFilePath)) {
                const configData = fs.readFileSync(configFilePath, 'utf-8');
                existingConfig = ini.parse(configData);
            }
            existingConfig.db = existingConfig.db || {};
            existingConfig.db.secretKey = newSecretKey;
            fs.writeFileSync(configFilePath, ini.stringify(existingConfig));
            return newSecretKey;
        } catch (error) {
            logger.error('E008', { error });
        }
    }
    return secretKey || config.secretKey;
}

// 生成随机初始化向量
function generateIV() {
    return crypto.randomBytes(16);
}

// 加密函数
function encryptData(data, secretKey) {
    const iv = generateIV();
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + encrypted;
}

// 解密函数
function decryptData(encryptedData, secretKey) {
    try {
        const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
        const encrypted = encryptedData.slice(32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        logger.error('解密失败:', { error, encryptedData, secretKey });
        throw error;
    }
}

// 只加密字段值
function encryptFields(data, secretKey) {
    if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
            return data.map(item => encryptFields(item, secretKey));
        }
        const encryptedObj = {};
        for (const [key, value] of Object.entries(data)) {
            if (key === 'id') {
                // 如果是 id 字段，不进行加密，直接使用原始值
                encryptedObj[key] = value;
            } else if (typeof value === 'string') {
                encryptedObj[key] = encryptData(value, secretKey);
            } else {
                encryptedObj[key] = encryptFields(value, secretKey);
            }
        }
        return encryptedObj;
    }
    return data;
}

// 只解密字段值
function decryptFields(data, secretKey) {
    if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
            return data.map(item => decryptFields(item, secretKey));
        }
        const decryptedObj = {};
        for (const [key, value] of Object.entries(data)) {
            if (key === 'id') {
                // 如果是 id 字段，直接使用原始值
                decryptedObj[key] = value;
            } else if (typeof value === 'string') {
                decryptedObj[key] = decryptData(value, secretKey);
            } else {
                decryptedObj[key] = decryptFields(value, secretKey);
            }
        }
        return decryptedObj;
    }
    return data;
}

class JsonDB {
    // JsonDB.js 中的构造函数
    constructor(filePath, secretKey) {
        this.secretKey = ensureSecretKey(secretKey);
        this.filePath = path.join(__dirname, filePath);
        try {
            this.data = this.loadData();
        } catch (error) {
            logger.error('E003', { error });
            this.data = [];
        }
    }

    loadData() {
        try {
            if (!fs.existsSync(this.filePath)) {
                logger.info('E001');
                this.createInitialFile();
                return [];
            }

            const fileData = fs.readFileSync(this.filePath, 'utf8');
            if (isEncrypted) {
                if (encryptionMethod === 'whole') {
                    const decrypted = decryptData(fileData, this.secretKey);
                    if (decrypted.trim() === '') {
                        logger.info('E002');
                        this.createInitialFile();
                        return [];
                    }
                    return JSON.parse(decrypted);
                } else {
                    return decryptFields(JSON.parse(fileData), this.secretKey);
                }
            }

            if (fileData.trim() === '') {
                logger.info('E002');
                this.createInitialFile();
                return [];
            }

            return JSON.parse(fileData);
        } catch (error) {
            if (error instanceof SyntaxError) {
                logger.error('E003', { error });
                try {
                    this.createInitialFile();
                    return [];
                } catch (createError) {
                    logger.error('E009', { createError });
                    throw createError;
                }
            }
            logger.error('E004', { error });
            return [];
        }
    }

    createInitialFile() {
        const initialData = '[]';
        const encrypted = isEncrypted ? (encryptionMethod === 'whole' ? encryptData(initialData, this.secretKey) : JSON.stringify(encryptFields(JSON.parse(initialData), this.secretKey))) : initialData;
        try {
            fs.writeFileSync(this.filePath, encrypted, 'utf8');
        } catch (error) {
            logger.error('E009', { error });
            throw error;
        }
    }

    saveData() {
        try {
            let dataToSave;
            if (isEncrypted) {
                if (encryptionMethod === 'whole') {
                    dataToSave = encryptData(JSON.stringify(this.data, null, 2), this.secretKey);
                } else {
                    dataToSave = JSON.stringify(encryptFields(this.data, this.secretKey));
                }
            } else {
                dataToSave = JSON.stringify(this.data, null, 2);
            }
            fs.writeFileSync(this.filePath, dataToSave, 'utf8');
        } catch (error) {
            logger.error('E005', { error });
        }
    }
}

module.exports = { encryptData, decryptData, JsonDB,logMessageMap };