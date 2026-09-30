// google.script.run replacement for the hospital server: the unmodified GAS
// frontend (src/JavaScript.html) keeps calling
//   google.script.run.withSuccessHandler(fn).withFailureHandler(fn).name(args...)
// and each call becomes POST /api/rpc/<name> { args: [...] }.
(function () {
  var SESSION_KEY = "iron_zero_session";
  var reloading = false;

  function hadStoredSession() {
    try { return !!localStorage.getItem(SESSION_KEY); } catch (e) { return false; }
  }

  function dropStoredSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked */ }
  }

  function call(name, args, onSuccess, onFailure) {
    fetch("/api/rpc/" + encodeURIComponent(name), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      body: JSON.stringify({ args: args })
    })
      .then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (body) {
          if (resp.status === 401 && hadStoredSession() && !reloading) {
            // Server session expired but the page still shows a cached login.
            reloading = true;
            dropStoredSession();
            window.location.reload();
          }
          if (!resp.ok) throw new Error(body.error || ("HTTP " + resp.status));
          return body.result;
        });
      })
      .then(function (result) { if (onSuccess) onSuccess(result); })
      .catch(function (err) {
        if (onFailure) onFailure(err);
        else console.error("[rpc " + name + "]", err);
      });
  }

  function runner(onSuccess, onFailure) {
    return new Proxy({}, {
      get: function (_target, prop) {
        if (prop === "withSuccessHandler") return function (fn) { return runner(fn, onFailure); };
        if (prop === "withFailureHandler") return function (fn) { return runner(onSuccess, fn); };
        if (prop === "withUserObject") return function () { return runner(onSuccess, onFailure); };
        if (typeof prop !== "string") return undefined;
        return function () { call(prop, Array.prototype.slice.call(arguments), onSuccess, onFailure); };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: runner(null, null) };

  // Called by window.logout() to clear the server-side session cookie.
  window.serverLogout = function () {
    return fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(function () {});
  };
})();
