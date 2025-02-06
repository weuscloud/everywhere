// http_main.js
const express = require('express');
const app = express();
const port = 3000;

// 解析 JSON 格式的请求体
app.use(express.json());
app.use(express.static('public'));

// 引入 GenericDB 类和 userModel
const {GenericDB,messageMap} = require('./db');
const userModel = require('./UserModel');

// 创建用户数据库实例
const userDB = new GenericDB('users.json', userModel);

// 通用的路由处理函数
function createRoutes(app, db, basePath) {
    // 创建记录
    app.post(basePath, (req, res) => {
        const record = req.body;
        const newRecord = db.create(record);
        if (newRecord) {
            res.json({ code: 201, message: messageMap['N001'], data: newRecord });
        } else {
            res.json({ code: 409, message: messageMap['E009'] });
        }
    });

    // 根据 ID 查找记录，返回全部字段信息
    app.get(`${basePath}/:id/full`, (req, res) => {
        const id = req.params.id;
        const record = db.findById(id);
        if (record) {
            res.json({ code: 200, message: messageMap['N002'], data: record });
        } else {
            res.json({ code: 404, message: messageMap['E006'] });
        }
    });

    // 根据 ID 查找记录
    app.get(`${basePath}/:id`, (req, res) => {
        const id = req.params.id;
        const record = db.findById(id);
        if (record) {
            res.json({ code: 200, message: messageMap['N002'], data: record });
        } else {
            res.json({ code: 404, message: messageMap['E006'] });
        }
    });

    // 更新记录，允许修改全部字段
    app.put(`${basePath}/:id`, async (req, res) => {
        const id = req.params.id;
        const updatedData = req.body;
        try {
            const success = await db.update(id, updatedData);
            if (success) {
                res.json({ code: 200, message: messageMap['N003'] });
            } else {
                res.json({ code: 404, message: messageMap['E007'] });
            }
        } catch (error) {
            res.json({ code: 500, message: messageMap['E012'] });
        }
    });

    // 删除记录
    app.delete(`${basePath}/:id`, (req, res) => {
        const id = req.params.id;
        const success = db.delete(id);
        if (success) {
            res.json({ code: 200, message: messageMap['N004'] });
        } else {
            res.json({ code: 404, message: messageMap['E006'] });
        }
    });

    // 获取所有记录
    app.get(basePath, (req, res) => {
        try {
            const allRecords = db.getAll();
            res.json({ code: 200, message: messageMap['N005'], data: allRecords });
        } catch (error) {
            res.json({ code: 500, message: messageMap['E014'] });
        }
    });
}

// 为用户数据创建路由
createRoutes(app, userDB, '/users');

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});