document.addEventListener("DOMContentLoaded", function() {
    
    let currentAvatarId = null;
    const registerBtn = document.getElementById('btn-register');
    const avatarOptions = document.querySelectorAll('.avatar-option');

    // 1. 點擊頭像時的處理
    avatarOptions.forEach(option => {
        option.addEventListener('click', function() {
            // 先移除所有人身上的 .selected 樣式
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            
            // 幫自己加上 .selected
            this.classList.add('selected');
            
            // 抓取 data-id，這樣我們就知道選了哪張圖
            currentAvatarId = this.getAttribute('data-id');
            console.log("已選擇頭像 ID:", currentAvatarId);
        });
    });

    // 2. 點擊註冊按鈕
    registerBtn.addEventListener('click', doRegister);

    async function doRegister() {
        const user = document.getElementById('reg-username').value;
        const pass = document.getElementById('reg-password').value;

        // 檢查欄位與頭像是否都有填
        if (!user || !pass) {
            alert("請輸入帳號與密碼！");
            return;
        }

        if (!currentAvatarId) {
            alert("請點擊上方格子，選擇一個頭像！");
            return;
        }

        try {
            // 向後端發送請求
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: user, 
                    password: pass, 
                    avatar_id: currentAvatarId 
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                alert("註冊成功！歡迎加入，請重新登入。");
                window.location.href = '/login'; 
            } else {
                alert("註冊失敗: " + result.message); 
            }
        } catch (error) {
            console.error("Register Error:", error);
            alert("後端未回應 (預覽模式無法寫入資料庫)");
        }
    }
});