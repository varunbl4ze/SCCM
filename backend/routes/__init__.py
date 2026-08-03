from flask import Flask
from flask_cors import CORS

from routes.auth import auth
from routes.complaint import complaint



def create_app():

    app = Flask(__name__)

    # Allow Vercel frontend
    CORS(app, origins=[
        "https://sccm-sable.vercel.app"
    ])

    # Register routes
    app.register_blueprint(auth, url_prefix="/auth")
    app.register_blueprint(complaint, url_prefix="/complaints")
    

    return app