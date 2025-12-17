from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)
DB_NAME = "city_puzzle.db"
FRAGMENT_COST = 10 

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row # 讓資料可以用欄位名稱存取
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    # 建立包含所有欄位的表格
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
    print("--- 資料庫初始化成功 ---")

if not os.path.exists(DB_NAME):
    init_db()
else:
    init_db()

# --- 路由 ---
@app.route("/")
def index(): return render_template("index.html")
@app.route("/login")
def login(): return render_template("login.html")
@app.route("/register")
def register(): return render_template("register.html")
@app.route("/home")
def home(): return render_template("home.html") 
@app.route("/game")
def game_hub(): return render_template("game.html")  
@app.route("/game/1")
def game1(): return render_template("game1.html")
@app.route("/game/2")
def game2(): return render_template("game2.html")
@app.route("/game/3")
def game3(): return render_template("game3.html")
@app.route("/game/4")
def game4(): return render_template("game4.html")
@app.route("/game/5")
def game5(): return render_template("game5.html")
@app.route("/ranking")
def ranking(): return render_template("ranking.html")
@app.route("/puzzle")
def puzzle_page(): return render_template("puzzle_select.html") 

# --- API ---

@app.route('/api/register', methods=['POST'])
def register_api():
    data = request.json
    print(f"[Register] 收到註冊請求: {data}") 
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''INSERT INTO users 
                     (username, password, avatar_id, total_fragments, current_fragments, progress_id) 
                     VALUES (?, ?, ?, 0, 0, 0)''', 
                  (data['username'], data['password'], data.get('avatar_id', 1)))
        conn.commit()
        conn.close()
        print(f"[Register] 註冊成功: {data['username']}")
        return jsonify({'status': 'success', 'message': '註冊成功'})
    except sqlite3.IntegrityError:
        print("[Register] 失敗: 帳號重複")
        return jsonify({'status': 'error', 'message': '該帳號已被註冊'})
    except Exception as e:
        print(f"[Register] 錯誤: {e}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/login', methods=['POST'])
def login_api():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    print(f"[Login] 嘗試登入: {username}")

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()

    if user:
        if user['password'] == password:
            print(f"[Login] 成功: {username}")
            return jsonify({
                'status': 'success', 
                'message': '登入成功', 
                'username': user['username'],
                'avatar_id': user['avatar_id'],
                'total_fragments': user['total_fragments'],     
                'current_fragments': user['current_fragments'], 
                'progress_id': user['progress_id']
            })
        else:
            print("[Login] 失敗: 密碼錯誤")
            return jsonify({'status': 'wrong_password', 'message': '密碼錯誤'})
    else:
        print("[Login] 失敗: 找不到帳號")
        return jsonify({'status': 'user_not_found', 'message': '帳號不存在'})

@app.route('/api/game_complete', methods=['POST'])
def game_complete():
    data = request.json
    username = data.get('username')
    fragments = int(data.get('fragments', 0)) 
    
    if not username:
        return jsonify({'status': 'success', 'message': 'Guest mode'})

    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''UPDATE users 
                     SET total_fragments = total_fragments + ?,
                         current_fragments = current_fragments + ?
                     WHERE username = ?''', 
                  (fragments, fragments, username))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'added': fragments})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route("/api/ranking", methods=['GET'])
def get_ranking_data():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT username, total_fragments, avatar_id FROM users ORDER BY total_fragments DESC LIMIT 10")
    data = c.fetchall()
    conn.close()

    result = []
    for i, row in enumerate(data):
        result.append({
            "rank": i + 1,
            "name": row['username'],
            "total_score": row['total_fragments'],
            "avatar_id": row['avatar_id']
        })
    return jsonify(result)

@app.route("/api/puzzle_progress", methods=['GET'])
def get_puzzle_progress():
    username = request.args.get('username')
    if not username: return jsonify({'status': 'error'})

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT total_fragments, current_fragments, progress_id, avatar_id FROM users WHERE username=?", (username,))
    user = c.fetchone()
    conn.close()

    if user:
        return jsonify({
            'status': 'success',
            'total_fragments': user['total_fragments'],
            'current_fragments': user['current_fragments'],
            'progress_id': user['progress_id'],
            'avatar_id': user['avatar_id'],
            'cost': FRAGMENT_COST
        })
    return jsonify({'status': 'error'})

@app.route("/api/unlock_puzzle", methods=['POST'])
def unlock_puzzle():
    data = request.json
    username = data.get('username')
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT current_fragments, progress_id FROM users WHERE username=?", (username,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        return jsonify({'status': 'error'})
        
    current = user['current_fragments']
    pid = user['progress_id']

    if pid >= 16:
        conn.close()
        return jsonify({'status': 'fail', 'message': '已全部解鎖'})

    if current < FRAGMENT_COST:
        conn.close()
        return jsonify({'status': 'fail', 'message': '碎片不足'})
        
    c.execute('''UPDATE users 
                 SET current_fragments = current_fragments - ?, 
                     progress_id = progress_id + 1 
                 WHERE username = ?''', 
              (FRAGMENT_COST, username))
    conn.commit()
    conn.close()
    
    return jsonify({
        'status': 'success', 
        'message': '解鎖成功！',
        'new_fragments': current - FRAGMENT_COST,
        'new_progress_id': pid + 1
    })

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8003)