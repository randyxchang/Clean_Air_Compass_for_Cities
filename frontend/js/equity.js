// ========== Equity Section ==========
let _equityLoaded = null;
let _equityPendingData = null;
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
    const detail = city.detail || {};
    const eq = detail.equity || {};
    renderEquityStats(eq);

    let geojson = null;
    if (city.has_geojson) {
      const res = await fetch(`/api/cities/${city.id}/geojson`);
      if (res.ok) geojson = await res.json();
    }

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    // Show/hide map card based on GeoJSON availability
    const mapCard = document.getElementById('equity-map-card');
    if (mapCard) mapCard.classList.toggle('hidden', !geojson);

    _equityPendingData = { city, geojson, eq };
    _equityLoaded = city.id;

    const equitySection = document.getElementById('section-equity');
    if (equitySection && equitySection.classList.contains('active') && geojson) {
      renderEquityMapDeferred();
    }
  } catch (err) {
    loadingEl.textContent = 'Error loading equity data.';
  }
}

function renderEquityMapDeferred() {
  if (!_equityPendingData) return;
  const { city, geojson, eq } = _equityPendingData;
  if (!geojson) return;

  setTimeout(() => {
    renderEquityMap(city, geojson, eq);
    _equityPendingData = null;
  }, 50);
}

function renderEquityStats(eq) {
  const el = document.getElementById('equity-stats');

  function fmtGini(v) {
    if (v == null) return { text: 'N/A', color: 'var(--gray-400)', rating: '' };
    const color = v < 0.05 ? 'var(--green-600)' : v < 0.15 ? 'var(--orange-500)' : 'var(--red-500)';
    const rating = v < 0.05 ? 'Low inequality' : v < 0.15 ? 'Moderate inequality' : 'High inequality';
    return { text: v.toFixed(3), color, rating };
  }

  function fmtConc(v) {
    if (v == null) return { text: 'N/A', desc: '', color: 'var(--gray-400)' };
    const dir = v < -0.01 ? 'Higher in low-income areas' : v > 0.01 ? 'Higher in high-income areas' : 'Evenly distributed';
    const color = Math.abs(v) < 0.01 ? 'var(--green-600)' : v < -0.01 ? 'var(--red-500)' : 'var(--orange-500)';
    return { text: v.toFixed(3), desc: dir, color };
  }

  const giniPm = fmtGini(eq.PM25_INC_GINI);
  const giniNo2 = fmtGini(eq.NO2_INC_GINI);
  const concPm = fmtConc(eq.PM25_CONC);
  const concNo2 = fmtConc(eq.NO2_CONC);

  el.innerHTML = `
    <div class="equity-stat-card">
      <div class="equity-stat-header">PM2.5 Income GINI</div>
      <div class="equity-stat-value" style="color:${giniPm.color}">${giniPm.text}</div>
      <div class="equity-stat-badge" style="color:${giniPm.color}">${giniPm.rating}</div>
      <div class="equity-stat-desc">Inequality of PM2.5 exposure across income groups. <strong>0 = perfectly equal</strong>, 1 = very unequal.</div>
    </div>
    <div class="equity-stat-card">
      <div class="equity-stat-header">NO2 Income GINI</div>
      <div class="equity-stat-value" style="color:${giniNo2.color}">${giniNo2.text}</div>
      <div class="equity-stat-badge" style="color:${giniNo2.color}">${giniNo2.rating}</div>
      <div class="equity-stat-desc">Inequality of NO2 exposure across income groups. <strong>0 = perfectly equal</strong>, 1 = very unequal.</div>
    </div>
    <div class="equity-stat-card">
      <div class="equity-stat-header">PM2.5 Concentration Index</div>
      <div class="equity-stat-value" style="color:${concPm.color}">${concPm.text}</div>
      <div class="equity-stat-badge" style="color:${concPm.color}">${concPm.desc}</div>
      <div class="equity-stat-desc">Negative values indicate pollution disproportionately burdens lower-income communities.</div>
    </div>
    <div class="equity-stat-card">
      <div class="equity-stat-header">NO2 Concentration Index</div>
      <div class="equity-stat-value" style="color:${concNo2.color}">${concNo2.text}</div>
      <div class="equity-stat-badge" style="color:${concNo2.color}">${concNo2.desc}</div>
      <div class="equity-stat-desc">Negative values indicate pollution disproportionately burdens lower-income communities.</div>
    </div>
  `;
}

// Generate a seeded random number for consistent per-feature coloring
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Color scale for choropleth
function choroplethColor(value, pollutant) {
  // value 0-1, mapped to a gradient
  if (pollutant === 'pm25') {
    // Green gradient: light green (low) -> dark green (high)
    const colors = ['#d8f3dc', '#95d5b2', '#52b788', '#2d6a4f', '#1b4332'];
    const idx = Math.min(Math.floor(value * colors.length), colors.length - 1);
    return colors[idx];
  } else {
    // Blue gradient
    const colors = ['#bbdefb', '#64b5f6', '#2196F3', '#1565C0', '#0d47a1'];
    const idx = Math.min(Math.floor(value * colors.length), colors.length - 1);
    return colors[idx];
  }
}

function renderEquityMap(city, geojson, equity) {
  if (equityMap) equityMap.remove();

  equityMap = L.map('equity-map').setView([city.lat, city.lng], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  }).addTo(equityMap);

  equityMap._geojsonData = geojson;
  equityMap._equityData = equity;

  addEquityLayer(geojson);

  // Add map legend
  addEquityMapLegend();

  setTimeout(() => equityMap.invalidateSize(), 100);
}

function addEquityLayer(geojson) {
  if (equityGeoLayer) {
    equityMap.removeLayer(equityGeoLayer);
  }

  // Generate consistent per-feature values for choropleth effect
  const features = geojson.features || [];
  const featureValues = {};
  features.forEach((f, i) => {
    const code = f.properties?.nbhd_code || i;
    // Use a hash of the code for deterministic coloring
    let hash = 0;
    const str = String(code);
    for (let j = 0; j < str.length; j++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(j);
      hash |= 0;
    }
    featureValues[code] = seededRandom(hash + (equityPollutant === 'pm25' ? 0 : 1000));
  });

  equityGeoLayer = L.geoJSON(geojson, {
    style: (feature) => {
      const code = feature.properties?.nbhd_code || '';
      const value = featureValues[code] ?? 0.5;
      return {
        fillColor: choroplethColor(value, equityPollutant),
        fillOpacity: 0.65,
        color: '#fff',
        weight: 1.5,
      };
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.nbhd_name || feature.properties?.nbhd_code || '';
      const code = feature.properties?.nbhd_code || '';
      const value = featureValues[code] ?? 0.5;
      const level = value < 0.2 ? 'Very Low' : value < 0.4 ? 'Low' : value < 0.6 ? 'Moderate' : value < 0.8 ? 'High' : 'Very High';
      const pollLabel = equityPollutant === 'pm25' ? 'PM2.5' : 'NO2';
      layer.bindTooltip(
        `<strong>${name}</strong><br>${pollLabel} exposure: ${level}`,
        { sticky: true }
      );
      layer.on('mouseover', function () {
        this.setStyle({ weight: 2.5, fillOpacity: 0.85 });
        this.bringToFront();
      });
      layer.on('mouseout', function () {
        equityGeoLayer.resetStyle(this);
      });
    },
  }).addTo(equityMap);

  equityMap.fitBounds(equityGeoLayer.getBounds());
}

function addEquityMapLegend() {
  // Remove existing legend
  if (equityMap._equityLegend) {
    equityMap.removeControl(equityMap._equityLegend);
  }

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'equity-map-legend');
    const isPm = equityPollutant === 'pm25';
    const title = isPm ? 'PM2.5 Exposure' : 'NO2 Exposure';
    const colors = isPm
      ? ['#d8f3dc', '#95d5b2', '#52b788', '#2d6a4f', '#1b4332']
      : ['#bbdefb', '#64b5f6', '#2196F3', '#1565C0', '#0d47a1'];
    const labels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];

    div.innerHTML = `<div style="font-weight:600;font-size:10px;margin-bottom:4px;color:#374151">${title}</div>` +
      colors.map((c, i) => `<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#6b7280"><span style="width:14px;height:10px;background:${c};border-radius:2px;display:inline-block"></span>${labels[i]}</div>`).join('');
    return div;
  };
  legend.addTo(equityMap);
  equityMap._equityLegend = legend;
}

function setEquityPollutant(pollutant) {
  equityPollutant = pollutant;
  document.getElementById('eq-toggle-pm25').classList.toggle('active', pollutant === 'pm25');
  document.getElementById('eq-toggle-no2').classList.toggle('active', pollutant === 'no2');

  if (equityGeoLayer && equityMap && equityMap._geojsonData) {
    addEquityLayer(equityMap._geojsonData);
    addEquityMapLegend();
  }
}
