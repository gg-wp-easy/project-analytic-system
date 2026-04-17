Electron and Python backends are now built only through Node.js scripts.

Main commands:

- `npm run servers:install` - install Python dependencies for both backends
- `npm run servers:build` - build both Python backends with PyInstaller
- `npm run analytics-server:build` - build only `server-analytic-system`
- `npm run news-server:build` - build only `server-news-analytic`
- `npm run electron:dev` - start Electron dev mode
- `npm run electron:build` - build Electron for the current OS

Platform-specific Electron builds:

- `npm run electron:build:win`
- `npm run electron:build:linux`
- `npm run electron:build:mac`

Useful aliases:

- `npm run desktop:dev`
- `npm run desktop:prod`
- `npm run desktop:prod:win`
- `npm run desktop:prod:linux`
- `npm run desktop:prod:mac`

The JS orchestrators are:

- [scripts/servers.cjs](<c:/Users/nikit/InvestProject/project-site-analytic-system/scripts/servers.cjs>)
- [scripts/electron.cjs](<c:/Users/nikit/InvestProject/project-site-analytic-system/scripts/electron.cjs>)
