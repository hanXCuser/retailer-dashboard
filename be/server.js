const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadEnvFile } = require("./services/config-service");
const {
  authenticateStoreUser,
  getSessionFromRequest,
  serializeSessionCookie,
  clearSessionCookie,
  signSession
} = require("./services/auth-service");
const {
  getDashboardSnapshot,
  getProductRows,
  getPromotionPerformance,
  getChartData
} = require("./services/data-service");
const { getForecastInsights, getRetailerForecastRows } = require("./services/forecast-service");
const {
  getModelPriceForecasts,
  getModelSalesForecasts,
  getSeasonalInsights,
  getWeatherInsights,
  getTopProducts,
  getModelPerformance
} = require("./services/predictive-service");

loadEnvFile();

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "..", "fe");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": contentTypes[".json"],
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": contentTypes[".json"],
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { message: "File not found." });
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

async function router(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const session = getSessionFromRequest(request);

  try {
    if (url.pathname === "/api/auth/me") {
      if (!session?.storeId) {
        sendJson(response, 401, { user: null });
        return;
      }

      sendJson(response, 200, { user: session });
      return;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readRequestBody(request);
      const user = await authenticateStoreUser(body.email, body.password);

      if (!user) {
        sendJson(response, 401, { message: "Invalid store login." });
        return;
      }

      const token = signSession(user);
      sendJsonWithHeaders(
        response,
        200,
        { user },
        { "Set-Cookie": serializeSessionCookie(token) }
      );
      return;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      sendJsonWithHeaders(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie() });
      return;
    }

    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) {
      if (!session?.storeId) {
        sendJson(response, 401, { message: "Store login required." });
        return;
      }
    }

    if (url.pathname === "/api/overview") {
      sendJson(response, 200, await getDashboardSnapshot(session));
      return;
    }

    if (url.pathname === "/api/products") {
      sendJson(response, 200, { products: await getProductRows() });
      return;
    }

    if (url.pathname === "/api/forecasts") {
      sendJson(response, 200, { forecasts: await getForecastInsights() });
      return;
    }

    if (url.pathname === "/api/retailer-forecasts") {
      sendJson(response, 200, { forecasts: await getRetailerForecastRows() });
      return;
    }

    if (url.pathname === "/api/promotions") {
      sendJson(response, 200, { promotions: await getPromotionPerformance() });
      return;
    }

    if (url.pathname === "/api/charts") {
      sendJson(response, 200, await getChartData());
      return;
    }

    if (url.pathname === "/api/model/price-forecast") {
      sendJson(response, 200, {
        forecasts: await getModelPriceForecasts(url.searchParams.get("limit"), session?.storeId)
      });
      return;
    }

    if (url.pathname === "/api/model/sales-forecast") {
      sendJson(response, 200, {
        forecasts: await getModelSalesForecasts(url.searchParams.get("limit"), session?.storeId)
      });
      return;
    }

    if (url.pathname === "/api/model/seasonal-insights") {
      sendJson(response, 200, {
        insights: await getSeasonalInsights(url.searchParams.get("limit"), session?.storeId)
      });
      return;
    }

    if (url.pathname === "/api/model/weather-insights") {
      sendJson(response, 200, {
        insights: await getWeatherInsights(url.searchParams.get("limit"), session?.storeId)
      });
      return;
    }

    if (url.pathname === "/api/model/top-products") {
      sendJson(response, 200, {
        products: await getTopProducts(url.searchParams.get("limit"), session?.storeId)
      });
      return;
    }

    if (url.pathname === "/api/model/performance") {
      sendJson(response, 200, {
        models: await getModelPerformance()
      });
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(FRONTEND_DIR, safePath);

    if (!filePath.startsWith(FRONTEND_DIR)) {
      sendJson(response, 403, { message: "Forbidden." });
      return;
    }

    serveStaticFile(response, filePath);
  } catch (error) {
    sendJson(response, 500, {
      message: "Dashboard request failed.",
      error: error.message
    });
  }
}

const server = http.createServer((request, response) => {
  router(request, response);
});

server.listen(PORT, () => {
  console.log(`Retailer dashboard running on http://localhost:${PORT}`);
});
