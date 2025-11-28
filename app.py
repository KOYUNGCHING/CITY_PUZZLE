from flask import Flask, render_template, redirect, url_for, jsonify, request # 🚨 修正：新增 request

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

# 新增：貪吃蛇遊戲的最高分數據 (在真實應用中應使用資料庫)
HIGH_SCORE_DATA = {
    "score": 0,
    "player": "N/A"
}


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
    # 這是您設計的「四角 UI」主頁 (模板名稱應為 home.html)
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

@app.route("/game/2")
def game2():
    return render_template("game2.html")

# 修正/新增：貪吃蛇遊戲頁面 (使用 game3.html)
@app.route("/game/3")
def game3():
    return render_template("game3.html")

@app.route("/game/4")
def game4():
    return render_template("game4.html")


# 新增：API 路由 - 取得最高分 (供 /game/3 的 JS 呼叫)
@app.route("/api/highscore", methods=['GET'])
def get_high_score():
    """返回貪吃蛇遊戲當前的最高分數"""
    return jsonify(HIGH_SCORE_DATA)

# 新增：API 路由 - 提交新分數 (供 /game/3 的 JS 呼叫)
@app.route("/api/submit_score", methods=['POST'])
def submit_score():
    """接收貪吃蛇遊戲提交的新分數，如果高於現有分數則更新"""
    data = request.get_json()
    new_score = data.get('score', 0)
    player_name = data.get('player', 'Guest')
    
    global HIGH_SCORE_DATA # 確保可以修改全域變數
    
    if new_score > HIGH_SCORE_DATA["score"]:
        HIGH_SCORE_DATA["score"] = new_score
        HIGH_SCORE_DATA["player"] = player_name
        # 返回新最高分成功的訊息
        return jsonify({"message": "New high score recorded!", "new_high_score": new_score}), 200
    else:
        # 返回未破紀錄的訊息
        return jsonify({"message": "Score is not a new high score."}), 200


# -------------------------
# 成績 / 排行榜
# -------------------------

@app.route("/ranking")
def ranking():
    # 排名頁面
    return render_template("ranking.html")

@app.route("/api/ranking", methods=['GET'])
def get_ranking_data():
    # 供前端 JS 獲取總體排名數據
    return jsonify(MOCK_RANKING_DATA)


# -------------------------
# 主程式入口
# -------------------------

if __name__ == "__main__":
    app.run(debug=True)