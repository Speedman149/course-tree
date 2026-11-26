/** Exact pre-paint script shared by development HTML, production HTML and the CSP checks. */
export const THEME_STORAGE_KEY='branchquest.theme';
export const THEME_BOOTSTRAP=String.raw`(function () {
  'use strict';
  var key = ${JSON.stringify(THEME_STORAGE_KEY)}, preference = null, system;
  var root = document.documentElement;
  function valid(value) { return value === 'light' || value === 'dark' ? value : null; }
  try { preference = valid(window.localStorage.getItem(key)); } catch (_) { /* Storage can be unavailable. */ }
  try { system = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) { /* Default to light. */ }
  function apply() {
    var theme = preference || (system && system.matches ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#171922' : '#7160d3');
  }
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target.closest('[data-theme-toggle]') : null;
    if (!target || target.disabled) return;
    preference = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem(key, preference); } catch (_) { /* Keep the choice for this visit. */ }
    apply();
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    preference = event.key === null ? null : valid(event.newValue);
    apply();
  });
  if (system) {
    var followSystem = function () { if (!preference) apply(); };
    if (system.addEventListener) system.addEventListener('change', followSystem);
    else if (system.addListener) system.addListener(followSystem);
  }
  apply();
})();`;
