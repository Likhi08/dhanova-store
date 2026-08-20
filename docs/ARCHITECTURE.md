# System architecture

## Request flow

```text
Browser
  │
  ├── pages, styles, images ──> Next.js frontend (:3000)
  │                                  │
  │                                  └── /api/* rewrite
  │                                           │
  └──────────────────────────────────> Express backend (:4000)
                                              │
                                              └── MongoDB (:27017)
```

The browser always calls `/api/...` through `frontend/src/lib/api.ts`. During
local development, `frontend/next.config.ts` forwards those requests to the
backend. This keeps cookies and API calls on the same browser origin.

## Frontend ownership

- `src/pages/` maps files to browser routes such as `/`, `/cart`, `/account`,
  `/admin`, and `/product/[id]`.
- `src/components/` contains shared header and footer UI.
- `src/lib/api.ts` is the single HTTP client entry point.
- `src/styles/globals.css` contains the design system and responsive rules.
- `public/` contains assets that can be requested directly by URL.

The frontend must never contain database credentials, JWT secrets, payment
secrets, or privileged business logic.

## Backend ownership

- `src/server.ts` creates the Express application and mounts routes.
- `src/routes/` owns authentication, accounts, products, carts, orders, and
  payments.
- `src/models/` defines MongoDB documents.
- `src/validation/` validates incoming API payloads.
- `src/middleware/` enforces signed-in and administrator access.
- `src/lib/` contains reusable inventory, error, and import utilities.
- `src/scripts/` contains manually invoked catalogue maintenance jobs.

Uploaded product images are stored in `backend/uploads/` and served from
`/api/uploads/`. The directory is runtime data and is not tracked by Git.

## Authentication and checkout

Authentication uses an HTTP-only session cookie. Administrator routes verify
both the session role and the current database role. Checkout always validates
the saved delivery address, product availability, prices, and inventory on the
backend.

Razorpay order creation and signature verification are implemented. UPI and
RuPay can be offered by the Razorpay checkout after credentials are configured.
Cashfree currently has a frontend placeholder only and must not be treated as
an active gateway until server-side creation and verification are implemented.

## Adding a feature

1. Put visual behavior in the relevant frontend page or shared component.
2. Put trusted data changes in a backend route.
3. Validate route input with Zod.
4. Protect private routes with `requireUser` or `requireAdmin`.
5. Add or update the Mongoose model when persisted data changes.
6. Run `npm run build` from the repository root.
