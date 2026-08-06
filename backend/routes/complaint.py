from flask import Blueprint, request, jsonify, current_app

from models import db
from models.complaint import Complaint
from models.user import User
from services.image_service import save_complaint_image, delete_complaint_image
from services.notification import notify_complaint_filed, notify_status_change

complaint_bp = Blueprint("complaint", __name__)


@complaint_bp.route("/", methods=["POST"])
def create_complaint():
    """
    Create a new complaint.
    Expects JSON body:
    {
        "title": "Broken streetlight",
        "description": "Streetlight on Main St has been off for a week",
        "user_id": 1,
        "category": "electricity",      (optional)
        "address": "Main St",           (optional)
        "latitude": 12.97,              (optional)
        "longitude": 77.59              (optional)
    }
    """
    data = request.get_json(silent=True) or {}

    title = data.get("title")
    description = data.get("description")
    user_id = data.get("user_id")

    if not title or not description or not user_id:
        return jsonify({"error": "title, description and user_id are required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": f"No user found with id {user_id}"}), 404

    complaint = Complaint(
        title=title,
        description=description,
        user_id=user_id,
        category=data.get("category"),
        address=data.get("address"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
    )

    db.session.add(complaint)
    db.session.commit()

    notify_complaint_filed(complaint, user)

    return jsonify(complaint.to_dict()), 201


@complaint_bp.route("/", methods=["GET"])
def list_complaints():
    """
    List complaints. Supports optional query params for filtering:
    GET /api/complaints/?status=pending
    GET /api/complaints/?user_id=1
    GET /api/complaints/?category=electricity
    """
    query = Complaint.query

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    user_id = request.args.get("user_id", type=int)
    if user_id:
        query = query.filter_by(user_id=user_id)

    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify([c.to_dict() for c in complaints]), 200


@complaint_bp.route("/<int:complaint_id>", methods=["GET"])
def get_complaint(complaint_id):
    """Fetch a single complaint by id."""
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify(complaint.to_dict()), 200


@complaint_bp.route("/<int:complaint_id>", methods=["PUT", "PATCH"])
def update_complaint(complaint_id):
    """
    Update editable fields on a complaint (title, description, category,
    address, latitude, longitude). Does NOT change status here — use
    the dedicated /status endpoint below for that.
    """
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    data = request.get_json(silent=True) or {}

    for field in ("title", "description", "category", "address", "latitude", "longitude"):
        if field in data:
            setattr(complaint, field, data[field])

    db.session.commit()
    return jsonify(complaint.to_dict()), 200


@complaint_bp.route("/<int:complaint_id>/status", methods=["PATCH"])
def update_complaint_status(complaint_id):
    """
    Update just the status of a complaint.
    Expects JSON body: { "status": "in_progress" }
    Valid values: pending, in_progress, resolved, rejected
    """
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


@complaint_bp.route("/<int:complaint_id>/image", methods=["POST"])
def upload_complaint_image(complaint_id):
    """
    Upload (or replace) the photo for a complaint.
    Expects multipart/form-data with a single field named "image".

    curl -X POST http://127.0.0.1:5000/api/complaints/1/image \
      -F "image=@/path/to/photo.jpg"
    """
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    if "image" not in request.files:
        return jsonify({"error": "No 'image' file part in the request"}), 400

    file = request.files["image"]

    try:
        filename = save_complaint_image(
            file,
            current_app.config["UPLOAD_FOLDER"],
            current_app.config["ALLOWED_IMAGE_EXTENSIONS"],
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Remove the old photo (if any) now that the new one has saved successfully
    if complaint.image_path:
        delete_complaint_image(complaint.image_path, current_app.config["UPLOAD_FOLDER"])

    complaint.image_path = filename
    db.session.commit()

    return jsonify({
        "message": "Image uploaded successfully",
        "image_url": f"/uploads/{filename}",
        "complaint": complaint.to_dict(),
    }), 200


@complaint_bp.route("/<int:complaint_id>", methods=["DELETE"])
def delete_complaint(complaint_id):
    """Delete a complaint by id."""
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    db.session.delete(complaint)
    db.session.commit()
    return jsonify({"message": f"Complaint {complaint_id} deleted"}), 200
