"""
create_admin.py

One-off script to create an admin user in the existing database.
Uses the project's own app factory (create_app) and the existing
User model — does NOT create a new database or model, and does NOT
run db.create_all() (the app factory already handles that).

Usage:
    python create_admin.py
    python create_admin.py --name "Admin User" --email admin@civic.com --password "StrongPass123"

If --email/--password aren't passed, you'll be prompted for them
interactively (password entry is hidden via getpass).
"""

import argparse
import getpass
import sys

from app import create_app
from models import db
from models.user import User


def create_admin(name, email, password, phone=None):
    """
    Create an admin user if one doesn't already exist with this email.
    Reuses User.set_password() so hashing is identical to normal
    registration (Werkzeug's generate_password_hash under the hood).
    """
    existing = User.query.filter_by(email=email).first()

    if existing:
        if existing.role == "admin":
            print(f"An admin with email '{email}' already exists (id={existing.id}). Nothing to do.")
        else:
            print(
                f"A user with email '{email}' already exists (id={existing.id}, "
                f"role='{existing.role}'). Refusing to overwrite — "
                f"promote them manually if that's what you intend, e.g.:\n"
                f"  user = User.query.filter_by(email='{email}').first()\n"
                f"  user.role = 'admin'\n"
                f"  db.session.commit()"
            )
        return None

    admin = User(name=name, email=email, phone=phone, role="admin")
    admin.set_password(password)  # Werkzeug generate_password_hash, via models/user.py

    db.session.add(admin)
    db.session.commit()

    print(f"Admin user created: id={admin.id}, email={admin.email}")
    return admin


def parse_args():
    parser = argparse.ArgumentParser(description="Create an admin user for the Civic Complaint Management System.")
    parser.add_argument("--name", help="Admin's display name")
    parser.add_argument("--email", help="Admin's login email")
    parser.add_argument("--password", help="Admin's password (omit to be prompted securely instead)")
    parser.add_argument("--phone", help="Optional phone number", default=None)
    return parser.parse_args()


def main():
    args = parse_args()

    name = args.name or input("Admin name: ").strip()
    email = args.email or input("Admin email: ").strip()
    password = args.password or getpass.getpass("Admin password: ")

    if not name or not email or not password:
        print("Name, email, and password are all required.", file=sys.stderr)
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    app = create_app()
    with app.app_context():
        create_admin(name=name, email=email, password=password, phone=args.phone)


if __name__ == "__main__":
    main()
