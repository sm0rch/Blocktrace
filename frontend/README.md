This frontend folder contains the React components and hooks and is now configured as a Vite/React app.

Structure:
- App.jsx
- components/
- hooks/
- services/
- main.jsx
- index.html
- package.json
- vite.config.js
- style.css

Run locally:
1. In the backend folder:
   ```bash
   cd backend
   npm install
   node server.js
   ```
2. In the frontend folder:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The frontend is configured to call the backend at `http://localhost:4000/api` by default.

One-server production flow:
1. Build the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Run the backend to serve the built site:
   ```bash
   cd backend
   npm install
   npm run serve:prod
   ```

This starts the app on `http://localhost:4000` and serves both the frontend UI and backend API together.

For local development, keep frontend and backend running separately:
- frontend: `cd frontend && npm run dev`
- backend: `cd backend && npm start`

Quick API examples (use these to test the running app):

- Get metrics:
```bash
curl -sS http://localhost:4000/api/dashboard/metrics | jq
```

- List batches:
```bash
curl -sS http://localhost:4000/api/batches | jq
```

- Scan token (example):
```bash
curl -sS http://localhost:4000/api/scan/TOKEN-001 | jq
```

- Report issue (demo):
```bash
curl -sS -X POST http://localhost:4000/api/scan/report-issue \
   -H "Content-Type: application/json" \
   -d '{"tokenId":"TOKEN-001","issueType":"quality","description":"Demo issue","evidenceHash":null}' | jq
```

- Lock payment (demo):
```bash
curl -sS -X POST http://localhost:4000/api/payments/lock \
   -H "Content-Type: application/json" \
   -d '{"batchId":"BATCH-001","payeeWallet":"0xabc","amountWei":1000,"flatFeeWei":10}' | jq
```

Notes on Database:
- The current backend uses mock/stub data and does not require a database for the demo.
- For production persistence, configure `MONGO_URI` (MongoDB) or `DATABASE_URL` (Postgres) in `backend/.env` and implement/off-chain sync as needed.

If you want, I can set up a local MongoDB (Docker) and wire the backend to persist data.
