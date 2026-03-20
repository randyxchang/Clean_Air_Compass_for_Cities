// ========== Equity Tab ==========
let _equityLoaded = null;
let equityMap = null;
let equityGeoLayer = null;
let equityPollutant = 'pm25';

async function loadEquity(city) {
  if (_equityLoaded === city.id) return;

  const loadingEl = document.getElementById('equity-loading');
  const contentEl = document.getElementById('equity-content');
  loadingEl.classList.remove('hidden');
  contentEl.classList.add('hidden');

  try {
    // Render equity stats from detail
    const detail = city.detail || {};
    const eq = detail.equity || {};
    renderEquityStats(eq);

    // Fetch GeoJSON if available
    if (city.has_geojson) {
      const res = await fetch(`/api/cities/${city.id}/geojson`);
      if (res.ok) {
        const geojson = await res.json();
        renderEquityMap(city, geojson, eq);
      }
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    _equityLoaded = city.id;
  } catch (err) {
    loadingEl.textContent = 'Error loading equity data.';
  }
}

function renderEquityStats(eq) {
  const el = document.getElementById('equity-stats');
  const stats = [
    { label: 'PM2.5 Income GINI', value: eq.PM25_INC_GINI },
    { label: 'NO2 Income GINI', value: eq.NO2_INC_GINI },
    { label: 'PM2.5 Concentration', value: eq.PM25_CONC },
    { label: 'NO2 Concentration', value: eq.NO2_CONC },
  ];

  el.innerHTML = stats
    .map(
      (s) => `
    <div class="profile-stat">
      <div class="profile-stat-value">${s.value != null ? s.value.toFixed(3) : 'N/A'}</div>
      <div class="profile-stat-label">${s.label}</div>
    </div>
  `
    )
    .join('');
}

function renderEquityMap(city, geojson, equity) {
  if (equityMap) equityMap.remove();

  equityMap = L.map('equity-map').setView([city.lat, city.lng], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(equityMap);

  // Store GeoJSON for pollutant toggle
  equityMap._geojsonData = geojson;
  equityMap._equityData = equity;

  addEquityLayer(geojson);
}

function addEquityLayer(geojson) {
  if (equityGeoLayer) {
    equityMap.removeLayer(equityGeoLayer);
  }

  equityGeoLayer = L.geoJSON(geojson, {
    style: (feature) => ({
      fillColor: '#40916c',
      fillOpacity: 0.4,
      color: '#2d6a4f',
      weight: 1,
    }),
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.nbhd_name || feature.properties?.nbhd_code || '';
      if (name) {
        layer.bindTooltip(name, { sticky: true });
      }
    },
  }).addTo(equityMap);

  equityMap.fitBounds(equityGeoLayer.getBounds());
}

function setEquityPollutant(pollutant) {
  equityPollutant = pollutant;
  document.getElementById('eq-toggle-pm25').classList.toggle('active', pollutant === 'pm25');
  document.getElementById('eq-toggle-no2').classList.toggle('active', pollutant === 'no2');

  // Re-render with different colors (visual distinction)
  if (equityGeoLayer && equityMap) {
    const color = pollutant === 'pm25' ? '#40916c' : '#2196F3';
    const border = pollutant === 'pm25' ? '#2d6a4f' : '#1565C0';
    equityGeoLayer.setStyle({
      fillColor: color,
      fillOpacity: 0.4,
      color: border,
      weight: 1,
    });
  }
}
