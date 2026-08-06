/* ==========================================================================
   admin-complaints.js — admin-wide complaint management.
   Talks to:
     GET   /api/admin/complaints          (?status=&category=&department_id=&unassigned=true)
     PATCH /api/admin/complaints/<id>/assign
     PATCH /api/admin/complaints/<id>/status
     GET   /api/admin/departments   (to populate filter + assign dropdown)
     GET   /api/admin/users?role=admin / ?role=staff  (to populate assign dropdown)
   ========================================================================== */

let allComplaints = [];
let departmentsCache = [];
let assignableUsersCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return;

  renderNavUser();
  initAppShell();

  await Promise.all([loadDepartments(), loadAssignableUsers()]);
  await loadComplaints();

  document.getElementById('searchInput').addEventListener('input', debounce(renderTable, 200));
  document.getElementById('statusFilter').addEventListener('change', loadComplaints);
  document.getElementById('departmentFilter').addEventListener('change', loadComplaints);
  document.getElementById('unassignedOnly').addEventListener('change', loadComplaints);
  document.getElementById('saveAssignmentBtn').addEventListener('click', saveAssignment);
});

/* ---- Data loading --------------------------------------------------- */

async function loadDepartments() {
  try {
    const { data } = await API.admin.listDepartments();
    departmentsCache = data;

    const filterSelect = document.getElementById('departmentFilter');
    const assignSelect = document.getElementById('assignDepartmentSelect');
    const options = data.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    filterSelect.insertAdjacentHTML('beforeend', options);
    assignSelect.insertAdjacentHTML('beforeend', options);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAssignableUsers() {
  try {
    const [admins, staff] = await Promise.all([
      API.admin.listUsers('admin'),
      API.admin.listUsers('staff'),
    ]);
    assignableUsersCache = [...admins.data, ...staff.data];

    const assignSelect = document.getElementById('assignAdminSelect');
    const options = assignableUsersCache
      .map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`)
      .join('');
    assignSelect.insertAdjacentHTML('beforeend', options);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadComplaints() {
  const tbody = document.getElementById('complaintsTableBody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Loading complaints…</td></tr>';

  try {
    const filters = {
      status: document.getElementById('statusFilter').value,
      department_id: document.getElementById('departmentFilter').value,
      unassigned: document.getElementById('unassignedOnly').checked,
    };
    const { data } = await API.admin.listComplaints(filters);
    allComplaints = data;
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---- Rendering -------------------------------------------------------- */

function renderTable() {
  const tbody = document.getElementById('complaintsTableBody');
  const search = document.getElementById('searchInput').value.trim().toLowerCase();

  const filtered = allComplaints.filter((c) =>
    !search || c.title.toLowerCase().includes(search) || docketId(c).toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state py-4">
          <i class="fa-solid fa-inbox"></i>
          <p class="mb-0 small">No complaints match these filters.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((c) => `
    <tr>
      <td class="docket-id">${escapeHtml(docketId(c))}</td>
      <td>
        <a href="#" class="fw-semibold text-decoration-none view-complaint-link" data-id="${c.id}" style="color:var(--forest-dark)">
          ${escapeHtml(c.title)}
        </a>
      </td>
      <td class="small">#${c.user_id}</td>
      <td class="small">${escapeHtml(categoryLabel(c.category))}</td>
      <td>
        <select class="form-select form-select-sm status-select" data-id="${c.id}" style="width:auto;">
          ${['pending', 'in_progress', 'resolved', 'rejected'].map((s) =>
            `<option value="${s}" ${s === c.status ? 'selected' : ''}>${statusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        ${c.department_name
          ? `<span class="dept-chip">${escapeHtml(c.department_name)}</span>`
          : `<span class="dept-chip unassigned">Unassigned</span>`}
      </td>
      <td class="small">${c.assigned_admin_name ? escapeHtml(c.assigned_admin_name) : '<span class="text-muted-custom">—</span>'}</td>
      <td class="small">${formatDate(c.created_at)}</td>
      <td class="text-end">
        <button class="action-icon-btn assign-btn" data-id="${c.id}" title="Assign">
          <i class="fa-solid fa-user-plus"></i>
        </button>
      </td>
    </tr>
  `).join('');

  qsa('.status-select', tbody).forEach((sel) => sel.addEventListener('change', onStatusChange));
  qsa('.assign-btn', tbody).forEach((btn) => btn.addEventListener('click', () => openAssignModal(btn.dataset.id)));
  qsa('.view-complaint-link', tbody).forEach((link) =>
    link.addEventListener('click', (e) => { e.preventDefault(); openViewModal(link.dataset.id); })
  );
}

/* ---- Status update ------------------------------------------------------*/

async function onStatusChange(e) {
  const select = e.target;
  const id = select.dataset.id;
  const newStatus = select.value;

  try {
    const { data } = await API.admin.updateComplaintStatus(id, newStatus);
    const idx = allComplaints.findIndex((c) => c.id == id);
    if (idx > -1) allComplaints[idx] = data;
    showToast(`${docketId(data)} marked ${statusLabel(newStatus).toLowerCase()}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    loadComplaints(); // revert the dropdown to the real server state
  }
}

/* ---- View modal --------------------------------------------------------*/

function openViewModal(id) {
  const c = allComplaints.find((x) => x.id == id);
  if (!c) return;

  document.getElementById('viewModalTitle').textContent = `${docketId(c)} — ${c.title}`;
  document.getElementById('viewModalBody').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><small class="text-muted-custom d-block">Status</small>${statusBadge(c.status)}</div>
      <div class="col-6 col-md-3"><small class="text-muted-custom d-block">Category</small><strong>${escapeHtml(categoryLabel(c.category))}</strong></div>
      <div class="col-6 col-md-3"><small class="text-muted-custom d-block">Department</small><strong>${c.department_name ? escapeHtml(c.department_name) : 'Unassigned'}</strong></div>
      <div class="col-6 col-md-3"><small class="text-muted-custom d-block">Filed</small><strong>${formatDate(c.created_at)}</strong></div>
    </div>
    <p>${escapeHtml(c.description)}</p>
    <div class="mb-2"><small class="text-muted-custom d-block">Location</small><strong>${escapeHtml(c.address || 'Not specified')}</strong></div>
    ${c.image_url ? `<img src="${escapeHtml(resolveImageUrl(c.image_url))}" alt="Complaint photo" class="img-fluid rounded mt-2" style="max-height:300px;">` : '<p class="small text-muted-custom mt-2 mb-0">No photo attached.</p>'}
  `;

  new bootstrap.Modal(document.getElementById('viewModal')).show();
}

/* ---- Assign modal --------------------------------------------------------*/

function openAssignModal(id) {
  const c = allComplaints.find((x) => x.id == id);
  if (!c) return;

  document.getElementById('assignComplaintId').value = id;
  document.getElementById('assignDepartmentSelect').value = c.department_id || '';
  document.getElementById('assignAdminSelect').value = c.assigned_admin_id || '';

  new bootstrap.Modal(document.getElementById('assignModal')).show();
}

async function saveAssignment() {
  const id = document.getElementById('assignComplaintId').value;
  const departmentId = document.getElementById('assignDepartmentSelect').value;
  const adminId = document.getElementById('assignAdminSelect').value;

  const btn = document.getElementById('saveAssignmentBtn');
  setButtonLoading(btn, true, 'Saving…');

  try {
    const { data } = await API.admin.assignComplaint(id, {
      department_id: departmentId ? Number(departmentId) : null,
      assigned_admin_id: adminId ? Number(adminId) : null,
    });
    const idx = allComplaints.findIndex((c) => c.id == id);
    if (idx > -1) allComplaints[idx] = data;
    renderTable();
    showToast(`${docketId(data)} assignment updated.`, 'success');
    bootstrap.Modal.getInstance(document.getElementById('assignModal'))?.hide();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}
