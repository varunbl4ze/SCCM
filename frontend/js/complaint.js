/* ==========================================================================
   complaint.js — the "Raise a Complaint" form.
   Talks to: POST /api/complaints/
   Image upload and precise geolocation are wired as far as the current
   backend allows — see the TODO notes below for what's still pending.
   ========================================================================== */

requireAuth();

let selectedCategory = null;
let selectedCoords = null; // { latitude, longitude } set only if geolocation succeeds

document.addEventListener('DOMContentLoaded', () => {
  initCategoryGrid();
  initDescriptionCounter();
  initImageUpload();
  initLocationButton();
  initComplaintForm();
});

/* ---- Category chips ------------------------------------------------- */
function initCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;

    qsa('.category-chip', grid).forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    selectedCategory = chip.dataset.value;
    document.getElementById('complaintCategory').value = selectedCategory;
    document.getElementById('categoryError').style.display = 'none';
  });
}

/* ---- Description char counter ------------------------------------------- */
function initDescriptionCounter() {
  const textarea = document.getElementById('complaintDescription');
  const counter = document.getElementById('descCharCount');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / 2000`;
  });
}

/* ---- Image upload (preview only — see TODO) ------------------------------
   TODO: backend — once POST /api/complaints/<id>/image (or similar) exists,
   swap the placeholder note below for an actual API.images.upload() call
   inside the form submit handler, using the id returned from creating the
   complaint. */
function initImageUpload() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('complaintImage');
  const preview = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('uploadPreviewImg');
  const removeBtn = document.getElementById('removeImageBtn');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  ['dragover', 'dragenter'].forEach((evt) =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); })
  );
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file, input, zone, preview, previewImg);
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleImageFile(file, input, zone, preview, previewImg);
  });

  removeBtn?.addEventListener('click', () => {
    input.value = '';
    preview.style.display = 'none';
    zone.style.display = 'block';
  });
}

function handleImageFile(file, input, zone, preview, previewImg) {
  if (!file.type.match(/image\/(jpeg|png)/)) {
    showToast('Please choose a JPG or PNG image.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be under 5MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    preview.style.display = 'block';
    zone.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

/* ---- Geolocation ------------------------------------------------------ */
function initLocationButton() {
  const btn = document.getElementById('useLocationBtn');
  const status = document.getElementById('locationStatus');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = 'Geolocation is not supported by this browser.';
      status.className = 'location-status err';
      return;
    }

    status.innerHTML = '<span class="civic-spinner dark" style="width:14px;height:14px;"></span> Locating…';
    status.className = 'location-status';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectedCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        status.innerHTML = `<i class="fa-solid fa-check"></i> Location captured (${selectedCoords.latitude.toFixed(4)}, ${selectedCoords.longitude.toFixed(4)})`;
        status.className = 'location-status ok';
      },
      () => {
        status.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Could not get your location. You can still type the address manually.';
        status.className = 'location-status err';
      }
    );
  });
}

/* ---- Submit ------------------------------------------------------------ */
function initComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  const titleInput = document.getElementById('complaintTitle');
  const descInput = document.getElementById('complaintDescription');
  const addressInput = document.getElementById('complaintAddress');
  const submitBtn = document.getElementById('complaintSubmitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    if (!titleInput.value.trim() || titleInput.value.trim().length < 5) {
      titleInput.classList.add('is-invalid');
      titleInput.nextElementSibling.textContent = 'Give the complaint a clear, specific title (5+ characters).';
      valid = false;
    } else {
      titleInput.classList.remove('is-invalid');
    }

    if (!selectedCategory) {
      document.getElementById('categoryError').textContent = 'Choose a category.';
      document.getElementById('categoryError').style.display = 'block';
      valid = false;
    }

    if (!descInput.value.trim() || descInput.value.trim().length < 15) {
      descInput.classList.add('is-invalid');
      descInput.previousElementSibling?.classList;
      descInput.parentElement.querySelector('.invalid-feedback').style.display = 'block';
      descInput.parentElement.querySelector('.invalid-feedback').textContent = 'Add a bit more detail (at least 15 characters).';
      valid = false;
    } else {
      descInput.classList.remove('is-invalid');
    }

    if (!valid) return;

    const user = getUser();
    const payload = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      user_id: user.id,
      category: selectedCategory,
      address: addressInput.value.trim() || undefined,
    };
    if (selectedCoords) {
      payload.latitude = selectedCoords.latitude;
      payload.longitude = selectedCoords.longitude;
    }

    setButtonLoading(submitBtn, true, 'Filing complaint…');
    try {
      const { data: complaint } = await API.complaints.create(payload);
      showToast(`Filed as ${docketId(complaint)}.`, 'success');
      setTimeout(() => {
        window.location.href = `complaint-details.html?id=${complaint.id}`;
      }, 600);
    } catch (err) {
      showToast(err.message, 'error');
      setButtonLoading(submitBtn, false);
    }
  });
}
