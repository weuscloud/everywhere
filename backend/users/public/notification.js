// 获取通知容器
const notificationContainer = document.getElementById('notification-container');

// 显示通知的函数
function showNotification(message, type='success') {
    // 创建一个新的通知元素
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;

    // 将通知添加到容器中
    notificationContainer.appendChild(notification);

    // 显示通知
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // 3 秒后隐藏通知
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notificationContainer.removeChild(notification);
        }, 300);
    }, 3000);
}