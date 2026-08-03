/* ==========================================================================
   auth.js — session storage, route guards, and the login/register forms.
   Include this file on every page (guards run harmlessly if their target
   elements aren't present) so the navbar user state stays consistent.
   ========================================================================== */

const AUTH_STORAGE_KEY = 'civic_auth';

/* ---- Session storage ------------------------------------------------- */
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function getToken() {
  return getSession()?.token || null;
}

function getUser() {
  return getSession()?.user || null;
}

function isLoggedIn() {
  return !!getToken();
}

function setAuth({ user, token }) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
}

function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function logout() {
  clearAuth();
  window.location.href = 'login.html';
}

/* ---- Route guards ---------------------------------------------------------
   Call the relevant guard at the top of each page's inline script or
   page-specific JS file. They redirect synchronously before content
   would otherwise render for the wrong audience. */

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

function requireGuest() {
  // Used on login.html / register.html so an already-logged-in user
  // is sent straight to their dashboard instead of seeing the form again.
  if (isLoggedIn()) {
    const user = getUser();
    window.location.href = user?.role === 'admin' ? 'admin.html' : 'dashboard.html';
  }
}

function requireAdmin() {
  requireAuth();
  const user = getUser();
  if (user && user.role !== 'admin') {
    window.location.href = 'dashboard.html';
  }
}

/* ---- Shared navbar user state -------------------------------------------
   Every page's navbar partial includes a #navUserSlot container. This
   fills it in with the logged-in user's name + a logout control, or a
   Login/Register pair for guests. Keeps the navbar markup identical
   across all 9 pages while still reflecting real session state. */
function renderNavUser() {
  const slot = document.getElementById('navUserSlot');
  if (!slot) return;

  const user = getUser();

  if (!user) {
    slot.innerHTML = `
      <a href="login.html" class="btn btn-civic-ghost">Log in</a>
      <a href="register.html" class="btn btn-civic-primary btn-sm">Get started</a>
    `;
    return;
  }

  slot.innerHTML = `
    <div class="dropdown">
      <button class="btn d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-expanded="false">
        <span class="profile-avatar" style="width:34px;height:34px;font-size:0.85rem;">${initials(user.name)}</span>
        <span class="d-none d-md-inline fw-semibold" style="color:var(--forest-dark)">${escapeHtml(user.name.split(' ')[0])}</span>
        <i class="fa-solid fa-chevron-down small text-muted"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" style="border-radius: var(--radius-sm);">
        <li><a class="dropdown-item" href="${user.role === 'admin' ? 'admin.html' : 'dashboard.html'}"><i class="fa-solid fa-gauge me-2 text-muted"></i>Dashboard</a></li>
        <li><a class="dropdown-item" href="profile.html"><i class="fa-solid fa-user me-2 text-muted"></i>Profile</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-danger" href="#" id="navLogoutBtn"><i class="fa-solid fa-right-from-bracket me-2"></i>Log out</a></li>
      </ul>
    </div>
  `;

  document.getElementById('navLogoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

/* ---- Field-level validation helpers used by both forms below ------------ */
function markInvalid(input, message) {
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  const feedback = input.parentElement.querySelector('.invalid-feedback')
    || input.closest('.password-field')?.parentElement.querySelector('.invalid-feedback');
  if (feedback) feedback.textContent = message;
}

function markValid(input) {
  input.classList.remove('is-invalid');
  input.classList.add('is-valid');
}

/* ---- Password visibility toggle (shared by login/register/profile) -------*/
function initPasswordToggles() {
  qsa('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
  });
}

/* ---- LOGIN PAGE ----------------------------------------------------------*/
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const submitBtn = document.getElementById('loginSubmitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    if (!isValidEmail(emailInput.value.trim())) {
      markInvalid(emailInput, 'Enter a valid email address.');
      valid = false;
    } else {
      markValid(emailInput);
    }

    if (!passwordInput.value) {
      markInvalid(passwordInput, 'Password is required.');
      valid = false;
    } else {
      markValid(passwordInput);
    }

    if (!valid) return;

    setButtonLoading(submitBtn, true, 'Logging in…');
    try {
      const { data } = await API.auth.login({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      setAuth({ user: data.user, token: data.token });
      showToast(`Welcome back, ${data.user.name.split(' ')[0]}.`, 'success');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }, 500);
    } catch (err) {
      showToast(err.message, 'error');
      setButtonLoading(submitBtn, false);
    }
  });
}

/* ---- REGISTER PAGE ---------------------------------------------------- */
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const nameInput = document.getElementById('regName');
  const emailInput = document.getElementById('regEmail');
  const phoneInput = document.getElementById('regPhone');
  const passwordInput = document.getElementById('regPassword');
  const confirmInput = document.getElementById('regConfirmPassword');
  const submitBtn = document.getElementById('registerSubmitBtn');
  const strengthBar = document.getElementById('passwordStrengthBar');

  passwordInput?.addEventListener('input', () => {
    const s = passwordStrength(passwordInput.value);
    if (strengthBar) {
      strengthBar.style.width = `${(s.score / 4) * 100}%`;
      strengthBar.style.background = s.color;
    }
    const label = document.getElementById('passwordStrengthLabel');
    if (label) label.textContent = passwordInput.value ? s.label : '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      markInvalid(nameInput, 'Enter your full name.');
      valid = false;
    } else markValid(nameInput);

    if (!isValidEmail(emailInput.value.trim())) {
      markInvalid(emailInput, 'Enter a valid email address.');
      valid = false;
    } else markValid(emailInput);

    if (phoneInput.value && !/^[0-9+\-\s]{7,15}$/.test(phoneInput.value.trim())) {
      markInvalid(phoneInput, 'Enter a valid phone number.');
      valid = false;
    } else markValid(phoneInput);

    if (!passwordInput.value || passwordInput.value.length < 6) {
      markInvalid(passwordInput, 'Password must be at least 6 characters.');
      valid = false;
    } else markValid(passwordInput);

    if (confirmInput.value !== passwordInput.value || !confirmInput.value) {
      markInvalid(confirmInput, 'Passwords do not match.');
      valid = false;
    } else markValid(confirmInput);

    if (!valid) return;

    setButtonLoading(submitBtn, true, 'Creating account…');
    try {
      const { data } = await API.auth.register({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        phone: phoneInput.value.trim() || undefined,
      });
      setAuth({ user: data.user, token: data.token });
      showToast('Account created. Welcome to the registry.', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 500);
    } catch (err) {
      showToast(err.message, 'error');
      setButtonLoading(submitBtn, false);
    }
  });
}

/* ---- Shared app-shell chrome (sidebar) -----------------------------------
   Runs harmlessly on pages without a sidebar. Handles:
   - showing the "Admin Dashboard" sidebar link only for admin users
   - the mobile hamburger toggle for the off-canvas sidebar */
function initAppShell() {
  const user = getUser();
  const adminLink = document.getElementById('adminSidebarLink');
  const adminDivider = document.getElementById('adminDivider');
  if (user?.role === 'admin' && adminLink) {
    adminLink.style.display = 'flex';
    if (adminDivider) adminDivider.style.display = 'block';
  }

  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (toggleBtn && sidebar) {
    toggleBtn.classList.remove('d-none');
    const open = () => { sidebar.classList.add('open'); backdrop?.classList.add('show'); };
    const close = () => { sidebar.classList.remove('open'); backdrop?.classList.remove('show'); };
    toggleBtn.addEventListener('click', open);
    backdrop?.addEventListener('click', close);
    qsa('.sidebar-link', sidebar).forEach((link) => link.addEventListener('click', close));
  }
}

/* ---- Boot on every page --------------------------------------------------*/
document.addEventListener('DOMContentLoaded', () => {
  renderNavUser();
  initPasswordToggles();
  initLoginForm();
  initRegisterForm();
  initAppShell();
});
