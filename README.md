# NYC Properties Hub

Portfolio management for NYC multifamily investments — single-source-of-truth dashboard with
NYC API enrichment (GeoSearch, PLUTO, DOF valuation, HPD/DOB violations), file storage with
public links, and one-click CSV export for Google Sheets.

Built on Cloudflare Pages + Functions + D1 (SQLite) + R2 (file storage). The original
`building_calculator.html` is preserved and mounted at `/calculator.html` — every property
has an "Open in DSCR Calculator" button that pre-loads the calculator with the property's
data via `?id=N`.

---

## Architecture

```
public/                       # Static site (Pages output)
├── index.html                # Dashboard with KPIs + property cards
├── properties.html           # 19-column master table
├── property.html             # Per-property detail + files + log
├── add.html                  # Add wizard with NYC API lookup
├── calculator.html           # Existing DSCR calculator (auto-fill from ?id=N)
├── css/styles.css
└── js/{api,utils,dashboard,properties,property,add}.js

functions/                    # Cloudflare Pages Functions (server)
├── _shared.js
└── api/
    ├── properties/{index,[id]}.js   # CRUD
    ├── lookup.js                    # NYC GeoSearch + PLUTO + HPD/DOB + rent-stab heuristic
    ├── files/{upload,[id]}.js       # R2 uploads, public-link generation
    └── export.js                    # CSV (UTF-8 BOM) — drop into Google Sheets

schema.sql                    # D1 schema (properties, property_files, property_log)
wrangler.toml                 # Cloudflare bindings
```

---

## Phase A — One-time setup (Cloudflare)

### 1. Create the Cloudflare resources

You need (free tier is enough for getting started):

- A **Cloudflare account**
- A **D1 database** named `properties-hub`
- An **R2 bucket** named `properties-hub-files`
- A **Pages project** connected to this Git repo

### 2. Via the Cloudflare dashboard

1. **D1**: Workers & Pages → D1 → Create database → name it `properties-hub`. Copy the
   **Database ID** that appears.
2. **R2**: R2 → Create bucket → name it `properties-hub-files`. Then on the bucket page:
   Settings → **Public Access** → enable **R2.dev subdomain** (so file links work). Copy
   the public URL — it looks like `https://pub-XXXXXXXXXXXX.r2.dev`.
3. **Pages**: Workers & Pages → Create application → Pages → Connect to Git → pick this
   repo and the `claude/nyc-properties-portfolio-Xz7iR` branch.
   - Build command: *(leave empty)*
   - Build output directory: `public`
   - Production branch: `claude/nyc-properties-portfolio-Xz7iR` (or merge to `main` and use that)

### 3. Wire bindings on the Pages project

Pages project → **Settings → Functions → Bindings** (or "Variables and bindings" depending
on dashboard version):

- **D1 database binding**: variable name `DB`, database `properties-hub`.
- **R2 bucket binding**: variable name `FILES`, bucket `properties-hub-files`.
- **Environment variable**: name `FILES_PUBLIC_BASE`, value = the R2 public URL you
  copied above (e.g. `https://pub-XXXXXXXXXXXX.r2.dev`). No trailing slash.

Set these for **both** Production and Preview environments.

### 4. Initialize the D1 schema

After the database exists, run the schema. Either:

**From the dashboard:** D1 → properties-hub → **Console** tab → paste the contents of
`schema.sql` and Run.

**Or from the CLI** (after `npm install` and editing `wrangler.toml` with the D1 database ID):

```bash
npx wrangler d1 execute properties-hub --remote --file=./schema.sql
```

### 5. Deploy

Push to the branch — Cloudflare Pages will build and deploy automatically. Or run:

```bash
npx wrangler pages deploy public
```

You'll get a URL like `https://nyc-properties-hub.pages.dev`. That's the app.

---

## Local development

```bash
npm install
# Make sure wrangler.toml has the right D1 database ID
npm run db:init:local          # set up the local D1
npm run dev                    # serves at http://localhost:8788
```

In local dev, file uploads to R2 use the local emulator. Set `FILES_PUBLIC_BASE` in
`.dev.vars` to e.g. `http://localhost:8788` if you want links to render — though for full
file testing you may prefer to deploy to a preview environment.

---

## How it works

### Adding a property

1. Click **+ Add Property** → enter the address → **Lookup** calls:
   - NYC GeoSearch → resolves BBL, BIN, borough
   - PLUTO → year built, units, building class
   - DOF Property Valuation → tax exemption codes (421-a, J-51)
   - HPD Open Violations → count
   - DOB Violations → count
2. Heuristic flags rent stabilization as **Confirmed / Likely / Possible / No**.
3. Pre-filled fields appear in the form. Edit anything, fill in financials (asking, max,
   NOI, DSCR…), and **Save**.

### Updating a property

Open a property → use the **Quick Update** card on the right to change status, next step,
last offer, notes. Every change writes to the activity log with a timestamp. `last_updated`
is automatically set to today.

### File uploads

On the property page, drag & drop files into the dropzone (or click). Pick a category:
contracts / photos / inspection / DSCR analysis / correspondence. Each file is uploaded
to R2 under `properties/{id}/{category}/{timestamp}-{filename}` and gets a **public URL**.

That public URL is:
- Shown in the property detail page (clickable)
- Shown in the dashboard's 19-column table (Files column)
- Included in the CSV export — so the Google Sheet will have direct download links

### Exporting to Google Sheets

Click **Export to Google Sheets (CSV)** anywhere on the site → downloads a UTF-8 CSV with
all 19 columns plus a "Files" column listing every file's public URL.

In Google Sheets: **File → Import → Upload → Replace current sheet**. Done.

**Live link option:** In Sheets, use
`=IMPORTDATA("https://your-domain.pages.dev/api/export?format=csv")` in cell A1 of a fresh
sheet. The sheet will re-fetch on open.

### DSCR Calculator integration

Each property has an **"Open in DSCR Calculator"** button. It opens `/calculator.html?id=N`
which loads the property record and auto-fills:
- Address (which triggers the calculator's own NYC lookup)
- Units
- Price (= asking price)

The calculator stays in Hebrew/RTL — it's your personal analysis tool, unchanged from the
original. The Hub itself is English-only as specified.

---

## NYC APIs used (no keys required for these endpoints)

| Source | Endpoint |
|---|---|
| GeoSearch (BBL/BIN) | `https://geosearch.planninglabs.nyc/v2/search` |
| PLUTO | `https://data.cityofnewyork.us/resource/64uk-42ks.json` |
| DOF Property Valuation | `https://data.cityofnewyork.us/resource/8y4t-faws.json` |
| HPD Open Violations | `https://data.cityofnewyork.us/resource/wvxf-dwi5.json` |
| DOB Violations | `https://data.cityofnewyork.us/resource/3h2n-5cm9.json` |

Socrata allows anonymous calls but is rate-limited. For production volume, register a free
app token at https://data.cityofnewyork.us and pass it as `&$$app_token=…`. Not wired in
yet — add it in `functions/api/lookup.js` if needed.

---

## Security note

There is **no authentication** on this deployment by design (per the project spec). The
URL is the only secret. If/when you want a login wall, the recommended path is
**Cloudflare Access**: Zero Trust → Access → Applications → add the Pages domain →
restrict to your Google account email. No code changes required.

---

## Data model (D1)

`properties` — one row per property, 19 spec columns + `id`, `created_at`, `enrichment_json`.

`property_files` — every uploaded file with `r2_key`, `public_url`, `category`,
`property_id` FK.

`property_log` — append-only activity log per property (`created`, `updated — status: X → Y`,
`file uploaded`, etc.). Surfaced in the property detail page.

---

## File index (everything that ships)

- `wrangler.toml`, `schema.sql`, `package.json`, `.gitignore`, `README.md`
- `functions/_shared.js`
- `functions/api/properties/index.js`
- `functions/api/properties/[id].js`
- `functions/api/lookup.js`
- `functions/api/files/upload.js`
- `functions/api/files/[id].js`
- `functions/api/export.js`
- `public/index.html`, `properties.html`, `property.html`, `add.html`, `calculator.html`
- `public/css/styles.css`
- `public/js/utils.js`, `api.js`, `dashboard.js`, `properties.js`, `property.js`, `add.js`
