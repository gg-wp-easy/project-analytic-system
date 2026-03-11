Затянуть актуальный код сервера командой
Для windows: Remove-Item -Path "server-analytic-system\" -Force; git clone https://github.com/gg-wp-easy/server-analytic-system.git
Для linux: rmdir server-analytic-system && git clone https://github.com/gg-wp-easy/server-analytic-system.git

Для начала нужно собрать серверное приложение, для этого сначала выполнить команду
1. Под windows: npm run server:build:win
2. Под linux: npm run server:build:linux
Собираем dev сборку командой:
1. Под windows: npm run electron:dev:win
2. Под linux: npm run electron:dev:linux
Собираем prod сборку командой:
1. Под windows: npm run electron:build:win
2. Под linux: npm run electron:build:linux
