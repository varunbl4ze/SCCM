from flask import Blueprint, request, jsonify

from models import db
from models.user import User
from services.notification import notify_registration_welcome
from middleware.auth_middleware import generate_token, token_required

auth_bp = Blueprint("auth", __name__)


# ----------------------------------------------------------------------
# Routes — unchanged behavior from before; token logic now lives in
# middleware/auth_middleware.py so routes/admin.py can reuse it.
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

    notify_registration_welcome(user)

    token = generate_token(user)

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict(),
        "token": token,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Log in an existing user — works identically for citizens and admins.
    The frontend decides where to redirect based on user.role in the
    response; the backend doesn't branch here at all.

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


@auth_bp.route("/me", methods=["PATCH"])
@token_required
def update_me(current_user):
    """
    Update the current user's own name/phone. Works identically for
    citizens and admins — editing your own profile isn't role-specific
    logic, so both panels' profile pages call this same endpoint rather
    than duplicating it.

    Expects JSON body (either or both fields):
    { "name": "New Name", "phone": "9876543210" }
    """
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        current_user.name = name

    if "phone" in data:
        current_user.phone = data["phone"] or None

    db.session.commit()
    return jsonify(current_user.to_dict()), 200


@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    """
    Change the current user's own password. Requires the correct current
    password, same as any normal account-security flow.

    Expects JSON body:
    { "current_password": "...", "new_password": "..." }
    """
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400

    if not current_user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 401

    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    current_user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password updated successfully"}), 200
