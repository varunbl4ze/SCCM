import os


class Config:
    """
    Application configuration settings.
    Extend this class with environment-specific configs
    (DevelopmentConfig, ProductionConfig, etc.) as the project grows.
    """

    # SQLite database configuration
    SQLALCHEMY_DATABASE_URI = "sqlite:///civic.db"

    # Disable SQLAlchemy event system (saves memory, avoids warnings)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Secret key used for sessions, tokens, etc.
    # In production, load this from an environment variable instead.
    SECRET_KEY = os.environ.get("SECRET_KEY", "civic-complaint-secret-key")

    # Folder where uploaded complaint images/files will be stored
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

    # Image upload constraints
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB max upload size

    # ------------------------------------------------------------------
    # Email / SMTP settings (used by services/notification.py)
    # Fill these in with real values (e.g. via environment variables) when
    # you're ready to send real emails. Until then, MAIL_SUPPRESS_SEND=True
    # means notifications are printed to the console instead of sent —
    # handy for local development, since no SMTP server is required.
    # ------------------------------------------------------------------
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "no-reply@civiccomplaints.local")

    # Set to False (or set env var MAIL_SUPPRESS_SEND=false) once real
    # MAIL_USERNAME / MAIL_PASSWORD are configured and you want emails to
    # actually go out.
    MAIL_SUPPRESS_SEND = os.environ.get("MAIL_SUPPRESS_SEND", "true").lower() == "true"
