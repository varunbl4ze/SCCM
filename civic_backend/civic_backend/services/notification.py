"""
services/notification.py

Sends email notifications to citizens: registration welcome, complaint
filed confirmation, and status-change updates (pending -> in_progress ->
resolved/rejected).

Uses Python's built-in smtplib rather than a third-party mail library,
so it works with just the config values in config.py — no extra
dependency to install.

DEV MODE: while Config.MAIL_SUPPRESS_SEND is True (the default), emails
are printed to the console instead of actually sent, so you can build
and test the whole flow without an SMTP server. Flip it to False and
fill in MAIL_USERNAME / MAIL_PASSWORD in config.py (ideally via
environment variables) when you're ready to send real emails.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app


def send_email(subject, recipients, body, html_body=None):
    """
    Core email sender. Everything else in this file calls this.

    Args:
        subject: email subject line
        recipients: a single email string or a list of email strings
        body: plain-text body (always required, used as a fallback)
        html_body: optional HTML version of the body

    Returns:
        True if the email was sent (or suppressed in dev mode) without
        error, False if sending failed. Never raises — a failed
        notification should never crash the request that triggered it.
    """
    if isinstance(recipients, str):
        recipients = [recipients]

    sender = current_app.config["MAIL_DEFAULT_SENDER"]

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    message.attach(MIMEText(body, "plain"))
    if html_body:
        message.attach(MIMEText(html_body, "html"))

    # ---- Dev mode: no SMTP server required ---------------------------
    if current_app.config.get("MAIL_SUPPRESS_SEND", True):
        print("=" * 60)
        print(f"[DEV MODE] Email suppressed — would send to: {recipients}")
        print(f"Subject: {subject}")
        print(body)
        print("=" * 60)
        return True

    # ---- Real send via SMTP ------------------------------------------
    try:
        with smtplib.SMTP(
            current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"]
        ) as server:
            if current_app.config.get("MAIL_USE_TLS"):
                server.starttls()

            username = current_app.config.get("MAIL_USERNAME")
            password = current_app.config.get("MAIL_PASSWORD")
            if username and password:
                server.login(username, password)

            server.sendmail(sender, recipients, message.as_string())
        return True

    except Exception as e:
        # Log and swallow — a notification failure shouldn't break the
        # complaint/registration flow that triggered it.
        current_app.logger.error(f"Failed to send email to {recipients}: {e}")
        return False


# --------------------------------------------------------------------
# High-level notification helpers — call these from your routes.
# --------------------------------------------------------------------

def notify_registration_welcome(user):
    """Send a welcome email right after a citizen registers."""
    subject = "Welcome to Civic Complaint Management System"
    body = (
        f"Hi {user.name},\n\n"
        "Thanks for registering with the Civic Complaint Management System. "
        "You can now report civic issues — potholes, broken streetlights, "
        "garbage collection, and more — and track them through to resolution.\n\n"
        "— Civic Complaint Management System"
    )
    return send_email(subject, user.email, body)


def notify_complaint_filed(complaint, user):
    """Send a confirmation email right after a complaint is created."""
    subject = f"Complaint #{complaint.id} received: {complaint.title}"
    body = (
        f"Hi {user.name},\n\n"
        f"We've received your complaint:\n\n"
        f"  Title: {complaint.title}\n"
        f"  Category: {complaint.category or 'Not specified'}\n"
        f"  Status: {complaint.status}\n\n"
        "We'll notify you here as its status changes.\n\n"
        "— Civic Complaint Management System"
    )
    return send_email(subject, user.email, body)


def notify_status_change(complaint, user, old_status):
    """Send an email whenever a complaint's status changes."""
    subject = f"Complaint #{complaint.id} update: {complaint.status.replace('_', ' ').title()}"
    body = (
        f"Hi {user.name},\n\n"
        f"Your complaint \"{complaint.title}\" has moved from "
        f"'{old_status.replace('_', ' ')}' to '{complaint.status.replace('_', ' ')}'.\n\n"
        + (
            "Thanks for your patience — this issue has been resolved.\n\n"
            if complaint.status == "resolved"
            else "We'll keep you posted as it progresses.\n\n"
        )
        + "— Civic Complaint Management System"
    )
    return send_email(subject, user.email, body)
