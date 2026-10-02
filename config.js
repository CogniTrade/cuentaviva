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
  // Checkout principal (Polar.sh). Ej.: "https://polar.sh/…/checkout/…"
  CHECKOUT_URL: "",

  // Checkout alternativo LatAm (Hotmart). Opcional.
  CHECKOUT_URL_LATAM: "",

  // Versión LITE gratuita de la hoja (archivo dentro de site/descargas/).
  LITE_DOWNLOAD_URL: "descargas/Calculadora_Cuenta_Viva_LITE.xlsx",

  // Lista de espera externa (p. ej. un formulario de un proveedor de email). Opcional.
  WAITLIST_URL: "",

  // Precios mostrados en la web (USD).
  PRECIO_LANZAMIENTO: 9,
  PRECIO_NORMAL: 15,

  // Enlaces de afiliado. Vacíos = no se muestran y no aparece la sección de divulgación.
  AFFILIATES: {
    FTMO: { nombre: "FTMO", url: "" },
    FundedNext: { nombre: "FundedNext", url: "" }
  }
};
