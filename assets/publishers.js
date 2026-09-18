// gamesquire.app/publishers: section buttons preselect the request type; the form posts to the publisher-request
// Supabase Edge Function, which logs the request and emails support@squirebuilds.com.
(function () {
  var ENDPOINT = 'https://kmuvpaphebpkiueiumzw.supabase.co/functions/v1/publisher-request';
  var form = document.getElementById('publisher-form');
  if (!form) return;
  var type = document.getElementById('pf-type');
  var status = document.getElementById('pf-status');
  var submit = document.getElementById('pf-submit');

  document.querySelectorAll('a[data-type]').forEach(function (a) {
    a.addEventListener('click', function () {
      type.value = a.getAttribute('data-type');
      setTimeout(function () { document.getElementById('pf-publisher').focus(); }, 300);
    });
  });

  function show(text, kind) {
    status.textContent = text;
    status.className = 'pf-status ' + (kind || '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v); });
    if (!data.publisher.trim()) { show('Enter the publisher name.', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) { show('Enter a valid email address.', 'err'); return; }
    submit.disabled = true;
    show('Sending…');
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          form.reset();
          show('Thank you. Your request is in and we will reply by email, usually within two working days.', 'ok');
        } else {
          show(res.j.error || 'Something went wrong. Please email support@squirebuilds.com.', 'err');
        }
      })
      .catch(function () { show('Could not send. Please email support@squirebuilds.com.', 'err'); })
      .then(function () { submit.disabled = false; });
  });
})();
