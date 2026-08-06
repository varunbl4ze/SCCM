from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import Blueprint, request, jsonify, current_app

from models import db
from models.user import User

auth_bp = Blueprint("auth_bp", __name__)


# ----------------------------------------------------------------------
# Token helpers
# ----------------------------------------------------------------------

def generate_token(user):
    """Create a signed JWT for the given user, valid for 24 hours."""
    payload = {
        "user_id": user.id,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=24),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def token_required(f):
    """
    Decorator for protected routes. Expects header:
        Authorization: Bearer <token>
    Injects the authenticated User as `current_user` (first positional arg).
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            payload = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        current_user = User.query.get(payload["user_id"])
        if not current_user:
            return jsonify({"error": "User no longer exists"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user.
    Expects JSON body:
    {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "password": "strongpassword",
        "phone": "9876543210",   (optional)
        "role": "citizen"        (optional, defaults to "citizen")
    }
    """
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "name, email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "A user with this email already exists"}), 409

    user = User(
        name=name,
        email=email,
        phone=data.get("phone"),
        role=data.get("role", "citizen"),
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = generate_token(user)

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict(),
        "token": token,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Log in an existing user.
    Expects JSON body:
    {
        "email": "jane@example.com",
        "password": "strongpassword"
    }
    """
    data = request.get_json(silent=True) or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = generate_token(user)

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict(),
        "token": token,
    }), 200


@auth_bp.route("/me", methods=["GET"])
@token_required
def me(current_user):
    """
    Return the currently authenticated user's profile.
    Requires header: Authorization: Bearer <token>
    """
    return jsonify(current_user.to_dict()), 200
