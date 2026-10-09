/* Shared behaviour for explore.html and reference.html: theme (shared with index.html), nav state, scroll progress, reveal, section index. */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");
  var body = document.body, KEY = "ensuretech-theme";
  function setTheme(light) { body.classList.toggle("light", light); var b = document.getElementById("theme"); if (b) { b.textContent = light ? "☀ Light" : "☾ Dark"; b.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode"); } try { localStorage.setItem(KEY, light ? "light" : "dark"); } catch (e) {} }
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  setTheme(saved === "light");
  var tb = document.getElementById("theme"); if (tb) tb.addEventListener("click", function () { setTheme(!body.classList.contains("light")); });
  var nav = document.querySelector("nav.top"), bar = document.querySelector(".scroll-progress");
  function onScroll() { if (nav) nav.classList.toggle("scrolled", scrollY > 30); if (bar) { var max = document.documentElement.scrollHeight - innerHeight; bar.style.width = (max > 0 ? scrollY / max * 100 : 0) + "%"; } }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
    var links = document.querySelectorAll(".toc a"), map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (l) { l.classList.remove("on"); }); var a = map[e.target.id]; if (a) a.classList.add("on"); } }); }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  } else document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
})();
