from datetime import datetime
from flask_login import UserMixin

from app import db, bcrypt, login_manager


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


class User(db.Model, UserMixin):

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(
        db.String(30),
        unique=True,
        nullable=False
    )

    email_address = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(200),
        nullable=False
    )

    messages = db.relationship(
        "Message",
        backref="user",
        lazy=True
    )
    custom_prompt = db.Column(db.Text, nullable=True)
    stream_ai = db.Column(db.Boolean, default=True)
    code_highlight = db.Column(db.Boolean, default=True)
    email_reminders = db.Column(db.Boolean, default=False)

    @property
    def is_admin(self):
        # 🔑 CHANGE THIS TO YOUR EXACT ADMIN USERNAME OR EMAIL!
        return self.username.lower() == 'habeeb'

    @property
    def password(self):
        raise AttributeError("Password is not readable.")

    @password.setter
    def password(self, plain_text_password):
        self.password_hash = bcrypt.generate_password_hash(
            plain_text_password
        ).decode("utf-8")

    def check_password_correction(self, attempted_password):
        return bcrypt.check_password_hash(
            self.password_hash,
            attempted_password
        )


class Message(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False
    )

    role = db.Column(db.String(20), nullable=False)

    content = db.Column(db.Text, nullable=True)

    image_path = db.Column(db.String(500), nullable=True)

    file_path = db.Column(db.String(500), nullable=True)

    file_name = db.Column(db.String(255), nullable=True)

    file_type = db.Column(db.String(100), nullable=True)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )