// ========== Overview Section ==========
let profileMap = null;
let scoreBreakdownChart = null;

function renderOverview(city, detail) {
  const raw = detail?.raw_values || {};
  const scores = detail?.scores || {};
  const eq = detail?.equity || {};
  const pm25 = city.pm25_avg != null ? city.pm25_avg.toFixed(1) : 'N/A';
  const no2 = city.no2_avg != null ? city.no2_avg.toFixed(1) : 'N/A';
  const score = city.final_score != null ? city.final_score.toFixed(1) : 'N/A';
  const region = city.region || 'N/A';
  const tier = city.tier || 'N/A';

  // ---- City Overview card (hero with text + image) ----
  const overviewHero = document.getElementById('overview-hero');
  const cityImgSrc = city.has_image ? `/images/${city.id}_transparent.png` : '';
  // Score assessment
  const scoreNum = city.final_score;
  const assessment = scoreNum >= 70 ? 'strong' : scoreNum >= 55 ? 'moderate' : scoreNum >= 45 ? 'below average' : scoreNum >= 35 ? 'poor' : 'very poor';
  const whoStatus = parseFloat(pm25) <= 5 ? 'meets the WHO annual guideline' : parseFloat(pm25) <= 10 ? 'is within WHO Interim Target 4' : parseFloat(pm25) <= 15 ? 'is within WHO Interim Target 3' : parseFloat(pm25) <= 25 ? 'is within WHO Interim Target 2' : parseFloat(pm25) <= 35 ? 'is within WHO Interim Target 1' : 'exceeds all WHO guidelines';

  overviewHero.innerHTML = `
    <div class="overview-hero-text">
      <h2 class="overview-hero-title">${city.name}, ${city.iso}</h2>
      <p class="overview-hero-desc">
        ${city.name} is located in the <strong>${region}</strong> region and is classified as a
        <strong>${tier}</strong> city. With a composite score of <strong>${score}</strong>,
        the city's air quality performance is <strong>${assessment}</strong>.
        Its PM2.5 annual average of ${pm25} µg/m³ ${whoStatus},
        while NO2 levels average ${no2} µg/m³.
        ${city.has_policy ? ' Policy performance data is also available for this city.' : ''}
      </p>
    </div>
    <div class="overview-hero-img" ${cityImgSrc ? '' : 'style="display:none"'}>
      <div class="overview-hero-img-blur" ${cityImgSrc ? `style="background-image:url('${cityImgSrc}')"` : ''}></div>
      <img src="${cityImgSrc}" alt="${city.name} boundary" />
    </div>
  `;

  // ---- Stat cards (3x2 grid with icons) ----
  const statsEl = document.getElementById('overview-stats');
  statsEl.innerHTML = `
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:var(--green-600)">eco</span>
      <div>
        <div class="overview-stat-value">${pm25}</div>
        <div class="overview-stat-label">PM2.5 µg/m³</div>
      </div>
    </div>
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:var(--blue-500)">cloud</span>
      <div>
        <div class="overview-stat-value">${no2}</div>
        <div class="overview-stat-label">NO2 µg/m³</div>
      </div>
    </div>
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:var(--green-700)">speed</span>
      <div>
        <div class="overview-stat-value">${score}</div>
        <div class="overview-stat-label">Composite Score</div>
      </div>
    </div>
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:var(--purple-500)">public</span>
      <div>
        <div class="overview-stat-value" style="font-size:16px">${region}</div>
        <div class="overview-stat-label">Region</div>
      </div>
    </div>
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:var(--orange-500)">layers</span>
      <div>
        <div class="overview-stat-value" style="font-size:16px">${tier}</div>
        <div class="overview-stat-label">Data Tier</div>
      </div>
    </div>
    <div class="overview-stat-card">
      <span class="material-icons overview-stat-icon" style="color:${city.has_policy ? 'var(--green-500)' : 'var(--gray-400)'}">verified</span>
      <div>
        <div class="overview-stat-value" style="font-size:16px">${city.has_policy ? 'Yes' : 'No'}</div>
        <div class="overview-stat-label">Policy Data</div>
      </div>
    </div>
  `;

  // ---- Location map ----
  if (profileMap) profileMap.remove();
  if (city.lat && city.lng) {
    profileMap = L.map('profile-map').setView([city.lat, city.lng], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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

    setTimeout(() => profileMap.invalidateSize(), 100);
  }

  // ---- Score breakdown chart ----
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
  const colors = ['#2d6a4f', '#40916c', '#74c69d'];

  if (detail?.has_policy && detail?.policy_score != null) {
    labels.push('Policy');
    values.push(detail.policy_score);
    colors.push('#f59e0b');
  }

  scoreBreakdownChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Score',
        data: values,
        backgroundColor: 'rgba(45, 106, 79, 0.15)',
        borderColor: '#2d6a4f',
        borderWidth: 2,
        pointBackgroundColor: colors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 25, font: { size: 10 } },
          pointLabels: { font: { size: 12, weight: '600' } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          angleLines: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    },
  });
}
