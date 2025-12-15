document.addEventListener('DOMContentLoaded', () => {
    const registerBtn = document.getElementById('btn-register');
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    let selectedAvatarId = 1; 

    // 頭像選擇
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatarId = option.dataset.id;
        });
    });

    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                alert("請輸入帳號與密碼");
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        avatar_id: selectedAvatarId
                    })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    alert("註冊成功！請登入。");
                    window.location.href = "/login"; 
                } else {
                    alert(`註冊失敗：${data.message}`);
                }
            } catch (error) {
                console.error("Register Error:", error);
                alert("伺服器連線錯誤");
            }
        });
    }
});