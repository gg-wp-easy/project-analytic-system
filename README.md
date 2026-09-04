# Project Site Analytic System

Electron desktop application with one Python backend:

- `server-analytic-system`

All orchestration is now done through Node.js scripts from `scripts/`. No `.sh` or `.ps1` entrypoints are required.

## Main Commands

### Frontend

- `npm run dev` - start Vite in browser mode
- `npm run build` - build the frontend

### Server Repository Sync

- `npm run servers:prepare` - fetch/pull the server repository
- `npm run analytics-server:prepare` - sync only `server-analytic-system`

To replace a local server checkout from scratch:

- `node scripts/prepare.cjs --reclone`
- `node scripts/prepare.cjs analytics --reclone`

### Python Backends

- `npm run servers:install` - install Python dependencies for the backend
- `npm run servers:build` - build the backend with PyInstaller
- `npm run analytics-server:install` - install dependencies only for `server-analytic-system`
- `npm run analytics-server:build` - build only `server-analytic-system`
- `npm run analytics-server:dev` - run only `server-analytic-system` in dev mode

### Electron

- `npm run electron:dev` - start Electron in dev mode
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
- If `server-analytic-system` is private, add repository secret `SERVER_ANALYTIC_REPOSITORY_TOKEN` with read access to that backend repository.

## Main Orchestrators

- [scripts/prepare.cjs](C:/Users/nikit/InvestProject/project-site-analytic-system/scripts/prepare.cjs)
- [scripts/servers.cjs](C:/Users/nikit/InvestProject/project-site-analytic-system/scripts/servers.cjs)
- [scripts/electron.cjs](C:/Users/nikit/InvestProject/project-site-analytic-system/scripts/electron.cjs)

## Typical Flows

### First setup on another machine

1. `npm install`
2. `npm run servers:prepare`
3. `npm run servers:install`
4. `npm run electron:dev`

### Full production build

1. `npm install`
2. `npm run servers:prepare`
3. `npm run servers:build`
4. `npm run electron:build`

## Server portfolio risk and return

The stock-analysis server uses one annual methodology in the AI, hybrid, tree, and cluster portfolio paths. All rates are decimal annual rates (`0.20` means 20%).

- **Expected return:** CAPM-implied return: `risk_free_rate + beta * market_risk_premium`. The risk-free rate comes from the saved optimizer settings; the default market risk premium is `5.5%` in `analysis/analysis_stocks/common/markowitz_constants.py` and must be reviewed when the target market or investment horizon changes.
- **Stock risk:** single-index total volatility: `sqrt(beta^2 * market_volatility^2 + idiosyncratic_volatility^2)`. The default market and idiosyncratic volatilities are 20% and 10%, respectively. The existing market-cap multiplier scales volatility only.
- **Portfolio risk:** the covariance matrix has a shared market factor and a diagonal idiosyncratic component; portfolio volatility remains `sqrt(w.T * Cov * w)`.
- Value, quality, dividend, and ML scores select and rank candidates but do **not** add arbitrary percentage points to `expected_return`. For transparency, AI/hybrid responses additionally include `income_growth_return_estimate` (dividend yield plus sustainable-growth proxy); it is diagnostic only and is not optimized as a return forecast.

The CAPM formula and the interpretation of beta as systematic risk are documented by [OpenStax](https://openstax.org/books/principles-finance/pages/15-3-the-capital-asset-pricing-model-capm). The portfolio approach follows Markowitz mean-variance selection; the original article is available from [The Journal of Finance](https://doi.org/10.1111/J.1540-6261.1952.TB01525.X). Dividend-plus-growth is kept separate because the Gordon model applies to an expected **dividend** growth stream and requires a stable-growth assumption; see [OpenStax's DDM discussion](https://openstax.org/books/principles-finance-2e/pages/11-2-dividend-discount-models-ddms).
