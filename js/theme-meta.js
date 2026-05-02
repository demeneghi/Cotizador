(function () {
    'use strict';
    var cfg = window.__APP_CONFIG__;
    if (!cfg || !cfg.theme) return;
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc && cfg.theme.colorPrimary) {
        mc.setAttribute('content', cfg.theme.colorPrimary);
    }
})();
