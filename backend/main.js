const { spawn } = require('child_process');
const fs = require('fs');
const ini = require('ini');
const path = require('path');

// 读取并解析 INI 配置文件
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));

// 遍历配置项，启动每个服务作为子进程
Object.keys(config).forEach((serviceName) => {
    const file = config[serviceName].entry;
    const port = config[serviceName].port;

    // 确保 file 只是文件名，不包含多余路径信息
    const fileName = path.basename(file);

    // 获取脚本文件所在的目录
    const scriptDir = path.dirname(path.join(__dirname, file));

    // 启动子进程，并指定工作目录
    const child = spawn('node', [fileName, port], { cwd: scriptDir });

    // 监听子进程的标准输出
    child.stdout.on('data', (data) => {
        console.log(`[${serviceName}] ${data.toString()}`);
    });

    // 监听子进程的标准错误输出
    child.stderr.on('data', (data) => {
        console.error(`[${serviceName}] ${data.toString()}`);
    });

    // 监听子进程的关闭事件
    child.on('close', (code) => {
        console.log(`[${serviceName}] Process exited with code ${code}`);
    });
});