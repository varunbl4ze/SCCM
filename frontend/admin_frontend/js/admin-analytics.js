/* ==========================================================================
   admin-analytics.js — analytics & reports page.
   Talks to: GET /api/admin/analytics
   Uses Chart.js (loaded via CDN in analytics.html) for the two canvas
   charts; category/department breakdowns render as simple CSS bar rows
   since they're just labeled counts, not worth a full chart each.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await requireAdmin();
  if (!ok) return;

  renderNavUser();
  initAppShell();
  await loadAnalytics();
});

async function loadAnalytics() {
  try {
    const { data } = await API.admin.analytics();

    const totalComplaints = Object.values(data.status_counts).reduce((a, b) => a + b, 0);
    const last7DaysTotal = Object.values(data.daily_counts_last_7_days).reduce((a, b) => a + b, 0);

    document.getElementById('metricTotal').textContent = totalComplaints;
    document.getElementById('metricResolved').textContent = data.status_counts.resolved ?? 0;
    document.getElementById('metricAvgHours').textContent = data.avg_resolution_hours ?? '—';
    document.getElementById('metricLast7Days').textContent = last7DaysTotal;

    renderStatusChart(data.status_counts);
    renderTrendChart(data.daily_counts_last_7_days);
    renderBars('categoryBars', data.category_counts);
    renderBars('departmentBars', data.department_counts);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStatusChart(statusCounts) {
  const ctx = document.getElementById('statusChart');
  const labels = Object.keys(statusCounts).map(statusLabel);
  const values = Object.values(statusCounts);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#c9822d', '#3e6fa8', '#2f8558', '#b1452f'],
        borderWidth: 0,
      }],
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Poppins' } } } },
    },
  });
}

function renderTrendChart(dailyCounts) {
  const ctx = document.getElementById('trendChart');
  // Build a stable 7-day sequence (oldest -> newest) even for days with 0.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days.map((d) => d.slice(5)), // MM-DD
      datasets: [{
        label: 'Complaints filed',
        data: days.map((d) => dailyCounts[d] || 0),
        backgroundColor: '#2f8558',
        borderRadius: 6,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function renderBars(containerId, counts) {
  const container = document.getElementById(containerId);
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    container.innerHTML = '<p class="text-muted-custom small mb-0">No data yet.</p>';
    return;
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);

  container.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label.replace(/_/g, ' '))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
      <div class="bar-value">${value}</div>
    </div>
  `).join('');
}
