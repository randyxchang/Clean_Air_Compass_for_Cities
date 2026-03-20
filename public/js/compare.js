// ========== Compare View ==========
let compareScoreChart = null;
let compareComponentsChart = null;

function renderCompareCheckboxes() {
  const container = document.getElementById('compare-checkboxes');

  // Group by region
  const grouped = {};
  cities.forEach((city) => {
    const region = city.region || 'Other';
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push(city);
  });

  let html = '';
  for (const [region, regionCities] of Object.entries(grouped).sort()) {
    regionCities.forEach((city) => {
      html += `<label class="compare-checkbox" data-name="${city.name.toLowerCase()} ${city.iso.toLowerCase()} ${region.toLowerCase()}">
        <input type="checkbox" value="${city.id}">
        ${city.name} (${city.iso})
      </label>`;
    });
  }
  container.innerHTML = html;

  // Search filter
  document.getElementById('compare-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll('.compare-checkbox').forEach((el) => {
      el.style.display = el.dataset.name.includes(q) ? '' : 'none';
    });
  });
}

async function runComparison() {
  const checked = [...document.querySelectorAll('#compare-checkboxes input:checked')].map((el) => el.value);
  if (checked.length < 2) {
    alert('Please select at least 2 cities to compare.');
    return;
  }

  const res = await fetch(`/api/compare?ids=${checked.join(',')}`);
  const data = await res.json();

  document.getElementById('compare-results').classList.remove('hidden');

  renderCompareScoreChart(data);
  renderCompareComponentsChart(data);
  renderCompareTable(data);
}

function renderCompareScoreChart(data) {
  const ctx = document.getElementById('compare-score-chart').getContext('2d');
  if (compareScoreChart) compareScoreChart.destroy();

  compareScoreChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.summary.name),
      datasets: [{
        label: 'Final Score',
        data: data.map((d) => d.summary.final_score),
        backgroundColor: data.map((d) => scoreColor(d.summary.final_score)),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function renderCompareComponentsChart(data) {
  const ctx = document.getElementById('compare-components-chart').getContext('2d');
  if (compareComponentsChart) compareComponentsChart.destroy();

  const components = ['pm25_score', 'no2_score', 'equity_score'];
  const componentLabels = ['PM2.5 Score', 'NO2 Score', 'Equity Score'];
  const colors = ['#2d6a4f', '#40916c', '#74c69d', '#95d5b2', '#d8f3dc', '#f59e0b'];

  compareComponentsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: componentLabels,
      datasets: data.map((d, i) => ({
        label: d.summary.name,
        data: components.map((c) => d.scores?.[c] ?? 0),
        backgroundColor: colors[i % colors.length],
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function renderCompareTable(data) {
  const container = document.getElementById('compare-table-container');

  const rows = [
    { label: 'Country', fn: (d) => d.summary.iso },
    { label: 'Region', fn: (d) => d.summary.region || 'N/A' },
    { label: 'Final Score', fn: (d) => d.summary.final_score?.toFixed(1) ?? 'N/A' },
    { label: 'PM2.5 (µg/m³)', fn: (d) => d.summary.pm25_avg?.toFixed(1) ?? 'N/A' },
    { label: 'NO2 (µg/m³)', fn: (d) => d.summary.no2_avg?.toFixed(1) ?? 'N/A' },
    { label: 'PM2.5 Score', fn: (d) => d.scores?.pm25_score?.toFixed(1) ?? 'N/A' },
    { label: 'NO2 Score', fn: (d) => d.scores?.no2_score?.toFixed(1) ?? 'N/A' },
    { label: 'Equity Score', fn: (d) => d.scores?.equity_score?.toFixed(1) ?? 'N/A' },
    { label: 'Policy Score', fn: (d) => d.policy_score?.toFixed(1) ?? 'N/A' },
    { label: 'Has Policy Data', fn: (d) => d.summary.has_policy ? 'Yes' : 'No' },
  ];

  container.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Metric</th>
          ${data.map((d) => `<th>${d.summary.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${row.label}</td>
            ${data.map((d) => `<td>${row.fn(d)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
