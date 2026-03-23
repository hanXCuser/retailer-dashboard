let dashboardState = {
  overview: null,
  authUser: null,
  modelPriceForecasts: [],
  modelSalesForecasts: [],
  seasonalInsights: [],
  weatherInsights: [],
  topProducts: [],
  modelPerformance: [],
  searchTerm: "",
  selectedForecastProduct: "",
  interactionsBound: false
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json();
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload || {})
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || `Request failed for ${path}`);
  }

  return response.json();
}

async function fetchJsonSafe(path, fallbackValue) {
  try {
    return await fetchJson(path);
  } catch (error) {
    console.error(`Dashboard data failed for ${path}:`, error);
    return fallbackValue;
  }
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatCompactNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getSearchTerm() {
  return dashboardState.searchTerm.trim().toLowerCase();
}

function matchesSearch(...values) {
  const term = getSearchTerm();
  if (!term) {
    return true;
  }

  return values.some((value) => String(value || "").toLowerCase().includes(term));
}

function getFilteredPriceForecasts() {
  return dashboardState.modelPriceForecasts.filter((row) =>
    matchesSearch(row.productName, row.category, row.seasonality, row.weatherCondition, row.productId, row.storeId)
  );
}

function getFilteredSalesForecasts() {
  return dashboardState.modelSalesForecasts.filter((row) =>
    matchesSearch(row.productName, row.category, row.seasonality, row.weatherCondition, row.productId, row.storeId)
  );
}

function getFilteredSeasonalInsights() {
  return dashboardState.seasonalInsights.filter((row) => matchesSearch(row.seasonality));
}

function getFilteredWeatherInsights() {
  return dashboardState.weatherInsights.filter((row) => matchesSearch(row.weatherCondition));
}

function getFilteredTopProducts() {
  return dashboardState.topProducts.filter((row) => matchesSearch(row.productName, row.category, row.productId));
}

function getFilteredModelPerformance() {
  return dashboardState.modelPerformance.filter((row) => matchesSearch(row.modelType, row.modelName));
}

function metricCard(metric) {
  const progressWidth = Math.max(8, Math.min(100, Number(metric.progress || 0)));
  return `
    <article class="kpi-card surface">
      <div class="kpi-topline">
        <div class="kpi-label">${metric.label}</div>
        ${metric.badge ? `<span class="kpi-badge ${metric.badgeTone || "neutral"}">${metric.badge}</span>` : ""}
      </div>
      <div class="kpi-value">${metric.value}</div>
      ${metric.comparison ? `<div class="kpi-comparison">${metric.comparison}</div>` : ""}
      <div class="kpi-progress">
        <div class="kpi-progress-fill ${metric.progressTone || "neutral"}" style="width:${progressWidth}%"></div>
      </div>
      <div class="kpi-detail">${metric.detail}</div>
    </article>
  `;
}

function performanceCard(model) {
  return `
    <article class="performance-card">
      <div>
        <div class="performance-label">${String(model.modelType || "").toUpperCase()}</div>
        <div class="performance-name">${model.modelName}</div>
      </div>
      <div class="performance-metrics">
        <span>MAE ${Number(model.mae || 0).toFixed(2)}</span>
        <span>RMSE ${Number(model.rmse || 0).toFixed(2)}</span>
        <span>R2 ${Number(model.r2 || 0).toFixed(3)}</span>
      </div>
    </article>
  `;
}

function stockAlertCard(item) {
    return `
      <article class="performance-card stock-alert-card">
        <div class="action-top">
          <div>
            <div class="performance-name">${item.title}</div>
            <div class="action-meta">${item.meta}</div>
          </div>
          <button class="action-badge ${item.tone} stock-action-button" type="button" data-product="${item.title}">${item.badge}</button>
        </div>
        <div class="action-text">${item.text}</div>
      </article>
    `;
}

function actionCard(action) {
  return `
    <article class="action-card">
      <div class="action-top">
        <div>
          <div class="action-title">${action.title}</div>
          <div class="action-meta">${action.meta}</div>
        </div>
        <span class="action-badge ${action.tone}">${action.badge}</span>
      </div>
      <div class="action-text">${action.text}</div>
    </article>
  `;
}

function leaderboardRow(item, index) {
  const width = Math.max(12, (Number(item.totalUnitsSold || 0) / Math.max(1, Number(item.maxUnits || 1))) * 100);
  return `
    <div class="leaderboard-row">
      <div>
        <div class="leaderboard-rank">#${index + 1}</div>
        <div class="leaderboard-name">${item.productName || `Product ${item.productId}`}</div>
        <div class="leaderboard-meta">${item.category || "Uncategorised"}</div>
      </div>
      <div class="leaderboard-bar-block">
        <div class="leaderboard-bar-meta">
          <span>Units sold</span>
          <strong>${formatCompactNumber(item.totalUnitsSold)}</strong>
        </div>
        <div class="leaderboard-track"><div class="leaderboard-fill" style="width:${width}%"></div></div>
      </div>
    </div>
  `;
}

function renderHorizontalBars(containerId, items, valueKey, formatter, emptyMessage) {
  const root = document.getElementById(containerId);
  if (!root) {
    return;
  }

  if (!items.length) {
    root.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
  root.innerHTML = `
    <div class="bar-chart-label">
      <span class="bar-chart-dot"></span>
      <span>Units sold</span>
    </div>
    ${items.map((item) => {
      const value = Number(item[valueKey] || 0);
      const width = Math.max(12, (value / maxValue) * 100);
      return `
        <div class="bar-row">
          <div class="bar-head">
            <span class="bar-label">${item.label}</span>
            <strong>${formatter(value)}</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        </div>
      `;
    }).join("")}
  `;
}

function getTopProductsByGroup(rows, groupKey) {
  const grouped = new Map();

  for (const row of rows) {
    const label = row[groupKey] || "Unknown";
    const productName = row.productName || `Product ${row.productId}`;
    const compositeKey = `${label}__${productName}`;

    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, {
        label,
        productName,
        unitsSold: 0
      });
    }

    grouped.get(compositeKey).unitsSold += Number(row.actualUnitsSold || 0);
  }

  const bestByGroup = new Map();
  for (const item of grouped.values()) {
    const current = bestByGroup.get(item.label);
    if (!current || item.unitsSold > current.unitsSold) {
      bestByGroup.set(item.label, item);
    }
  }

  return Array.from(bestByGroup.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function compactInsightList(items) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="insight-mini-grid">
      ${items.map((item) => `
        <article class="insight-mini-card">
          <span class="insight-mini-label">${item.label}</span>
          <div class="insight-mini-body">
            <h3 class="insight-mini-name">${item.productName}</h3>
          </div>
          <div class="insight-mini-units">
            <strong>${formatCompactNumber(item.unitsSold)}</strong>
            <span>units</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSalesForecastChart() {
  const chartRoot = document.getElementById("salesForecastChart");
  const summaryRoot = document.getElementById("salesChartSummary");
  const selectedProduct = dashboardState.selectedForecastProduct.trim().toLowerCase();
  const salesRows = getFilteredSalesForecasts().filter((row) =>
    !selectedProduct || String(row.productName || `Product ${row.productId}`).toLowerCase() === selectedProduct
  );

  if (salesRows.length < 2) {
    summaryRoot.innerHTML = `
      <div>
        <div class="chart-title">${dashboardState.selectedForecastProduct || "No sales forecast selected"}</div>
        <div class="chart-meta">${dashboardState.selectedForecastProduct ? "Not enough rows exist for this product." : "Choose a product with imported sales forecast rows."}</div>
      </div>
    `;
    chartRoot.innerHTML = '<div class="empty-state">Type a product name from the suggestions to see its historical vs predicted sales trend.</div>';
    return;
  }

  const grouped = new Map();
  for (const row of salesRows) {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        label: key,
        actualTotal: 0,
        predictedTotal: 0,
        count: 0
      });
    }

    const entry = grouped.get(key);
    entry.actualTotal += Number(row.actualUnitsSold || 0);
    entry.predictedTotal += Number(row.predictedUnitsSold || 0);
    entry.count += 1;
  }

  const points = Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => ({
      label: entry.label,
      actual: entry.actualTotal / Math.max(1, entry.count),
      predicted: entry.predictedTotal / Math.max(1, entry.count)
    }));

  if (points.length < 2) {
    summaryRoot.innerHTML = `
      <div>
        <div class="chart-title">${dashboardState.selectedForecastProduct || "No sales forecast selected"}</div>
        <div class="chart-meta">At least two monthly points are needed to render the chart.</div>
      </div>
    `;
    chartRoot.innerHTML = '<div class="empty-state">Import more forecast months to display the main chart.</div>';
    return;
  }

  const values = points.flatMap((point) => [point.actual, point.predicted]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = Math.max(1, maxValue - minValue);
  const width = 760;
  const height = 280;
  const paddingX = 36;
  const paddingTop = 26;
  const paddingBottom = 46;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;

  function pointX(index) {
    return paddingX + (usableWidth * index) / Math.max(1, points.length - 1);
  }

  function pointY(value) {
    return paddingTop + ((maxValue - value) / span) * usableHeight;
  }

  const actualPolyline = points.map((point, index) => `${pointX(index)},${pointY(point.actual)}`).join(" ");
  const predictedPolyline = points.map((point, index) => `${pointX(index)},${pointY(point.predicted)}`).join(" ");
  const yGrid = Array.from({ length: 4 }, (_, index) => {
    const value = maxValue - (span * index) / 3;
    const y = pointY(value);
    return `
      <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="chart-grid-line"></line>
      <text x="4" y="${y + 4}" class="chart-axis-value">${Math.round(value)}</text>
    `;
  }).join("");
  const xLabels = points.map((point, index) => `
    <text x="${pointX(index)}" y="${height - 12}" text-anchor="middle" class="chart-axis-label">${point.label}</text>
  `).join("");
  const actualDots = points.map((point, index) => `<circle cx="${pointX(index)}" cy="${pointY(point.actual)}" r="4" class="actual-dot"></circle>`).join("");
  const predictedDots = points.map((point, index) => `<circle cx="${pointX(index)}" cy="${pointY(point.predicted)}" r="4" class="predicted-dot"></circle>`).join("");

  const latestPoint = points[points.length - 1];
  summaryRoot.innerHTML = `
    <div>
      <div class="chart-title">${dashboardState.selectedForecastProduct || "Overall sales forecast trend"}</div>
      <div class="chart-meta">${dashboardState.selectedForecastProduct ? "How this product has sold versus what the forecast expects next" : "How average monthly sales compare with the forecast"}</div>
    </div>
    <div class="chart-legend">
      <span><i class="legend-dot actual"></i>Past</span>
      <span><i class="legend-dot predicted"></i>Predicted</span>
      <strong>Latest predicted: ${Math.round(latestPoint.predicted)} units</strong>
    </div>
  `;

  chartRoot.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="main-line-chart" aria-label="Sales forecast chart">
      ${yGrid}
      <polyline points="${actualPolyline}" class="line actual-line"></polyline>
      <polyline points="${predictedPolyline}" class="line predicted-line"></polyline>
      ${actualDots}
      ${predictedDots}
      ${xLabels}
    </svg>
  `;
}

function getForecastProductOptions() {
  const names = dashboardState.modelSalesForecasts
    .map((row) => row.productName || `Product ${row.productId}`)
    .filter(Boolean);

  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

function renderProductOptions() {
  const datalist = document.getElementById("forecastProductOptions");
  if (!datalist) {
    return;
  }

  datalist.innerHTML = getForecastProductOptions()
    .map((name) => `<option value="${name}"></option>`)
    .join("");
}

function buildKpis() {
  const performance = getFilteredModelPerformance();
  const priceModel = performance.find((row) => String(row.modelType).toLowerCase() === "price");
  const salesModel = performance.find((row) => String(row.modelType).toLowerCase() === "sales");
  const topSeason = getFilteredSeasonalInsights()[0];
  const topProduct = getFilteredTopProducts()[0];
  const salesRows = getFilteredSalesForecasts();
  const projectedRevenue = salesRows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.predictedUnitsSold || 0), 0);
  const totalActualDemand = salesRows.reduce((sum, row) => sum + Number(row.actualUnitsSold || 0), 0);
  const totalPredictedDemand = salesRows.reduce((sum, row) => sum + Number(row.predictedUnitsSold || 0), 0);
  const demandChange = totalActualDemand === 0 ? 0 : ((totalPredictedDemand - totalActualDemand) / totalActualDemand) * 100;

  return [
    {
      label: "Revenue",
      value: projectedRevenue ? `Rs ${(projectedRevenue / 1000).toFixed(1)}K` : "Rs 0.0K",
      detail: "Expected revenue based on forecast demand and current selling price."
    },
    {
      label: "Forecast Accuracy",
      value: priceModel ? `${(Number(priceModel.r2 || 0) * 100).toFixed(1)}%` : "N/A",
      detail: salesModel
        ? `Price confidence ${(Number(priceModel?.r2 || 0) * 100).toFixed(1)}% • Sales confidence ${(Number(salesModel.r2 || 0) * 100).toFixed(1)}%`
        : "Forecast confidence appears here when model metrics are available."
    },
    {
      label: "Demand Trend",
      value: `${demandChange >= 0 ? "+" : ""}${demandChange.toFixed(1)}%`,
      detail: topSeason
        ? `${topSeason.seasonality} currently shows the strongest buying activity.`
        : "Seasonal demand signals appear here when data is available."
    },
    {
      label: "Top Product",
      value: topProduct ? topProduct.productName || `Product ${topProduct.productId}` : "N/A",
      detail: topProduct
        ? `${formatCompactNumber(topProduct.totalUnitsSold)} units sold across the imported forecast dataset.`
        : "Top-selling product appears here when product demand data is available."
    }
  ];
}

function buildRevenueAwareKpis() {
  const performance = getFilteredModelPerformance();
  const priceModel = performance.find((row) => String(row.modelType).toLowerCase() === "price");
  const salesModel = performance.find((row) => String(row.modelType).toLowerCase() === "sales");
  const topSeason = getFilteredSeasonalInsights()[0];
  const salesRows = getFilteredSalesForecasts();
  const currentRevenue = salesRows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.actualUnitsSold || 0), 0);
  const projectedRevenue = salesRows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.predictedUnitsSold || 0), 0);
  const totalActualDemand = salesRows.reduce((sum, row) => sum + Number(row.actualUnitsSold || 0), 0);
  const totalPredictedDemand = salesRows.reduce((sum, row) => sum + Number(row.predictedUnitsSold || 0), 0);
  const demandChange = totalActualDemand === 0 ? 0 : ((totalPredictedDemand - totalActualDemand) / totalActualDemand) * 100;

  return [
    {
      label: "Current Revenue",
      value: currentRevenue ? `Rs ${(currentRevenue / 1000).toFixed(1)}K` : "Rs 0.0K",
      detail: "Based on what the store is currently selling at today's demand level."
    },
    {
      label: "Projected Revenue",
      value: projectedRevenue ? `Rs ${(projectedRevenue / 1000).toFixed(1)}K` : "Rs 0.0K",
      detail: "Expected next revenue if forecasted demand holds at the current selling price."
    },
    {
      label: "Forecast Accuracy",
      value: priceModel ? `${(Number(priceModel.r2 || 0) * 100).toFixed(1)}%` : "N/A",
      detail: salesModel
        ? `Price confidence ${(Number(priceModel?.r2 || 0) * 100).toFixed(1)}% • Sales confidence ${(Number(salesModel.r2 || 0) * 100).toFixed(1)}%`
        : "Forecast confidence appears here when model metrics are available."
    },
    {
      label: "Demand Trend",
      value: `${demandChange >= 0 ? "+" : ""}${demandChange.toFixed(1)}%`,
      detail: topSeason
        ? `${topSeason.seasonality} currently shows the strongest buying activity.`
        : "Seasonal demand signals appear here when data is available."
    }
  ];
}

function buildContextualKpis() {
  const performance = getFilteredModelPerformance();
  const priceModel = performance.find((row) => String(row.modelType).toLowerCase() === "price");
  const salesModel = performance.find((row) => String(row.modelType).toLowerCase() === "sales");
  const topSeason = getFilteredSeasonalInsights()[0];
  const topProduct = getFilteredTopProducts()[0];
  const salesRows = getFilteredSalesForecasts();
  const currentRevenue = salesRows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.actualUnitsSold || 0), 0);
  const projectedRevenue = salesRows.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.predictedUnitsSold || 0), 0);
  const totalActualDemand = salesRows.reduce((sum, row) => sum + Number(row.actualUnitsSold || 0), 0);
  const totalPredictedDemand = salesRows.reduce((sum, row) => sum + Number(row.predictedUnitsSold || 0), 0);
  const demandChange = totalActualDemand === 0 ? 0 : ((totalPredictedDemand - totalActualDemand) / totalActualDemand) * 100;
  const revenueChange = currentRevenue === 0 ? 0 : ((projectedRevenue - currentRevenue) / currentRevenue) * 100;
  const priceConfidence = Number(priceModel?.r2 || 0) * 100;
  const salesConfidence = Number(salesModel?.r2 || 0) * 100;

  return [
    {
      label: "Current Revenue",
      value: currentRevenue ? `Rs ${(currentRevenue / 1000).toFixed(1)}K` : "Rs 0.0K",
      comparison: `Projected revenue is ${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% compared with current revenue.`,
      detail: "Estimated from current selling price multiplied by actual units sold.",
      progress: currentRevenue === 0 && projectedRevenue === 0 ? 8 : (currentRevenue / Math.max(currentRevenue, projectedRevenue, 1)) * 100,
      progressTone: "accent",
      badge: "Current baseline",
      badgeTone: "neutral"
    },
    {
      label: "Projected Revenue",
      value: projectedRevenue ? `Rs ${(projectedRevenue / 1000).toFixed(1)}K` : "Rs 0.0K",
      comparison: `${formatCurrency(projectedRevenue - currentRevenue)} expected change compared with current revenue.`,
      detail: "Forecasted next revenue based on predicted demand and current selling price.",
      progress: projectedRevenue === 0 && currentRevenue === 0 ? 8 : (projectedRevenue / Math.max(currentRevenue, projectedRevenue, 1)) * 100,
      progressTone: revenueChange >= 0 ? "positive" : "warning",
      badge: revenueChange >= 0 ? "Above baseline" : "Below baseline",
      badgeTone: revenueChange >= 0 ? "positive" : "warning"
    },
    {
      label: "Forecast Accuracy",
      value: priceModel ? `${priceConfidence.toFixed(1)}%` : "N/A",
      comparison: salesModel
        ? `The price forecast is ${(priceConfidence - salesConfidence).toFixed(1)} points more reliable than the sales forecast.`
        : "A direct model comparison appears when both forecasts are available.",
      detail: salesModel
        ? `Price confidence ${priceConfidence.toFixed(1)}% • Sales confidence ${salesConfidence.toFixed(1)}%`
        : "Confidence levels show how reliable the forecast is when model metrics are available.",
      progress: Math.max(priceConfidence, 8),
      progressTone: "accent",
      badge: salesModel ? "Price vs sales" : "",
      badgeTone: "neutral"
    },
    {
      label: "Demand Trend",
      value: `${demandChange >= 0 ? "+" : ""}${demandChange.toFixed(1)}%`,
      comparison: `${formatCompactNumber(totalPredictedDemand)} forecasted units versus ${formatCompactNumber(totalActualDemand)} current units.`,
      detail: topSeason
        ? `${topSeason.seasonality} is currently the strongest selling season in this store view.`
        : "Seasonal demand direction appears here when enough data is available.",
      progress: Math.max(Math.min(Math.abs(demandChange) * 8, 100), 8),
      progressTone: demandChange >= 0 ? "positive" : "warning",
      badge: topProduct ? "Top product signal" : "",
      badgeTone: "neutral"
    }
  ];
}

function buildRecommendedActions() {
  const priceMoves = getFilteredPriceForecasts()
    .slice()
    .sort((a, b) => Math.abs(Number(b.predictedPrice || 0) - Number(b.actualPrice || 0)) - Math.abs(Number(a.predictedPrice || 0) - Number(a.actualPrice || 0)))
    .slice(0, 2)
    .map((row) => {
      const actual = Number(row.actualPrice || 0);
      const predicted = Number(row.predictedPrice || 0);
      const change = actual === 0 ? 0 : ((predicted - actual) / actual) * 100;
      return {
        title: row.productName || `Product ${row.productId}`,
        meta: `${row.category || "Forecast"} • ${row.seasonality || "Model output"}`,
        badge: change >= 0 ? "Increase Price" : "Review Price",
        tone: change >= 0 ? "positive" : "neutral",
        text: change >= 0
          ? `Consider moving from ${formatCurrency(actual)} to ${formatCurrency(predicted)} to improve margin while demand stays healthy.`
          : `Consider lowering the target toward ${formatCurrency(predicted)} to reduce the risk of losing demand.`
      };
    });

  const demandMoves = getFilteredSalesForecasts()
    .slice()
    .sort((a, b) => Number(b.predictedUnitsSold || 0) - Number(a.predictedUnitsSold || 0))
    .slice(0, 2)
    .map((row) => ({
      title: row.productName || `Product ${row.productId}`,
      meta: `${row.weatherCondition || "All weather"} • ${row.seasonality || "Demand forecast"}`,
      badge: "High Demand",
      tone: "accent",
      text: `Demand is expected to reach ${Math.round(Number(row.predictedUnitsSold || 0))} units. Plan replenishment early to avoid missed sales.`
    }));

  return [...priceMoves, ...demandMoves];
}

function buildStockAlerts() {
  return getFilteredSalesForecasts()
    .slice()
    .sort((a, b) => Number(b.predictedUnitsSold || 0) - Number(a.predictedUnitsSold || 0))
    .slice(0, 3)
    .map((row) => {
      const projectedDemand = Number(row.predictedUnitsSold || 0);
      const inventoryLevel = Number(row.inventoryLevel || 0);
      const needsRestock = inventoryLevel < projectedDemand;
        return {
          title: row.productName || `Product ${row.productId}`,
          meta: `${row.category || "Retail item"} • Inventory ${Math.round(inventoryLevel)} units`,
          badge: needsRestock ? "Restock" : "Monitor",
          tone: needsRestock ? "warning" : "neutral",
        text: needsRestock
          ? `Expected demand is ${Math.round(projectedDemand)} units, which is above current stock. Reorder this item soon.`
          : `Expected demand is ${Math.round(projectedDemand)} units. Current stock looks stable for now.`
      };
      });
}

function openProductDetailModal(productName) {
  if (!productName) {
    return;
  }

  const salesRows = dashboardState.modelSalesForecasts.filter(
    (row) => String(row.productName || `Product ${row.productId}`).toLowerCase() === productName.toLowerCase()
  );
  const priceRows = dashboardState.modelPriceForecasts.filter(
    (row) => String(row.productName || `Product ${row.productId}`).toLowerCase() === productName.toLowerCase()
  );

  const modalBackdrop = document.getElementById("productModalBackdrop");
  const modalTitle = document.getElementById("productModalTitle");
  const modalContent = document.getElementById("productModalContent");
  if (!modalBackdrop || !modalTitle || !modalContent) {
    return;
  }

  const latestSales = salesRows
    .slice()
    .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))[0];
  const latestPrice = priceRows
    .slice()
    .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))[0];
  const avgPredictedDemand =
    salesRows.reduce((sum, row) => sum + Number(row.predictedUnitsSold || 0), 0) / Math.max(salesRows.length, 1);
  const avgPredictedPrice =
    priceRows.reduce((sum, row) => sum + Number(row.predictedPrice || 0), 0) / Math.max(priceRows.length, 1);
  const avgActualPrice =
    priceRows.reduce((sum, row) => sum + Number(row.actualPrice || 0), 0) / Math.max(priceRows.length, 1);
  const forecastMonths = Array.from(
    new Set(salesRows.map((row) => `${row.year}-${String(row.month).padStart(2, "0")}`))
  ).sort();

  modalTitle.textContent = productName;
  modalContent.innerHTML = `
    <div class="modal-kpis">
      <div class="modal-kpi">
        <div class="modal-kpi-label">Avg Predicted Price</div>
        <div class="modal-kpi-value">${formatCurrency(avgPredictedPrice)}</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-label">Avg Predicted Demand</div>
        <div class="modal-kpi-value">${Math.round(avgPredictedDemand)} units</div>
      </div>
      <div class="modal-kpi">
        <div class="modal-kpi-label">Latest Forecast Month</div>
        <div class="modal-kpi-value">${forecastMonths[forecastMonths.length - 1] || "N/A"}</div>
      </div>
    </div>
    <article class="modal-card">
      <h3>Pricing Outlook</h3>
      <p>
        ${priceRows.length
          ? `Average actual price is ${formatCurrency(avgActualPrice)} and average predicted price is ${formatCurrency(avgPredictedPrice)}.`
          : "No imported price forecast rows are available for this product yet."}
      </p>
      ${latestPrice ? `
        <div class="modal-list">
          <div class="modal-list-row">
            <span>Latest season</span>
            <strong>${latestPrice.seasonality || "N/A"}</strong>
          </div>
          <div class="modal-list-row">
            <span>Latest weather context</span>
            <strong>${latestPrice.weatherCondition || "N/A"}</strong>
          </div>
        </div>
      ` : '<p class="modal-empty">No latest pricing context available.</p>'}
    </article>
    <article class="modal-card">
      <h3>Demand Outlook</h3>
      <p>
        ${salesRows.length
          ? `Expected demand averages ${Math.round(avgPredictedDemand)} units based on the imported forecast records.`
          : "No imported sales forecast rows are available for this product yet."}
      </p>
      ${latestSales ? `
        <div class="modal-list">
          <div class="modal-list-row">
            <span>Inventory level</span>
            <strong>${Math.round(Number(latestSales.inventoryLevel || 0))} units</strong>
          </div>
          <div class="modal-list-row">
            <span>Predicted units sold</span>
            <strong>${Math.round(Number(latestSales.predictedUnitsSold || 0))} units</strong>
          </div>
          <div class="modal-list-row">
            <span>Recommended action</span>
            <strong>${Number(latestSales.inventoryLevel || 0) < Number(latestSales.predictedUnitsSold || 0) ? "Restock soon" : "Continue monitoring"}</strong>
          </div>
        </div>
      ` : '<p class="modal-empty">No latest demand context available.</p>'}
    </article>
  `;

  modalBackdrop.hidden = false;
}

function closeProductDetailModal() {
  const modalBackdrop = document.getElementById("productModalBackdrop");
  if (modalBackdrop) {
    modalBackdrop.hidden = true;
  }
}

function renderMetrics() {
  document.getElementById("metrics").innerHTML = buildContextualKpis().map(metricCard).join("");
}

function setAuthView(isAuthenticated) {
  const authShell = document.getElementById("authShell");
  const dashboardShell = document.getElementById("dashboardShell");
  if (authShell) {
    authShell.hidden = isAuthenticated;
  }
  if (dashboardShell) {
    dashboardShell.hidden = !isAuthenticated;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderSessionMeta() {
  const meta = document.getElementById("storeSessionMeta");
  if (!meta) {
    return;
  }

  if (!dashboardState.authUser) {
    meta.textContent = "Not logged in";
    return;
  }

  meta.textContent = `${dashboardState.authUser.storeName} • Store ${dashboardState.authUser.storeId}`;
}

function renderRecommendedActions() {
  const root = document.getElementById("recommendedActions");
  const actions = buildRecommendedActions();
  root.innerHTML = actions.length
    ? actions.map(actionCard).join("")
    : '<div class="empty-state">No matching pricing or demand recommendations are available for the current search.</div>';
}

function renderPerformance() {
  const root = document.getElementById("stockAlertsGrid");
  if (!root) {
    return;
  }

  const alerts = buildStockAlerts();
  root.innerHTML = alerts.length
    ? alerts.map(stockAlertCard).join("")
    : '<div class="empty-state">No stock alerts are available for the current search.</div>';
}

function renderModelHealth() {
  const root = document.getElementById("modelPerformanceGrid");
  if (!root) {
    return;
  }

  const models = getFilteredModelPerformance();
  root.innerHTML = models.length
    ? models.map(performanceCard).join("")
    : '<div class="empty-state">No model performance records are available for the current search.</div>';
}

function renderTopProducts() {
  const root = document.getElementById("topProductsChart");
  const products = getFilteredTopProducts()
    .slice(0, 5)
    .map((item) => ({ ...item, maxUnits: Math.max(...getFilteredTopProducts().map((row) => Number(row.totalUnitsSold || 0)), 1) }));

  root.innerHTML = products.length
    ? products.map((item, index) => leaderboardRow(item, index)).join("")
    : '<div class="empty-state">No high-demand products are available for the current search.</div>';
}

function renderSeasonalInsights() {
  const copyRoot = document.getElementById("seasonalInsightCopy");
  const visualRoot = document.getElementById("seasonalInsightsChart");
  const items = getFilteredSeasonalInsights().slice(0, 4);
  const topProductsBySeason = getTopProductsByGroup(getFilteredSalesForecasts(), "seasonality");

  if (!items.length) {
    copyRoot.innerHTML = '<div class="empty-state">No seasonal insight rows are available.</div>';
    visualRoot.innerHTML = "";
    return;
  }

  const topSeason = items[0];
  const topSeasonProduct = topProductsBySeason.find((item) => item.label === topSeason.seasonality);
  copyRoot.innerHTML = `
    <p class="insight-title">${topSeason.seasonality} is the strongest selling season</p>
    <p class="insight-text">${formatCompactNumber(topSeason.totalUnitsSold)} units were sold in this season, with an average selling price of ${formatCurrency(topSeason.avgPrice)}.</p>
    <p class="insight-text">${topSeasonProduct ? `${topSeasonProduct.productName} is the best-selling product in ${topSeason.seasonality}, with ${formatCompactNumber(topSeasonProduct.unitsSold)} units sold.` : "The top product for each season will appear here when sales rows are available."}</p>
    ${compactInsightList(topProductsBySeason)}
  `;

  renderHorizontalBars(
    "seasonalInsightsChart",
    items.map((item) => ({ label: item.seasonality, totalUnitsSold: item.totalUnitsSold })),
    "totalUnitsSold",
    formatCompactNumber,
    "No seasonal insight rows are available."
  );
}

function renderWeatherInsights() {
  const copyRoot = document.getElementById("weatherInsightCopy");
  const visualRoot = document.getElementById("weatherInsightsChart");
  const items = getFilteredWeatherInsights().slice(0, 4);
  const topProductsByWeather = getTopProductsByGroup(getFilteredSalesForecasts(), "weatherCondition");

  if (!items.length) {
    copyRoot.innerHTML = '<div class="empty-state">No weather insight rows are available.</div>';
    visualRoot.innerHTML = "";
    return;
  }

  const topWeather = items[0];
  const topWeatherProduct = topProductsByWeather.find((item) => item.label === topWeather.weatherCondition);
  copyRoot.innerHTML = `
    <p class="insight-title">${topWeather.weatherCondition} weather drives the highest demand</p>
    <p class="insight-text">${formatCompactNumber(topWeather.totalUnitsSold)} units were sold under this weather condition, with an average discount of ${Number(topWeather.avgDiscount || 0).toFixed(1)}%.</p>
    <p class="insight-text">${topWeatherProduct ? `${topWeatherProduct.productName} sells best during ${topWeather.weatherCondition.toLowerCase()} weather, with ${formatCompactNumber(topWeatherProduct.unitsSold)} units sold.` : "The top product for each weather condition will appear here when sales rows are available."}</p>
    ${compactInsightList(topProductsByWeather)}
  `;

  renderHorizontalBars(
    "weatherInsightsChart",
    items.map((item) => ({ label: item.weatherCondition, totalUnitsSold: item.totalUnitsSold })),
    "totalUnitsSold",
    formatCompactNumber,
    "No weather insight rows are available."
  );
}

function renderDiscountInsights() {
  const copyRoot = document.getElementById("discountInsightCopy");
  const salesRows = getFilteredSalesForecasts();
  const buckets = new Map();

  for (const row of salesRows) {
    const discount = Number(row.discount || 0);
    const label = discount === 0 ? "0%" : discount <= 10 ? "1-10%" : discount <= 20 ? "11-20%" : "20%+";
    if (!buckets.has(label)) {
      buckets.set(label, { label, predictedUnitsSold: 0, count: 0 });
    }

    const entry = buckets.get(label);
    entry.predictedUnitsSold += Number(row.predictedUnitsSold || 0);
    entry.count += 1;
  }

  const items = Array.from(buckets.values())
    .map((item) => ({
      label: item.label,
      predictedUnitsSold: item.predictedUnitsSold / Math.max(1, item.count)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!items.length) {
    copyRoot.innerHTML = '<div class="empty-state">No discount impact rows are available.</div>';
    document.getElementById("discountChart").innerHTML = "";
    return;
  }

  const strongest = items.slice().sort((a, b) => b.predictedUnitsSold - a.predictedUnitsSold)[0];
  copyRoot.innerHTML = `
    <p class="insight-title">${strongest.label} discounts perform best</p>
    <p class="insight-text">Average expected demand reaches ${Math.round(strongest.predictedUnitsSold)} units in this discount range.</p>
  `;

  renderHorizontalBars(
    "discountChart",
    items,
    "predictedUnitsSold",
    (value) => `${Math.round(value)} units`,
    "No discount impact rows are available."
  );
}

function renderAll() {
  const overview = dashboardState.overview || { story: {} };
  document.getElementById("storyTitle").textContent = overview.story?.title || "RetailPro Forecast Console";
  document.getElementById("storyDescription").textContent =
    overview.story?.description || "Monitor predictive sales performance, pricing opportunities, and seasonal demand signals.";

  renderSessionMeta();
  renderProductOptions();
  renderMetrics();
  renderSalesForecastChart();
  renderRecommendedActions();
  renderPerformance();
  renderModelHealth();
  renderTopProducts();
  renderSeasonalInsights();
  renderWeatherInsights();
  renderDiscountInsights();
}

function wireInteractions() {
  if (dashboardState.interactionsBound) {
    return;
  }

  document.querySelectorAll(".nav-item[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      document.querySelectorAll(".nav-item[data-target]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.getElementById("searchInput").addEventListener("input", (event) => {
    dashboardState.searchTerm = event.target.value;
    renderAll();
  });

  document.getElementById("syncButton").addEventListener("click", async () => {
    await loadDashboard();
  });

  document.getElementById("resetChartButton").addEventListener("click", () => {
    dashboardState.selectedForecastProduct = "";
    document.getElementById("forecastProductInput").value = "";
    renderAll();
  });

  const forecastProductInput = document.getElementById("forecastProductInput");
  forecastProductInput.addEventListener("input", (event) => {
    dashboardState.selectedForecastProduct = event.target.value;
    renderSalesForecastChart();
  });
  forecastProductInput.addEventListener("change", (event) => {
    dashboardState.selectedForecastProduct = event.target.value;
    renderSalesForecastChart();
  });

  document.getElementById("stockAlertsGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".stock-action-button");
    if (!button) {
      return;
    }

    openProductDetailModal(button.dataset.product);
  });

  document.getElementById("closeProductModalButton").addEventListener("click", () => {
    closeProductDetailModal();
  });

  document.getElementById("productModalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "productModalBackdrop") {
      closeProductDetailModal();
    }
  });

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const authError = document.getElementById("authError");
    const authSuccess = document.getElementById("authSuccess");

    try {
      authError.hidden = true;
      authSuccess.hidden = true;
      const response = await postJson("/api/auth/login", { email, password });
      dashboardState.authUser = response.user;
      authSuccess.hidden = false;
      authSuccess.textContent = `Login successful. Opening ${response.user.storeName || `Store ${response.user.storeId}`} dashboard...`;
      await delay(900);
      setAuthView(true);
      await loadDashboard();
      document.getElementById("loginPassword").value = "";
    } catch (error) {
      authError.hidden = false;
      authError.textContent = error.message;
      authSuccess.hidden = true;
    }
  });

  document.getElementById("logoutButton").addEventListener("click", async () => {
    await postJson("/api/auth/logout", {});
    dashboardState.authUser = null;
    dashboardState.searchTerm = "";
    dashboardState.selectedForecastProduct = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("forecastProductInput").value = "";
    document.getElementById("authError").hidden = true;
    document.getElementById("authSuccess").hidden = true;
    setAuthView(false);
  });

  dashboardState.interactionsBound = true;
}

async function loadDashboard() {
  const [overview, priceForecasts, salesForecasts, seasonalInsights, weatherInsights, topProducts, modelPerformance] = await Promise.all([
    fetchJsonSafe("/api/overview", { story: {} }),
    fetchJsonSafe("/api/model/price-forecast?limit=100", { forecasts: [] }),
    fetchJsonSafe("/api/model/sales-forecast?limit=100", { forecasts: [] }),
    fetchJsonSafe("/api/model/seasonal-insights?limit=12", { insights: [] }),
    fetchJsonSafe("/api/model/weather-insights?limit=12", { insights: [] }),
    fetchJsonSafe("/api/model/top-products?limit=20", { products: [] }),
    fetchJsonSafe("/api/model/performance", { models: [] })
  ]);

  dashboardState = {
    ...dashboardState,
    overview,
    modelPriceForecasts: priceForecasts.forecasts,
    modelSalesForecasts: salesForecasts.forecasts,
    seasonalInsights: seasonalInsights.insights,
    weatherInsights: weatherInsights.insights,
    topProducts: topProducts.products,
    modelPerformance: modelPerformance.models
  };

  wireInteractions();
  renderAll();
}

async function bootstrapApp() {
  wireInteractions();

  const session = await fetchJsonSafe("/api/auth/me", { user: null });
  if (!session.user) {
    setAuthView(false);
    return;
  }

  dashboardState.authUser = session.user;
  setAuthView(true);
  await loadDashboard();
}

bootstrapApp().catch((error) => {
  console.error(error);
  setAuthView(false);
  document.getElementById("authError").hidden = false;
  document.getElementById("authError").textContent = "Could not initialize the store dashboard session.";
});
