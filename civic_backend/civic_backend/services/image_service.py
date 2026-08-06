import os
import uuid

from werkzeug.utils import secure_filename


def is_allowed_image(filename, allowed_extensions):
    """Check the file extension against the allowed set (case-insensitive)."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_extensions


def save_complaint_image(file_storage, upload_folder, allowed_extensions):
    """
    Save an uploaded complaint photo to disk.

    Args:
        file_storage: a werkzeug FileStorage object (from request.files['image'])
        upload_folder: absolute path to the uploads directory (Config.UPLOAD_FOLDER)
        allowed_extensions: set of permitted extensions, e.g. {"png", "jpg"}

    Returns:
        The filename (not full path) that was saved, e.g. "3f9a1c2b_photo.jpg".
        Store this in Complaint.image_path and serve it back via the
        GET /uploads/<filename> static route registered in app.py.

    Raises:
        ValueError: if the filename is missing or the extension isn't allowed.
    """
    if not file_storage or file_storage.filename == "":
        raise ValueError("No file was provided")

    if not is_allowed_image(file_storage.filename, allowed_extensions):
        raise ValueError(
            f"Unsupported file type. Allowed types: {', '.join(sorted(allowed_extensions))}"
        )

    os.makedirs(upload_folder, exist_ok=True)

    # Prefix with a short uuid so two citizens uploading "photo.jpg" never collide.
    safe_name = secure_filename(file_storage.filename)
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"

    filepath = os.path.join(upload_folder, unique_name)
    file_storage.save(filepath)

    return unique_name


def delete_complaint_image(filename, upload_folder):
    """Remove a previously saved complaint image, if it exists."""
    if not filename:
        return
    filepath = os.path.join(upload_folder, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
