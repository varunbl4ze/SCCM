/* ==========================================================================
   dashboard.js — citizen dashboard: stats + recent complaints.
   Talks to: GET /api/complaints/?user_id=<id>
   ========================================================================== */

requireAuth();

document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  const welcomeName = document.getElementById('welcomeName');
  if (welcomeName && user) {
    welcomeName.textContent = `Welcome back, ${user.name.split(' ')[0]}`;
  }

  await loadDashboardData(user);
});

async function loadDashboardData(user) {
  const listEl = document.getElementById('recentComplaintsList');

  try {
    const { data: complaints } = await API.complaints.list({ user_id: user.id });

    renderStatCards(complaints);
    renderRecentComplaints(complaints, listEl);
  } catch (err) {
    showToast(err.message, 'error');
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-plug-circle-xmark"></i>
          <h4>Couldn't load your complaints</h4>
          <p class="mb-0">${escapeHtml(err.message)}</p>
        </div>`;
    }
  }
}

function renderStatCards(complaints) {
  const counts = { total: complaints.length, pending: 0, in_progress: 0, resolved: 0 };
  complaints.forEach((c) => {
    if (counts[c.status] !== undefined) counts[c.status]++;
  });

  document.getElementById('statTotal').textContent = counts.total;
  document.getElementById('statPending').textContent = counts.pending;
  document.getElementById('statProgress').textContent = counts.in_progress;
  document.getElementById('statResolved').textContent = counts.resolved;
}

function renderRecentComplaints(complaints, container) {
  if (!container) return;

  if (complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <h4>No complaints filed yet</h4>
        <p class="mb-3">When you report an issue, it'll show up here with its status.</p>
        <a href="complaint.html" class="btn btn-civic-primary btn-sm">Raise your first complaint</a>
      </div>`;
    return;
  }

  const recent = [...complaints]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  container.innerHTML = recent.map((c) => `
    <a href="complaint-details.html?id=${c.id}" class="docket-row border-${c.status} text-decoration-none">
      <div class="flex-grow-1">
        <div class="docket-id mono">${docketId(c)}</div>
        <div class="docket-title">${escapeHtml(c.title)}</div>
        <div class="docket-meta"><i class="fa-solid fa-clock me-1"></i>${timeAgo(c.created_at)} &middot; ${categoryLabel(c.category)}</div>
      </div>
      ${statusBadge(c.status)}
    </a>
  `).join('');
}
