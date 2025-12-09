from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3

app = Flask(__name__)
DB_NAME = "city_puzzle.db"

# -------------------------
# 資料庫初始化 (保持不變)
# -------------------------
def init_db():
    """初始化資料庫：建立 users 表格"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # id: 主鍵, username: 帳號, password: 密碼, avatar_id: 頭像編號
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
# 頁面路由 (保持不變)
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

@app.route("/home")
def home():
    return render_template("home.html") 

@app.route("/game")
def game_hub():
    return render_template("game.html")  

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

@app.route("/game/5")
def game5():
    return render_template("game5.html")
    
@app.route("/ranking")
def ranking():
    return render_template("ranking.html")

# 新增：拼圖收集頁面路由
@app.route("/puzzle")
def puzzle_page():
    return render_template("puzzle_select.html") 

# -------------------------
# API 邏輯 (Login, Register, High Score, Ranking) (保持不變)
# -------------------------

@app.route('/api/login', methods=['POST'])
def login_api():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()

    if user:
        if user[2] == password:
            return jsonify({
                'status': 'success', 
                'message': '登入成功', 
                'username': user[1],
                'avatar_id': user[3],
                'total_fragments': user[4],
                'current_fragments': user[5],
                'score': user[5],
                'progress_id': user[6]
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
        c.execute('''INSERT INTO users 
                     (username, password, avatar_id, total_fragments, current_fragments, progress_id) 
                     VALUES (?, ?, ?, 0, 0, 0)''', 
                  (data['username'], data['password'], data['avatar_id']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': '註冊成功'})
    except sqlite3.IntegrityError:
        return jsonify({'status': 'error', 'message': '該帳號已被註冊'})

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

@app.route("/api/ranking", methods=['GET'])
def get_ranking_data():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT username, total_fragments, avatar_id FROM users ORDER BY total_fragments DESC LIMIT 10")
    data = c.fetchall()
    conn.close()

    real_ranking_data = []
    for row in data:
        real_ranking_data.append({
            "name": row[0],
            "account": row[0],
            "score": row[1],
            "avatar_id": row[2]
        })
    
    return jsonify(real_ranking_data)

# -------------------------
# 拼圖收集頁 API (修改: 新增邏輯來處理碎片和進度更新)
# -------------------------

# 全局變數來定義解鎖邏輯
FRAGMENT_COST = 1000 # 每塊拼圖所需的碎片數

@app.route("/api/puzzle_progress", methods=['GET'])
def get_puzzle_progress():
    """根據帳號獲取玩家當前的進度和碎片數"""
    username = request.args.get('username')
    
    if not username:
        return jsonify({'status': 'error', 'message': '需要提供帳號'}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 抓取 progress_id (6) 和 current_fragments (5)
    c.execute("SELECT current_fragments, progress_id FROM users WHERE username=?", (username,))
    user_data = c.fetchone()
    conn.close()

    if user_data:
        return jsonify({
            'status': 'success',
            'current_fragments': user_data[0], # 目前可用的碎片數 (對應分數)
            'progress_id': user_data[1]       # 目前解鎖進度 (0~16)
        })
    else:
        return jsonify({'status': 'user_not_found', 'message': '找不到該使用者'}), 404

# 新增 API: 用於解鎖下一塊拼圖
@app.route("/api/unlock_puzzle", methods=['POST'])
def unlock_puzzle():
    """消費碎片並將玩家的 progress_id 增加 1"""
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({'status': 'error', 'message': '需要提供帳號'}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 1. 獲取當前數據
    c.execute("SELECT current_fragments, progress_id FROM users WHERE username=?", (username,))
    user_data = c.fetchone()
    
    if not user_data:
        conn.close()
        return jsonify({'status': 'error', 'message': '找不到使用者'}), 404
        
    current_fragments = user_data[0]
    progress_id = user_data[1]

    # 2. 檢查是否滿足解鎖條件
    MAX_PROGRESS = 16
    if progress_id >= MAX_PROGRESS:
        conn.close()
        return jsonify({'status': 'fail', 'message': '已完成所有拼圖'}), 200
        
    if current_fragments < FRAGMENT_COST:
        conn.close()
        return jsonify({'status': 'fail', 'message': f'碎片不足，需要 {FRAGMENT_COST} 碎片'}), 200
        
    # 3. 執行解鎖
    new_fragments = current_fragments - FRAGMENT_COST
    new_progress_id = progress_id + 1
    
    c.execute('''UPDATE users 
                 SET current_fragments = ?, progress_id = ? 
                 WHERE username = ?''', 
              (new_fragments, new_progress_id, username))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'status': 'success', 
        'message': f'成功解鎖第 {new_progress_id} 塊拼圖！',
        'new_fragments': new_fragments,
        'new_progress_id': new_progress_id
    })

if __name__ == "__main__":
    app.run(debug=True)