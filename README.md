# Dhanova E-commerce

Dhanova is a full-stack online store. The repository is deliberately split by
responsibility so a new contributor can find the right code quickly.

```text
Site 3/
├── frontend/              Next.js user interface
│   ├── public/            Logos and product images
│   └── src/
│       ├── components/    Shared page components
│       ├── lib/           Frontend API client
│       ├── pages/         Website routes
│       └── styles/        Global responsive styling
├── backend/               Express API and MongoDB data layer
│   ├── src/
│   │   ├── config/        Database configuration
│   │   ├── lib/           Shared backend services
│   │   ├── middleware/    Authentication and authorization
│   │   ├── models/        Mongoose models
│   │   ├── routes/        HTTP API endpoints
│   │   ├── scripts/       Catalogue import and maintenance jobs
│   │   └── validation/    Request validation schemas
│   └── uploads/           Runtime product uploads; not committed
├── scripts/               Commands that coordinate both applications
├── docs/                  Architecture and contributor documentation
├── package.json           Root commands
└── README.md              Start here
```

Generated runtime logs are written to the hidden `.preview/` directory. They
are not source code and are excluded from Git.

## Quick start

Requirements: Node.js 20 or newer and MongoDB.

```powershell
npm --prefix backend install
npm --prefix frontend install
Copy-Item backend/.env.example backend/.env
npm run dev
```

Open `http://localhost:3000`. The root `npm run dev` command starts both:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

To run one application while debugging:

```powershell
npm run dev:frontend
npm run dev:backend
```

## Configuration

All private backend settings belong in `backend/.env`. Start from
`backend/.env.example`. Never put payment secrets in frontend files or commit
the `.env` file.

Razorpay is the currently implemented online gateway. UPI and RuPay are shown
as checkout methods through that gateway. Cashfree is visible as a planned
option but still requires backend order and verification integration. Cash on
delivery works after the customer saves a delivery address.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together |
| `npm run build` | Compile both applications |
| `npm run verify` | Build and run production dependency audits |
| `npm start` | Start both previously built applications |
| `npm run dev:frontend` | Start only Next.js |
| `npm run dev:backend` | Start only Express |

Catalogue import and image-sync commands remain available in the root
`package.json`.

## Read next

- [System architecture](docs/ARCHITECTURE.md)
- [Frontend guide](frontend/README.md)
- [Backend guide](backend/README.md)
