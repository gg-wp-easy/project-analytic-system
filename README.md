# NK-Tech Finance · Investment Analytics

Part of the NK-Tech Finance product family (repository `project-site-analytic-system`). App icons and logos come from the shared brand kit `../nk-tech-brand`: run `node nk-tech-brand/build.mjs --sync`, then `npm run icons:create -- --force`.

Electron desktop application, a thin client of the NK-Tech Finance platform (`../nk-platform`). Since platform step 5 it bundles no Python: the user signs in with their NK-Tech Finance account (service `auth`), calculations run in the `analytics` service, and T-Invest market data comes through the `market` service with the server token, so no personal T-Bank token is needed. The app is part of the **Pro** plan; other plans see a plan screen after signing in.

| Path | Server |
| --- | --- |
| `/auth/*` | sign-in, tokens, profile and plan |
| `/analytics/*` | stock valuation, bond builder, indexes, commodities, optimizer settings (per account) |
| `/market/tinvest/<Service>/<Method>` | T-Invest REST API with the same request and response bodies, cached on the server |

The `server-analytic-system/` checkout is frozen: its live code now lives in `nk-platform/services/analytics`. It stays until the platform version is verified on staging.

All orchestration is done through Node.js scripts from `scripts/`. No `.sh` or `.ps1` entrypoints are required.

## Main Commands

### Frontend

- `npm run dev` - start Vite in browser mode; it proxies `/auth`, `/analytics` and `/market` to the platform gateway (`make dev` in `../nk-platform`, `http://127.0.0.1:8000`, override with `PLATFORM_URL`)
- `npm run build` - build the frontend (no Electron icon generation); `VITE_PLATFORM_URL` sets the server address, empty means the same origin
- `npm run test:scripts` - tests of the build scripts

### Frontend asset splitting

Vite keeps route-level lazy loading and separates stable runtime groups (`react`, `mui`, and `radix`) into cacheable chunks. Spreadsheet and PDF packages remain lazy and are isolated in `spreadsheet`, `pdf`, and `pdf-canvas` chunks, so they load only when an export is requested. Run `npm run build` to inspect production chunk sizes; the current largest JS chunk is 429.53 kB, below 500 kB.

### Bond matching and duration immunization

The bond screen sends only construction parameters to `POST /analytics/analysis-bonds-portfolio`; the browser renders the result. Enter an investment amount (a nominal limit), a target annual cash-flow percentage, one currency, a risk profile, a monthly or quarterly payout cadence, and 10–50 distinct issues. `mixed` risk allows all levels 0–3. For duration immunization, enter a target modified duration in years.

The server obtains the T-Bank coupon calendar, includes principal at maturity, and aggregates known payments over the next 12 months. The annual target is `investment amount × target percentage / 100`. **Matching** requires the requested minimum number of distinct issues, caps each issue at 10% of total nominal, and then selects the smallest feasible number of issues and, among those portfolios, the lower nominal amount. Known payments must cover an equal share of the annual target in each of 12 monthly or 4 quarterly rolling periods; all quantities are integer. A strict cadence or the 10% cap can make a requested scenario infeasible. **Immunization** uses the same constraints and additionally keeps estimated modified duration within ±0.25 years of the target; it is duration targeting, not matching an external liability.

The server caches each currency/limit universe in memory for 15 minutes (coupon schedules are cached by `market` for a day). Normal construction uses that cache; the separate **Refresh bonds** button forces a T-Bank refresh. Only same-currency issues with a known fixed payment schedule are considered. Floating-rate, amortizing, perpetual, and callable-flagged issues are excluded. `estimatedNominal` is a nominal proxy, not a tradable purchase price. The scenario excludes prices, accrued interest, taxes, fees, default, liquidity, unavailable data, and changing issuer terms; it creates no obligation and gives no payment guarantee.

References: [CFA Institute overview of cash-flow matching and immunization](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/overview-fixed-income-portfolio-management), [T-Bank `GetBondCoupons` API](https://developer.tbank.ru/invest/api/instruments-service-get-bond-coupons), and [Investor.gov bond basics](https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products).
### Electron

- `npm run electron:dev` - start Electron in dev mode (needs `make dev` in `../nk-platform`)
- `npm run electron:build:local` - build an unpacked app for the host architecture in `release/<os>-local`, without installers or ASAR backup; reuses the output directory
- `npm run electron:build` - build Electron for the current OS
- `npm run electron:build:win` - build Windows artifacts
- `npm run electron:build:win:msi` - build Windows MSI profile
- `npm run electron:build:win:store` - build Windows Store profile
- `npm run electron:build:linux` - build Linux artifacts
- `npm run electron:build:mac` - build macOS artifacts

### GitHub Releases and Auto-Update

- Push a tag like `v1.0.1`, or run `Build and Release` manually with `publish_release=true` and `release_tag=v1.0.1`.
- The workflow publishes Windows and Linux build files directly to the GitHub Release without using GitHub Actions artifacts.
- Packaged installed Windows builds use `electron-updater` to check GitHub Releases from `gg-wp-easy/project-site-analytic-system`.
- Set the repository variable `PLATFORM_URL` (Settings → Secrets and variables → Actions → Variables) to the platform API address, for example `https://api.<domain>`. Release builds embed it as `VITE_PLATFORM_URL` and require https; without it the workflow stops.

## Main Orchestrators

- `scripts/electron.cjs` — dev mode and builds; a build embeds `VITE_PLATFORM_URL` (a local build defaults to `http://127.0.0.1:8000`)

## Typical Flows

### First setup on another machine

1. `make dev-db` and `make dev` in `../nk-platform` (the platform with a T-Invest token for `market`)
2. `npm install`
3. `npm run electron:dev` (or `npm run dev` in the browser)
4. Sign in; a Pro plan is granted until billing exists: `uv run --frozen python -m app.admin plan <email> pro` in `nk-platform/services/auth` (on a server: `docker compose exec auth python -m app.admin plan <email> pro`)

### Full production build

1. `npm install`
2. `VITE_PLATFORM_URL=https://api.<domain> npm run electron:build`

## Stock analysis and portfolio

The cluster, decision-tree, neural and hybrid pages send the same records, built by `buildStockAnalysisRecords` in `src/entities/fundamentals`. A record holds the trading flags, P/E and the other multiples, ROE, ROA, net margin, revenue, debt/equity, beta, payout ratio and the dividend history (`consecutive_dividend_years`, `last_dividend_year`). Revenue and debt/equity are new fields, so fundamentals loaded by an older app version must be reloaded once.

The server runs one pipeline for all four pages, and the pages differ only in the model of the fair valuation level: peer groups, a regression tree, a neural ensemble, or their weighted blend. The pipeline cleans the data (P/E from 1 to 100, one share per issuer). It then measures each company's valuation level: the average of its P/E, P/B, P/S and EV/EBITDA relative to the market medians, keeping the multiples that share one common factor. A factor analysis of the fundamentals and the sector keeps significant factors without multicollinearity; the sector stays when its joint Wald test is significant, and price multiples are never factors. The pipeline estimates each company's fair level out of sample, sets the class from the model's probable error, ranks candidates with the dividend payers of the last two years first (companies below 50 bn RUB market cap are screened out; companies without dividends only fill missing positions at the minimum weight), and runs a Markowitz optimization. Expected return is the Gordon growth model: `dividend yield + g`, with `g = (1 − payout) × ROE`; past prices and the valuation gap do not enter it. Risk is the Ledoit–Wolf covariance of three years of weekly T-Invest prices, or a single-index model by beta when prices are unavailable. All rates are decimal annual rates (`0.20` means 20%).

The optimizer settings choose the objective: minimum risk, maximum Sharpe ratio, maximum return at a target risk, or minimum risk at a target return. Automatic portfolio optimization means the maximum Sharpe ratio with 20 positions. If a target cannot be reached, the server returns the nearest portfolio with a message. Every page shows the response key `valuation_report` in `ValuationReportPanel` (`src/features/valuation-report`): the valuation level, the factor analysis, model quality against simple baselines, the classes, candidate tiers and the risk model.

The rules and the reasons for them are described in `server-analytic-system/README.md` (section "Stock valuation pipeline") and `docs/STOCK_VALUATION.md`; the code runs in `nk-platform/services/analytics`. Optimizer settings are stored per account on the server.

## Local build resource usage

Use `npm run electron:dev` for development and `npm run electron:build:local`
when you need to test a packaged app against the local platform. The local profile
skips installer compression and additional architectures. Regular platform build
commands retain their release targets.

Icon generation now checks source, generator, lockfile and generated file hashes.
Unchanged assets are reused; `npm run icons:create -- --force` regenerates them.
The frontend build no longer runs this desktop-only step.