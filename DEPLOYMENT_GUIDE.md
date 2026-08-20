# Dhanova deployment guide

This archive contains source code only. It intentionally excludes credentials,
Vercel project links, installed dependencies, build output, and runtime logs.

## Requirements

- Node.js 20 or newer
- A Vercel account
- A MongoDB Atlas database for deployment

MongoDB installed on a laptop works for local development only. Vercel cannot
connect to `localhost` on a developer's computer.

## Local development

1. Install and start MongoDB Community Server.
2. In the extracted project directory, run:

   ```powershell
   npm --prefix backend install
   npm --prefix frontend install
   Copy-Item backend/.env.example backend/.env
   npm run dev
   ```

3. Open `http://localhost:3000`.

The example backend configuration uses
`mongodb://127.0.0.1:27017/dhanova`. Replace the example JWT and admin password
before using real accounts.

## Vercel deployment

The frontend and backend are separate Vercel projects.

### 1. Create and link the backend project

```powershell
cd backend
npm install
npx vercel link
```

Install a free MongoDB Atlas resource from the Vercel Marketplace and connect it
to this backend project. Confirm that the project receives `MONGODB_URI` for the
Production environment.

Configure these backend Production variables in Vercel:

- `MONGODB_URI` — supplied automatically by the Atlas integration
- `JWT_SECRET` — a new random secret of at least 32 characters
- `FRONTEND_URL` — the final frontend URL, such as `https://your-store.vercel.app`
- `ADMIN_EMAILS`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` — optional admin bootstrap values
- Razorpay variables — optional until online payments are enabled

Deploy the backend:

```powershell
npx vercel --prod
```

Verify `https://your-api.vercel.app/api/health` returns `{"status":"ok"}`.

### 2. Seed the hosted catalogue

From the `backend` directory:

```powershell
npx vercel env pull .env.seed --environment=production --yes
node --env-file=.env.seed --import tsx src/scripts/seed-products.ts
Remove-Item .env.seed
```

Never share or commit `.env.seed`.

### 3. Create and deploy the frontend project

```powershell
cd ../frontend
npm install
npx vercel link
npx vercel env add API_BACKEND_URL production
```

Enter the backend base URL, such as `https://your-api.vercel.app`, when prompted.
Then deploy:

```powershell
npx vercel --prod
```

If the final frontend URL differs from the value configured as backend
`FRONTEND_URL`, update that backend variable and redeploy the backend.

## Production verification

Check all of the following:

- Frontend `/login` loads without the storefront category header.
- Frontend `/api/health` returns `{"status":"ok"}`.
- Frontend `/api/products?limit=1` returns at least one product.
- Invalid login details return `Invalid email or password`, not a backend-unavailable message.

