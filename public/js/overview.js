// ========== Overview Tab ==========
let profileMap = null;
let scoreBreakdownChart = null;

function renderOverview(city, detail) {
  // Stats
  const statsEl = document.getElementById('overview-stats');
  const pm25 = city.pm25_avg != null ? city.pm25_avg.toFixed(1) : 'N/A';
  const no2 = city.no2_avg != null ? city.no2_avg.toFixed(1) : 'N/A';
  const score = city.final_score != null ? city.final_score.toFixed(1) : 'N/A';
  const region = city.region || 'N/A';
  const tier = city.tier || 'N/A';

  statsEl.innerHTML = `
    <div class="profile-stat">
      <div class="profile-stat-value">${pm25}</div>
      <div class="profile-stat-label">PM2.5 (µg/m³)</div>
    </div>
    <div class="profile-stat">
      <div class="profile-stat-value">${no2}</div>
      <div class="profile-stat-label">NO2 (µg/m³)</div>
    </div>
    <div class="profile-stat">
      <div class="profile-stat-value">${score}</div>
      <div class="profile-stat-label">Composite Score</div>
    </div>
    <div class="profile-stat">
      <div class="profile-stat-value" style="font-size:14px">${region}</div>
      <div class="profile-stat-label">Region · ${tier}</div>
    </div>
  `;

  // Map
  if (profileMap) profileMap.remove();
  if (city.lat && city.lng) {
    profileMap = L.map('profile-map').setView([city.lat, city.lng], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(profileMap);
    L.circleMarker([city.lat, city.lng], {
      radius: 10,
      fillColor: scoreColor(city.final_score),
      color: 'white',
      weight: 3,
      fillOpacity: 0.9,
    }).addTo(profileMap);
  }

  // City image
  const imgContainer = document.getElementById('city-image-container');
  const imgEl = document.getElementById('city-image');
  if (city.has_image) {
    imgEl.src = `/images/${city.id}_transparent.png`;
    imgContainer.classList.remove('hidden');
  } else {
    imgContainer.classList.add('hidden');
  }

  // Score breakdown chart
  renderScoreBreakdown(detail);
}

function renderScoreBreakdown(detail) {
  const ctx = document.getElementById('score-breakdown-chart').getContext('2d');
  if (scoreBreakdownChart) scoreBreakdownChart.destroy();

  const scores = detail?.scores || {};
  const labels = ['PM2.5', 'NO2', 'Equity'];
  const values = [
    scores.pm25_score ?? 0,
    scores.no2_score ?? 0,
    scores.equity_score ?? 0,
  ];

  if (detail?.has_policy && detail?.policy_score != null) {
    labels.push('Policy');
    values.push(detail.policy_score);
  }

  scoreBreakdownChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#2d6a4f', '#40916c', '#74c69d', '#f59e0b'],
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score' } } },
    },
  });
}
