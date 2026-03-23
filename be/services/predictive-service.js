function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return { supabaseUrl, supabaseKey };
}

async function fetchSupabaseTable(path) {
  const config = getSupabaseConfig();
  if (!config) {
    return [];
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed for ${path} with status ${response.status}`);
  }

  return response.json();
}

function appendStoreFilter(path, storeId) {
  if (!storeId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}store_id=eq.${encodeURIComponent(storeId)}`;
}

async function withStoreFallback(loader, storeId, fallbackLoader = null) {
  const storeRows = await loader(storeId);
  if (storeRows.length > 0 || !storeId) {
    return storeRows;
  }

  return fallbackLoader ? fallbackLoader() : loader(null);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeSeasonality(value) {
  const mapping = {
    0: "Autumn",
    1: "Spring",
    2: "Summer",
    3: "Winter"
  };

  const numeric = Number(value);
  if (Number.isFinite(numeric) && mapping[numeric] !== undefined) {
    return mapping[numeric];
  }

  return value;
}

function decodeWeatherCondition(value) {
  const mapping = {
    0: "Cloudy",
    1: "Rainy",
    2: "Snowy",
    3: "Sunny"
  };

  const numeric = Number(value);
  if (Number.isFinite(numeric) && mapping[numeric] !== undefined) {
    return mapping[numeric];
  }

  return value;
}

function parseLimit(rawLimit, fallback) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 50);
}

async function getModelPriceForecasts(limit = 20, storeId = null) {
  const rows = await withStoreFallback(
    (activeStoreId) => fetchSupabaseTable(appendStoreFilter(
      `model_price_forecasts?select=forecast_id,store_id,product_id,category,region,inventory_level,units_sold,units_ordered,demand_forecast,discount,weather_condition,holiday_promotion,competitor_pricing,seasonality,year,month,day,day_of_week,actual_price,predicted_price,created_at&order=created_at.desc&limit=${parseLimit(limit, 20)}`,
      activeStoreId
    )),
    storeId
  );
  const lookupRows = await fetchSupabaseTable("model_product_lookup?select=product_id,product_name,category");
  const lookupMap = new Map(lookupRows.map((row) => [Number(row.product_id), row]));

  return rows.map((row) => ({
    productName: lookupMap.get(Number(row.product_id))?.product_name || `Product ${row.product_id}`,
    forecastId: row.forecast_id,
    storeId: row.store_id,
    productId: row.product_id,
    category: lookupMap.get(Number(row.product_id))?.category || row.category,
    region: row.region,
    inventoryLevel: toNumber(row.inventory_level),
    unitsSold: toNumber(row.units_sold),
    unitsOrdered: toNumber(row.units_ordered),
    demandForecast: toNumber(row.demand_forecast),
    discount: toNumber(row.discount),
    weatherCondition: decodeWeatherCondition(row.weather_condition),
    holidayPromotion: row.holiday_promotion,
    competitorPricing: toNumber(row.competitor_pricing),
    seasonality: decodeSeasonality(row.seasonality),
    year: row.year,
    month: row.month,
    day: row.day,
    dayOfWeek: row.day_of_week,
    actualPrice: toNumber(row.actual_price),
    predictedPrice: toNumber(row.predicted_price),
    createdAt: row.created_at
  }));
}

async function getModelSalesForecasts(limit = 20, storeId = null) {
  const rows = await withStoreFallback(
    (activeStoreId) => fetchSupabaseTable(appendStoreFilter(
      `model_sales_forecasts?select=forecast_id,store_id,product_id,category,region,inventory_level,price,discount,weather_condition,holiday_promotion,competitor_pricing,seasonality,year,month,day,day_of_week,actual_units_sold,predicted_units_sold,created_at&order=created_at.desc&limit=${parseLimit(limit, 20)}`,
      activeStoreId
    )),
    storeId
  );
  const lookupRows = await fetchSupabaseTable("model_product_lookup?select=product_id,product_name,category");
  const lookupMap = new Map(lookupRows.map((row) => [Number(row.product_id), row]));

  return rows.map((row) => ({
    productName: lookupMap.get(Number(row.product_id))?.product_name || `Product ${row.product_id}`,
    forecastId: row.forecast_id,
    storeId: row.store_id,
    productId: row.product_id,
    category: lookupMap.get(Number(row.product_id))?.category || row.category,
    region: row.region,
    inventoryLevel: toNumber(row.inventory_level),
    price: toNumber(row.price),
    discount: toNumber(row.discount),
    weatherCondition: decodeWeatherCondition(row.weather_condition),
    holidayPromotion: row.holiday_promotion,
    competitorPricing: toNumber(row.competitor_pricing),
    seasonality: decodeSeasonality(row.seasonality),
    year: row.year,
    month: row.month,
    day: row.day,
    dayOfWeek: row.day_of_week,
    actualUnitsSold: toNumber(row.actual_units_sold),
    predictedUnitsSold: toNumber(row.predicted_units_sold),
    createdAt: row.created_at
  }));
}

async function getSeasonalInsights(limit = 12, storeId = null) {
  if (!storeId) {
    const rows = await fetchSupabaseTable(
      `model_seasonal_insights?select=insight_id,seasonality,avg_units_sold,avg_price,total_units_sold,avg_discount,created_at&order=total_units_sold.desc&limit=${parseLimit(limit, 12)}`
    );

    return rows.map((row) => ({
      insightId: row.insight_id,
      seasonality: row.seasonality,
      avgUnitsSold: toNumber(row.avg_units_sold),
      avgPrice: toNumber(row.avg_price),
      totalUnitsSold: toNumber(row.total_units_sold),
      avgDiscount: toNumber(row.avg_discount),
      createdAt: row.created_at
    }));
  }

  const rows = await withStoreFallback(
    (activeStoreId) => getModelSalesForecasts(200, activeStoreId),
    storeId,
    () => getModelSalesForecasts(200, null)
  );
  const grouped = new Map();

  for (const row of rows) {
    const key = row.seasonality || "Unknown";
    if (!grouped.has(key)) {
      grouped.set(key, { seasonality: key, avgUnitsSold: 0, avgPrice: 0, totalUnitsSold: 0, avgDiscount: 0, count: 0 });
    }
    const entry = grouped.get(key);
    entry.avgUnitsSold += row.actualUnitsSold;
    entry.avgPrice += row.price;
    entry.totalUnitsSold += row.actualUnitsSold;
    entry.avgDiscount += row.discount;
    entry.count += 1;
  }

  return Array.from(grouped.values())
    .map((entry, index) => ({
      insightId: index + 1,
      seasonality: entry.seasonality,
      avgUnitsSold: entry.avgUnitsSold / Math.max(entry.count, 1),
      avgPrice: entry.avgPrice / Math.max(entry.count, 1),
      totalUnitsSold: entry.totalUnitsSold,
      avgDiscount: entry.avgDiscount / Math.max(entry.count, 1),
      createdAt: null
    }))
    .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
    .slice(0, parseLimit(limit, 12));
}

async function getWeatherInsights(limit = 12, storeId = null) {
  if (!storeId) {
    const rows = await fetchSupabaseTable(
      `model_weather_insights?select=insight_id,weather_condition,avg_units_sold,avg_price,total_units_sold,avg_discount,created_at&order=total_units_sold.desc&limit=${parseLimit(limit, 12)}`
    );

    return rows.map((row) => ({
      insightId: row.insight_id,
      weatherCondition: row.weather_condition,
      avgUnitsSold: toNumber(row.avg_units_sold),
      avgPrice: toNumber(row.avg_price),
      totalUnitsSold: toNumber(row.total_units_sold),
      avgDiscount: toNumber(row.avg_discount),
      createdAt: row.created_at
    }));
  }

  const rows = await withStoreFallback(
    (activeStoreId) => getModelSalesForecasts(200, activeStoreId),
    storeId,
    () => getModelSalesForecasts(200, null)
  );
  const grouped = new Map();

  for (const row of rows) {
    const key = row.weatherCondition || "Unknown";
    if (!grouped.has(key)) {
      grouped.set(key, { weatherCondition: key, avgUnitsSold: 0, avgPrice: 0, totalUnitsSold: 0, avgDiscount: 0, count: 0 });
    }
    const entry = grouped.get(key);
    entry.avgUnitsSold += row.actualUnitsSold;
    entry.avgPrice += row.price;
    entry.totalUnitsSold += row.actualUnitsSold;
    entry.avgDiscount += row.discount;
    entry.count += 1;
  }

  return Array.from(grouped.values())
    .map((entry, index) => ({
      insightId: index + 1,
      weatherCondition: entry.weatherCondition,
      avgUnitsSold: entry.avgUnitsSold / Math.max(entry.count, 1),
      avgPrice: entry.avgPrice / Math.max(entry.count, 1),
      totalUnitsSold: entry.totalUnitsSold,
      avgDiscount: entry.avgDiscount / Math.max(entry.count, 1),
      createdAt: null
    }))
    .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
    .slice(0, parseLimit(limit, 12));
}

async function getTopProducts(limit = 10, storeId = null) {
  if (!storeId) {
    const [rows, lookupRows] = await Promise.all([
      fetchSupabaseTable(
        `model_top_products?select=record_id,product_id,category,total_units_sold,avg_price,ranking,created_at&order=ranking.asc&limit=${parseLimit(limit, 10)}`
      ),
      fetchSupabaseTable("model_product_lookup?select=product_id,product_name,category")
    ]);
    const lookupMap = new Map(lookupRows.map((row) => [Number(row.product_id), row]));

    return rows.map((row) => ({
      recordId: row.record_id,
      productId: row.product_id,
      productName: lookupMap.get(Number(row.product_id))?.product_name || `Product ${row.product_id}`,
      category: lookupMap.get(Number(row.product_id))?.category || row.category,
      totalUnitsSold: toNumber(row.total_units_sold),
      avgPrice: toNumber(row.avg_price),
      ranking: row.ranking,
      createdAt: row.created_at
    }));
  }

  const rows = await withStoreFallback(
    (activeStoreId) => getModelSalesForecasts(200, activeStoreId),
    storeId,
    () => getModelSalesForecasts(200, null)
  );
  const grouped = new Map();

  for (const row of rows) {
    const key = Number(row.productId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        recordId: key,
        productId: key,
        productName: row.productName,
        category: row.category,
        totalUnitsSold: 0,
        avgPrice: 0,
        count: 0,
        createdAt: row.createdAt
      });
    }

    const entry = grouped.get(key);
    entry.totalUnitsSold += row.actualUnitsSold;
    entry.avgPrice += row.price;
    entry.count += 1;
  }

  return Array.from(grouped.values())
    .map((entry, index) => ({
      recordId: entry.recordId,
      productId: entry.productId,
      productName: entry.productName,
      category: entry.category,
      totalUnitsSold: entry.totalUnitsSold,
      avgPrice: entry.avgPrice / Math.max(entry.count, 1),
      ranking: index + 1,
      createdAt: entry.createdAt
    }))
    .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
    .slice(0, parseLimit(limit, 10))
    .map((entry, index) => ({ ...entry, ranking: index + 1 }));
}

async function getModelPerformance() {
  const rows = await fetchSupabaseTable(
    "model_performance?select=performance_id,model_type,model_name,mae,rmse,r2,created_at&order=created_at.desc"
  );

  return rows.map((row) => ({
    performanceId: row.performance_id,
    modelType: row.model_type,
    modelName: row.model_name,
    mae: toNumber(row.mae),
    rmse: toNumber(row.rmse),
    r2: toNumber(row.r2),
    createdAt: row.created_at
  }));
}

module.exports = {
  getModelPriceForecasts,
  getModelSalesForecasts,
  getSeasonalInsights,
  getWeatherInsights,
  getTopProducts,
  getModelPerformance
};
