/* ==========================================================================
   admin-profile.js — the admin's own profile & settings page.
   Talks to:
     GET   /api/auth/me                (shared with citizen panel)
     PATCH /api/auth/me                (shared with citizen panel)
     POST  /api/auth/change-password   (shared with citizen panel)
   These are deliberately the SAME endpoints the citizen profile page
   uses — editing your own name/phone/password isn't admin-specific
   logic, so there's no separate /api/admin/profile route to duplicate it.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return;

  renderNavUser();
  initAppShell();
  await loadProfile();

  document.getElementById('adminProfileForm').addEventListener('submit', onSaveProfile);
  document.getElementById('adminChangePasswordForm').addEventListener('submit', onChangePassword);
});

async function loadProfile() {
  try {
    const { data: user } = await API.auth.me();
    setAuth({ user, token: getToken() }); // keep local session in sync

    document.getElementById('profileAvatar').textContent = initials(user.name);
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;

    const rolePill = document.getElementById('profileRolePill');
    rolePill.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    rolePill.className = `role-pill role-${user.role}`;

    document.getElementById('profileNameInput').value = user.name;
    document.getElementById('profileEmailInput').value = user.email;
    document.getElementById('profilePhoneInput').value = user.phone || '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function onSaveProfile(e) {
  e.preventDefault();

  const name = document.getElementById('profileNameInput').value.trim();
  const phone = document.getElementById('profilePhoneInput').value.trim();
  const btn = document.getElementById('saveProfileBtn');
  const note = document.getElementById('profileUpdateNote');

  if (!name) {
    showToast('Name cannot be empty.', 'error');
    return;
  }

  setButtonLoading(btn, true, 'Saving…');
  note.textContent = '';

  try {
    const { data: user } = await API.profile.update({ name, phone: phone || null });
    setAuth({ user, token: getToken() });
    renderNavUser();

    document.getElementById('profileName').textContent = user.name;
    note.textContent = 'Profile updated.';
    showToast('Profile updated.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function onChangePassword(e) {
  e.preventDefault();

  const current = document.getElementById('currentPasswordInput').value;
  const next = document.getElementById('newPasswordInput').value;
  const btn = document.getElementById('changePasswordBtn');
  const note = document.getElementById('passwordUpdateNote');

  if (!current || !next) {
    showToast('Both current and new password are required.', 'error');
    return;
  }
  if (next.length < 6) {
    showToast('New password must be at least 6 characters.', 'error');
    return;
  }

  setButtonLoading(btn, true, 'Updating…');
  note.textContent = '';

  try {
    await API.profile.changePassword({ current_password: current, new_password: next });
    document.getElementById('adminChangePasswordForm').reset();
    note.textContent = 'Password updated.';
    showToast('Password updated.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}
