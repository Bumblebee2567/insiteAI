from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_migrate import Migrate  # <--- 1. Import Flask-Migrate
from datetime import timedelta

db = SQLAlchemy()
bcrypt = Bcrypt()
login_manager = LoginManager()
migrate = Migrate()  # <--- 2. Instantiate Migrate

app = Flask(__name__)

app.config["SECRET_KEY"] = "efb27ddd02c14feb02fe072025c917c9d6bf53dffc3841fcabf1807af0676318"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///insight.db"
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
bcrypt.init_app(app)
login_manager.init_app(app)
migrate.init_app(app, db)  # <--- 3. Initialize Migrate with app and db

login_manager.login_view = "login_page"
login_manager.login_message_category = "info"

@app.after_request
def add_cross_origin_headers(response):
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

from app import models
from app import routes
