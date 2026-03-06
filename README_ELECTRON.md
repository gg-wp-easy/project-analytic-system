Затянуть актуальный код сервера командой
Для windows: Remove-Item -Path "server-analytic-system\" -Force; git clone https://github.com/gg-wp-easy/server-analytic-system.git

Для начала нужно собрать серверное приложение, для этого сначала выполнить команду
1. Под windows: npm run server:build:win

Собираем dev сборку командой:
npm run electron:dev
Собираем prod сборку командой:
npm run electron:build
