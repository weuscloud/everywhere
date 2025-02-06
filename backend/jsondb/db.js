const { JsonDB } = require('./db_core');
const winston = require('winston');

const messageMap = {
    // 错误信息
    'E001': '数据库文件不存在，将创建新文件',
    'E002': '数据库文件内容为空，将初始化为空数组',
    'E003': '数据库文件内容格式不正确，将初始化为空数组',
    'E004': '加载数据时发生未知错误',
    'E005': '保存数据时出错',
    'E006': '未找到记录',
    'E007': '未找到要更新的记录',
    'E008': '在已有数据情况下不允许减少字段',
    'E009': '记录已存在',
    'E010': '创建记录时出错',
    'E011': '根据 ID 查找记录时出错',
    'E012': '更新记录时出错',
    'E013': '删除记录时出错',
    'E014': '获取所有记录时出错',
    'E015': '记录创建失败，数据验证不通过',
    'E016': '字段数量超过 10 个，无法创建或更新记录',
    'E017': '未知错误',
    // 正常信息
    'N001': '记录已创建',
    'N002': '记录已更新',
    'N003': '记录已删除',
    'N004': '已获取所有记录'
};

// 配置日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'logs/GenericDB_error.log', level: 'error', maxsize: 100 * 1024 * 1024 }),
        new winston.transports.File({ filename: 'logs/GenericDB_combined.log', maxsize: 100 * 1024 * 1024 })
    ]
});

class GenericDB {
    // 内置规则对象，包含每种类型的默认规则和默认值
    static builtInRules = {
        string: {
            type: 'string',
            length: { min: 0, max: 255 },
            default: '',
            regex: null
        },
        number: {
            type: 'number',
            default: 0
        },
        boolean: {
            type: 'boolean',
            default: false
        }
    };

    constructor(schema, secretKey) {
        const modelName = this.constructor.name;
        const defaultFilePath = `${modelName}.jsondb`;

        if (Object.keys(schema).length > 10) {
            throw new Error('E016');
        }
        this.db = new JsonDB(defaultFilePath, secretKey);
        this.schema = this.mergeRules(schema);
    }

    // 合并用户规则和内置规则的方法
    mergeRules(schema) {
        const mergedSchema = {};
        for (const field in schema) {
            const fieldConfig = schema[field];
            // 检查 fieldConfig.type 是否为 undefined
            if (fieldConfig.type === undefined) {
                fieldConfig.type = 'string';
            }
            const builtInRule = GenericDB.builtInRules[fieldConfig.type];
            if (!builtInRule) {
                throw new Error(`Invalid field type '${fieldConfig.type}' for field '${field}'`);
            }
            mergedSchema[field] = {
                ...builtInRule,
                ...fieldConfig
            };
        }
        return mergedSchema;
    }

    validate(data, allRecords = []) {
        const newData = { ...data };
        if (Object.keys(newData).length > 10) {
            return { valid: false, message: 'E015' };
        }

        for (const field in this.schema) {
            const fieldConfig = this.schema[field];
            let value = newData[field];

            if (value === undefined) {
                if ('default' in fieldConfig) {
                    value = fieldConfig.default;
                    newData[field] = value;
                } else if (fieldConfig.required) {
                    return { valid: false, message: 'E015' };
                }
            }

            if (!fieldConfig.required && (value === undefined || value === null || value === '')) {
                continue;
            }

            if (fieldConfig.required && (value === undefined || value === null)) {
                return { valid: false, message: 'E015' };
            }

            const fieldType = fieldConfig.type;
            switch (fieldType) {
                case 'string':
                    if (typeof value !== 'string') {
                        return { valid: false, message: 'E015' };
                    }
                    if (value !== '' && fieldConfig.regex) {
                        const regex = new RegExp(fieldConfig.regex);
                        if (!regex.test(value)) {
                            return { valid: false, message: 'E015' };
                        }
                    }
                    const { min, max } = fieldConfig.length;
                    if (value.length < min || value.length > max) {
                        return { valid: false, message: 'E015' };
                    }
                    break;
                case 'number':
                    if (typeof value !== 'number') {
                        return { valid: false, message: 'E015' };
                    }
                    // 验证数字长度最大为 64 位
                    const numStr = String(value).replace(/^-/, ''); // 去除负号
                    if (numStr.length > 64) {
                        return { valid: false, message: 'E015' };
                    }
                    break;
                case 'boolean':
                    if (typeof value !== 'boolean') {
                        return { valid: false, message: 'E015' };
                    }
                    break;
                default:
                    return { valid: false, message: 'E015' };
            }

            if (fieldConfig.unique) {
                const isDuplicate = allRecords.some(record => record[field] === value && record.id !== newData.id);
                if (isDuplicate) {
                    return { valid: false, message: 'E015' };
                }
            }
        }
        return { valid: true, message: '', data: newData };
    }

    create(record) {
        const allRecords = this.db.loadData();

        // 生成递增的 id
        if (!record.id) {
            const maxId = allRecords.reduce((max, current) => {
                const currentId = parseInt(current.id);
                return !isNaN(currentId) && currentId > max ? currentId : max;
            }, 0);
            record.id = (maxId + 1).toString();
        }

        // 填充默认值
        for (const key in this.schema) {
            if (!record.hasOwnProperty(key) && !this.schema[key].required) {
                record[key] = this.schema[key].default;
            }
        }

        const validationResult = this.validate(record, allRecords);
        if (!validationResult.valid) {
            logger.error(validationResult.message);
            return null;
        }

        const newRecord = validationResult.data;

        const existingRecord = allRecords.find(item => String(item.id) === String(newRecord.id));
        if (existingRecord) {
            logger.warn('E009', { recordId: newRecord.id });
            return null;
        }

        this.db.data.push(newRecord);
        this.db.saveData();
        logger.info('N001', { recordId: newRecord.id });
        return newRecord;
    }

    findById(id) {
        const allRecords = this.db.loadData();
        const record = allRecords.find(item => String(item.id) === String(id));
        if (!record) {
            logger.error('E006', { recordId: id });
        }
        return record;
    }

    update(id, updatedData) {
        const allRecords = this.db.loadData();
        const index = allRecords.findIndex(item => String(item.id) === String(id));
        if (index === -1) {
            logger.warn('E007', { id });
            return false;
        }

        const oldRecord = allRecords[index];
        const newRecord = { ...oldRecord, ...updatedData };

        const validationResult = this.validate(newRecord, allRecords);
        if (!validationResult.valid) {
            logger.error(validationResult.message);
            return false;
        }

        allRecords[index] = validationResult.data;
        this.db.data = allRecords;
        this.db.saveData();
        logger.info('N002', { recordId: id });
        return true;
    }

    delete(id) {
        const allRecords = this.db.loadData();
        const index = allRecords.findIndex(item => String(item.id) === String(id));
        if (index === -1) {
            logger.warn('E006', { id });
            return false;
        }

        allRecords.splice(index, 1);
        this.db.data = allRecords;
        this.db.saveData();
        logger.info('N003', { recordId: id });
        return true;
    }

    getAll() {
        const allRecords = this.db.loadData();
        logger.info('N004');
        return allRecords;
    }
}

module.exports = {
    GenericDB,
    messageMap
};