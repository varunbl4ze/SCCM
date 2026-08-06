/* ==========================================================================
   tracking.js — lists every complaint filed by the logged-in user, with
   client-side search (title/docket) and server-side status/category
   filters (re-fetched from the API on change).
   Talks to: GET /api/complaints/?user_id=&status=&category=
   ========================================================================== */

requireAuth();

let allComplaints = [];

document.addEventListener('DOMContentLoaded', () => {
  loadComplaints();

  document.getElementById('searchInput')?.addEventListener('input', debounce(applyFilters, 200));
  document.getElementById('statusFilter')?.addEventListener('change', loadComplaints);
  document.getElementById('categoryFilter')?.addEventListener('change', loadComplaints);
});

async function loadComplaints() {
  const listEl = document.getElementById('complaintsList');
  const user = getUser();
  const status = document.getElementById('statusFilter').value;
  const category = document.getElementById('categoryFilter').value;

  listEl.innerHTML = `
    <div class="skeleton" style="height:78px;margin-bottom:0.75rem;"></div>
    <div class="skeleton" style="height:78px;margin-bottom:0.75rem;"></div>`;

  try {
    const { data } = await API.complaints.list({ user_id: user.id, status, category });
    allComplaints = data;
    applyFilters();
  } catch (err) {
    showToast(err.message, 'error');
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-plug-circle-xmark"></i>
        <h4>Couldn't load complaints</h4>
        <p class="mb-0">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function applyFilters() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();

  const filtered = allComplaints.filter((c) => {
    if (!query) return true;
    return (
      c.title.toLowerCase().includes(query) ||
      docketId(c).toLowerCase().includes(query)
    );
  });

  renderList(filtered);
}

function renderList(complaints) {
  const listEl = document.getElementById('complaintsList');
  const countEl = document.getElementById('resultCount');

  countEl.textContent = `${complaints.length} complaint${complaints.length !== 1 ? 's' : ''} found`;

  if (complaints.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h4>No matching complaints</h4>
        <p class="mb-0">Try a different search term or clear the filters.</p>
      </div>`;
    return;
  }

  const sorted = [...complaints].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  listEl.innerHTML = sorted.map((c) => `
    <a href="complaint-details.html?id=${c.id}" class="docket-row border-${c.status} text-decoration-none">
      <div class="flex-grow-1">
        <div class="docket-id mono">${docketId(c)}</div>
        <div class="docket-title">${escapeHtml(c.title)}</div>
        <div class="docket-meta">
          <i class="fa-solid fa-tag me-1"></i>${categoryLabel(c.category)}
          &middot; <i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(c.address || 'No address given')}
          &middot; <i class="fa-solid fa-clock me-1"></i>${formatDate(c.created_at)}
        </div>
      </div>
      ${statusBadge(c.status)}
    </a>
  `).join('');
}
