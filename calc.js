/*
 * Cuenta Viva — matemática de la calculadora.
 * Funciones puras, sin DOM. Misma lógica que la hoja de cálculo (ver SPEC.md).
 * Uso en navegador: window.CuentaViva. Uso en Node: require('./calc.js').
 *
 * Convenciones:
 *  - Los porcentajes se pasan como número "humano": 5 significa 5 %.
 *  - La pérdida máxima es % del balance inicial (b0). La pérdida diaria es % de b0
 *    (baseDiaria = 'inicial', p. ej. FTMO, FundedNext) o % de la referencia del día
 *    (baseDiaria = 'referencia', p. ej. The5ers High Stakes).
 *  - Dinero en USD.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CuentaViva = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Tolerancia para errores de coma flotante (p. ej. 0.29 * 100 = 28.999999999999996).
  var EPS = 1e-9;

  /** Redondea hacia abajo a múltiplos de `step` (por defecto 0.01). Nunca devuelve negativos. */
  function floorTo(x, step) {
    step = step || 0.01;
    if (!isFinite(x) || x <= 0) return 0;
    var q = x / step;
    var n = Math.floor(q + Math.max(EPS, Math.abs(q) * 1e-12));
    // Evita 2.5000000000000004 al multiplicar de vuelta.
    var decimals = Math.max(0, Math.round(-Math.log10(step)));
    return Number((n * step).toFixed(decimals));
  }

  /** Entero hacia abajo, tolerante a flotantes, nunca negativo. */
  function floorInt(x) {
    if (!isFinite(x) || x <= 0) return 0;
    return Math.floor(x + Math.max(EPS, Math.abs(x) * 1e-12));
  }

  /** Riesgo por operación en USD: en % del balance inicial o directo en USD. */
  function riesgoUSD(b0, modo, valor) {
    return modo === 'usd' ? valor : (valor / 100) * b0;
  }

  /** Semáforo según colchón y riesgo por operación (R$). */
  function semaforo(colchon, r) {
    // Tolerancia de una millonésima de dólar para que 1499.9999999 cuente como 1500.
    var t = 1e-6;
    if (colchon <= t || colchon + t < r) return 'rojo';
    if (colchon + t < 3 * r) return 'ambar';
    return 'verde';
  }

  function num(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** Valida la entrada. Devuelve un objeto { campo: mensaje }. Vacío = todo bien. */
  function validar(e) {
    var err = {};
    if (!num(e.b0) || e.b0 <= 0) err.b0 = 'Pon el tamaño de la cuenta (mayor que 0).';
    if (!num(e.eq) || e.eq < 0) err.eq = 'Pon tu equity actual.';
    if (!num(e.ref) || e.ref <= 0) err.ref = 'Pon el balance o equity con el que arrancó el día.';
    if (!num(e.ddDiario) || e.ddDiario <= 0 || e.ddDiario >= 100) err.ddDiario = 'Entre 0 y 100 %.';
    if (!num(e.ddMax) || e.ddMax <= 0 || e.ddMax >= 100) err.ddMax = 'Entre 0 y 100 %.';
    if (e.tipo === 'trailing' && (!num(e.pico) || e.pico <= 0)) err.pico = 'Pon el pico máximo que alcanzó la cuenta.';
    if (!num(e.objetivo) || e.objetivo < 0) err.objetivo = 'Pon 0 si no tienes objetivo.';
    if (!num(e.riesgo) || e.riesgo <= 0) err.riesgo = 'El riesgo debe ser mayor que 0.';
    if (!num(e.sl) || e.sl <= 0) err.sl = 'El stop debe ser mayor que 0.';
    if (!num(e.vpp) || e.vpp <= 0) err.vpp = 'El valor por punto debe ser mayor que 0.';
    return err;
  }

  /**
   * Cálculo principal.
   * @param {object} e
   *   b0, eq, ref, ddDiario (%), baseDiaria ('inicial'|'referencia'), ddMax (%), tipo ('estatica'|'trailing'),
   *   pico, bloquearEnB0 (bool), objetivo (%), riesgoModo ('pct'|'usd'),
   *   riesgo, sl, vpp
   */
  function calcular(e) {
    var errores = validar(e);
    if (Object.keys(errores).length) {
      return { valido: false, errores: errores };
    }

    var b0 = e.b0;
    var r = riesgoUSD(b0, e.riesgoModo, e.riesgo);
    // inicial: piso = REF − dd_d·B0 ; referencia: piso = REF·(1 − dd_d) = REF − dd_d·REF
    var limiteDiarioUSD = (e.ddDiario / 100) * (e.baseDiaria === 'referencia' ? e.ref : b0);
    var limiteMaxUSD = (e.ddMax / 100) * b0;

    var pisoDiario = e.ref - limiteDiarioUSD;
    var pisoMax;
    if (e.tipo === 'trailing') {
      pisoMax = e.pico - limiteMaxUSD;
      if (e.bloquearEnB0) pisoMax = Math.min(pisoMax, b0);
    } else {
      pisoMax = b0 * (1 - e.ddMax / 100);
    }

    var colchonDiario = e.eq - pisoDiario;
    var colchonMax = e.eq - pisoMax;
    var colchon = Math.min(colchonDiario, colchonMax);
    var violada = colchon <= 1e-6;

    var usdPorLote = e.sl * e.vpp; // pérdida en USD de un stop completo con 1 lote
    var loteSugerido = floorTo(r / usdPorLote, 0.01);
    var loteMaxSeguro = violada ? 0 : floorTo(colchon / usdPorLote, 0.01);
    var stopsRestantes = violada ? 0 : floorInt(colchon / r);

    var metaUSD = (e.objetivo / 100) * b0;
    var progresoObj = null;
    var faltaObj = null;
    if (metaUSD > 0) {
      progresoObj = Math.max(0, (e.eq - b0) / metaUSD);
      faltaObj = Math.max(0, metaUSD - (e.eq - b0));
    }

    var limiteCercano;
    if (Math.abs(colchonDiario - colchonMax) < 1e-6) limiteCercano = 'empate';
    else limiteCercano = colchonDiario < colchonMax ? 'diario' : 'maximo';

    return {
      valido: true,
      errores: {},
      riesgoUSD: r,
      limiteDiarioUSD: limiteDiarioUSD,
      limiteMaxUSD: limiteMaxUSD,
      pisoDiario: pisoDiario,
      pisoMax: pisoMax,
      colchonDiario: colchonDiario,
      colchonMax: colchonMax,
      colchon: colchon,
      violada: violada,
      usdPorLote: usdPorLote,
      loteSugerido: loteSugerido,
      riesgoRealLote: loteSugerido * usdPorLote,
      loteMaxSeguro: loteMaxSeguro,
      stopsRestantes: stopsRestantes,
      metaUSD: metaUSD,
      progresoObj: progresoObj,
      faltaObj: faltaObj,
      limiteCercano: limiteCercano,
      estado: semaforo(colchon, r)
    };
  }

  /**
   * Convierte texto escrito por la persona en número.
   * Acepta "1,5", "1.5", "100,000", "100.000" (en dinero), "$ 2.500,50", "US$ 1,200".
   * @param {string} s
   * @param {boolean} dinero si es true, "100.000" se lee como cien mil.
   */
  function parseNumero(s, dinero) {
    if (typeof s === 'number') return s;
    if (s == null) return NaN;
    var t = String(s).trim().replace(/^(us\$|usd|\$)/i, '').replace(/[\s$%]/g, '');
    if (t === '' || t === '-') return NaN;
    var neg = t.charAt(0) === '-';
    if (neg) t = t.slice(1);
    var hasDot = t.indexOf('.') !== -1;
    var hasComma = t.indexOf(',') !== -1;
    if (hasDot && hasComma) {
      // El último separador es el decimal.
      if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(/,/g, '');
    } else if (hasComma) {
      if (/^\d{1,3}(,\d{3})+$/.test(t) && (dinero || (t.match(/,/g) || []).length > 1)) t = t.replace(/,/g, '');
      else if ((t.match(/,/g) || []).length === 1) t = t.replace(',', '.');
      else return NaN;
    } else if (hasDot) {
      var groups = (t.match(/\./g) || []).length;
      if (/^\d{1,3}(\.\d{3})+$/.test(t) && (dinero || groups > 1)) t = t.replace(/\./g, '');
      else if (groups > 1) return NaN;
    }
    if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN;
    var n = parseFloat(t);
    return neg ? -n : n;
  }

  // Presets (referencia oct-2026, verificados contra webs oficiales el 2026-10-01). Ver SPEC.md.
  // baseDd: de qué se calcula el % de pérdida diaria. refTexto: qué debe ingresar la persona como REF.
  var FIRMAS = {
    ftmo2: {
      nombre: 'FTMO 2 fases', corto: 'FTMO', ddDiario: 5, baseDd: 'inicial', ddMax: 10, tipo: 'estatica',
      objF1: 10, objF2: 5, diasMin: 4, diasTexto: '4 días operados',
      refTexto: 'el balance al inicio del día',
      reset: '00:00 hora de Europa central (CE(S)T)'
    },
    fn_stellar2: {
      nombre: 'FundedNext Stellar 2 fases', corto: 'FundedNext', ddDiario: 5, baseDd: 'inicial', ddMax: 10, tipo: 'estatica',
      objF1: 8, objF2: 5, diasMin: 5, diasTexto: '5 días operados',
      refTexto: 'el balance al inicio del día (supuesto conservador: si tu equity era mayor, usa el mayor)',
      reset: '00:00 hora del servidor (GMT+2/+3)'
    },
    the5ers_hs: {
      nombre: 'The5ers High Stakes (New)', corto: 'The5ers', ddDiario: 5, baseDd: 'referencia', ddMax: 10, tipo: 'estatica',
      objF1: 10, objF2: 5, diasMin: 3, diasTexto: '3 días rentables (cada uno con al menos 0,5 % del balance inicial cerrado)',
      refTexto: 'el mayor entre balance y equity al cierre del día anterior',
      reset: '00:00 hora del servidor'
    },
    fundingpips2: {
      nombre: 'FundingPips 2 Step Standard', corto: 'FundingPips', ddDiario: 5, baseDd: 'referencia', ddMax: 10, tipo: 'estatica',
      objF1: 8, objF2: 5, diasMin: 3, diasTexto: '3 días operados por fase. Al comprar eliges pérdida diaria de 5 % o 3 %: si elegiste 3 %, cámbiala abajo',
      refTexto: 'el mayor entre balance y equity al inicio del día',
      reset: '00:00 hora de la plataforma (UTC+3)'
    },
    custom: {
      nombre: 'Personalizada', corto: 'tu firma', ddDiario: 5, baseDd: 'inicial', ddMax: 10, tipo: 'estatica',
      objF1: 10, objF2: 5, diasMin: 0, diasTexto: '',
      refTexto: 'la base que use tu firma (balance o equity al inicio del día)',
      reset: ''
    }
  };

  // USD por 1 punto/pip por 1 lote estándar. Depende del bróker.
  var INSTRUMENTOS = {
    EURUSD: { nombre: 'EURUSD', vpp: 10, unidad: 'pips', nota: 'Par con USD al final: 10 USD por pip por lote.' },
    GBPUSD: { nombre: 'GBPUSD', vpp: 10, unidad: 'pips', nota: 'Par con USD al final: 10 USD por pip por lote.' },
    AUDUSD: { nombre: 'AUDUSD', vpp: 10, unidad: 'pips', nota: 'Par con USD al final: 10 USD por pip por lote.' },
    NZDUSD: { nombre: 'NZDUSD', vpp: 10, unidad: 'pips', nota: 'Par con USD al final: 10 USD por pip por lote.' },
    USDJPY: { nombre: 'USDJPY', vpp: 6.5, unidad: 'pips', aprox: true, nota: 'Aproximado: cambia con el precio de USDJPY.' },
    XAUUSD: { nombre: 'XAUUSD (oro)', vpp: 100, unidad: 'USD de precio', nota: 'Contrato de 100 oz: 100 USD por cada 1.00 de movimiento.' },
    US30: { nombre: 'US30', vpp: 1, unidad: 'puntos', aprox: true, nota: 'Varía mucho por bróker (0.1 a 20). Revísalo en tu plataforma.' },
    NAS100: { nombre: 'NAS100', vpp: 1, unidad: 'puntos', aprox: true, nota: 'Varía mucho por bróker (0.1 a 20). Revísalo en tu plataforma.' },
    US500: { nombre: 'US500', vpp: 1, unidad: 'puntos', aprox: true, nota: 'Varía mucho por bróker (0.1 a 20). Revísalo en tu plataforma.' },
    custom: { nombre: 'Personalizado', vpp: null, unidad: 'puntos', nota: 'Pon el valor de 1 punto por 1 lote que muestra tu plataforma.' }
  };

  return {
    calcular: calcular,
    validar: validar,
    semaforo: semaforo,
    riesgoUSD: riesgoUSD,
    floorTo: floorTo,
    floorInt: floorInt,
    parseNumero: parseNumero,
    FIRMAS: FIRMAS,
    INSTRUMENTOS: INSTRUMENTOS
  };
});
