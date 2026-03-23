const fs = require("fs");
const path = require("path");

const modelPredictionsPath = path.join(__dirname, "..", "models", "predictions.json");

function loadModelPredictions() {
  if (!fs.existsSync(modelPredictionsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(modelPredictionsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.predictions || null;
  } catch (error) {
    return null;
  }
}

function findPrediction(predictions, productId, productName) {
  if (!predictions) {
    return null;
  }

  return predictions.find((entry) => {
    return entry.productId === productId || entry.product_id === productId || entry.product === productName || entry.product_name === productName;
  }) || null;
}

module.exports = {
  loadModelPredictions,
  findPrediction,
  modelPredictionsPath
};
