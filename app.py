from flask import Flask, render_template, redirect, url_for

app = Flask(__name__)


# -------------------------
# 基本頁面路由

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/home")
def home():
    return render_template("home.html")   # 你做的「四角 UI」主頁


# -------------------------
# 小遊戲系統
# -------------------------

@app.route("/game")
def game_hub():
    return render_template("game_hub.html")  # 小遊戲選單頁


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
# 成績 / 排行榜
# -------------------------

@app.route("/ranking")
def ranking():
    return render_template("ranking.html")


# -------------------------
# 主程式入口
# -------------------------

if __name__ == "__main__":
    app.run(debug=True)