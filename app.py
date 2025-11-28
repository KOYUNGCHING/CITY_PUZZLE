from flask import Flask, render_template, redirect, url_for, jsonify

app = Flask(__name__)

# 模擬的積分排名數據 (供 ranking.html 的 JS 呼叫)
MOCK_RANKING_DATA = [
    {"name": "戰地記者W", "account": "press_w", "score": 12500},
    {"name": "鷹眼偵探", "account": "eye007", "score": 9800},
    {"name": "暗夜追蹤者", "account": "dark_tracker", "score": 8500},
    {"name": "真相守護者", "account": "truth_guard", "score": 7200},
    # 更多數據...
]
MOCK_RANKING_DATA.sort(key=lambda x: x['score'], reverse=True)


# -------------------------
# 基本頁面路由

@app.route("/")
def index():
    # 初始入口，您可以選擇導向登入頁面
    return redirect(url_for("login")) 


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/home")
def home():
    # 這是您設計的「四角 UI」主頁
    # 確保您之前的 index.html 內容被放在這裡的 templates/home.html
    return render_template("home.html")   


# -------------------------
# 小遊戲系統
# -------------------------

@app.route("/game")
def game_hub():
    # 小遊戲選單頁
    return render_template("game_hub.html")  


@app.route("/game/1")
def game1():
    return render_template("game1.html")

# ... 其他遊戲路由保持不變


# -------------------------
# 成績 / 排行榜
# -------------------------

@app.route("/ranking")
def ranking():
    # 排名頁面
    return render_template("ranking.html")

@app.route("/api/ranking", methods=['GET'])
def get_ranking_data():
    # 供前端 JS 獲取排名數據
    return jsonify(MOCK_RANKING_DATA)

# -------------------------
# 主程式入口
# -------------------------

if __name__ == "__main__":
    app.run(debug=True)