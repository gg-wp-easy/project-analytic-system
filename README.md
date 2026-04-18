# Project Site Analytic System

Electron desktop application with two Python backends:

- `server-analytic-system`
- `server-news-analytic`

All orchestration is now done through Node.js scripts from `scripts/`. No `.sh` or `.ps1` entrypoints are required.

## Main Commands

### Frontend

- `npm run dev` - start Vite in browser mode
- `npm run build` - build the frontend

### Server Repository Sync

- `npm run servers:prepare` - fetch/pull both server repositories
- `npm run analytics-server:prepare` - sync only `server-analytic-system`
- `npm run news-server:prepare` - sync only `server-news-analytic`

To replace a local server checkout from scratch:

- `node scripts/prepare.cjs --reclone`
- `node scripts/prepare.cjs analytics --reclone`
- `node scripts/prepare.cjs news --reclone`

### Python Backends

- `npm run servers:install` - install Python dependencies for both backends
- `npm run servers:build` - build both backends with PyInstaller
- `npm run analytics-server:install` - install dependencies only for `server-analytic-system`
- `npm run analytics-server:build` - build only `server-analytic-system`
- `npm run analytics-server:dev` - run only `server-analytic-system` in dev mode
- `npm run news-server:install` - install dependencies only for `server-news-analytic`
- `npm run news-server:build` - build only `server-news-analytic`
- `npm run news-server:dev` - run only `server-news-analytic` in dev mode

### Electron

- `npm run electron:dev` - start Electron in dev mode
- `npm run electron:build` - build Electron for the current OS
- `npm run electron:build:win` - build Windows artifacts
- `npm run electron:build:win:msi` - build Windows MSI profile
- `npm run electron:build:win:store` - build Windows Store profile
- `npm run electron:build:linux` - build Linux artifacts
- `npm run electron:build:mac` - build macOS artifacts

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
