// static/js/puzzle_select.js

document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("logged_in_username");

  // UI 元素
  const userInfoDisplay = document.getElementById("username-display");
  const fragDisplay = document.getElementById("current-fragments");
  const unlockBtn = document.getElementById("unlock-button");
  const costDisplay = document.getElementById("cost-display");
  const costSpan = document.getElementById("cost");
  const messageP = document.getElementById("message");

  // 地標分段：每 4 塊完成一張
  const LANDMARKS = [
    { id: "landmark-101", min: 4 },
    { id: "landmark-eiffel", min: 8 },
    { id: "landmark-liberty", min: 12 },
    { id: "landmark-pyramid", min: 16 },
  ];

  // ========== 0. 登入檢查 ==========
  if (!username) {
    alert("請先登入！");
    window.location.href = "/login";
    return;
  }
  if (userInfoDisplay) userInfoDisplay.textContent = username;

  // ========== 1. 保證初始狀態「全灰階」 ==========
  // 目的：避免載入 API 前短暫露出彩色（或 overlay 被意外隱藏）
  function forceInitialGrayscale() {
    // 初始先把所有拼圖塊隱藏
    document.querySelectorAll(".puzzle-piece").forEach((piece) => {
        piece.classList.remove("unlocked");
    });
}

  // ========== 2. 更新視覺：拼圖塊 + 灰階遮罩 ==========
  function updatePuzzleVisuals(unlockedCount) {
  // 依 progress_id 決定每一塊要不要顯示
  document.querySelectorAll(".puzzle-piece").forEach((piece) => {
    const pid = parseInt(piece.dataset.progressId, 10);
    if (pid <= unlockedCount) {
      piece.classList.add("unlocked");   // 顯示彩色 1/4
    } else {
      piece.classList.remove("unlocked"); // 隱藏
    }
    });
}

  // ========== 3. 更新按鈕狀態 ==========
  function updateUnlockButton({ progress_id, current_fragments, cost }) {
    if (!unlockBtn) return;

    if (progress_id >= 16) {
      unlockBtn.disabled = true;
      unlockBtn.textContent = "🎉 已全部完成";
      unlockBtn.style.backgroundColor = "#555";
      return;
    }

    if (current_fragments < cost) {
      unlockBtn.disabled = true;
      unlockBtn.textContent = `碎片不足 (持有: ${current_fragments})`;
      unlockBtn.style.backgroundColor = "#555";
      return;
    }

    unlockBtn.disabled = false;
    unlockBtn.textContent = `點擊解鎖下一塊 (花費 ${cost} 碎片)`;
    unlockBtn.style.backgroundColor = "#ffcc00";
  }

  // ========== 4. 載入狀態 ==========
  async function loadStatus() {
    try {
      if (messageP) messageP.textContent = "";

      const res = await fetch(
        `/api/puzzle_progress?username=${encodeURIComponent(username)}`
      );
      const data = await res.json();

      if (data.status !== "success") {
        if (messageP) messageP.textContent = data.message || "載入失敗";
        return;
      }

      // 更新錢包/成本顯示
      if (fragDisplay) fragDisplay.textContent = data.current_fragments ?? 0;

      const cost = data.cost ?? 10;
      if (costDisplay) costDisplay.textContent = cost;
      if (costSpan) costSpan.textContent = cost;

      // 更新拼圖視覺
      const unlockedCount = data.progress_id ?? 0;
      updatePuzzleVisuals(unlockedCount);

      // 更新按鈕狀態
      updateUnlockButton({
        progress_id: unlockedCount,
        current_fragments: data.current_fragments ?? 0,
        cost,
      });
    } catch (e) {
      console.error(e);
      if (messageP) messageP.textContent = "載入失敗（連線錯誤）";
    }
  }

  // ========== 5. 解鎖按鈕 ==========
  if (unlockBtn) {
    unlockBtn.addEventListener("click", async () => {
      try {
        unlockBtn.disabled = true;

        const res = await fetch("/api/unlock_puzzle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        const result = await res.json();

        if (result.status === "success") {
          // 你想要彈窗就留著
          alert(result.message || "解鎖成功！");
          await loadStatus();
        } else {
          alert(result.message || "解鎖失敗");
          // 解鎖失敗時也要恢復按鈕狀態（重新載入以同步 cost/frag）
          await loadStatus();
        }
      } catch (e) {
        console.error(e);
        alert("連線錯誤");
        await loadStatus();
      }
    });
  }

  // ========== 啟動 ==========
  forceInitialGrayscale(); // 先確保一開始全灰
  loadStatus();            // 再去抓 API 更新狀態
});