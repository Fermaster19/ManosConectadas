// donation-email.js — confirmación por email al donante vía EmailJS
// Configurar en supabase-config.js:
//   window.EMAILJS_SERVICE_ID   → ID del servicio (ej: "service_abc123")
//   window.EMAILJS_TEMPLATE_ID  → ID del template (ej: "template_xyz789")
//   window.EMAILJS_PUBLIC_KEY   → Clave pública (ej: "aBcDeFgHiJkLmN")
//
// Variables disponibles en el template de EmailJS:
//   {{to_name}}        Nombre completo del donante
//   {{to_email}}       Email del donante (campo "To email" del template)
//   {{tracking_code}}  Código de seguimiento (ej: MC-2026-12345)
//   {{items_count}}    Cantidad de ítems donados
//   {{items_list}}     Lista de ítems con detalle
//   {{modalidad}}      Modalidad de entrega
//   {{direccion}}      Dirección (si eligió retiro a domicilio)
//   {{telefono}}       Teléfono del donante

(function () {
  "use strict";

  function isConfigured() {
    return !!(
      window.EMAILJS_SERVICE_ID &&
      window.EMAILJS_TEMPLATE_ID &&
      window.EMAILJS_PUBLIC_KEY &&
      !String(window.EMAILJS_SERVICE_ID).includes("TU-")
    );
  }

  function buildItemsList(items) {
    if (!items || !items.length) return "Sin ítems registrados.";
    return items
      .map(function (item, i) {
        var line = (i + 1) + ". " + (item.objeto || "Sin nombre") +
          " — " + (item.categoria || "Sin categoría") +
          ", " + (item.estado || "Sin estado");
        if (item.cantidad) line += ", " + item.cantidad;
        if (item.fecha_vencimiento) line += " (vence: " + item.fecha_vencimiento + ")";
        return line;
      })
      .join("\n");
  }

  async function sendDonationConfirmation(params) {
    var donor = params.donor || {};
    var donation = params.donation || {};
    var coordination = params.coordination || {};
    var code = params.code || "";

    if (!isConfigured()) {
      return { ok: false, error: "EmailJS no configurado." };
    }
    if (!window.emailjs) {
      return { ok: false, error: "SDK de EmailJS no disponible." };
    }

    var items = Array.isArray(donation.items) ? donation.items : [];
    var modalidadMap = { retiro: "Retiro a domicilio", llevar: "Lo lleva al Municipio" };
    var modalidad = modalidadMap[coordination.modalidad] || "No informada";

    var templateParams = {
      to_name: ((donor.nombre || "") + " " + (donor.apellido || "")).trim() || "Donante",
      to_email: donor.email || "",
      tracking_code: code,
      items_count: String(items.length),
      items_list: buildItemsList(items),
      modalidad: modalidad,
      direccion: coordination.direccion || "",
      telefono: donor.telefono || ""
    };

    try {
      await window.emailjs.send(
        window.EMAILJS_SERVICE_ID,
        window.EMAILJS_TEMPLATE_ID,
        templateParams,
        window.EMAILJS_PUBLIC_KEY
      );
      return { ok: true };
    } catch (err) {
      var msg = (err && (err.text || err.message)) || "Error al enviar el email.";
      return { ok: false, error: msg };
    }
  }

  window.DonationEmail = {
    isConfigured: isConfigured,
    sendDonationConfirmation: sendDonationConfirmation
  };
})();
