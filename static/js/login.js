document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('btn-login');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // 點擊事件
    if (loginBtn) {
        loginBtn.addEventListener('click', performLogin);
    }

    // Enter 鍵事件
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performLogin();
    });

    async function performLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            alert("請輸入帳號與密碼");
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.status === 'success') {
                // 登入成功：存入 LocalStorage
                localStorage.setItem('logged_in_username', data.username);
                localStorage.setItem('avatar_id', data.avatar_id);
                localStorage.setItem('total_fragments', data.total_fragments);
                
                alert(`登入成功！歡迎回来，${data.username}`);
                window.location.href = "/home";

            } else if (data.status === 'user_not_found') {
                // 找不到帳號：引導註冊
                alert("查無此帳號，請先註冊！");
                window.location.href = "/register";

            } else if (data.status === 'wrong_password') {
                // 密碼錯誤
                alert("密碼錯誤，請重試。");
                passwordInput.value = '';

            } else {
                // 其他錯誤
                alert(`登入失敗：${data.message}`);
            }

        } catch (error) {
            console.error("Login Error:", error);
            alert("伺服器連線錯誤，請確認 app.py 是否正在執行。");
        }
    }
});