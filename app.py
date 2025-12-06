from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3

app = Flask(__name__)
DB_NAME = "city_puzzle.db"

# -------------------------
# 資料庫初始化 (已修改為您指定的新欄位)
# -------------------------
def init_db():
    """初始化資料庫：建立 users 表格"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 修改：根據您的需求更新了欄位
    # id: 主鍵
    # username: 帳號
    # password: 密碼
    # avatar_id: 頭像編號
    # total_fragments: 累積獲得的拼圖碎片 (排行榜用)
    # current_fragments: 目前持有的拼圖碎片 (可消費用)
    # progress_id: 目前解鎖進度 (0~16)
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT UNIQUE, 
                  password TEXT, 
                  avatar_id INTEGER,
                  total_fragments INTEGER DEFAULT 0,
                  current_fragments INTEGER DEFAULT 0,
                  progress_id INTEGER DEFAULT 0)''')
    
    conn.commit()
    conn.close()
    print("資料庫連線成功 (City Puzzle DB) - Schema Updated。")

init_db()

# -------------------------
# 你的頁面路由 (Story, Login, Register)
# -------------------------

@app.route("/")
def index():
    """故事頁 (Story Page)"""
    return render_template("index.html")

@app.route("/login")
def login():
    """登入頁 (Login Page)"""
    return render_template("login.html")

@app.route("/register")
def register():
    """註冊頁 (Register Page)"""
    return render_template("register.html")

# -------------------------
# 你的 API 邏輯 (Login, Register) - 已配合新資料庫修改
# -------------------------

@app.route('/api/login', methods=['POST'])
def login_api():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # 抓取所有新欄位資料
    c.execute("SELECT * FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()

    if user:
        # DB欄位順序: 0:id, 1:username, 2:password, 3:avatar_id, 4:total_fragments, 5:current_fragments, 6:progress_id
        if user[2] == password:
            return jsonify({
                'status': 'success', 
                'message': '登入成功', 
                'username': user[1],
                'avatar_id': user[3],
                'total_fragments': user[4],    # 累積碎片
                'current_fragments': user[5],  # 目前碎片 (可用於前端顯示分數)
                'score': user[5],              # 保留 score 欄位回傳 (對應 current_fragments) 以免舊 JS 報錯
                'progress_id': user[6]         # 解鎖進度
            })
        else:
            return jsonify({'status': 'wrong_password', 'message': '密碼錯誤'})
    else:
        return jsonify({'status': 'user_not_found', 'message': '帳號不存在'})

@app.route('/api/register', methods=['POST'])
def register_api():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        # 註冊時，碎片與進度都預設為 0
        c.execute('''INSERT INTO users 
                     (username, password, avatar_id, total_fragments, current_fragments, progress_id) 
                     VALUES (?, ?, ?, 0, 0, 0)''', 
                  (data['username'], data['password'], data['avatar_id']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': '註冊成功'})
    except sqlite3.IntegrityError:
        return jsonify({'status': 'error', 'message': '該帳號已被註冊'})

# -------------------------
# 夥伴的頁面路由 (Home, Games) - 保持原樣
# -------------------------

@app.route("/home")
def home():
    return render_template("home.html") 

@app.route("/game")
def game_hub():
    return render_template("game_hub.html")  

@app.route("/game/1")
def game1():
    return render_template("game1.html")

@app.route("/game/2")
def game2():
    return render_template("game2.html")

@app.route("/game/3")
def game3():
    return render_template("game3.html")

@app.route("/game/4")
def game4():
    return render_template("game4.html")

# -------------------------
# 夥伴的貪吃蛇遊戲 API (Game 3) - 保持原樣
# -------------------------

HIGH_SCORE_DATA = { "score": 0, "player": "N/A" }

@app.route("/api/highscore", methods=['GET'])
def get_high_score():
    return jsonify(HIGH_SCORE_DATA)

@app.route("/api/submit_score", methods=['POST'])
def submit_score():
    data = request.get_json()
    new_score = data.get('score', 0)
    player_name = data.get('player', 'Guest')
    global HIGH_SCORE_DATA
    
    if new_score > HIGH_SCORE_DATA["score"]:
        HIGH_SCORE_DATA["score"] = new_score
        HIGH_SCORE_DATA["player"] = player_name
        return jsonify({"message": "New high score!", "new_high_score": new_score}), 200
    else:
        return jsonify({"message": "Not a high score."}), 200

# -------------------------
# 成績 / 排行榜 (使用真實 DB 數據) - 已修正對應新欄位
# -------------------------

@app.route("/ranking")
def ranking():
    return render_template("ranking.html")

@app.route("/api/ranking", methods=['GET'])
def get_ranking_data():
    """從資料庫抓取真實的前 10 名玩家資料"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 修改：排行榜應該依照「累積獲得的碎片 (total_fragments)」來排序
    c.execute("SELECT username, total_fragments, avatar_id FROM users ORDER BY total_fragments DESC LIMIT 10")
    data = c.fetchall()
    conn.close()

    # 轉換成夥伴前端需要的 JSON 格式
    real_ranking_data = []
    for row in data:
        real_ranking_data.append({
            "name": row[0],      # 顯示名稱
            "account": row[0],   # 帳號
            "score": row[1],     # 這裡回傳 total_fragments 給排行榜顯示
            "avatar_id": row[2]  # 頭像ID
        })
    
    return jsonify(real_ranking_data)

if __name__ == "__main__":
    app.run(debug=True)