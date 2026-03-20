// ========== Shared State ==========
let cities = [];
let selectedCity = null;
let heroMap = null;
let fullMap = null;
let fullMapInitialized = false;

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/cities');
  cities = await res.json();

  initNavigation();
  initHeroMap();
  renderAboutStats();
  renderCityList();
  renderCompareCheckboxes();

  // City search
  document.getElementById('city-search').addEventListener('input', (e) => {
    filterCityList(e.target.value);
  });
});

// ========== Navigation ==========
function initNavigation() {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });

  // Profile sub-tabs
  document.querySelectorAll('.profile-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
  });
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));

  const viewMap = { about: 'view-about', map: 'view-map', 'city-profile': 'view-city-profile', compare: 'view-compare' };
  document.getElementById(viewMap[viewName]).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  setTimeout(() => {
    if (heroMap) heroMap.invalidateSize();
    if (viewName === 'map') {
      if (!fullMapInitialized) initFullMap();
      else if (fullMap) fullMap.invalidateSize();
    }
  }, 100);
}

function switchProfileTab(tabName) {
  document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

  document.querySelector(`.profile-tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Lazy load tab data
  if (tabName === 'air-quality' && selectedCity) loadAirQuality(selectedCity);
  if (tabName === 'equity' && selectedCity) loadEquity(selectedCity);
  if (tabName === 'sources' && selectedCity) loadSources(selectedCity);
}

// ========== Hero Map ==========
function initHeroMap() {
  heroMap = L.map('hero-map', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    dragging: false,
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(heroMap);

  cities.forEach((city) => {
    if (!city.lat || !city.lng) return;

    const color = scoreColor(city.final_score);
    const marker = L.circleMarker([city.lat, city.lng], {
      radius: 5,
      fillColor: color,
      color: 'white',
      weight: 1,
      fillOpacity: 0.8,
    }).addTo(heroMap);

    marker.bindTooltip(
      `<strong>${city.name}</strong><br>Score: ${city.final_score ? city.final_score.toFixed(1) : 'N/A'}`,
      { direction: 'top' }
    );

    marker.on('click', () => {
      showView('city-profile');
      selectCity(city.id);
    });
  });
}

// ========== About Stats ==========
function renderAboutStats() {
  document.getElementById('stat-cities').textContent = cities.length;
  document.getElementById('stat-policy-cities').textContent = cities.filter((c) => c.has_policy).length;
  const regions = new Set(cities.map((c) => c.region).filter(Boolean));
  document.getElementById('stat-regions').textContent = regions.size;
}

// ========== City List ==========
function renderCityList() {
  const list = document.getElementById('city-list');
  list.innerHTML = cities
    .map(
      (city) => `
    <div class="city-list-item" data-city="${city.id}" onclick="selectCity('${city.id}')">
      <div>
        <div class="city-name">${city.name}</div>
        <div class="city-country">${city.iso}${city.region ? ' · ' + city.region : ''}</div>
      </div>
      <span class="city-score" style="color: ${scoreColor(city.final_score)}">${city.final_score ? city.final_score.toFixed(0) : '--'}</span>
    </div>
  `
    )
    .join('');
}

function filterCityList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.city-list-item').forEach((el) => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? '' : 'none';
  });
}

// ========== Select City ==========
async function selectCity(cityId) {
  const citySummary = cities.find((c) => c.id === cityId);
  if (!citySummary) return;

  // Update sidebar
  document.querySelectorAll('.city-list-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.city === cityId);
  });

  // Fetch detail
  let cityDetail;
  try {
    const res = await fetch(`/api/cities/${cityId}`);
    cityDetail = await res.json();
  } catch {
    cityDetail = { summary: citySummary };
  }

  selectedCity = { ...citySummary, detail: cityDetail };

  // Show content
  document.getElementById('profile-placeholder').classList.add('hidden');
  document.getElementById('profile-content').classList.remove('hidden');

  // Header
  document.getElementById('profile-city-name').textContent = citySummary.name;
  document.getElementById('profile-country').textContent = `${citySummary.iso} · ${citySummary.region || ''}`;

  const badge = document.getElementById('profile-score-badge');
  badge.textContent = citySummary.final_score ? `Score: ${citySummary.final_score.toFixed(1)}` : 'No Score';

  // Show/hide conditional tabs
  const srcBtn = document.getElementById('tab-btn-sources');
  const polBtn = document.getElementById('tab-btn-policy');
  srcBtn.classList.toggle('hidden', !citySummary.has_health);
  polBtn.classList.toggle('hidden', !citySummary.has_policy);

  // Reset to overview tab
  switchProfileTab('overview');

  // Render overview
  renderOverview(selectedCity, cityDetail);

  // Reset lazy-loaded tabs
  document.getElementById('aq-content').classList.add('hidden');
  document.getElementById('aq-loading').classList.remove('hidden');
  document.getElementById('equity-content').classList.add('hidden');
  document.getElementById('equity-loading').classList.remove('hidden');
  if (document.getElementById('sources-content')) {
    document.getElementById('sources-content').classList.add('hidden');
    document.getElementById('sources-loading').classList.remove('hidden');
  }

  // Clear cached tab data
  _aqLoaded = null;
  _equityLoaded = null;
  _sourcesLoaded = null;
}

// ========== Full Map View ==========
function initFullMap() {
  fullMap = L.map('full-map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([20, 0], 3);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(fullMap);

  cities.forEach((city) => {
    if (!city.lat || !city.lng) return;

    const color = scoreColor(city.final_score);
    const radius = city.final_score != null ? Math.max(5, Math.min(12, city.final_score / 10)) : 5;

    const marker = L.circleMarker([city.lat, city.lng], {
      radius,
      fillColor: color,
      color: 'white',
      weight: 2,
      fillOpacity: 0.85,
    }).addTo(fullMap);

    marker.bindTooltip(
      `<strong>${city.name}</strong> (${city.iso})<br>Score: ${city.final_score ? city.final_score.toFixed(1) : 'N/A'}`,
      { direction: 'top' }
    );

    marker.on('click', () => showMapCityInfo(city));
  });

  fullMapInitialized = true;
}

function showMapCityInfo(city) {
  const nameEl = document.getElementById('map-city-name');
  const detailsEl = document.getElementById('map-city-details');
  const infoEl = document.getElementById('map-city-info');
  const btn = document.getElementById('map-view-profile-btn');

  nameEl.textContent = city.name;

  const rows = [
    ['Country', city.iso],
    ['Region', city.region || 'N/A'],
    ['Composite Score', city.final_score ? city.final_score.toFixed(1) : 'N/A'],
    ['PM2.5 (µg/m³)', city.pm25_avg ? city.pm25_avg.toFixed(1) : 'N/A'],
    ['NO2 (µg/m³)', city.no2_avg ? city.no2_avg.toFixed(1) : 'N/A'],
    ['Data Tier', city.tier || 'N/A'],
    ['Has Policy Data', city.has_policy ? 'Yes' : 'No'],
  ];

  detailsEl.innerHTML = rows
    .map(([label, value]) => `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`)
    .join('');

  infoEl.classList.remove('hidden');

  btn.onclick = () => {
    showView('city-profile');
    selectCity(city.id);
  };

  // Pan map to city
  fullMap.setView([city.lat, city.lng], 8, { animate: true });
}

// ========== Helpers ==========
function scoreColor(score) {
  if (score == null) return '#9ca3af';
  if (score >= 70) return '#22c55e';
  if (score >= 55) return '#84cc16';
  if (score >= 45) return '#eab308';
  if (score >= 35) return '#f59e0b';
  return '#ef4444';
}

function formatNumber(n) {
  if (n == null) return 'N/A';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

// WHO 2021 palette from README
const WHO_PALETTE = {
  "Within Recommended Value of 5µg/m^3": "#00E400",
  "Within WHO Interim Target 4 of 10µg/m^3": "#FB6A4A",
  "Within WHO Interim Target 3 of 15µg/m^3": "#EF3B2C",
  "Within WHO Interim Target 2 of 25µg/m^3": "#CB181D",
  "Within WHO Interim Target 1 of 35µg/m^3": "#A50F15",
  "Exceeding All Recommended Guidelines & Targets": "#67000D",
};

const WHO_LABELS = {
  "Within Recommended Value of 5µg/m^3": "< 5 µg/m³",
  "Within WHO Interim Target 4 of 10µg/m^3": "5-10 µg/m³",
  "Within WHO Interim Target 3 of 15µg/m^3": "10-15 µg/m³",
  "Within WHO Interim Target 2 of 25µg/m^3": "15-25 µg/m³",
  "Within WHO Interim Target 1 of 35µg/m^3": "25-35 µg/m³",
  "Exceeding All Recommended Guidelines & Targets": "> 35 µg/m³",
};
