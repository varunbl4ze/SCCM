/* ==========================================================================
   admin.js — admin console: stats, Chart.js visualizations, department
   overview, and a full complaint management table (status + delete).

   Talks to: GET /api/complaints/ (all complaints — the backend does not
   yet scope this by role, so any logged-in user could call it; the
   requireAdmin() guard below only controls whether this *page* is shown,
   it does not change what the API itself allows. See the note in
   README.md about adding server-side role checks.)
   PATCH /api/complaints/<id>/status, DELETE /api/complaints/<id>
   ========================================================================== */

requireAdmin();

let allComplaints = [];
let statusChart = null;
let categoryChart = null;
let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadAllComplaints();

  document.getElementById('refreshAdminBtn')?.addEventListener('click', loadAllComplaints);
  document.getElementById('adminSearchInput')?.addEventListener('input', debounce(renderTable, 200));
  document.getElementById('adminStatusFilter')?.addEventListener('change', renderTable);
  document.getElementById('adminConfirmDeleteBtn')?.addEventListener('click', confirmDelete);
});

async function loadAllComplaints() {
  try {
    const { data } = await API.complaints.list({});
    allComplaints = data;
    renderStats(allComplaints);
    renderCharts(allComplaints);
    renderDepartmentOverview(allComplaints);
    renderTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ---- Stat cards ------------------------------------------------------ */
function renderStats(complaints) {
  const counts = { pending: 0, in_progress: 0, resolved: 0, rejected: 0 };
  complaints.forEach((c) => { if (counts[c.status] !== undefined) counts[c.status]++; });

  document.getElementById('adminStatTotal').textContent = complaints.length;
  document.getElementById('adminStatPending').textContent = counts.pending;
  document.getElementById('adminStatProgress').textContent = counts.in_progress;
  document.getElementById('adminStatResolved').textContent = counts.resolved;
}

/* ---- Chart.js visualizations ------------------------------------------- */
function renderCharts(complaints) {
  const counts = { pending: 0, in_progress: 0, resolved: 0, rejected: 0 };
  complaints.forEach((c) => { if (counts[c.status] !== undefined) counts[c.status]++; });

  const statusCtx = document.getElementById('statusChart');
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
      datasets: [{
        data: [counts.pending, counts.in_progress, counts.resolved, counts.rejected],
        backgroundColor: ['#c9822d', '#3e6fa8', '#2f8558', '#b1452f'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Poppins', size: 11 }, padding: 12 } } },
    },
  });

  const categoryCounts = {};
  complaints.forEach((c) => {
    const label = categoryLabel(c.category);
    categoryCounts[label] = (categoryCounts[label] || 0) + 1;
  });

  const categoryCtx = document.getElementById('categoryChart');
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(categoryCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(categoryCounts),
      datasets: [{
        data: Object.values(categoryCounts),
        backgroundColor: '#2f8558',
        borderRadius: 6,
        maxBarThickness: 28,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'JetBrains Mono', size: 10 } } },
        x: { ticks: { font: { family: 'Poppins', size: 10 } } },
      },
    },
  });
}

/* ---- Department overview (derived from category — see TODO in utils.js) */
function renderDepartmentOverview(complaints) {
  const container = document.getElementById('departmentOverview');
  const deptCounts = {};
  complaints.forEach((c) => {
    const dept = categoryToDepartment(c.category);
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  const max = Math.max(1, ...Object.values(deptCounts));
  const entries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = `<p class="text-muted small mb-0">No complaints yet.</p>`;
    return;
  }

  container.innerHTML = entries.map(([dept, count]) => `
    <div class="dept-row">
      <span class="dept-name">${escapeHtml(dept)}</span>
      <div class="dept-bar"><span style="width:${(count / max) * 100}%"></span></div>
      <span class="dept-count">${count}</span>
    </div>
  `).join('');
}

/* ---- Management table --------------------------------------------------- */
function renderTable() {
  const tbody = document.getElementById('adminTableBody');
  const query = document.getElementById('adminSearchInput').value.trim().toLowerCase();
  const statusFilter = document.getElementById('adminStatusFilter').value;

  let filtered = allComplaints.filter((c) => {
    const matchesQuery = !query || c.title.toLowerCase().includes(query) || docketId(c).toLowerCase().includes(query);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state py-4"><i class="fa-solid fa-folder-open"></i><p class="mb-0 small">No complaints match your filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((c) => `
    <tr>
      <td><span class="mono small">${docketId(c)}</span></td>
      <td>
        <a href="complaint-details.html?id=${c.id}" class="fw-semibold text-decoration-none" style="color:var(--forest-dark);">
          ${escapeHtml(c.title)}
        </a>
      </td>
      <td>${categoryLabel(c.category)}</td>
      <td class="small text-muted">${formatDate(c.created_at)}</td>
      <td>
        <select class="form-select form-select-sm status-select" data-id="${c.id}" style="min-width:140px;">
          <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="in_progress" ${c.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          <option value="rejected" ${c.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger delete-complaint-btn" data-id="${c.id}" title="Delete complaint">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');

  qsa('.status-select', tbody).forEach((select) => {
    select.addEventListener('change', () => updateStatus(select.dataset.id, select.value, select));
  });
  qsa('.delete-complaint-btn', tbody).forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingDeleteId = btn.dataset.id;
      const modal = new bootstrap.Modal(document.getElementById('adminDeleteModal'));
      modal.show();
    });
  });
}

async function updateStatus(id, newStatus, selectEl) {
  const previous = allComplaints.find((c) => c.id == id)?.status;
  try {
    await API.complaints.updateStatus(id, newStatus);
    const complaint = allComplaints.find((c) => c.id == id);
    if (complaint) complaint.status = newStatus;
    showToast(`${docketId(complaint)} marked ${statusLabel(newStatus)}.`, 'success');
    renderStats(allComplaints);
    renderCharts(allComplaints);
  } catch (err) {
    showToast(err.message, 'error');
    if (selectEl && previous) selectEl.value = previous;
  }
}

async function confirmDelete() {
  const btn = document.getElementById('adminConfirmDeleteBtn');
  setButtonLoading(btn, true, 'Deleting…');
  try {
    await API.complaints.remove(pendingDeleteId);
    allComplaints = allComplaints.filter((c) => c.id != pendingDeleteId);
    renderStats(allComplaints);
    renderCharts(allComplaints);
    renderDepartmentOverview(allComplaints);
    renderTable();
    showToast('Complaint deleted.', 'success');
    bootstrap.Modal.getInstance(document.getElementById('adminDeleteModal'))?.hide();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}
