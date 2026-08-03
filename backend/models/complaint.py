from datetime import datetime

from models import db


class Complaint(db.Model):
    """
    Complaint model — represents a civic issue reported by a citizen
    (e.g. pothole, garbage, broken streetlight) and tracked through
    to resolution by staff/admins.
    """

    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)

    # pending / in_progress / resolved / rejected
    status = db.Column(db.String(20), default="pending", nullable=False)

    # e.g. road, water, electricity, sanitation, other
    category = db.Column(db.String(50), nullable=True)

    # Optional location info for the reported issue
    address = db.Column(db.String(255), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)

    # Path to an uploaded photo of the issue (handled by services/image_service.py)
    image_path = db.Column(db.String(255), nullable=True)

    # Link back to the citizen who filed this complaint
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)

    VALID_STATUSES = ("pending", "in_progress", "resolved", "rejected")

    def update_status(self, new_status):
        """Update status safely, stamping resolved_at when resolved."""
        if new_status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: {new_status}")

        self.status = new_status
        if new_status == "resolved":
            self.resolved_at = datetime.utcnow()

    def to_dict(self):
        """Serialize the complaint for JSON API responses."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "category": self.category,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "image_path": self.image_path,
            "image_url": f"/uploads/{self.image_path}" if self.image_path else None,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }

    def __repr__(self):
        return f"<Complaint {self.id} '{self.title}' ({self.status})>"
