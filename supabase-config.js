// Reemplaza estos valores con los de tu proyecto Supabase.
window.SUPABASE_URL = "https://cugheirevqrvayadkocr.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_uCJ6WsRvlCgP_db74QTFsQ_csnbLdk5";
window.SUPABASE_WARMUP = (async () => {
	if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return false;
	try {
		const response = await fetch(`${window.SUPABASE_URL}/rest/v1/donations?select=id&limit=1`, {
			headers: {
				apikey: window.SUPABASE_ANON_KEY,
				Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
			}
		});
		return response.ok;
	} catch (error) {
		console.warn("No se pudo anticipar la conexión con Supabase.", error);
		return false;
	}
})();

// EmailJS — para enviar confirmación al donante cuando completa la donación.
// Registrate gratis en https://www.emailjs.com (200 emails/mes gratuitos).
// Pasos:
//   1. Creá un "Service" conectado a tu cuenta de Gmail u otro proveedor.
//   2. Creá un "Template" y usá las variables indicadas en donation-email.js.
//   3. Copiá los IDs en los valores de abajo (reemplazando los "TU-...").
window.EMAILJS_SERVICE_ID  = "service_nsev569";   // Ej: "service_abc123"
window.EMAILJS_TEMPLATE_ID = "template_zyalyo7";  // Ej: "template_xyz789"
window.EMAILJS_PUBLIC_KEY  = "wXuCSajfUc4jYxxMm";   // Ej: "aBcDeFgHiJkLmNoPqR"
