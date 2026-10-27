from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import (
    Length,
    EqualTo,
    Email,
    DataRequired,
    ValidationError
)

from app.models import User


class RegisterForm(FlaskForm):

    username = StringField(
        "Username",
        validators=[
            DataRequired(message="Username is required."),
            Length(
                min=2,
                max=30,
                message="Username must be between 2 and 30 characters."
            )
        ]
    )

    email_address = StringField(
        "Email Address",
        validators=[
            DataRequired(message="Email address is required."),
            Email(message="Please enter a valid email address.")
        ]
    )

    password1 = PasswordField(
        "Password",
        validators=[
            DataRequired(message="Password is required."),
            Length(
                min=6,
                message="Password must be at least 6 characters long."
            )
        ]
    )

    password2 = PasswordField(
        "Confirm Password",
        validators=[
            DataRequired(message="Please confirm your password."),
            EqualTo(
                "password1",
                message="Passwords do not match."
            )
        ]
    )

    submit = SubmitField("Create Account")

    # Check if username already exists
    def validate_username(self, username):
        existing_user = User.query.filter_by(
            username=username.data
        ).first()

        if existing_user:
            raise ValidationError(
                "That username is already taken."
            )

    # Check if email already exists
    def validate_email_address(self, email_address):
        existing_email = User.query.filter_by(
            email_address=email_address.data
        ).first()

        if existing_email:
            raise ValidationError(
                "An account already exists with this email."
            )


class LoginForm(FlaskForm):

    username = StringField(
        "Username",
        validators=[
            DataRequired(
                message="Please enter your username."
            )
        ]
    )

    password = PasswordField(
        "Password",
        validators=[
            DataRequired(
                message="Please enter your password."
            )
        ]
    )

    submit = SubmitField("Sign In")