# Frontend

The frontend is a Next.js Pages Router application.

## Important locations

- `src/pages/` — one file per website route
- `src/components/` — shared site header and footer
- `src/lib/api.ts` — API request helper
- `src/styles/globals.css` — global and responsive CSS
- `public/` — browser-accessible images and brand assets
- `next.config.ts` — forwards `/api/*` to the backend during development

## Commands

```powershell
npm install
npm run dev
npm run build
npm start
```

Run these inside `frontend/`, or use the equivalent root commands. Do not put
private API keys in `.env.local`; payment secrets belong to the backend only.
