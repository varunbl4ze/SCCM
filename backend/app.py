from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import os

from config import Config
from models import db


def create_app():
    """
    Application factory.
    Keeps app creation isolated so it can be reused for testing
    or for running with different configs later.
    """
    app = Flask(__name__)

    # Load configuration from config.py
    app.config.from_object(Config)

    # Enable CORS so the frontend (Vercel, or any other client — including
    # the Flutter mobile app) can call this API across origins.
    #
    # Defaults to allowing every origin, which is the safest default for
    # not breaking connectivity — but once you know your real frontend
    # domain(s), set the ALLOWED_ORIGINS env var to lock it down, e.g.:
    #   ALLOWED_ORIGINS=https://sccm-sable.vercel.app,http://localhost:5500
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    origins = "*" if allowed_origins == "*" else [o.strip() for o in allowed_origins.split(",")]
    CORS(app, origins="https://sccm-sable.vercel.app", supports_credentials=True)

    # Initialize the database with this app
    db.init_app(app)

    # Create database tables if they don't exist yet.
    # (Once you add migrations, you can replace this with Flask-Migrate.)
    with app.app_context():
        db.create_all()

    # Make sure the uploads folder exists before any image upload is attempted
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # ------------------------------------------------------------------
    # Register blueprints
    # ------------------------------------------------------------------
    from routes.auth import auth_bp
    from routes.complaint import complaint_bp
    from routes.admin import admin_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(complaint_bp, url_prefix="/api/complaints")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    # ------------------------------------------------------------------

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({"message": "Civic Complaint Backend Running"})

    @app.route("/uploads/<path:filename>", methods=["GET"])
    def uploaded_file(filename):
        """
        Serve uploaded complaint images.
        A complaint's image is reachable at:
            http://<host>:<port>/uploads/<image_path from Complaint>
        This is what the frontend's image_url points to after upload.
        """
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
