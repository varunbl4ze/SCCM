/* ==========================================================================
   admin-users.js — user management page.
   Talks to:
     GET    /api/admin/users            (?role=)
     PATCH  /api/admin/users/<id>/role
     DELETE /api/admin/users/<id>
   ========================================================================== */

let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return;

  renderNavUser();
  initAppShell();
  await loadUsers();

  document.getElementById('searchInput').addEventListener('input', debounce(renderTable, 200));
  document.getElementById('roleFilter').addEventListener('change', loadUsers);
});

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Loading users…</td></tr>';

  try {
    const role = document.getElementById('roleFilter').value;
    const { data } = await API.admin.listUsers(role || undefined);
    allUsers = data;
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('usersTableBody');
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const me = getUser();

  const filtered = allUsers.filter((u) =>
    !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state py-4">
          <i class="fa-solid fa-users"></i>
          <p class="mb-0 small">No users match this search.</p>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((u) => `
    <tr>
      <td class="fw-semibold" style="color:var(--forest-dark)">${escapeHtml(u.name)}</td>
      <td class="small">${escapeHtml(u.email)}</td>
      <td class="small">${u.phone ? escapeHtml(u.phone) : '<span class="text-muted-custom">—</span>'}</td>
      <td>
        <select class="form-select form-select-sm role-select" data-id="${u.id}" ${u.id === me.id ? 'disabled title="You cannot change your own role"' : ''} style="width:auto;">
          <option value="citizen" ${u.role === 'citizen' ? 'selected' : ''}>Citizen</option>
          <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td class="small">${formatDate(u.created_at)}</td>
      <td class="text-end">
        <button class="action-icon-btn danger delete-user-btn" data-id="${u.id}" data-name="${escapeHtml(u.name)}"
          title="${u.id === me.id ? 'You cannot delete your own account' : 'Delete user'}"
          ${u.id === me.id ? 'disabled' : ''}>
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  qsa('.role-select', tbody).forEach((sel) => sel.addEventListener('change', onRoleChange));
  qsa('.delete-user-btn', tbody).forEach((btn) => btn.addEventListener('click', onDeleteUser));
}

async function onRoleChange(e) {
  const select = e.target;
  const id = select.dataset.id;
  const newRole = select.value;

  try {
    const { data } = await API.admin.changeUserRole(id, newRole);
    const idx = allUsers.findIndex((u) => u.id == id);
    if (idx > -1) allUsers[idx] = data;
    showToast(`${data.name}'s role is now ${data.role}.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    loadUsers(); // revert dropdown to real server state
  }
}

async function onDeleteUser(e) {
  const btn = e.currentTarget;
  const id = btn.dataset.id;
  const name = btn.dataset.name;

  if (!confirm(`Delete ${name}'s account? This also removes their filed complaints. This cannot be undone.`)) {
    return;
  }

  try {
    await API.admin.deleteUser(id);
    allUsers = allUsers.filter((u) => u.id != id);
    renderTable();
    showToast(`${name}'s account was deleted.`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
