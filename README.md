# Insider Trading Compliance Portal (White-Label)

A multi-tenant employee insider trading compliance portal covering:

- **Restricted List** — securities under trading restriction, with reasons and audit trail
- **Trading Window** — open/closed control that automatically blocks pre-clearance requests when closed
- **Pre-Clearance Workflow** — employees request approval to trade; compliance approves/rejects; auto-blocked against the restricted list and closed windows
- **UPSI Register (Structured Digital Database)** — append-only log of Unpublished Price Sensitive Information, with a SHA-256 hash per entry for tamper-evidence and an access log
- **Employee Self-Declarations** — initial/annual holding disclosures, transaction disclosures, immediate-relative updates, with compliance acknowledgement
- **White-label branding** — brand name, primary color, logo, and support email are per-tenant and applied live across the UI (multi-tenant: one deployment can serve many client organizations, or you can run one deployment per client)
- **Role-based access** (Employee / Compliance Officer / Admin) and an append-only audit log across every mutating action

### Mutual fund / AMC support

Mutual fund insider trading falls under a different SEBI framework than listed companies (SEBI (Mutual Funds) Regulations, 1996 + the 2022 circular on Institutional Mechanism for Prevention of Fraud/Market Abuse), which is about front-running the fund's own trades rather than corporate UPSI. Two extra pieces support this:

- **Scheme Trades** — compliance logs the AMC's own fund trades (scheme, security, buy/sell, quantity, date)
- **Surveillance Alerts** — automatically generated whenever an employee's approved pre-clearance trade falls within 7 days of a scheme trade in the same security. This is the core front-running detection pattern; compliance reviews each alert as Reviewed / Dismissed / Escalated.

The restricted list, pre-clearance, and UPSI/SDD register modules work for both listed-company and mutual-fund clients as-is — the UPSI register for an AMC client would log portfolio/scheme decisions instead of corporate events. The surveillance window (7 days) is a starting default; adjust `SURVEILLANCE_WINDOW_DAYS` in `src/lib/db.ts` per client requirements. Declarations don't yet feed the surveillance check automatically (only approved pre-clearances do) — extending that is a reasonable next step if a client's transaction declarations need the same check.

## Important: this is functional software, not a compliance certification

This app implements the *mechanics* SEBI's PIT (Prohibition of Insider Trading) regulations and the Structured Digital Database (SDD) requirement typically call for — restricted lists, trading windows, pre-clearance, UPSI logging, disclosures, audit trails. It has **not** been reviewed by a SEBI compliance professional or lawyer. Before selling or deploying this as "SEBI PIT/SDD compliant," have a qualified compliance consultant review the actual regulations (SEBI PIT Regulations, 2015, as amended) against this implementation and sign off. Treat this as a strong technical foundation, not a legal guarantee.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **SQLite via Node's built-in `node:sqlite`** (Node 22+) — no external database server or native-module build step required. Swappable for Postgres for production multi-tenant scale (see below).
- **JWT session cookies** (httpOnly), **bcrypt** password hashing, **zod** input validation

## Local setup

```bash
npm install
cp .env.example .env.local   # then edit JWT_SECRET to a real random value
npx tsx scripts/seed.ts      # creates a demo tenant + 3 demo users
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

Demo accounts (from the seed script):

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.example | Admin@12345 |
| Compliance Officer | compliance@demo.example | Compliance@12345 |
| Employee | employee@demo.example | Employee@12345 |

**Change or remove these before any real deployment.**

## Project structure

```
src/
  app/
    login/                    Login page
    (dashboard)/              Authenticated app shell + pages (one per module)
    api/                      Route handlers (one folder per resource)
  lib/
    db.ts                     SQLite connection + schema migration + audit logging
    auth.ts                   Password hashing, JWT session cookie helpers
    api.ts                    Client-side fetch helper
  components/
    SessionProvider.tsx       Client-side auth/tenant context
scripts/
  seed.ts                     Demo data seeder
```

## White-labeling for a new client

Each client organization is a row in the `tenants` table. To onboard a new client:

1. Insert a new tenant row (name, brand_name, primary_color, logo_url, support_email) — either directly via SQL/a small script, or extend the Admin page into a "create tenant" flow if you're selling this multi-tenant from one deployment.
2. Create their users with `tenant_id` pointing at the new tenant.
3. Their users will see the new brand name/color/logo automatically — no code changes needed.

If you'd rather run **one deployment per client** (simpler, fully isolated data — often preferred for compliance software), just re-deploy this repo per client with a different database and seed their tenant/users. The Admin page lets their own admin user adjust branding afterward without your involvement.

## Production database (recommended before selling this)

`node:sqlite` is great for demos and small deployments, but for real multi-tenant production use, swap `src/lib/db.ts` for Postgres:

- Use `pg` or an ORM (Drizzle, Prisma — note Prisma's engine binaries need network access to `binaries.prisma.sh` at install time, so confirm your build environment allows that)
- Keep the same table shapes; the SQL in `migrate()` is close to standard SQL already
- This matters most for: concurrent write load, managed backups, and point-in-time recovery — all things a broker/compliance client will ask about

## Pushing this to your private GitHub repo

```bash
cd insider-trading-portal
git init
git add .
git commit -m "Initial commit: insider trading compliance portal"

# Create a private repo on GitHub first (via github.com or `gh repo create`), then:
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

If you have the GitHub CLI installed, you can create the private repo and push in one step:

```bash
gh repo create <repo-name> --private --source=. --remote=origin --push
```

**Do not commit `.env.local` or any real `data/*.db` files** — both are already in `.gitignore`. If you ever add a real client's database file by accident, remove it and rotate `JWT_SECRET` immediately, since a leaked SQLite file exposes password hashes and all compliance data.

## Hosting options

### Option A — Vercel (fastest, good for demoing to prospects)
Vercel's filesystem is ephemeral, so `node:sqlite` won't persist data between deployments/restarts. Fine for a demo; not fine for a real client's compliance data. To actually run production on Vercel, swap in a hosted Postgres (Vercel Postgres, Neon, or Supabase) first.
```bash
npm i -g vercel
vercel        # follow prompts, link to your GitHub repo for auto-deploys
vercel env add JWT_SECRET
```

### Option B — Railway / Render (simplest for a small persistent server)
Both support persistent disks, so `node:sqlite` works as-is for a single-tenant or small multi-tenant deployment.
1. Connect your GitHub repo.
2. Set build command `npm run build`, start command `npm start`.
3. Add a persistent volume mounted at `/app/data` and set `SQLITE_PATH=/app/data/app.db`.
4. Set `JWT_SECRET` as an environment variable.

### Option C — Your own VPS / Docker (most control, best for a client who wants their own infra)
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```
Mount a volume at wherever `SQLITE_PATH` points so data survives container restarts, and put it behind a reverse proxy (Caddy or nginx) with TLS — compliance data over plain HTTP is a non-starter for a client pitch.

## Before you sell this as "ready-made"

A few things worth doing before positioning this as a purchasable, deploy-and-go product:
1. **Compliance review** — as above, get a SEBI compliance professional to check the feature set against actual PIT/SDD regulatory text and any recent amendments.
2. **Multi-factor auth** — regulators and brokers increasingly expect MFA for systems touching UPSI; this isn't implemented yet.
3. **Data residency** — SEBI has expectations around where data is stored; confirm your hosting choice satisfies them for an Indian financial-services client.
4. **Backups and retention** — SEBI recordkeeping rules typically require multi-year retention; make sure your hosting/backup strategy matches, not just "the app works."
5. **Penetration test / security review** — standard due diligence before a broker-dealer or listed company will trust you with insider trading data.
