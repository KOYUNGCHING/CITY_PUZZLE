# 專案名稱：CITY_PUZZLE — 城市復興拼圖遊戲

City Puzzle 是一款以「重建世界城市」為主題的互動式解謎遊戲。
玩家透過小遊戲蒐集拼圖碎片、合成大拼圖、解鎖四大國家的首都，
逐步讓原本灰暗崩壞的城市恢復活力。

玩家推進進度時，各國的首都會從 廢墟 → 完整、美麗 的場景中逐步變化，
並可同時累積分數、參與全球排名。

本專案使用 Flask + HTML + CSS + JavaScript 製作
可互動的網頁遊戲原型，並採用模組化架構便於多人協作與系統擴充。


## 專案目的（Project Goals）
	•	呈現城市從「破壞 → 重建」的視覺轉換體驗
	•	設計四大國家與首都的解鎖機制
	•	完成拼圖碎片蒐集與合成系統
	•	透過 Flask 建立後端 API（城市狀態、拼圖狀態、玩家進度）
	•	建立一個乾淨、模組化、易於合作與維護的專案架構



## 遊戲核心玩法（Game Mechanism）
	1.	收集拼圖碎片
        玩家透過遊戲內互動、任務或按鈕取得「小拼圖」。

	2.	合成大拼圖碎片
        多個小碎片可以合成大碎片。

	3.	完成大拼圖解鎖城市
        四片大拼圖後可解鎖某國的首都。

	4.	城市從灰色廢墟 → 彩色復興
        玩家完成拼圖後，對應城市會從灰暗破敗狀態變為完整、美麗的場景。

	5.	四國完成 → 通關
        全部國家恢復後遊戲結束，顯示全球重建成功的畫面。
        
    6.  累積分數排名
        玩家累積遊戲點數，可進入排行榜比拼。

## 遊戲角色（International Rescue Squad）

本遊戲內有一支救援小隊：
	年齡層：1 位 40 歲隊長 + 3 位 20 歲隊員 + 2 位 戰地記者
    不同角色頭貼供玩家選擇


## 專案架構（Project Structure）

```bash
CITY_PUZZLE/
│── app.py                  # Flask 主程式
│── README.md               # 專案說明文件
│── requirements.txt        # 需要安裝的 Python 套件
│── .gitignore              # 避免上傳不必要的檔案
│
├── templates/              # Flask 模板頁面
│   ├── base.html           # 共用頁面框架
│   ├── index.html          # 首頁（城市廢墟 → 復興入口）
│   ├── game.html           # 遊戲主畫面（拼圖界面）
│   └── about.html          # 世界觀與角色介紹
│
├── static/                 # 靜態資源
│   ├── css/
│   │   └── style.css       # 遊戲 UI 與設計風格
│   ├── js/
│   │   └── game.js         # 拼圖邏輯、互動事件
│   └── img/
│       ├── city_ruin/      # 城市破敗狀態圖片
│       ├── city_alive/     # 城市復興後彩色圖片
│       └── ui/             # 介面素材（按鈕、Icon、Logo）
```






##  技術使用

- Python 3.10
- Flask
- HTML / CSS / JavaScript（前端遊戲視覺與互動）

##  如何啟動專案

1. 建立虛擬環境：
```bash
python -m venv venv
```
2. 啟動虛擬環境：
Mac 用：
```bash
source venv/bin/activate  
```
Windows 用：
```bash
venv\Scripts\activate
```

3. 安裝依賴套件：
```bash
pip install -r requirements.txt
```

4. 執行主程式：
```bash
python app.py
```

