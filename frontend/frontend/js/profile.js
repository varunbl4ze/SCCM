/* ==========================================================================
   profile.js — view profile, edit profile, change password.
   Talks to:
     GET   /api/auth/me
     PATCH /api/auth/me                (shared with the admin profile page)
     POST  /api/auth/change-password   (shared with the admin profile page)
   ========================================================================== */

requireAuth();

document.addEventListener('DOMContentLoaded', async () => {
  await refreshProfile();
  initEditProfileForm();
  initChangePasswordForm();
});

async function refreshProfile() {
  try {
    const { data: user } = await API.auth.me();
    setAuth({ user, token: getToken() }); // keep local session in sync
    renderProfile(user);
  } catch (err) {
    // Token likely expired — bounce back to login rather than show stale data.
    showToast('Your session has expired. Please log in again.', 'error');
    setTimeout(logout, 1200);
  }
}

function renderProfile(user) {
  document.getElementById('profileAvatar').textContent = initials(user.name);
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileRole').textContent = user.role;
  document.getElementById('profilePhone').textContent = user.phone || 'Not provided';
  document.getElementById('profileSince').textContent = formatDate(user.created_at);

  document.getElementById('editName').value = user.name;
  document.getElementById('editPhone').value = user.phone || '';
  document.getElementById('editEmail').value = user.email;
}

function initEditProfileForm() {
  const form = document.getElementById('editProfileForm');
  const btn = document.getElementById('editProfileBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('editName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();

    if (!name) {
      showToast('Name cannot be empty.', 'error');
      return;
    }

    setButtonLoading(btn, true, 'Saving…');
    try {
      const { data: updatedUser } = await API.profile.update({ name, phone: phone || null });
      setAuth({ user: updatedUser, token: getToken() });
      renderProfile(updatedUser);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function initChangePasswordForm() {
  const form = document.getElementById('changePasswordForm');
  const btn = document.getElementById('changePasswordBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const next = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (next.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (next !== confirm) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setButtonLoading(btn, true, 'Updating…');
    try {
      await API.profile.changePassword({ current_password: current, new_password: next });
      showToast('Password updated.', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}
