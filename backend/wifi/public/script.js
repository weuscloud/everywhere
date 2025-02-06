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
                const {ssid,qrCodeFileName}=d;
                // 处理单个WiFi信息
                const wifi = {
                    ssid,
                    qrCodeFileName
                };
                createQRCodeItem(wifi);
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

    const caption = document.createElement('p');
    caption.textContent = `WiFi名称: ${wifi.ssid}`;

    const downloadButton = document.createElement('button');
    downloadButton.textContent = '下载二维码';
    downloadButton.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = wifi.qrCodeFileName;
        a.click();
    });

    listItem.appendChild(img);
    listItem.appendChild(caption);
    listItem.appendChild(downloadButton);
    qrCodeList.appendChild(listItem);
}

// 调用函数获取WiFi信息
getWiFiInfo();