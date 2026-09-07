// Extracted from an inline <script> so gamesquire.app can have a CSP at all.
// Scripts in files are allowed by 'self'; inline ones would need a hash that
// breaks on every edit, or 'unsafe-inline', which defeats the point.
function handleWaitlistSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var toast = document.getElementById('waitlist-toast');
    fetch('https://formspree.io/f/mwlkejeb', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('submit failed');
        toast.textContent = "You're on the list, we'll email you at 1.0.";
        toast.classList.add('show');
        form.reset();
        if (window.posthog) posthog.capture('waitlist_signup');
      })
      .catch(function () {
        toast.textContent = 'Could not submit right now, please try again.';
        toast.classList.add('show');
      });
  }

// Was an inline onsubmit="handleWaitlistSubmit(event)" attribute on the form.
// Inline handlers are blocked by CSP just like inline <script>, so the form is
// wired up here instead. This file is deferred, so the DOM is already parsed.
document.querySelectorAll('form[name="waitlist"]').forEach(function (form) {
  form.addEventListener('submit', handleWaitlistSubmit);
});
