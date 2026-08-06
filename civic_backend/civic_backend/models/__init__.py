from flask_sqlalchemy import SQLAlchemy

# Single shared SQLAlchemy database instance for the whole app.
# Import this `db` object in every model file (user.py, complaint.py, etc.)
# so all models are registered against the same metadata.
db = SQLAlchemy()

# Import models here so they get registered with `db` before
# db.create_all() runs in app.py. This means app.py only needs
# `from models import db` and every table still gets created.
from models.user import User          # noqa: E402, F401
from models.department import Department  # noqa: E402, F401
from models.complaint import Complaint  # noqa: E402, F401
