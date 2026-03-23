// ========== Shared State ==========
let cities = [];
let selectedCity = null;
let heroMap = null;
let heroMarkers = [];

// ========== Init ==========
document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/cities');
  cities = await res.json();

  initNavigation();
  initHeroMap();
  renderAboutStats();
  renderCityDropdown();
  renderCompareCheckboxes();

  // City search in profile topbar
  const citySearch = document.getElementById('city-search');
  citySearch.addEventListener('input', (e) => filterCityDropdown(e.target.value));
  citySearch.addEventListener('focus', () => {
    document.getElementById('city-dropdown').classList.add('open');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-topbar-inner')) {
      document.getElementById('city-dropdown').classList.remove('open');
    }
  });

  // Hero city search
  document.getElementById('hero-city-search').addEventListener('input', (e) => {
    filterHeroMarkers(e.target.value);
  });

  // Section sidebar navigation
  document.querySelectorAll('.section-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
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

  document.querySelector('.logo').addEventListener('click', () => showView('about'));
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));

  const viewMap = { about: 'view-about', 'city-profile': 'view-city-profile', compare: 'view-compare' };
  document.getElementById(viewMap[viewName]).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { if (heroMap) heroMap.invalidateSize(); }, 150);
}

// ========== Section Sidebar Navigation ==========
function switchSection(sectionName) {
  document.querySelectorAll('.section-nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.section-panel').forEach((p) => p.classList.remove('active'));

  document.querySelector(`.section-nav-item[data-section="${sectionName}"]`).classList.add('active');
  document.getElementById(`section-${sectionName}`).classList.add('active');

  // Lazy-load section data
  if (sectionName === 'air-quality' && selectedCity) loadAirQuality(selectedCity);
  if (sectionName === 'equity' && selectedCity) loadEquity(selectedCity);
  if (sectionName === 'sources' && selectedCity) loadSources(selectedCity);
  if (sectionName === 'policy' && selectedCity) loadPolicy(selectedCity);

  // Handle maps when switching sections
  setTimeout(() => {
    if (sectionName === 'overview' && typeof profileMap !== 'undefined' && profileMap) profileMap.invalidateSize();
    if (sectionName === 'equity') {
      // If we have pending equity data, render the map now that the container is visible
      if (typeof renderEquityMapDeferred === 'function') renderEquityMapDeferred();
      if (typeof equityMap !== 'undefined' && equityMap) equityMap.invalidateSize();
    }
  }, 100);
}

// ========== Hero Map ==========
function initHeroMap() {
  heroMap = L.map('hero-map', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: true,
    dragging: true,
    maxBounds: [[-85, -200], [85, 200]],
    maxBoundsViscosity: 1.0,
  }).setView([20, 0], 3);

  L.control.zoom({ position: 'bottomright' }).addTo(heroMap);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(heroMap);

  cities.forEach((city) => {
    if (!city.lat || !city.lng) return;

    const color = scoreColor(city.final_score);
    const radius = city.final_score != null ? Math.max(4, Math.min(10, city.final_score / 10)) : 4;

    const marker = L.circleMarker([city.lat, city.lng], {
      radius,
      fillColor: color,
      color: 'rgba(255,255,255,0.6)',
      weight: 1.5,
      fillOpacity: 0.85,
    }).addTo(heroMap);

    marker.bindTooltip(
      `<strong>${city.name}</strong> (${city.iso})<br>Score: ${city.final_score ? city.final_score.toFixed(1) : 'N/A'}`,
      { direction: 'top' }
    );

    marker.on('click', () => showHeroCityInfo(city));
    marker.on('mouseover', function () {
      this.setStyle({ weight: 2.5, color: 'white', fillOpacity: 1 });
      this.setRadius(radius + 2);
    });
    marker.on('mouseout', function () {
      this.setStyle({ weight: 1.5, color: 'rgba(255,255,255,0.6)', fillOpacity: 0.85 });
      this.setRadius(radius);
    });

    marker._cityData = city;
    marker._baseRadius = radius;
    heroMarkers.push(marker);
  });
}

function showHeroCityInfo(city) {
  const nameEl = document.getElementById('hero-city-name');
  const detailsEl = document.getElementById('hero-city-details');
  const infoEl = document.getElementById('hero-city-info');
  const btn = document.getElementById('hero-view-profile-btn');

  nameEl.textContent = city.name;

  const rows = [
    ['Country', city.iso],
    ['Region', city.region || 'N/A'],
    ['Composite Score', city.final_score ? city.final_score.toFixed(1) : 'N/A'],
    ['PM2.5 (µg/m³)', city.pm25_avg ? city.pm25_avg.toFixed(1) : 'N/A'],
    ['NO2 (µg/m³)', city.no2_avg ? city.no2_avg.toFixed(1) : 'N/A'],
  ];

  detailsEl.innerHTML = rows
    .map(([label, value]) => `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`)
    .join('');

  infoEl.classList.remove('hidden');

  btn.onclick = () => {
    showView('city-profile');
    selectCity(city.id);
  };

  heroMap.setView([city.lat, city.lng], 8, { animate: true, duration: 0.8 });
}

function filterHeroMarkers(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    heroMarkers.forEach((m) => {
      m.setStyle({ fillOpacity: 0.85 });
      m.setRadius(m._baseRadius);
    });
    document.getElementById('hero-city-info').classList.add('hidden');
    return;
  }

  let firstMatch = null;
  heroMarkers.forEach((m) => {
    const city = m._cityData;
    const match = city.name.toLowerCase().includes(q) || city.iso.toLowerCase().includes(q);
    m.setStyle({ fillOpacity: match ? 0.95 : 0.08 });
    m.setRadius(match ? m._baseRadius + 2 : 2);
    if (match && !firstMatch) firstMatch = city;
  });

  if (firstMatch) {
    heroMap.setView([firstMatch.lat, firstMatch.lng], 5, { animate: true, duration: 0.5 });
  }
}

// ========== Animated Counter ==========
function animateNumber(el, target, duration = 800) {
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderAboutStats() {
  animateNumber(document.getElementById('stat-cities'), cities.length, 900);
  animateNumber(document.getElementById('stat-policy-cities'), cities.filter((c) => c.has_policy).length, 900);
  animateNumber(document.getElementById('stat-regions'), new Set(cities.map((c) => c.region).filter(Boolean)).size, 700);
}

// ========== City Dropdown ==========
function renderCityDropdown() {
  const dd = document.getElementById('city-dropdown');
  dd.innerHTML = cities
    .map((c) => `
      <div class="city-dropdown-item" data-city="${c.id}" onclick="selectCityFromDropdown('${c.id}')">
        <div>
          <div class="dd-name">${c.name}</div>
          <div class="dd-sub">${c.iso}${c.region ? ' · ' + c.region : ''}</div>
        </div>
        <span class="dd-score" style="color:${scoreColor(c.final_score)}">${c.final_score ? c.final_score.toFixed(0) : '–'}</span>
      </div>`)
    .join('');
}

function filterCityDropdown(query) {
  const q = query.toLowerCase();
  const dd = document.getElementById('city-dropdown');
  dd.classList.add('open');
  dd.querySelectorAll('.city-dropdown-item').forEach((el) => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function selectCityFromDropdown(cityId) {
  document.getElementById('city-dropdown').classList.remove('open');
  const city = cities.find((c) => c.id === cityId);
  if (city) {
    document.getElementById('city-search').value = city.name;
  }
  selectCity(cityId);
}

// ========== Select City ==========
async function selectCity(cityId) {
  const citySummary = cities.find((c) => c.id === cityId);
  if (!citySummary) return;

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
  const content = document.getElementById('profile-content');
  content.classList.remove('hidden');

  // Header
  document.getElementById('profile-city-name').textContent = citySummary.name;
  document.getElementById('profile-country').textContent = `${citySummary.iso} · ${citySummary.region || ''}`;

  const badge = document.getElementById('profile-score-badge');
  badge.textContent = citySummary.final_score ? `Score: ${citySummary.final_score.toFixed(1)}` : 'No Score';

  // Show/hide conditional sidebar nav items
  document.getElementById('nav-btn-sources').classList.toggle('hidden', !citySummary.has_health);
  document.getElementById('nav-btn-policy').classList.toggle('hidden', !citySummary.has_policy);

  // Reset to overview section
  switchSection('overview');

  // Render overview
  renderOverview(selectedCity, cityDetail);

  // Reset lazy-loaded state
  _aqLoaded = null;
  _equityLoaded = null;
  _sourcesLoaded = null;
  _policyLoaded = null;

  document.getElementById('aq-content').classList.add('hidden');
  document.getElementById('aq-loading').classList.remove('hidden');
  document.getElementById('equity-content').classList.add('hidden');
  document.getElementById('equity-loading').classList.remove('hidden');
  if (document.getElementById('sources-content')) {
    document.getElementById('sources-content').classList.add('hidden');
    document.getElementById('sources-loading').classList.remove('hidden');
  }
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
