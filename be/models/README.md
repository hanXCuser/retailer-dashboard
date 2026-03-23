Place your trained model output here as `predictions.json`.

Supported structure:

[
  {
    "productId": "P-1001",
    "predictedNextPrice": 8.82,
    "confidence": 0.93
  }
]

Notes:
- Use `productId` values that match Supabase `price_history.product_id`.
- If `predictions.json` exists, the dashboard will use those values instead of the simple trend-based prediction.
- If it does not exist, the app still works using the built-in fallback predictor.
