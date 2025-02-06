const baseUrl =`${location.href}users`;
const userTableBody = document.getElementById('user-table-body');
const addButton = document.getElementById('add-button');
const refreshButton = document.getElementById('refresh-button');
const formModal = document.getElementById('form-modal');
const closeModal = document.querySelector('.close');
const userForm = document.getElementById('user-form');
const modalTitle = document.getElementById('modal-title');
const userIdInput = document.getElementById('user-id');

// 关闭模态框
closeModal.addEventListener('click', () => {
    formModal.style.display = 'none';
});

// 打开添加用户模态框
addButton.addEventListener('click', () => {
    modalTitle.textContent = 'Add User';
    userIdInput.value = '';
    userForm.reset();
    formModal.style.display = 'block';
});

// 刷新数据
refreshButton.addEventListener('click', () => {
    fetchUsers();
});

// 提交表单
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userIdInput.value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;
    const avatarURL = document.getElementById('user-avatar-url').value;
    const is2FAEnabled = document.getElementById('user-2fa-enabled').checked;

    const data = {
        name,
        password,
        avatarURL,
        is2FAEnabled
    };

    if (id) {
        // 更新用户
        try {
            const response = await fetch(`${baseUrl}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                formModal.style.display = 'none';
                fetchUsers();
                // 显示成功通知
                showNotification('User updated successfully', 'success');
            } else {
                const errorData = await response.json();
                // 显示失败通知
                showNotification(`Error updating user: ${errorData.message} (Code: ${errorData.code})`, 'error');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            // 显示失败通知
            showNotification('Error updating user', 'error');
        }
    } else {
        // 添加用户
        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                formModal.style.display = 'none';
                fetchUsers();
                // 显示成功通知
                showNotification('User added successfully', 'success');
            } else {
                const errorData = await response.json();
                // 显示失败通知
                showNotification(`Error adding user: ${errorData.message} (Code: ${errorData.code})`, 'error');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            // 显示失败通知
            showNotification('Error adding user', 'error');
        }
    }
});

// 删除用户
function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user?')) {
        fetch(`${baseUrl}/${id}`, {
            method: 'DELETE'
        })
           .then(async response => {
                if (response.ok) {
                    fetchUsers();
                    // 显示成功通知
                    showNotification('User deleted successfully', 'success');
                } else {
                    const errorData = await response.json();
                    // 显示失败通知
                    showNotification(`Error deleting user: ${errorData.message} (Code: ${errorData.code})`, 'error');
                }
            })
           .catch(error => {
                console.error('Error deleting user:', error);
                // 显示失败通知
                showNotification('Error deleting user', 'error');
            });
    }
}

// 编辑用户
function editUser(id, name, password, avatarURL, is2FAEnabled) {
    modalTitle.textContent = 'Edit User';
    userIdInput.value = id;
    document.getElementById('user-name').value = name;
    document.getElementById('user-password').value = password;
    document.getElementById('user-avatar-url').value = avatarURL;
    document.getElementById('user-2fa-enabled').checked = is2FAEnabled;
    formModal.style.display = 'block';
}

// 获取所有用户
async function fetchUsers() {
    try {
        const response = await fetch(baseUrl);
        const data = await response.json();
        userTableBody.innerHTML = '';
        data.data.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.password}</td>
                <td>${user.avatarURL}</td>
                <td>${user.is2FAEnabled}</td>
                <td>
                    <button onclick="editUser('${user.id}', '${user.name}', '${user.password}', '${user.avatarURL}', ${user.is2FAEnabled})">Edit</button>
                    <button onclick="deleteUser('${user.id}')">Delete</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        // 显示失败通知
        showNotification('Error fetching users', 'error');
    }
}

// 页面加载时获取用户数据
fetchUsers();