from flask_migrate import Migrate
from app import app
from app import db

# Initialize migrate alongside db
migrate = Migrate(app, db)
