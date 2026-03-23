// ========== Air Quality Tab ==========
let _aqLoaded = null;
let pm25TrendChart = null;
let dailyChart = null;
let whoDistChart = null;

async function loadAirQuality(city) {
  if (_aqLoaded === city.id) return;

  const loadingEl = document.getElementById('aq-loading');
  const contentEl = document.getElementById('aq-content');
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');

  try {
    // Fetch smogstripes
    let smogData = null;
    if (city.has_smogstripes) {
      const res = await fetch(`/api/cities/${city.id}/smogstripes`);
      if (res.ok) smogData = await res.json();
    }

    // Fetch daily
    let dailyData = null;
    if (city.has_daily) {
      const res = await fetch(`/api/cities/${city.id}/daily`);
      if (res.ok) dailyData = await res.json();
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    if (smogData) {
      renderSmogstripes(smogData);
      renderPm25Trend(smogData);
    }

    const dailySection = document.getElementById('daily-section');
    const whoDistSection = document.getElementById('who-dist-section');
    if (dailyData) {
      dailySection.classList.remove('hidden');
      whoDistSection.classList.remove('hidden');
      renderDailyChart(dailyData);
      renderWhoDistChart(dailyData);
    } else {
      dailySection.classList.add('hidden');
      whoDistSection.classList.add('hidden');
    }

    _aqLoaded = city.id;
  } catch (err) {
    loadingEl.textContent = 'Error loading air quality data.';
  }
}

function renderSmogstripes(data) {
  const container = document.getElementById('smogstripes-container');
  container.innerHTML = data.years
    .map((yr) => {
      const color = WHO_PALETTE[yr.who_category] || '#ccc';
      return `<div class="smogstripe-bar" style="background:${color}">
        <div class="tooltip">${yr.year}: ${yr.pm25_mean?.toFixed(1)} µg/m³</div>
      </div>`;
    })
    .join('');

  // Legend
  const legendEl = document.getElementById('smogstripes-legend');
  legendEl.innerHTML = Object.entries(WHO_PALETTE)
    .map(([cat, color]) => {
      const label = WHO_LABELS[cat] || cat;
      return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${label}</div>`;
    })
    .join('');

  // Add trend info
  const trend = data.trend_estimate;
  const pVal = data.trend_p_value;
  if (trend != null) {
    const dir = trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable';
    const sig = pVal != null && pVal < 0.05 ? '(significant)' : '(not significant)';
    legendEl.innerHTML += `<div class="legend-item" style="margin-left:auto;font-weight:600">Trend: ${dir} ${sig}</div>`;
  }
}

function renderPm25Trend(data) {
  const ctx = document.getElementById('pm25-trend-chart').getContext('2d');
  if (pm25TrendChart) pm25TrendChart.destroy();

  pm25TrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.years.map((d) => d.year),
      datasets: [
        {
          label: 'PM2.5 (µg/m³)',
          data: data.years.map((d) => d.pm25_mean),
          borderColor: '#40916c',
          backgroundColor: 'rgba(64, 145, 108, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#40916c',
        },
        {
          label: 'WHO Guideline (5 µg/m³)',
          data: data.years.map(() => 5),
          borderColor: '#ef4444',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'µg/m³' } } },
    },
  });
}

function renderDailyChart(data) {
  const ctx = document.getElementById('daily-chart').getContext('2d');
  if (dailyChart) dailyChart.destroy();

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.monthly.map((m) => months[m.month - 1]),
      datasets: [
        {
          label: 'Avg PM2.5',
          data: data.monthly.map((m) => m.avg_pm25),
          backgroundColor: data.monthly.map((m) => {
            if (m.avg_pm25 <= 5) return '#00E400';
            if (m.avg_pm25 <= 10) return '#FB6A4A';
            if (m.avg_pm25 <= 15) return '#EF3B2C';
            if (m.avg_pm25 <= 25) return '#CB181D';
            if (m.avg_pm25 <= 35) return '#A50F15';
            return '#67000D';
          }),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'µg/m³' } } },
    },
  });
}

function renderWhoDistChart(data) {
  const ctx = document.getElementById('who-dist-chart').getContext('2d');
  if (whoDistChart) whoDistChart.destroy();

  const dist = data.who_distribution || {};
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  const colors = labels.map((l) => {
    // Match WHO palette keys loosely
    for (const [key, color] of Object.entries(WHO_PALETTE)) {
      if (l.includes('Recommended') && key.includes('Recommended')) return color;
      if (l.includes('Target 4') || l.includes('1st')) {
        if (key.includes('Target 4')) return color;
      }
      if (l.includes('Target 3') || l.includes('2nd')) {
        if (key.includes('Target 3')) return color;
      }
      if (l.includes('Target') && l.includes('25') || l.includes('3rd')) {
        if (key.includes('Target 2')) return color;
      }
      if (l.includes('Target') && l.includes('35') || l.includes('4th')) {
        if (key.includes('Target 1')) return color;
      }
      if (l.includes('Exceeding') && key.includes('Exceeding')) return color;
    }
    return '#ccc';
  });

  whoDistChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map((l) => {
        if (l.length > 30) return l.substring(0, 28) + '...';
        return l;
      }),
      datasets: [{
        data: values,
        backgroundColor: colors,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 } } },
      },
    },
  });
}
