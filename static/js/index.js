document.addEventListener("DOMContentLoaded", function() {
    console.log("Story Page Loaded");

    // 鍵盤監聽：按空白鍵或 Enter 也可以跳過
    document.addEventListener('keydown', function(event) {
        if (event.code === 'Space' || event.code === 'Enter') {
            // 注意：這裡配合您目前的測試模式，跳轉到 login.html
            window.location.href = "login.html";
        }
    });
});