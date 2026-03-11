Затянуть актуальный код сервера командой
Для windows: .\prepare.ps1
Для linux: bash prepare.sh

Для начала нужно собрать серверное приложение, для этого сначала выполнить команду
Собираем dev сборку командой:
1. Под windows: npm run electron:dev:win
2. Под linux: npm run electron:dev:linux
Собираем prod сборку командой:
1. Под windows: npm run electron:build:win
2. Под linux: npm run electron:build:linux
