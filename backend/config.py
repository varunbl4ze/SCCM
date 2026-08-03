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
