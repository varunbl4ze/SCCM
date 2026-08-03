from datetime import datetime

from werkzeug.security import generate_password_hash, check_password_hash

from models import db


class User(db.Model):
    """
    User model for citizens, staff, and admins using the
    Civic Complaint Management System.
    """

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)

    # citizen / admin / staff
    role = db.Column(db.String(20), default="citizen", nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One user can file many complaints.
    # `backref="user"` lets a Complaint instance access its owner via
    # `complaint.user`, without needing a matching column on Complaint itself.
    complaints = db.relationship(
        "Complaint",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def set_password(self, raw_password):
        """Hash and store the given plaintext password."""
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        """Verify a plaintext password against the stored hash."""
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        """Serialize the user for JSON API responses (excludes password)."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.id} {self.email} ({self.role})>"
