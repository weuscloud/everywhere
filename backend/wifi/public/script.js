const qrCodeList = document.getElementById('qr-code-list');
// 从服务器获取WiFi信息
async function getWiFiInfo() {
    try {
        const response = await fetch(`${location.href}list`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.code === 200) {
            for (const d of data['wifiList']) {
                createQRCodeItem(d);
            }
        }


    } catch (error) {
        console.error('获取WiFi信息时出错:', error);
    }
}

// 生成二维码列表项
function createQRCodeItem(wifi) {
    const listItem = document.createElement('li');
    listItem.classList.add('qr-code-item');

    const img = document.createElement('img');
    img.src = `./${wifi.qrCodeFileName}`;
    img.alt = `${wifi.ssid} WiFi二维码`;

    const infoContainer = document.createElement('div');
    infoContainer.classList.add('wifi-info-container');

    // 创建 WIFI 名称的 label 和 input
    const ssidLabel = document.createElement('label');
    ssidLabel.textContent = 'WIFI名称：';
    const ssidInput = document.createElement('input');
    ssidInput.type = 'text';
    ssidInput.value = wifi.ssid;
    ssidInput.readOnly = true;
    ssidLabel.appendChild(ssidInput);

    // 创建 WIFI 密码的 label 和 input
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'WIFI密码：';
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.value = wifi.password;
    passwordInput.readOnly = true;
    passwordInput.classList.add('password-input'); // 添加样式类
    passwordInput.addEventListener('click', () => {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
        } else {
            passwordInput.type = 'password';
        }
    });
    passwordLabel.appendChild(passwordInput);

    infoContainer.appendChild(ssidLabel);
    infoContainer.appendChild(passwordLabel);

    const downloadButton = document.createElement('button');
    downloadButton.textContent = '下载二维码';
    downloadButton.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = wifi.qrCodeFileName;
        a.click();
    });

    listItem.appendChild(img);
    listItem.appendChild(infoContainer);
    listItem.appendChild(downloadButton);
    qrCodeList.appendChild(listItem);
}
// 调用函数获取WiFi信息
getWiFiInfo();