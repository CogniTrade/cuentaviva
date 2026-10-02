/*
 * Cuenta Viva — configuración del sitio. ÚNICO lugar para editar enlaces.
 *
 * Reglas:
 *  - Deja un campo en "" si todavía no existe. El sitio nunca muestra un enlace vacío o roto:
 *    sin CHECKOUT_URL, los botones de compra muestran "Lanzamiento muy pronto".
 *  - Solo se aceptan URLs que empiecen por https:// (o rutas relativas en LITE_DOWNLOAD_URL).
 *  - Si pones un enlace de afiliado, aparece automáticamente la sección de divulgación.
 */
window.CUENTA_VIVA_CONFIG = {
  // Link de pago de Hotmart (único procesador). Ej.: "https://pay.hotmart.com/…"
  CHECKOUT_URL: "",

  // Segundo checkout opcional. Sin uso: todo el cobro va por Hotmart.
  CHECKOUT_URL_LATAM: "",

  // Versión LITE gratuita de la hoja (archivo dentro de site/descargas/).
  LITE_DOWNLOAD_URL: "descargas/Calculadora_Cuenta_Viva_LITE.xlsx",

  // Lista de espera externa (p. ej. un formulario de un proveedor de email). Opcional.
  WAITLIST_URL: "",

  // Precios mostrados en la web (USD).
  PRECIO_LANZAMIENTO: 15.55,
  PRECIO_NORMAL: 19,

  // Enlaces de afiliado. Vacíos = no se muestran y no aparece la sección de divulgación.
  AFFILIATES: {
    FTMO: { nombre: "FTMO", url: "" },
    FundedNext: { nombre: "FundedNext", url: "" }
  }
};
