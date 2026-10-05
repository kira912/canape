// Runs before the app bundle (an external file, not inline: the CSP allows scripts from this origin only).

// The static landing in index.html is for crawlers without JavaScript: hide it at once.
document.documentElement.classList.add("js");

// Service workers only run in a secure context (https or localhost).
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  });
}
