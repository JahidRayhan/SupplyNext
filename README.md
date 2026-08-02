# SupplyNext SDCIP — Release 2

My Release 2 build of the SDCIP pilot from the SRS. Release 1 covered demand forecasting, inventory analytics, and a role-based dashboard for the Smart Fan product line. Release 2 adds login/RBAC, Postgres persistence, and logistics/IoT tracking.

**Stack:** Node/TypeScript/Express backend, Postgres (raw SQL via `pg`, no ORM), React/TypeScript/Vite frontend, Recharts, JWT auth (`jsonwebtoken` + `bcryptjs`).

## Setup

Needs Postgres running locally:

```
sudo apt-get install postgresql
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER sdcip WITH PASSWORD 'sdcip_dev_pw' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE sdcip OWNER sdcip;"
```

The backend connects via `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` (or `DATABASE_URL`), defaulting to the values above. It runs the schema and seeds mock data automatically on first boot.

## Running it

**Backend**
```
cd backend
cp -n .env.example .env
npm install
npm run dev              # http://localhost:4000
```

**Frontend** (separate terminal)
```
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Health check: `GET http://localhost:4000/health`

**IoT simulator** (optional, for the Logistics tab): `npm run simulate` from `backend/`. It fakes RFID scans and GPS pings so shipments move through their statuses automatically. Leave the Logistics tab open — it polls every 4s.

## Logging in

Log in via `POST /api/v1/auth/login` (or the login page). All demo accounts share the password `SDCIP-Pilot-2026`:

| Email | Role |
|---|---|
| nusrat.jahan@supplynext.com | Sales & Demand Planner |
| kamrul.hasan@supplynext.com | Production Manager |
| farzana.akter@supplynext.com | Warehouse Manager |
| rafiqul.islam@supplynext.com | Logistics Coordinator |
| tanvir.ahmed@supplynext.com | Executive |
| admin@supplynext.com | Admin |

Write actions are restricted by role (e.g. only a Sales Planner or Admin can override a forecast) — see the route files for the exact permissions per endpoint.

## Key features (SRS §4 mapping)

- **Forecasting** — FR-DF-02/03: weekly + monthly demand forecast per SKU with confidence bands. FR-DF-04: planner override with mandatory reason. FR-DF-05: recompute endpoint.
- **Inventory** — FR-IM-01: live stock ledger across 1 factory + 3 warehouses. FR-IM-02: reorder point + safety stock. FR-IM-03: transfer recommendations. FR-IM-04: cycle-count reconciliation. FR-IM-05: audit trail.
- **Dashboard** — FR-DB-01/02: role-specific KPIs.
- **Logistics & IoT** — FR-LG-01/02: shipment creation and status tracking (`pending → in_transit → delivered/delayed`), with IoT events auto-advancing shipment status and feeding on-time delivery %.

Mock data: 4 Smart Fan SKUs with ~120 days of synthetic sales history, seeded deterministically so numbers stay stable across restarts.

## Testing

```
cd backend
sudo -u postgres psql -c "CREATE DATABASE sdcip_test OWNER sdcip;"   # once
npm test
```

16 tests total: unit tests on the forecast logic, plus integration tests (supertest) covering login, auth, and validation. Runs in CI on every push (`.github/workflows/ci.yml`).

## Known limitations

This is a pilot, not a production system:
- No real IoT device fleet (the simulator stands in for one).
- No refresh tokens/session revocation — a single 8h JWT.
- Forecast model is a simple trailing-mean, not a trained ML model.
- No DB migration tooling, structured logging, or admin UI for managing users.
