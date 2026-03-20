// ========== Sources & Health Impacts Tab ==========
let _sourcesLoaded = null;
let sourceChart = null;
let healthChart = null;

async function loadSources(city) {
  if (_sourcesLoaded === city.id) return;
  if (!city.has_health) return;

  const loadingEl = document.getElementById('sources-loading');
  const contentEl = document.getElementById('sources-content');
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');

  try {
    const res = await fetch(`/api/cities/${city.id}/health`);
    if (!res.ok) {
      loadingEl.textContent = 'No health data available for this city.';
      return;
    }

    const data = await res.json();
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    renderSourceChart(data);
    renderHealthChart(data);
    renderHealthMetrics(data);

    _sourcesLoaded = city.id;
  } catch (err) {
    loadingEl.textContent = 'Error loading health data.';
  }
}

function renderSourceChart(data) {
  const ctx = document.getElementById('source-chart').getContext('2d');
  if (sourceChart) sourceChart.destroy();

  const gc = data.grand_categories || {};
  const labels = Object.keys(gc);
  const values = Object.values(gc);
  const colors = ['#2d6a4f', '#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#795548'];

  sourceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Contribution (%)',
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: '% Contribution' } },
      },
    },
  });
}

function renderHealthChart(data) {
  const ctx = document.getElementById('health-chart').getContext('2d');
  if (healthChart) healthChart.destroy();

  const outcomes = data.health_outcomes || {};
  // Only include percentage fields
  const pctFields = ['COPD', 'DM', 'LRI', 'LC', 'IHD', 'Stroke'];
  const labels = [];
  const values = [];
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

  pctFields.forEach((field, i) => {
    if (outcomes[field] != null) {
      labels.push(field);
      values.push(outcomes[field]);
    }
  });

  healthChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
          },
        },
      },
    },
  });
}

function renderHealthMetrics(data) {
  const el = document.getElementById('health-metrics');
  const metrics = [];

  if (data.total_mortality != null) {
    metrics.push({ value: formatNumber(data.total_mortality), label: 'Attributable Deaths' });
  }
  if (data.life_expectancy_gain != null) {
    metrics.push({ value: `+${data.life_expectancy_gain}`, label: 'Life Exp. Gain (yrs) if WHO met' });
  }
  if (data.pm25_weighted_avg != null) {
    metrics.push({ value: data.pm25_weighted_avg, label: 'Pop. Weighted PM2.5 (µg/m³)' });
  }

  const outcomes = data.health_outcomes || {};
  if (outcomes.preterm_births != null) {
    metrics.push({ value: formatNumber(outcomes.preterm_births), label: 'Pre-Term Births' });
  }
  if (outcomes.low_birth_weight != null) {
    metrics.push({ value: formatNumber(outcomes.low_birth_weight), label: 'Low Birth Weight' });
  }

  el.innerHTML = metrics
    .map(
      (m) => `
    <div class="health-metric">
      <div class="health-metric-value">${m.value}</div>
      <div class="health-metric-label">${m.label}</div>
    </div>
  `
    )
    .join('');
}
