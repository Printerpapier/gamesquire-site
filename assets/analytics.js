// Extracted from an inline <script> so gamesquire.app can have a CSP at all.
// Scripts in files are allowed by 'self'; inline ones would need a hash that
// breaks on every edit, or 'unsafe-inline', which defeats the point.
!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="Oo Lo $o init rl nl tl el ll pa il hl Ko capture sl Ao gl calculateEventProperties pl register register_once register_for_session unregister unregister_for_session Xo ml getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync wl identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset kl shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty yl cl createPersonProfile setInternalOrTestUser bl Do No opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing dl debug ma kn getPageViewId captureTraceFeedback captureTraceMetric Go".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_mfD2teKjbBUVgLeGFnXqNF4cNJecNcyhpLp5b6iLtdji', {
  api_host: 'https://e.gamesquire.app',
  ui_host: 'https://eu.posthog.com',
  defaults: '2026-05-30',
  cookieless_mode: 'always',
  autocapture: false,
  enable_heatmaps: true,
  person_profiles: 'identified_only',
});

document.addEventListener('click', function (e) {
  var link = e.target.closest('a[href]');
  if (!link) return;
  if (/^https?:\/\/(www\.)?(weeksquire\.com|gamesquire\.app|beta\.gamesquire\.app|apps\.apple\.com|testflight\.apple\.com|play\.google\.com)/.test(link.href)) {
    posthog.capture('outbound_app_click', { href: link.href, link_text: link.textContent.trim() });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  var utmParams = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach(function (value, key) {
    if (key.indexOf('utm_') === 0) utmParams.append(key, value);
  });
  if (!utmParams.toString()) return;
  document.querySelectorAll('a[href^="https://beta.gamesquire.app"]').forEach(function (link) {
    var url = new URL(link.href);
    utmParams.forEach(function (value, key) { url.searchParams.set(key, value); });
    link.href = url.toString();
  });
});
