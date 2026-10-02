/* Cuenta Viva — interfaz de la calculadora. La matemática vive en calc.js. */
(function () {
  'use strict';
  var CV = window.CuentaViva;
  var form = document.getElementById('calc-form');
  if (!CV || !form) return;

  var STORE_KEY = 'cuentaviva.calc.v1';
  var $ = function (id) { return document.getElementById(id); };

  var TEXT_FIELDS = ['b0', 'eq', 'ref', 'ddDiario', 'ddMax', 'pico', 'objetivo', 'riesgo', 'sl', 'vpp'];
  var MONEY = { b0: 1, eq: 1, ref: 1, pico: 1 };

  var DEFAULTS = {
    firma: 'ftmo2', fase: 'f1', b0: '100,000', eq: '100,000', ref: '100,000',
    ddDiario: '5', baseDiaria: 'inicial', ddMax: '10', tipo: 'estatica', pico: '100,000', lock: false,
    objetivo: '10', riesgoModo: 'pct', riesgo: '0.5', instrumento: 'EURUSD', sl: '20', vpp: '10'
  };

  // Claves cortas para el enlace compartible (#…). Sin datos personales: solo números de la cuenta.
  var SHORT = {
    firma: 'f', fase: 'fa', baseDiaria: 'bd', b0: 'b', eq: 'e', ref: 'r', ddDiario: 'dd', ddMax: 'dm', tipo: 't',
    pico: 'p', lock: 'l', objetivo: 'o', riesgoModo: 'rm', riesgo: 'rv', instrumento: 'i', sl: 'sl', vpp: 'v'
  };

  /* ---------- Formato ---------- */
  var nf0 = new Intl.NumberFormat('es-419', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('es-419', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function usd(x) {
    var neg = x < 0;
    var a = Math.abs(x);
    var cents = Math.abs(a - Math.round(a)) > 0.004;
    var s = (cents ? nf2 : nf0).format(cents ? a : Math.round(a));
    return (neg ? '−' : '') + 'US$ ' + s;
  }
  function plain(x) { return nf0.format(Math.round(x)); }
  function lots(x) { return nf2.format(x); }
  function pct(x) { return nf0.format(Math.round(x * 100)) + ' %'; }
  function stopsWord(n) { return n === 1 ? 'stop' : 'stops'; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  /* ---------- Estado del formulario ---------- */
  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function setRadio(name, value) {
    var el = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }
  function readRaw() {
    var s = {
      firma: $('firma').value, baseDiaria: $('baseDiaria').value, fase: radio('fase'), tipo: radio('tipo'), lock: $('lock').checked,
      riesgoModo: radio('riesgoModo'), instrumento: $('instrumento').value
    };
    TEXT_FIELDS.forEach(function (k) { s[k] = $(k).value; });
    return s;
  }
  function writeRaw(s) {
    s = Object.assign({}, DEFAULTS, s || {});
    if (!CV.FIRMAS[s.firma]) s.firma = DEFAULTS.firma;
    if (!CV.INSTRUMENTOS[s.instrumento]) s.instrumento = DEFAULTS.instrumento;
    $('firma').value = s.firma;
    $('baseDiaria').value = s.baseDiaria === 'referencia' ? 'referencia' : 'inicial';
    $('instrumento').value = s.instrumento;
    setRadio('fase', s.fase);
    setRadio('tipo', s.tipo === 'trailing' ? 'trailing' : 'estatica');
    setRadio('riesgoModo', s.riesgoModo === 'usd' ? 'usd' : 'pct');
    $('lock').checked = s.lock === true || s.lock === '1' || s.lock === 'true';
    TEXT_FIELDS.forEach(function (k) { $(k).value = s[k] == null ? '' : String(s[k]).slice(0, 24); });
  }
  function parsed(raw) {
    var p = {};
    TEXT_FIELDS.forEach(function (k) { p[k] = CV.parseNumero(raw[k], !!MONEY[k]); });
    return {
      b0: p.b0, eq: p.eq, ref: p.ref, ddDiario: p.ddDiario, baseDiaria: raw.baseDiaria, ddMax: p.ddMax,
      tipo: raw.tipo, pico: p.pico, bloquearEnB0: raw.lock, objetivo: p.objetivo,
      riesgoModo: raw.riesgoModo, riesgo: p.riesgo, sl: p.sl, vpp: p.vpp
    };
  }

  /* ---------- Presets ---------- */
  function applyFirm(id) {
    var f = CV.FIRMAS[id];
    if (!f) return;
    $('ddDiario').value = f.ddDiario;
    $('baseDiaria').value = f.baseDd;
    $('ddMax').value = f.ddMax;
    setRadio('tipo', f.tipo);
    applyPhase();
  }
  function applyPhase() {
    var f = CV.FIRMAS[$('firma').value];
    var fase = radio('fase');
    if (!f) return;
    $('objetivo').value = fase === 'f1' ? f.objF1 : fase === 'f2' ? f.objF2 : 0;
  }
  function applyInstrument(id, fillValue) {
    var ins = CV.INSTRUMENTOS[id];
    if (!ins) return;
    if (fillValue && ins.vpp != null) $('vpp').value = ins.vpp;
    var unit = ins.unidad;
    $('sl-unit').textContent = unit;
    $('vpp-unit').textContent = unit === 'pips' ? 'pip' : unit === 'puntos' ? 'punto' : '1.00 USD de precio';
    $('vpp-hint').textContent = (ins.aprox ? 'Aproximado. ' : '') + ins.nota + (ins.aprox ? '' : ' Depende del bróker.');
  }
  function updateHints() {
    var id = $('firma').value;
    var f = CV.FIRMAS[id] || CV.FIRMAS.custom;
    var refHint = id === 'custom'
      ? 'Ingresa ' + f.refTexto + '.'
      : 'En ' + f.corto + ' ingresa <strong>' + f.refTexto + '</strong>. Se reinicia a las ' + f.reset + '.';
    $('ref-hint').innerHTML = refHint;
    $('firma-hint').textContent = 'Valores de referencia oct-2026: verifica en la web oficial, las firmas cambian sus reglas.' +
      (f.diasTexto ? ' Días mínimos: ' + f.diasTexto + '.' : '');
    var sobreRef = $('baseDiaria').value === 'referencia';
    $('base-hint').textContent = sobreRef
      ? 'El % diario se aplica a la referencia del día, así que el límite cambia cada día. La máxima sigue siendo sobre el balance inicial.'
      : 'El % diario se aplica al tamaño de la cuenta: el límite es igual todos los días. La máxima también es sobre el balance inicial.';
    var trailing = radio('tipo') === 'trailing';
    $('trailing-box').hidden = !trailing;
    var usdMode = radio('riesgoModo') === 'usd';
    $('riesgo-unit').textContent = usdMode ? 'USD' : '%';
    $('riesgo-hint').textContent = usdMode ? 'Lo máximo que pierdes si toca el stop.' : 'Porcentaje del tamaño de la cuenta.';
  }

  /* ---------- Errores ---------- */
  function showErrors(raw, errores) {
    TEXT_FIELDS.forEach(function (k) {
      var input = $(k);
      var box = $('err-' + k);
      var msg = errores[k];
      // Texto que no se puede leer como número tiene prioridad.
      if (raw[k] !== '' && isNaN(CV.parseNumero(raw[k], !!MONEY[k]))) msg = 'No entiendo ese número. Usa solo cifras, por ejemplo 1500 o 0.5.';
      if (k === 'pico' && radio('tipo') !== 'trailing') msg = null;
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        box.innerHTML = '<svg class="icon" aria-hidden="true" style="width:16px;height:16px;margin-top:1px"><use href="#i-alert"/></svg><span></span>';
        box.lastChild.textContent = msg;
        box.hidden = false;
      } else {
        input.removeAttribute('aria-invalid');
        box.hidden = true;
        box.textContent = '';
      }
    });
  }

  /* ---------- Render ---------- */
  var TITLES = { verde: 'Puedes operar', ambar: 'Reduce riesgo', rojo: 'Detente hoy', nada: 'Faltan datos' };
  var lastLive = '';
  var liveTimer;

  function setSignal(estado, msgHTML) {
    var sig = $('signal');
    sig.setAttribute('data-estado', estado);
    sig.querySelectorAll('.lamp span').forEach(function (l) {
      l.classList.toggle('on', l.classList.contains('l-' + estado));
    });
    $('sig-title').textContent = TITLES[estado];
    $('sig-msg').innerHTML = msgHTML;
    var dock = $('dock');
    dock.setAttribute('data-estado', estado);
    $('dock-title').textContent = TITLES[estado];
  }

  function setGauge(el, colchon, limite, piso, r, closer) {
    var track = el.querySelector('[data-track]');
    var p = limite > 0 ? clamp01(colchon / limite) : 0;
    var r1 = limite > 0 ? clamp01(r / limite) : 0;
    var r3 = limite > 0 ? clamp01(3 * r / limite) : 0;
    track.style.setProperty('--pct', (p * 100).toFixed(2) + '%');
    track.style.setProperty('--r1', (r1 * 100).toFixed(2) + '%');
    track.style.setProperty('--r3', (r3 * 100).toFixed(2) + '%');
    var nTicks = r > 0 ? limite / r : Infinity;
    var ticks = track.querySelector('.ticks');
    if (nTicks <= 50 && nTicks >= 1) {
      ticks.classList.remove('off');
      track.style.setProperty('--tick', (r / limite * 100).toFixed(4) + '%');
    } else {
      ticks.classList.add('off');
    }
    var n = CV.floorInt(colchon / r);
    el.querySelector('[data-val]').innerHTML = usd(colchon) + ' <span>· ' + n + ' ' + stopsWord(n) + '</span>';
    el.querySelector('[data-floor]').textContent = 'Piso: ' + usd(piso);
    el.querySelector('[data-of]').textContent = colchon > limite
      ? 'Por encima del límite completo (' + plain(limite) + ')'
      : 'Queda ' + pct(Math.max(0, p)) + ' de ' + plain(limite);
    el.querySelector('[data-closer]').hidden = !closer;
    track.setAttribute('aria-label', el.querySelector('.gauge-name').firstChild.textContent.trim() + ': ' + usd(colchon) + ', ' + n + ' ' + stopsWord(n) + ' de riesgo antes del piso de ' + usd(piso));
  }

  function render() {
    var raw = readRaw();
    updateHints();
    var input = parsed(raw);
    var res = CV.calcular(input);
    showErrors(raw, res.errores || {});

    if (!res.valido) {
      setSignal('nada', 'Revisa los campos marcados para ver el resultado.');
      ['o-lote', 'o-lotemax', 'o-stops', 'o-obj'].forEach(function (id) { $(id).textContent = '–'; });
      $('o-lote-sub').textContent = '';
      $('o-alert').hidden = true;
      $('dock-sub').textContent = 'Faltan datos';
      ['g-diario', 'g-max'].forEach(function (id) {
        var g = $(id);
        g.querySelector('[data-val]').textContent = '–';
        g.querySelector('[data-floor]').textContent = '';
        g.querySelector('[data-of]').textContent = '';
        g.querySelector('[data-closer]').hidden = true;
        g.querySelector('[data-track]').style.setProperty('--pct', '0%');
      });
      $('o-obj-bar').style.width = '0';
      $('o-obj-note').textContent = '';
      announce('Faltan datos. Revisa los campos marcados.');
      return;
    }

    // Aviso suave si la equity está muy lejos del tamaño de la cuenta (típico error de tipeo).
    var lejos = input.eq > input.b0 * 1.5 || input.eq < input.b0 * 0.5;
    $('eq-hint').innerHTML = lejos ? '<strong>¿Seguro?</strong> Está muy lejos del tamaño de la cuenta.' : 'Balance + flotante.';
    var r = res.riesgoUSD;
    var cerca = res.limiteCercano === 'maximo' ? 'máximo' : 'diario';
    var cercaTxt = res.limiteCercano === 'empate' ? 'los dos límites (están a la misma distancia)' : 'el límite ' + cerca;
    var antesDe = res.limiteCercano === 'empate' ? 'antes de los dos límites' : 'antes del límite ' + cerca;
    var msg;
    if (res.violada) {
      var pisoV = res.limiteCercano === 'maximo' ? res.pisoMax : res.pisoDiario;
      msg = 'Tu equity está en o por debajo del piso ' + cerca + ' (<strong>' + usd(pisoV) + '</strong>). Con estos datos la regla ya se rompió: revisa el panel de tu firma.';
    } else if (res.estado === 'rojo') {
      msg = 'Tu colchón (<strong>' + usd(res.colchon) + '</strong>) es menor que un stop de ' + usd(r) + '. Si esta operación sale mal, rompes ' + cercaTxt + '.' +
        (res.limiteCercano === 'diario' ? ' Mañana el límite diario se reinicia.' : '');
    } else if (res.estado === 'ambar') {
      msg = 'Te quedan <strong>' + res.stopsRestantes + ' ' + stopsWord(res.stopsRestantes) + '</strong> de ' + usd(r) + ' ' + antesDe + '. ' +
        (res.limiteCercano === 'diario' ? 'Baja el riesgo o espera al reinicio del día.' : 'Baja el riesgo: el límite máximo no se reinicia.');
    } else {
      msg = 'Tu colchón de <strong>' + usd(res.colchon) + '</strong> aguanta <strong>' + res.stopsRestantes + ' stops</strong> de ' + usd(r) + ' ' + antesDe + '.';
    }
    setSignal(res.estado, msg);

    // Lote
    var ins = CV.INSTRUMENTOS[raw.instrumento];
    var unidad = ins ? ins.unidad : 'puntos';
    $('o-lote').innerHTML = lots(res.loteSugerido) + '<small>lotes</small>';
    $('o-lote-sub').textContent = res.loteSugerido > 0
      ? 'Pierdes ' + usd(res.riesgoRealLote) + ' si toca el stop de ' + input.sl + ' ' + unidad + ' (riesgo elegido: ' + usd(r) + ').'
      : '';
    var alert = $('o-alert');
    alert.classList.remove('is-amber');
    if (res.loteSugerido <= 0) {
      alert.hidden = false;
      alert.classList.add('is-amber');
      $('o-alert-text').textContent = 'Con ese stop no cabe ni 0.01 lotes dentro de ' + usd(r) + '. Sube el riesgo o acorta el stop.';
    } else if (res.loteSugerido > res.loteMaxSeguro) {
      alert.hidden = false;
      $('o-alert-text').textContent = res.violada
        ? 'La cuenta ya está por debajo del piso según estos datos. No abras operaciones.'
        : 'Con el lote sugerido, un stop completo (' + usd(res.riesgoRealLote) + ') supera tu colchón. Como máximo ' + lots(res.loteMaxSeguro) + ' lotes.';
    } else {
      alert.hidden = true;
    }
    $('o-lotemax').innerHTML = lots(res.loteMaxSeguro) + '<small>lotes</small>';
    $('o-stops').textContent = String(res.stopsRestantes);
    $('o-stops-note').textContent = 'De ' + usd(r) + ' antes del límite ' + (res.limiteCercano === 'maximo' ? 'máximo' : 'diario') + '.';

    // Medidores
    setGauge($('g-diario'), res.colchonDiario, res.limiteDiarioUSD, res.pisoDiario, r, res.limiteCercano !== 'maximo');
    setGauge($('g-max'), res.colchonMax, res.limiteMaxUSD, res.pisoMax, r, res.limiteCercano !== 'diario');

    // Objetivo
    if (res.progresoObj == null) {
      $('o-obj').textContent = 'Sin objetivo';
      $('o-obj-bar').style.width = '0';
      $('o-obj-note').textContent = 'Cuenta fondeada: aquí solo importa no tocar los pisos.';
    } else {
      $('o-obj').textContent = pct(res.progresoObj);
      $('o-obj-bar').style.width = (clamp01(res.progresoObj) * 100).toFixed(1) + '%';
      $('o-obj-note').textContent = res.faltaObj > 0
        ? 'Faltan ' + usd(res.faltaObj) + ' para el ' + nf0.format(input.objetivo) + ' % (' + usd(res.metaUSD) + ').'
        : 'Objetivo alcanzado. Revisa si tu firma pide días mínimos antes de pasar.';
    }

    $('dock-sub').textContent = 'Lote ' + lots(res.loteSugerido) + ' · ' + res.stopsRestantes + ' ' + stopsWord(res.stopsRestantes);
    announce(TITLES[res.estado] + '. Lote sugerido ' + lots(res.loteSugerido) + '. Stops restantes ' + res.stopsRestantes + '.');
  }

  function announce(text) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      if (text !== lastLive) { $('sr-live').textContent = text; lastLive = text; }
    }, 900);
  }

  /* ---------- Persistencia ---------- */
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(readRaw())); } catch (e) { /* sin almacenamiento */ }
    }, 250);
  }
  function load() {
    try {
      var v = localStorage.getItem(STORE_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function fromHash() {
    var h = location.hash.replace(/^#/, '');
    if (!/(^|&)b=/.test(h)) return null;
    var q;
    try { q = new URLSearchParams(h); } catch (e) { return null; }
    var s = {};
    Object.keys(SHORT).forEach(function (k) {
      var v = q.get(SHORT[k]);
      if (v != null) s[k] = k === 'lock' ? v === '1' : v;
    });
    return s;
  }
  function toHash(raw) {
    var q = new URLSearchParams();
    Object.keys(SHORT).forEach(function (k) {
      var v = raw[k];
      if (k === 'lock') v = v ? '1' : '0';
      if (v !== '' && v != null) q.set(SHORT[k], v);
    });
    return q.toString();
  }

  /* ---------- Eventos ---------- */
  var prevB0 = NaN;
  form.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'b0') {
      var nb = CV.parseNumero(t.value, true);
      if (isFinite(nb) && nb > 0) {
        ['eq', 'ref', 'pico'].forEach(function (k) {
          var cur = CV.parseNumero($(k).value, true);
          if ($(k).value === '' || (isFinite(prevB0) && cur === prevB0)) $(k).value = t.value;
        });
        prevB0 = nb;
      }
    }
    render();
    save();
  });
  form.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'firma') applyFirm(t.value);
    else if (t.name === 'fase') applyPhase();
    else if (t.id === 'instrumento') applyInstrument(t.value, true);
    else if (t.name === 'riesgoModo') {
      // Convierte el valor para que el riesgo no salte al cambiar de unidad.
      var b0 = CV.parseNumero($('b0').value, true);
      var v = CV.parseNumero($('riesgo').value);
      if (isFinite(b0) && b0 > 0 && isFinite(v) && v > 0) {
        $('riesgo').value = t.value === 'usd' ? String(Math.round(v / 100 * b0 * 100) / 100) : String(Math.round(v / b0 * 100 * 1000) / 1000);
      }
    }
    render();
    save();
  });
  // Al salir de un campo de dinero, muestra separadores de miles (100000 → 100,000).
  form.addEventListener('focusout', function (ev) {
    var t = ev.target;
    if (!t.hasAttribute || !t.hasAttribute('data-money')) return;
    var v = CV.parseNumero(t.value, true);
    if (isFinite(v) && v > 0) {
      var f = new Intl.NumberFormat('es-419', { maximumFractionDigits: 2 }).format(v);
      if (f !== t.value) { t.value = f; save(); }
    }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  var toastTimer;
  function toast(msg) {
    $('toast').textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').textContent = ''; }, 3500);
  }

  $('btn-share').addEventListener('click', function () {
    var url = location.href.split('#')[0] + '#' + toHash(readRaw());
    var done = function () { toast('Enlace copiado. Solo lleva los números de la calculadora.'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url) ? done() : toast('No pude copiar. Copia la dirección del navegador.'); });
    } else if (fallbackCopy(url)) {
      done();
    } else {
      toast('No pude copiar. Copia la dirección del navegador.');
    }
  });
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  $('btn-reset').addEventListener('click', function () {
    writeRaw(DEFAULTS);
    applyInstrument(DEFAULTS.instrumento, false);
    prevB0 = CV.parseNumero(DEFAULTS.b0, true);
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nada */ }
    render();
    toast('Valores de ejemplo restablecidos.');
  });

  /* ---------- Barra flotante (móvil) ---------- */
  function setupDock() {
    var dock = $('dock');
    if (!('IntersectionObserver' in window)) return;
    var formVisible = false;
    var signalVisible = true;
    var update = function () { dock.classList.toggle('show', formVisible && !signalVisible); };
    new IntersectionObserver(function (es) { formVisible = es[0].isIntersecting; update(); }, { rootMargin: '0px 0px -40% 0px' }).observe(form);
    new IntersectionObserver(function (es) { signalVisible = es[0].isIntersecting; update(); }).observe($('signal'));
  }

  /* ---------- Inicio ---------- */
  var initial = fromHash();
  var fromLink = !!initial;
  if (!initial) initial = load();
  writeRaw(initial || DEFAULTS);
  applyInstrument($('instrumento').value, false);
  prevB0 = CV.parseNumero($('b0').value, true);
  render();
  if (fromLink) {
    save();
    try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* nada */ }
  }
  setupDock();
})();
