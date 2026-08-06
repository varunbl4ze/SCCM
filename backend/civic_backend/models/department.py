from datetime import datetime

from models import db


class Department(db.Model):
    """
    A civic department that complaints can be routed to
    (e.g. Roads & Infrastructure, Sanitation, Electricity, Water Supply).
    Managed exclusively through the admin panel.
    """

    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Complaints assigned to this department
    complaints = db.relationship("Complaint", backref="department", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "complaint_count": len(self.complaints),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Department {self.id} {self.name}>"
