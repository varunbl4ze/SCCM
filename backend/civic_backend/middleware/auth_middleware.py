"""
middleware/auth_middleware.py

Single source of truth for JWT creation/verification and role-based
access control (RBAC). Both the citizen-facing auth routes and the
admin routes import from here, so there is exactly one place that
knows how a token is signed and verified.

Two decorators are exported:
    @token_required   -> any logged-in user (citizen or admin)
    @admin_required   -> logged-in user AND role == "admin"

Both inject the authenticated User as the first positional argument
to the wrapped view function.
"""

from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import request, jsonify, current_app

from models.user import User


def generate_token(user):
    """Create a signed JWT for the given user, valid for 24 hours."""
    payload = {
        "user_id": user.id,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=24),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def _decode_token_from_request():
    """
    Shared logic: pull the bearer token off the Authorization header,
    decode it, and load the corresponding User.

    Returns (user, error_response) — exactly one of the two is None.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

    token = auth_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"error": "Token has expired, please log in again"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"error": "Invalid token"}), 401)

    user = User.query.get(payload["user_id"])
    if not user:
        return None, (jsonify({"error": "User no longer exists"}), 401)

    return user, None


def token_required(f):
    """
    Decorator for any authenticated route (citizen or admin).
    Expects header: Authorization: Bearer <token>
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = _decode_token_from_request()
        if error:
            return error
        return f(user, *args, **kwargs)

    return decorated


def admin_required(f):
    """
    Decorator for admin-only routes. Requires a valid token AND
    role == "admin". This is the enforcement point for every
    /api/admin/* endpoint — the frontend hiding admin links from
    citizens is a UX nicety, this decorator is the actual security
    boundary.

    A citizen with a perfectly valid token gets a 403, not a 401 —
    401 means "we don't know who you are", 403 means "we know who
    you are, and you're not allowed here".
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = _decode_token_from_request()
        if error:
            return error

        if user.role != "admin":
            return jsonify({"error": "Admin privileges required for this action"}), 403

        return f(user, *args, **kwargs)

    return decorated
