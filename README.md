# Retailer Dashboard

This project is a final-year-project retailer intelligence dashboard built with a dependency-free Node.js server and a premium frontend inspired by modern retail analytics apps.

## Start the app

```bash
npm.cmd start
```

Open `http://localhost:3000`.

## Where to enter Supabase details

1. Create a file named `.env` in the project root.
2. Copy the values from `.env.example`.
3. Fill in:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Example:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

The backend will load `.env` automatically on startup.

## Supabase table expected

The dashboard currently reads from `price_history` and expects columns like:

- `product_id`
- `product_name`
- `category`
- `supermarket`
- `price`
- `stock`
- `recorded_at`

## When to add your trained model

Add your trained model output after your product IDs in Supabase are stable.

Place the model predictions file here:

- `be/models/predictions.json`

You can use the example file `be/models/predictions.example.json` as the template.

Recommended timing:

- First, connect Supabase and confirm products load correctly.
- Then export your trained model predictions using the same `productId` values.
- Once `predictions.json` is added, the dashboard will automatically prefer trained-model predictions over the simple trend predictor.

## Mobile app linkage

The UI is structured to show retailer decisions influenced by your mobile app through:

- consumer behavior insights,
- conversion and basket indicators,
- promotion performance,
- dynamic pricing recommendations.
