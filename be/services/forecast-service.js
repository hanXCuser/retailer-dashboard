async function fetchSupabaseTable(path) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed for ${path} with status ${response.status}`);
  }

  return response.json();
}

async function loadSupabaseRetailerForecasts() {
  try {
    const [forecastRows, productRows, retailerRows, priceHistoryRows] = await Promise.all([
      fetchSupabaseTable("retailer_forecast?select=product_id,retailer_id,predicted_price,forecast_date,created_at&order=forecast_date.asc"),
      fetchSupabaseTable("products?select=product_id,name,category,base_price"),
      fetchSupabaseTable("retailers?select=retailer_id,name"),
      fetchSupabaseTable("price_history?select=product_id,retailer_id,old_price,collected_at&order=collected_at.asc")
    ]);

    const productMap = new Map(productRows.map((row) => [Number(row.product_id), row]));
    const retailerMap = new Map(retailerRows.map((row) => [Number(row.retailer_id), row.name]));
    const latestPriceMap = new Map();

    for (const row of priceHistoryRows) {
      const key = `${row.product_id}:${row.retailer_id}`;
      const current = latestPriceMap.get(key);
      if (!current || String(row.collected_at) > String(current.collected_at)) {
        latestPriceMap.set(key, row);
      }
    }

    return forecastRows.map((row) => {
      const productId = Number(row.product_id);
      const retailerId = Number(row.retailer_id);
      const product = productMap.get(productId) || {};
      const latestPrice = latestPriceMap.get(`${productId}:${retailerId}`);
      const currentPrice = Number(latestPrice?.old_price ?? product.base_price ?? row.predicted_price ?? 0);

      return {
        productId,
        retailerId,
        retailerName: retailerMap.get(retailerId) || `Retailer ${retailerId}`,
        product: product.name || `Product ${productId}`,
        category: product.category || "Uncategorised",
        currentPrice,
        predictedPrice: Number(row.predicted_price ?? currentPrice),
        forecastDate: row.forecast_date,
        createdAt: row.created_at
      };
    });
  } catch (error) {
    return [];
  }
}

async function getRetailerForecastRows() {
  return loadSupabaseRetailerForecasts();
}

async function getForecastInsights() {
  const retailerForecasts = await getRetailerForecastRows();

  return retailerForecasts.slice(0, 4).map((forecast) => {
    const currentPrice = Number(forecast.currentPrice || 0);
    const predictedPrice = Number(forecast.predictedPrice || currentPrice);
    const expectedLift = currentPrice === 0
      ? "0.0%"
      : `${(((predictedPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%`;

    return {
      product: forecast.product,
      retailer: forecast.retailerName,
      demandOutlook: predictedPrice > currentPrice ? "Price increase likely" : "Price stable",
      forecastWindow: `For ${forecast.forecastDate}`,
      expectedLift,
      currentPrice: `Rs ${currentPrice.toFixed(2)}`,
      predictedNextPrice: `Rs ${predictedPrice.toFixed(2)}`,
      recommendation:
        predictedPrice > currentPrice
          ? "Model output suggests the next saved price may rise for this retailer-product pair."
          : "Model output suggests the next saved price should remain close to the current level.",
      driver: `Source: retailer_forecast table for ${forecast.retailerName}`
    };
  });
}

module.exports = {
  getForecastInsights,
  getRetailerForecastRows
};
