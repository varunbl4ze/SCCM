"""
routes/admin.py

All routes here are mounted under /api/admin/* (see app.py) and every
single one is wrapped in @admin_required (middleware/auth_middleware.py).
That decorator is the actual security boundary: it requires a valid JWT
AND role == "admin", returning 403 otherwise. The admin frontend hiding
its own nav links from citizens is just a UX nicety on top of this —
never the other way around.
"""

from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

from models import db
from models.user import User
from models.complaint import Complaint
from models.department import Department
from middleware.auth_middleware import admin_required
from services.notification import send_email

admin_bp = Blueprint("admin", __name__)


# ======================================================================
# DASHBOARD OVERVIEW
# ======================================================================

@admin_bp.route("/overview", methods=["GET"])
@admin_required
def overview(current_admin):
    """High-level stats for the admin dashboard landing page."""
    total_complaints = Complaint.query.count()
    total_users = User.query.filter_by(role="citizen").count()
    total_departments = Department.query.count()

    status_counts = {
        status: Complaint.query.filter_by(status=status).count()
        for status in Complaint.VALID_STATUSES
    }

    recent = (
        Complaint.query.order_by(Complaint.created_at.desc()).limit(5).all()
    )

    return jsonify({
        "total_complaints": total_complaints,
        "total_citizens": total_users,
        "total_departments": total_departments,
        "status_counts": status_counts,
        "recent_complaints": [c.to_dict() for c in recent],
    }), 200


# ======================================================================
# COMPLAINT MANAGEMENT, ASSIGNMENT & STATUS UPDATES
# ======================================================================

@admin_bp.route("/complaints", methods=["GET"])
@admin_required
def list_all_complaints(current_admin):
    """
    List every complaint in the system (citizens only ever see their own,
    via /api/complaints/?user_id=... — this is the admin-wide view).
    Supports the same filters plus department/assignment filters.
    """
    query = Complaint.query

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)

    department_id = request.args.get("department_id", type=int)
    if department_id:
        query = query.filter_by(department_id=department_id)

    unassigned_only = request.args.get("unassigned") == "true"
    if unassigned_only:
        query = query.filter(Complaint.assigned_admin_id.is_(None))

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify([c.to_dict() for c in complaints]), 200


@admin_bp.route("/complaints/<int:complaint_id>/assign", methods=["PATCH"])
@admin_required
def assign_complaint(current_admin, complaint_id):
    """
    Assign a complaint to a department and/or a specific admin.
    Expects JSON body (either or both fields):
    { "department_id": 2, "assigned_admin_id": 5 }
    """
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    data = request.get_json(silent=True) or {}

    if "department_id" in data:
        dept_id = data["department_id"]
        if dept_id is not None and not Department.query.get(dept_id):
            return jsonify({"error": f"No department with id {dept_id}"}), 404
        complaint.department_id = dept_id

    if "assigned_admin_id" in data:
        admin_id = data["assigned_admin_id"]
        if admin_id is not None:
            assignee = User.query.get(admin_id)
            if not assignee or assignee.role not in ("admin", "staff"):
                return jsonify({"error": "assigned_admin_id must belong to an admin or staff user"}), 400
        complaint.assigned_admin_id = admin_id

    db.session.commit()
    return jsonify(complaint.to_dict()), 200


@admin_bp.route("/complaints/<int:complaint_id>/status", methods=["PATCH"])
@admin_required
def admin_update_status(current_admin, complaint_id):
    """
    Admin-side status update — functionally the same transition rules as
    the citizen-created complaint's own status route, but sitting behind
    admin_required so it's clearly part of the protected admin surface
    and notifies the citizen the same way.
    """
    from services.notification import notify_status_change

    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "status is required"}), 400

    old_status = complaint.status
    try:
        complaint.update_status(new_status)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db.session.commit()

    if old_status != complaint.status:
        notify_status_change(complaint, complaint.user, old_status)

    return jsonify(complaint.to_dict()), 200


# ======================================================================
# USER MANAGEMENT
# ======================================================================

@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_users(current_admin):
    """List all users. Optional ?role=citizen|admin|staff filter."""
    query = User.query
    role = request.args.get("role")
    if role:
        query = query.filter_by(role=role)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users]), 200


@admin_bp.route("/users/<int:user_id>/role", methods=["PATCH"])
@admin_required
def change_user_role(current_admin, user_id):
    """
    Promote/demote a user. Expects JSON body: { "role": "admin" }
    Valid roles: citizen, staff, admin.
    An admin cannot demote themselves (prevents accidentally locking
    every admin out of the panel).
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}
    new_role = data.get("role")

    if new_role not in ("citizen", "staff", "admin"):
        return jsonify({"error": "role must be one of: citizen, staff, admin"}), 400

    if user.id == current_admin.id and new_role != "admin":
        return jsonify({"error": "You cannot remove your own admin privileges"}), 400

    user.role = new_role
    db.session.commit()
    return jsonify(user.to_dict()), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(current_admin, user_id):
    """Delete a user account. An admin cannot delete their own account."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.id == current_admin.id:
        return jsonify({"error": "You cannot delete your own account"}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"User {user_id} deleted"}), 200


# ======================================================================
# DEPARTMENT MANAGEMENT
# ======================================================================

@admin_bp.route("/departments", methods=["GET"])
@admin_required
def list_departments(current_admin):
    departments = Department.query.order_by(Department.name).all()
    return jsonify([d.to_dict() for d in departments]), 200


@admin_bp.route("/departments", methods=["POST"])
@admin_required
def create_department(current_admin):
    """Expects JSON body: { "name": "Sanitation", "description": "..." }"""
    data = request.get_json(silent=True) or {}
    name = data.get("name")

    if not name:
        return jsonify({"error": "name is required"}), 400

    if Department.query.filter_by(name=name).first():
        return jsonify({"error": f"A department named '{name}' already exists"}), 409

    department = Department(name=name, description=data.get("description"))
    db.session.add(department)
    db.session.commit()
    return jsonify(department.to_dict()), 201


@admin_bp.route("/departments/<int:department_id>", methods=["PATCH"])
@admin_required
def update_department(current_admin, department_id):
    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Department not found"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        department.name = data["name"]
    if "description" in data:
        department.description = data["description"]

    db.session.commit()
    return jsonify(department.to_dict()), 200


@admin_bp.route("/departments/<int:department_id>", methods=["DELETE"])
@admin_required
def delete_department(current_admin, department_id):
    department = Department.query.get(department_id)
    if not department:
        return jsonify({"error": "Department not found"}), 404

    # Unassign any complaints pointed at this department rather than
    # cascading deletes into complaint records.
    for complaint in department.complaints:
        complaint.department_id = None

    db.session.delete(department)
    db.session.commit()
    return jsonify({"message": f"Department {department_id} deleted"}), 200


# ======================================================================
# ANALYTICS & REPORTS
# ======================================================================

@admin_bp.route("/analytics", methods=["GET"])
@admin_required
def analytics(current_admin):
    """Aggregated data for the admin analytics/reports page."""
    status_counts = {
        status: Complaint.query.filter_by(status=status).count()
        for status in Complaint.VALID_STATUSES
    }

    categories = db.session.query(
        Complaint.category, db.func.count(Complaint.id)
    ).group_by(Complaint.category).all()
    category_counts = {(cat or "uncategorized"): count for cat, count in categories}

    departments = db.session.query(
        Department.name, db.func.count(Complaint.id)
    ).outerjoin(Complaint, Complaint.department_id == Department.id).group_by(Department.name).all()
    department_counts = {name: count for name, count in departments}

    # Average resolution time (in hours) for resolved complaints
    resolved = Complaint.query.filter_by(status="resolved").filter(
        Complaint.resolved_at.isnot(None)
    ).all()
    if resolved:
        total_hours = sum(
            (c.resolved_at - c.created_at).total_seconds() / 3600 for c in resolved
        )
        avg_resolution_hours = round(total_hours / len(resolved), 1)
    else:
        avg_resolution_hours = None

    # Complaints filed in the last 7 days, per day (simple trend line)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent = Complaint.query.filter(Complaint.created_at >= seven_days_ago).all()
    daily_counts = {}
    for c in recent:
        day = c.created_at.strftime("%Y-%m-%d")
        daily_counts[day] = daily_counts.get(day, 0) + 1

    return jsonify({
        "status_counts": status_counts,
        "category_counts": category_counts,
        "department_counts": department_counts,
        "avg_resolution_hours": avg_resolution_hours,
        "daily_counts_last_7_days": daily_counts,
    }), 200


# ======================================================================
# NOTIFICATIONS (admin-triggered)
# ======================================================================

@admin_bp.route("/notifications/send", methods=["POST"])
@admin_required
def send_notification(current_admin):
    """
    Send an ad-hoc email notification to a specific citizen.
    Expects JSON body: { "user_id": 3, "subject": "...", "message": "..." }
    Reuses the same send_email() used by the automatic notifications.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    subject = data.get("subject")
    message = data.get("message")

    if not user_id or not subject or not message:
        return jsonify({"error": "user_id, subject and message are required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    sent = send_email(subject, user.email, message)
    if not sent:
        return jsonify({"error": "Failed to send notification"}), 502

    return jsonify({"message": f"Notification sent to {user.email}"}), 200
