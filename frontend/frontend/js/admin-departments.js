/* ==========================================================================
   admin-departments.js — department management page.
   Talks to:
     GET    /api/admin/departments
     POST   /api/admin/departments
     PATCH  /api/admin/departments/<id>
     DELETE /api/admin/departments/<id>
   ========================================================================== */

let allDepartments = [];
let departmentModal;

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return;

  renderNavUser();
  initAppShell();

  departmentModal = new bootstrap.Modal(document.getElementById('departmentModal'));

  await loadDepartments();

  document.getElementById('newDepartmentBtn').addEventListener('click', () => openModal(null));
  document.getElementById('saveDepartmentBtn').addEventListener('click', saveDepartment);
});

async function loadDepartments() {
  const grid = document.getElementById('departmentsGrid');
  grid.innerHTML = '<div class="col-12 text-center py-4 text-muted">Loading departments…</div>';

  try {
    const { data } = await API.admin.listDepartments();
    allDepartments = data;
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<div class="col-12 text-center py-4 text-danger">${escapeHtml(err.message)}</div>`;
  }
}

function renderGrid() {
  const grid = document.getElementById('departmentsGrid');

  if (allDepartments.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="empty-state py-5">
          <i class="fa-solid fa-building"></i>
          <p class="mb-0">No departments yet. Create one to start routing complaints.</p>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = allDepartments.map((d) => `
    <div class="col-md-6 col-lg-4">
      <div class="department-card h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="mb-0">${escapeHtml(d.name)}</h6>
          <div class="d-flex gap-1">
            <button class="action-icon-btn edit-dept-btn" data-id="${d.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="action-icon-btn danger delete-dept-btn" data-id="${d.id}" data-name="${escapeHtml(d.name)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <p class="small text-muted-custom flex-grow-1">${d.description ? escapeHtml(d.description) : 'No description.'}</p>
        <div class="count">${d.complaint_count}</div>
        <div class="small text-muted-custom">complaint${d.complaint_count === 1 ? '' : 's'} routed here</div>
      </div>
    </div>
  `).join('');

  qsa('.edit-dept-btn', grid).forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.id)));
  qsa('.delete-dept-btn', grid).forEach((btn) => btn.addEventListener('click', onDeleteDepartment));
}

function openModal(id) {
  const dept = id ? allDepartments.find((d) => d.id == id) : null;

  document.getElementById('departmentModalTitle').textContent = dept ? 'Edit department' : 'New department';
  document.getElementById('departmentId').value = dept ? dept.id : '';
  document.getElementById('departmentName').value = dept ? dept.name : '';
  document.getElementById('departmentDescription').value = dept ? (dept.description || '') : '';

  departmentModal.show();
}

async function saveDepartment() {
  const id = document.getElementById('departmentId').value;
  const name = document.getElementById('departmentName').value.trim();
  const description = document.getElementById('departmentDescription').value.trim();

  if (!name) {
    showToast('Department name is required.', 'error');
    return;
  }

  const btn = document.getElementById('saveDepartmentBtn');
  setButtonLoading(btn, true, 'Saving…');

  try {
    if (id) {
      const { data } = await API.admin.updateDepartment(id, { name, description });
      const idx = allDepartments.findIndex((d) => d.id == id);
      allDepartments[idx] = data;
      showToast(`${data.name} updated.`, 'success');
    } else {
      const { data } = await API.admin.createDepartment({ name, description });
      allDepartments.push(data);
      showToast(`${data.name} created.`, 'success');
    }
    renderGrid();
    departmentModal.hide();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function onDeleteDepartment(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const name = btn.dataset.name;

  if (!confirm(`Delete "${name}"? Complaints routed here will become unassigned, not deleted.`)) {
    return;
  }

  try {
    await API.admin.deleteDepartment(id);
    allDepartments = allDepartments.filter((d) => d.id != id);
    renderGrid();
    showToast(`${name} deleted.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
