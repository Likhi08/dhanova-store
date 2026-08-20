# Backend

The backend is an Express API backed by MongoDB and Mongoose.

## Important locations

- `src/server.ts` — application entry point and route registration
- `src/routes/` — API endpoints
- `src/models/` — MongoDB schemas
- `src/middleware/` — authentication and administrator authorization
- `src/validation/` — Zod request schemas
- `src/lib/` — shared backend services
- `src/scripts/` — catalogue imports and maintenance tasks
- `uploads/` — runtime product images, excluded from Git

## Commands

```powershell
Copy-Item .env.example .env
npm install
npm run dev
npm run build
npm start
```

The API runs on `http://localhost:4000` by default. Confirm it with
`GET /api/health`.

Keep MongoDB, JWT, administrator, and payment secrets in `.env`. Never expose
them through frontend code or commit them to version control.
