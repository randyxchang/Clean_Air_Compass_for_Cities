// ========== Policy Section ==========
let _policyLoaded = null;
let policyCompareChart = null;

function loadPolicy(city) {
  if (_policyLoaded === city.id) return;

  const detail = city.detail || {};
  if (!detail.has_policy || detail.policy_score == null) return;

  renderPolicyHighlight(detail);
  renderPolicyCompareChart(detail);

  _policyLoaded = city.id;
}

function renderPolicyHighlight(detail) {
  const el = document.getElementById('policy-highlight');
  const policyScore = detail.policy_score;
  const scores = detail.scores || {};
  const finalScore = detail.final_score;

  // Compute score without policy (weighted average of non-policy components)
  const pm25 = scores.pm25_score ?? 0;
  const no2 = scores.no2_score ?? 0;
  const equity = scores.equity_score ?? 0;
  const scoreWithoutPolicy = ((pm25 + no2 + equity) / 3);

  const boost = finalScore - scoreWithoutPolicy;
  const boostColor = boost > 0 ? 'var(--green-600)' : boost < 0 ? 'var(--red-500)' : 'var(--gray-500)';
  const boostSign = boost > 0 ? '+' : '';

  el.innerHTML = `
    <div class="policy-card">
      <div class="policy-card-value">${policyScore.toFixed(1)}</div>
      <div class="policy-card-label">Policy Score</div>
      <div class="policy-card-desc">Out of 100. Measures the strength and comprehensiveness of air quality policies.</div>
    </div>
    <div class="policy-card">
      <div class="policy-card-value">${finalScore.toFixed(1)}</div>
      <div class="policy-card-label">Final Composite Score</div>
      <div class="policy-card-desc">Includes policy performance alongside air quality and equity metrics.</div>
    </div>
    <div class="policy-card">
      <div class="policy-card-value">${scoreWithoutPolicy.toFixed(1)}</div>
      <div class="policy-card-label">Score Without Policy</div>
      <div class="policy-card-desc">Composite score based only on PM2.5, NO2, and equity components.</div>
    </div>
    <div class="policy-card">
      <div class="policy-card-value" style="color:${boostColor}">${boostSign}${boost.toFixed(1)}</div>
      <div class="policy-card-label">Policy Impact</div>
      <div class="policy-card-desc">How much policy performance changes the city's overall composite score.</div>
    </div>
  `;
}

function renderPolicyCompareChart(detail) {
  const ctx = document.getElementById('policy-compare-chart').getContext('2d');
  if (policyCompareChart) policyCompareChart.destroy();

  const scores = detail.scores || {};

  policyCompareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['PM2.5', 'NO2', 'Equity', 'Policy'],
      datasets: [{
        label: 'Component Score',
        data: [
          scores.pm25_score ?? 0,
          scores.no2_score ?? 0,
          scores.equity_score ?? 0,
          detail.policy_score ?? 0,
        ],
        backgroundColor: ['#2d6a4f', '#40916c', '#74c69d', '#f59e0b'],
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y.toFixed(1)} / 100`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Score (0-100)' },
        },
      },
    },
  });
}
