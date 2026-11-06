#!/bin/sh
# Запуск проверок логики: sh tests/run.sh   (нужен jsc — он есть в macOS вместе с Safari)
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
$JSC tests/shim.js js/util.js js/seed.js js/legacy.js js/store.js js/domain.js tests/domain.test.js
