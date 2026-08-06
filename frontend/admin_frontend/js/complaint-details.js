/* ==========================================================================
   complaint-details.js — single complaint view.
   Talks to: GET /api/complaints/<id>, DELETE /api/complaints/<id>
   Comments and photo evidence are shown as empty/pending states — see the
   TODO notes for what to wire up once those backend routes exist.
   ========================================================================== */

requireAuth();

let currentComplaint = null;

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    renderNotFound('No complaint id was given in the URL.');
    return;
  }
  loadComplaint(id);
});

async function loadComplaint(id) {
  const content = document.getElementById('detailsContent');
  try {
    const { data: complaint } = await API.complaints.get(id);
    currentComplaint = complaint;

    const user = getUser();
    if (user.role !== 'admin' && complaint.user_id !== user.id) {
      renderNotFound("This complaint doesn't belong to your account.");
      return;
    }

    renderComplaint(complaint);
  } catch (err) {
    renderNotFound(err.message);
  }
}

function renderNotFound(message) {
  document.getElementById('detailsContent').innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <h4>Complaint not found</h4>
      <p class="mb-3">${escapeHtml(message)}</p>
      <a href="tracking.html" class="btn btn-civic-primary btn-sm">Back to tracking</a>
    </div>`;
}

function renderComplaint(c) {
  const content = document.getElementById('detailsContent');
  const department = categoryToDepartment(c.category);
  const canWithdraw = c.status === 'pending';

  content.innerHTML = `
    <div class="civic-card p-4 p-lg-5 mb-4">
      <div class="d-flex justify-content-between flex-wrap gap-3 mb-3">
        <div>
          <span class="docket-id mono d-block mb-1">${docketId(c)}</span>
          <h1 class="h4 mb-0">${escapeHtml(c.title)}</h1>
        </div>
        ${statusBadge(c.status)}
      </div>

      <p class="text-muted mb-4">${escapeHtml(c.description)}</p>

      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <small class="text-muted d-block">Category</small>
          <strong>${categoryLabel(c.category)}</strong>
        </div>
        <div class="col-6 col-md-3">
          <small class="text-muted d-block">Assigned department</small>
          <strong>${escapeHtml(department)}</strong>
        </div>
        <div class="col-6 col-md-3">
          <small class="text-muted d-block">Filed on</small>
          <strong>${formatDate(c.created_at, { withTime: true })}</strong>
        </div>
        <div class="col-6 col-md-3">
          <small class="text-muted d-block">Location</small>
          <strong>${escapeHtml(c.address || 'Not specified')}</strong>
        </div>
      </div>

      ${c.image_url ? `
        <div class="mb-4">
          <small class="text-muted d-block mb-2">Photo evidence</small>
          <img src="${escapeHtml(resolveImageUrl(c.image_url))}" alt="Complaint photo" class="img-fluid rounded" style="max-height:320px;">
        </div>
      ` : `
        <div class="mb-4">
          <small class="text-muted d-block mb-2">Photo evidence</small>
          <div class="empty-state py-4">
            <i class="fa-solid fa-image"></i>
            <p class="mb-0 small">No photo attached to this complaint yet.</p>
          </div>
        </div>
      `}

      ${canWithdraw ? `
        <button class="btn btn-outline-danger rounded-pill btn-sm" data-bs-toggle="modal" data-bs-target="#cancelModal">
          <i class="fa-solid fa-trash-can me-1"></i> Withdraw complaint
        </button>
      ` : ''}
    </div>

    <div class="row g-4">
      <div class="col-lg-6">
        <div class="civic-card p-4">
          <h5 class="mb-4"><i class="fa-solid fa-timeline me-2" style="color:var(--leaf);"></i>Status timeline</h5>
          ${renderTimeline(c)}
        </div>
      </div>
      <div class="col-lg-6">
        <div class="civic-card p-4">
          <h5 class="mb-3"><i class="fa-solid fa-comments me-2" style="color:var(--leaf);"></i>Comments</h5>
          <!-- TODO: backend — replace this empty state with a rendered list
               from API.comments.list(c.id) once a comments endpoint exists,
               and wire the form below to API.comments.add(). -->
          <div class="empty-state py-4">
            <i class="fa-solid fa-comment-slash"></i>
            <p class="mb-0 small">Comments aren't available yet — this feature isn't connected to a backend endpoint.</p>
          </div>
          <form class="d-flex gap-2 mt-3" onsubmit="return false;">
            <input type="text" class="form-control" placeholder="Comments are coming soon…" disabled>
            <button class="btn btn-civic-outline" type="submit" disabled><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('confirmCancelBtn')?.addEventListener('click', () => withdrawComplaint(c.id));
}

function renderTimeline(c) {
  const steps = [
    { key: 'pending', label: 'Filed', time: c.created_at },
    { key: 'in_progress', label: 'Picked up by department', time: c.status !== 'pending' ? c.updated_at : null },
    { key: 'resolved', label: 'Resolved', time: c.resolved_at },
  ];

  if (c.status === 'rejected') {
    return `
      <ul class="timeline">
        <li class="active"><div class="t-label">Filed</div><div class="t-time">${formatDate(c.created_at, { withTime: true })}</div></li>
        <li class="active"><div class="t-label">Rejected</div><div class="t-time">${formatDate(c.updated_at, { withTime: true })}</div></li>
      </ul>`;
  }

  const order = ['pending', 'in_progress', 'resolved'];
  const currentIndex = order.indexOf(c.status);

  return `<ul class="timeline">${steps.map((s, i) => `
    <li class="${i <= currentIndex ? 'active' : ''}">
      <div class="t-label">${s.label}</div>
      <div class="t-time">${s.time ? formatDate(s.time, { withTime: true }) : (i <= currentIndex ? '—' : 'Pending')}</div>
    </li>
  `).join('')}</ul>`;
}

async function withdrawComplaint(id) {
  const btn = document.getElementById('confirmCancelBtn');
  setButtonLoading(btn, true, 'Withdrawing…');
  try {
    await API.complaints.remove(id);
    showToast('Complaint withdrawn.', 'success');
    setTimeout(() => { window.location.href = 'tracking.html'; }, 500);
  } catch (err) {
    showToast(err.message, 'error');
    setButtonLoading(btn, false);
  }
}
