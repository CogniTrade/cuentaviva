/* Cuenta Viva — comportamiento compartido: botones de compra, descarga LITE y afiliados.
 * Lee window.CUENTA_VIVA_CONFIG (config.js). Si un enlace no está configurado o no es válido,
 * no se muestra: nunca se renderiza un enlace roto. */
(function () {
  'use strict';
  var cfg = window.CUENTA_VIVA_CONFIG || {};

  function isHttps(u) {
    return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u.trim());
  }
  function isRelative(u) {
    return typeof u === 'string' && /^[\w][\w\-./]*$/.test(u.trim()) && u.indexOf('..') === -1;
  }

  // Precios
  document.querySelectorAll('[data-price-launch]').forEach(function (el) {
    if (cfg.PRECIO_LANZAMIENTO) el.textContent = cfg.PRECIO_LANZAMIENTO;
  });
  document.querySelectorAll('[data-price-regular]').forEach(function (el) {
    if (cfg.PRECIO_NORMAL) el.textContent = cfg.PRECIO_NORMAL;
  });

  // Botones de compra. El HTML trae por defecto el estado "Lanzamiento muy pronto" (sirve sin JS).
  document.querySelectorAll('[data-buy-box]').forEach(function (box) {
    var main = box.querySelector('[data-buy]');
    var latam = box.querySelector('[data-buy-latam]');
    var wait = box.querySelector('[data-waitlist]');
    var soon = box.querySelector('[data-soon-note]');
    var after = box.querySelector('[data-buy-note]');

    if (isHttps(cfg.CHECKOUT_URL)) {
      var a = document.createElement('a');
      a.className = 'btn btn-primary';
      a.href = cfg.CHECKOUT_URL.trim();
      a.rel = 'noopener';
      a.innerHTML = 'Comprar el kit · USD ' + (cfg.PRECIO_LANZAMIENTO || 9) +
        '<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>';
      main.replaceWith(a);
      if (soon) soon.hidden = true;
      if (after) after.hidden = false;
      if (latam && isHttps(cfg.CHECKOUT_URL_LATAM)) {
        latam.href = cfg.CHECKOUT_URL_LATAM.trim();
        latam.hidden = false;
      }
    } else if (wait && isHttps(cfg.WAITLIST_URL)) {
      wait.href = cfg.WAITLIST_URL.trim();
      wait.hidden = false;
      if (soon) soon.textContent = 'Todavía no está a la venta. Déjanos tu correo en la lista de espera y te avisamos el día del lanzamiento, con el precio de USD ' + (cfg.PRECIO_LANZAMIENTO || 9) + '.';
    }
  });

  // Descarga LITE: solo si hay ruta válida. En http(s) se comprueba que el archivo exista.
  var lite = cfg.LITE_DOWNLOAD_URL;
  var liteBoxes = document.querySelectorAll('[data-lite]');
  if (liteBoxes.length && (isRelative(lite) || isHttps(lite))) {
    var show = function () {
      liteBoxes.forEach(function (box) {
        var link = box.querySelector('[data-lite-link]');
        link.href = lite.trim();
        link.setAttribute('download', '');
        box.hidden = false;
      });
    };
    if (/^https?:$/.test(location.protocol) && window.fetch) {
      fetch(lite, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        if (r.ok) show();
      }).catch(function () { /* sin archivo: no se muestra */ });
    } else {
      show();
    }
  }

  // Afiliados: la sección y su divulgación solo aparecen si hay al menos un enlace válido.
  var afBox = document.querySelector('[data-affiliates]');
  if (afBox && cfg.AFFILIATES) {
    var list = afBox.querySelector('[data-affiliate-list]');
    var n = 0;
    Object.keys(cfg.AFFILIATES).forEach(function (k) {
      var it = cfg.AFFILIATES[k] || {};
      if (!isHttps(it.url)) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'btn btn-ghost';
      a.href = it.url.trim();
      a.rel = 'sponsored noopener';
      a.target = '_blank';
      a.textContent = (it.nombre || k) + ' (enlace de afiliado)';
      li.appendChild(a);
      list.appendChild(li);
      n++;
    });
    if (n) afBox.hidden = false;
  }
})();
