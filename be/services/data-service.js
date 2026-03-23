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

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function predictNextPrice(history, fallbackPrice) {
  if (!history || history.length === 0) {
    return fallbackPrice;
  }

  if (history.length === 1) {
    return history[0];
  }

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const shortTrend = latest - previous;
  const movingAverage = history.reduce((sum, price) => sum + price, 0) / history.length;
  const predicted = latest + shortTrend * 0.6 + (latest - movingAverage) * 0.2;

  return roundToTwo(Math.max(predicted, 0));
}

function mapLatestForecasts(forecastRows) {
  const latestByKey = new Map();

  for (const row of forecastRows) {
    const key = `${row.product_id}:${row.retailer_id}`;
    const current = latestByKey.get(key);
    if (!current || String(row.forecast_date) > String(current.forecast_date)) {
      latestByKey.set(key, row);
    }
  }

  return latestByKey;
}

async function loadRetailData() {
  try {
    const [priceHistoryRows, productRows, retailerRows, dealRows, forecastRows] = await Promise.all([
      fetchSupabaseTable("price_history?select=product_id,retailer_id,old_price,collected_at,source&order=collected_at.asc"),
      fetchSupabaseTable("products?select=product_id,name,brand,category,unit,base_price"),
      fetchSupabaseTable("retailers?select=retailer_id,name"),
      fetchSupabaseTable("deals?select=deal_id,product_id,retailer_id,title,deal_price,discount,start_date,end_date,original_price,created_at&order=created_at.desc"),
      fetchSupabaseTable("retailer_forecast?select=product_id,retailer_id,predicted_price,forecast_date,created_at&order=forecast_date.desc")
    ]);

    return {
      priceHistoryRows,
      productRows,
      retailerRows,
      dealRows,
      forecastRows
    };
  } catch (error) {
    return {
      priceHistoryRows: [],
      productRows: [],
      retailerRows: [],
      dealRows: [],
      forecastRows: []
    };
  }
}

async function getProductRows() {
  const { priceHistoryRows, productRows, retailerRows, forecastRows } = await loadRetailData();
  if (priceHistoryRows.length === 0 || productRows.length === 0) {
    return [];
  }

  const productMap = new Map(productRows.map((row) => [Number(row.product_id), row]));
  const retailerMap = new Map(retailerRows.map((row) => [Number(row.retailer_id), row.name]));
  const forecastMap = mapLatestForecasts(forecastRows);
  const grouped = new Map();

  for (const row of priceHistoryRows) {
    const productId = Number(row.product_id);
    const retailerId = Number(row.retailer_id);
    if (!productId || !retailerId) {
      continue;
    }

    const key = `${productId}:${retailerId}`;
    if (!grouped.has(key)) {
      const product = productMap.get(productId) || {};
      grouped.set(key, {
        productId,
        retailerId,
        sku: `P-${productId}`,
        product: product.name || `Product ${productId}`,
        category: product.category || "Uncategorised",
        supermarket: retailerMap.get(retailerId) || `Retailer ${retailerId}`,
        currentPrice: Number(product.base_price ?? 0),
        previousPrice: Number(product.base_price ?? 0),
        priceTimeline: []
      });
    }

    const entry = grouped.get(key);
    const price = Number(row.old_price ?? 0);
    const date = String(row.collected_at ?? "").slice(0, 10);
    if (!Number.isFinite(price) || !date) {
      continue;
    }

    entry.priceTimeline.push({ date, price });
  }

  return Array.from(grouped.values())
    .map((entry) => {
      const timeline = entry.priceTimeline
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      if (timeline.length === 0) {
        return null;
      }

      const prices = timeline.map((point) => point.price);
      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices.length > 1 ? prices[prices.length - 2] : currentPrice;
      const forecast = forecastMap.get(`${entry.productId}:${entry.retailerId}`);
      const predictedNextPrice = forecast
        ? Number(forecast.predicted_price ?? currentPrice)
        : predictNextPrice(prices, currentPrice);

      return {
        ...entry,
        currentPrice,
        previousPrice,
        predictedNextPrice,
        priceHistory: prices,
        priceTimeline: timeline,
        priceChange: previousPrice === 0 ? "0.0" : (((currentPrice - previousPrice) / previousPrice) * 100).toFixed(1)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.product.localeCompare(b.product));
}

async function getDashboardSnapshot(storeContext = null) {
  const { productRows, retailerRows, dealRows, forecastRows, priceHistoryRows } = await loadRetailData();

  const activeDeals = dealRows.filter((deal) => {
    const today = new Date().toISOString().slice(0, 10);
    return deal.start_date <= today && deal.end_date >= today;
  });

  const latestPriceDate = priceHistoryRows.length > 0
    ? String(priceHistoryRows[priceHistoryRows.length - 1].collected_at).slice(0, 10)
    : "No sync yet";

  return {
    metrics: [
      {
        label: "Tracked Products",
        value: productRows.length.toString(),
        detail: "Products currently available in the connected catalog"
      },
      {
        label: "Tracked Retailers",
        value: retailerRows.length.toString(),
        detail: "Retailers connected from Supabase"
      },
      {
        label: "Active Forecasts",
        value: forecastRows.length.toString(),
        detail: "Retailer-level price predictions saved from the trained model"
      },
      {
        label: "Active Deals",
        value: activeDeals.length.toString(),
        detail: `Latest price sync: ${latestPriceDate}`
      }
    ],
    story: {
      title: storeContext?.storeName ? `${storeContext.storeName} Dashboard` : "Retailer Dashboard",
      description: storeContext?.storeId
        ? `Store ${storeContext.storeId} is viewing forecast outputs and operational insights scoped to its login.`
        : "Live retailer pricing, promotion records, and forecast outputs from your Supabase database."
    },
    activity: [
      forecastRows.length > 0 ? `${forecastRows.length} retailer forecast records loaded from Supabase.` : "No retailer forecast records found yet.",
      priceHistoryRows.length > 0 ? `Latest price history sync recorded on ${latestPriceDate}.` : "No price history records found yet.",
      activeDeals.length > 0 ? `${activeDeals.length} promotion records are currently active.` : "No active promotions are currently available."
    ]
  };
}

async function getPromotionPerformance() {
  const { dealRows, retailerRows, productRows } = await loadRetailData();
  if (dealRows.length === 0) {
    return [];
  }

  const retailerMap = new Map(retailerRows.map((row) => [Number(row.retailer_id), row.name]));
  const productMap = new Map(productRows.map((row) => [Number(row.product_id), row.name]));
  const today = new Date().toISOString().slice(0, 10);

  return dealRows.slice(0, 4).map((deal) => {
    const retailerName = retailerMap.get(Number(deal.retailer_id)) || `Retailer ${deal.retailer_id}`;
    const productName = productMap.get(Number(deal.product_id)) || `Product ${deal.product_id}`;
    const isActive = deal.start_date <= today && deal.end_date >= today;

    return {
      campaign: deal.title || `${productName} promotion`,
      channel: retailerName,
      uplift: `${Number(deal.discount ?? 0).toFixed(0)}% OFF`,
      summary: `${productName} • ${isActive ? "Active" : "Scheduled/Ended"}`,
      detail: `Deal price Rs ${Number(deal.deal_price ?? 0).toFixed(2)} from original Rs ${Number(deal.original_price ?? 0).toFixed(2)}`,
      outcome: `${deal.start_date} to ${deal.end_date}`
    };
  });
}

async function getChartData() {
  const [products, retailData] = await Promise.all([getProductRows(), loadRetailData()]);
  const { dealRows, retailerRows, productRows, forecastRows, priceHistoryRows } = retailData;
  const retailerMap = new Map(retailerRows.map((row) => [Number(row.retailer_id), row.name]));
  const productMap = new Map(productRows.map((row) => [Number(row.product_id), row.name]));

  const latestForecasts = Array.from(mapLatestForecasts(forecastRows).values())
    .map((row) => {
      const key = `${row.product_id}:${row.retailer_id}`;
      const matchingProduct = products.find((product) => `${product.productId}:${product.retailerId}` === key);
      const currentPrice = Number(matchingProduct?.currentPrice ?? 0);
      const predictedPrice = Number(row.predicted_price ?? currentPrice);

      return {
        label: `${retailerMap.get(Number(row.retailer_id)) || `Retailer ${row.retailer_id}`} • ${productMap.get(Number(row.product_id)) || `Product ${row.product_id}`}`,
        currentPrice,
        predictedPrice,
        forecastDate: row.forecast_date
      };
    })
    .filter((row) => row.currentPrice > 0 && row.predictedPrice > 0)
    .slice(0, 6);

  const dealDiscounts = dealRows
    .map((deal) => ({
      label: `${retailerMap.get(Number(deal.retailer_id)) || `Retailer ${deal.retailer_id}`} • ${productMap.get(Number(deal.product_id)) || `Product ${deal.product_id}`}`,
      discount: Number(deal.discount ?? 0),
      dealPrice: Number(deal.deal_price ?? 0),
      originalPrice: Number(deal.original_price ?? 0)
    }))
    .filter((deal) => deal.discount > 0)
    .slice(0, 6);

  const priceTimeline = products.length > 0
    ? {
        product: products[0].product,
        retailer: products[0].supermarket,
        category: products[0].category,
        latestPrice: products[0].currentPrice,
        points: products[0].priceTimeline
      }
    : {
        product: "",
        retailer: "",
        category: "",
        latestPrice: 0,
        points: []
      };

  return {
    priceTimeline,
    forecastComparison: latestForecasts,
    discountComparison: dealDiscounts,
    stats: {
      historyPoints: priceHistoryRows.length,
      forecastPoints: latestForecasts.length,
      dealPoints: dealDiscounts.length
    }
  };
}

module.exports = {
  getDashboardSnapshot,
  getProductRows,
  getPromotionPerformance,
  getChartData,
  predictNextPrice
};
