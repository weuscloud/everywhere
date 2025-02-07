const express = require('express');
const fs = require('fs');
const path = require('path');
const ini = require('ini');

const app = express();
const port = parseInt(process.argv[2], 10) || 3000;
app.use(express.static('public'));
// 读取 config.ini 文件
const configFilePath = path.join(__dirname, 'config.ini');
const config = ini.parse(fs.readFileSync(configFilePath, 'utf-8'));

// 定义 /wifi 路由
app.get('/list', (req, res) => {
    const wifiList = [];
    // 遍历 config 对象
    for (const ssid in config) {
        const password = config[ssid].password;
        // 生成二维码文件名
        const qrCodeFileName = `${ssid}_qrcode.png`;
        // 将每个 Wi-Fi 的信息添加到 wifiList 数组中
        wifiList.push({
            ssid,
            qrCodeFileName,
            password
        });
    }

    // 返回包含所有 Wi-Fi 信息的响应
    res.json({
        code: 200,
        wifiList
    });
});
// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});