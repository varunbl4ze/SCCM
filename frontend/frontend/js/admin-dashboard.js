/* ==========================================================================
   admin-dashboard.js — the admin overview page.
   Talks to: GET /api/admin/overview
   Gated by requireAdmin() (see auth.js), which verifies the current
   token actually clears the backend's @admin_required check before any
   of this runs.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return; // requireAdmin() already redirected

  renderNavUser();
  initAppShell();
  await loadOverview();
});

async function loadOverview() {
  try {
    const { data } = await API.admin.overview();

    document.getElementById('statTotal').textContent = data.total_complaints;
    document.getElementById('statPending').textContent = data.status_counts.pending ?? 0;
    document.getElementById('statProgress').textContent = data.status_counts.in_progress ?? 0;
    document.getElementById('statResolved').textContent = data.status_counts.resolved ?? 0;
    document.getElementById('statRejected').textContent = data.status_counts.rejected ?? 0;
    document.getElementById('statCitizens').textContent = data.total_citizens;
    document.getElementById('statDepartments').textContent = data.total_departments;

    const user = getUser();
    if (user) {
      document.getElementById('welcomeName').textContent = `Welcome, ${user.name.split(' ')[0]}`;
    }

    renderRecentComplaints(data.recent_complaints);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderRecentComplaints(complaints) {
  const container = document.getElementById('recentComplaintsList');

  if (!complaints || complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state py-4">
        <i class="fa-solid fa-inbox"></i>
        <p class="mb-0 small">No complaints filed yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = complaints.map((c) => `
    <div class="docket-row border-${c.status} mb-2">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <div class="docket-id">${escapeHtml(docketId(c))}</div>
          <div class="docket-title">${escapeHtml(c.title)}</div>
          <div class="docket-meta">${escapeHtml(categoryLabel(c.category))} · ${timeAgo(c.created_at)}</div>
        </div>
        ${statusBadge(c.status)}
      </div>
    </div>
  `).join('');
}
