/* ==========================================================================
   utils.js — shared helpers used by every page.
   No page-specific logic belongs here; keep this generic and dependency-free
   (besides the DOM it renders into).
   ========================================================================== */

/* ---- Toast / alert system -------------------------------------------- */
/**
 * Show a floating toast message. Requires a <div id="toastStack"></div>
 * to exist somewhere in the page (included via partial in every page).
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const stack = document.getElementById('toastStack');
  if (!stack) {
    // Fallback so a missing container never silently swallows feedback.
    alert(message);
    return;
  }

  const icon = type === 'success' ? 'fa-circle-check'
    : type === 'error' ? 'fa-circle-exclamation'
    : 'fa-circle-info';

  const toast = document.createElement('div');
  toast.className = `civic-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ---- Basic escaping so user-entered text never breaks markup ------------ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ---- Button loading state ------------------------------------------------*/
/**
 * Toggle a submit button into/out of a loading state.
 * Stores the original label on the element so it can be restored exactly.
 */
function setButtonLoading(button, isLoading, loadingText = 'Please wait…') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="civic-spinner"></span> ${loadingText}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}

/* ---- Date formatting ------------------------------------------------- */
function formatDate(isoString, opts = {}) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(opts.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function timeAgo(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d)) return '—';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const steps = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year'],
  ];
  let value = seconds, unit = 'second';
  for (const [limit, label] of steps) {
    if (value < limit) { unit = label; break; }
    value = Math.floor(value / limit);
    unit = label;
  }
  if (unit === 'second' && value < 5) return 'just now';
  return `${value} ${unit}${value !== 1 ? 's' : ''} ago`;
}

/* ---- Docket reference numbers -------------------------------------------
   The backend only returns a numeric id. We render a stable, human-friendly
   "docket number" from it everywhere in the UI: CCR-<year>-<zero-padded id>.
   This is purely a display transform — the real id is still what's sent
   back to the API for any read/update/delete call. */
function docketId(complaint) {
  const year = complaint?.created_at ? new Date(complaint.created_at).getFullYear() : new Date().getFullYear();
  const padded = String(complaint?.id ?? 0).padStart(6, '0');
  return `CCR-${year}-${padded}`;
}

/* ---- Status helpers ------------------------------------------------- */
const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

function statusBadge(status) {
  const key = status || 'pending';
  const label = STATUS_LABELS[key] || key;
  return `<span class="status-badge status-${key}">${label}</span>`;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Pending';
}

/* ---- Category -> department mapping --------------------------------------
   NOTE: The backend's Complaint model does not yet have a dedicated
   "department" field or assignment endpoint. Until that exists, we derive
   a department label from the complaint's `category` on the client side.
   Swap this out for a real `complaint.department` field the moment the
   backend supports it — search this file for "TODO: backend" to find it. */
const CATEGORY_DEPARTMENTS = {
  road: 'Roads & Infrastructure',
  water: 'Water Supply Board',
  electricity: 'Electricity Department',
  sanitation: 'Sanitation & Waste Management',
  streetlight: 'Street Lighting Division',
  drainage: 'Stormwater & Drainage',
  parks: 'Parks & Public Spaces',
  other: 'General Civic Affairs',
};

function categoryToDepartment(category) {
  // TODO: backend — replace with complaint.department once the API exposes it.
  return CATEGORY_DEPARTMENTS[category] || 'General Civic Affairs';
}

function categoryLabel(category) {
  if (!category) return 'Uncategorized';
  return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
}

/* ---- Validation helpers ------------------------------------------------- */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const map = [
    { label: 'Very weak', color: 'var(--status-rejected)' },
    { label: 'Weak', color: 'var(--status-rejected)' },
    { label: 'Fair', color: 'var(--status-pending)' },
    { label: 'Good', color: 'var(--leaf)' },
    { label: 'Strong', color: 'var(--forest)' },
  ];
  return { score, ...map[score] };
}

/* ---- Small DOM helpers ------------------------------------------------- */
function qs(selector, scope = document) { return scope.querySelector(selector); }
function qsa(selector, scope = document) { return Array.from(scope.querySelectorAll(selector)); }

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---- Initials for avatars ------------------------------------------------*/
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}
