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

    # Enable CORS so the Flutter mobile app (or any client)
    # can communicate with this backend across origins.
    CORS(app, origins=[
    "https://sccm-sable.vercel.app"
])

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
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(complaint_bp, url_prefix="/api/complaints")
    # ------------------------------------------------------------------

    @app.route("/", methods=["GET"])
    def index():
        return jsonify({"message": "Complaint Backend Running"})

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
