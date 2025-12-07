document.addEventListener("DOMContentLoaded", function() {
    
    const loginBtn = document.getElementById('btn-login');

    // 綁定點擊事件
    loginBtn.addEventListener('click', doLogin);

    // 綁定 Enter 鍵事件 (在密碼框按 Enter 也可登入)
    document.getElementById('password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doLogin();
    });

    async function doLogin() {
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        if(!user || !pass) {
            alert("請輸入帳號與密碼");
            return;
        }

        try {
            // 注意：如果直接打開 html 檔案，這裡會報錯，因為沒有後端 server
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            
            const result = await response.json();

            if (result.status === 'success') {
                // 登入成功
                localStorage.setItem('username', user);
                localStorage.setItem('avatar_id', result.avatar_id);
                localStorage.setItem('score', result.score);
                
                // 導向主頁
                window.location.href = '/home'; 
                
            } else if (result.status === 'wrong_password') {
                alert("提示：密碼錯誤");
                document.getElementById('password').value = ''; 
                
            } else if (result.status === 'user_not_found') {
                alert("查無此帳號，將為您導向註冊頁面...");
                // 導向註冊頁
                window.location.href = '/register';
            }

        } catch (error) {
            console.error("Login Error:", error);
            alert("目前為預覽模式，或後端未啟動，無法進行實際登入驗證。");
        }
    }
});