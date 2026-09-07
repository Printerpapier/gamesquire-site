// Extracted from an inline <script> so gamesquire.app can have a CSP at all.
// Scripts in files are allowed by 'self'; inline ones would need a hash that
// breaks on every edit, or 'unsafe-inline', which defeats the point.
(function () {
    var STORAGE_KEY = 'gamesquire-theme';
    var root = document.documentElement;
    var toggle = document.getElementById('theme-toggle');

    function systemPrefersDark() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function effectiveTheme() {
      var stored = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        /* localStorage unavailable (e.g. private browsing) — fall back to system */
      }
      if (stored === 'light' || stored === 'dark') return stored;
      return systemPrefersDark() ? 'dark' : 'light';
    }
    function applyTheme(theme, persist) {
      root.setAttribute('data-theme', theme);
      if (persist) {
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
          /* ignore */
        }
      }
      if (toggle) {
        toggle.textContent = theme === 'dark' ? '🌙' : '☀️';
        toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      }
    }

    applyTheme(effectiveTheme(), false);
    if (toggle) {
      toggle.addEventListener('click', function () {
        applyTheme(effectiveTheme() === 'dark' ? 'light' : 'dark', true);
      });
    }
  })();
