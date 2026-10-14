import { getGroqErrorMessage, requestGroqChat } from "../lib/groq-chat.js";

const SYSTEM_PROMPT = `Eres una IA de apoyo para asistentes sociales de Manos Conectadas.

Usa exclusivamente los datos de donaciones incluidos en el contexto. El resumen se calcula con todas las donaciones de la base de datos; los registros detallados pueden ser solo una selección relevante. No presentes esa selección como una lista completa ni deduzcas que un dato no existe solo porque no aparece en ella. Si el contexto no alcanza para contestar con precisión, dilo claramente. Responde en español, con tono claro, profesional y breve. Puedes contar, filtrar, comparar y resumir donaciones; también puedes sugerir prioridades, pero la decisión final siempre la toma la asistente social.

No inventes datos. Si el contexto no permite responder, dilo explícitamente. Los asistentes pueden solicitar los datos del donante para coordinar una entrega o retiro; muestra teléfono, correo y dirección solo cuando la consulta los pida o sean necesarios para esa coordinación. Nunca expongas contraseñas. Cuando listes donaciones, incluye su código y el dato relevante. Los estados de seguimiento pueden ser: Pendiente de coordinación, Para retirar, En bodega de la municipalidad, En tránsito y Entregada.`;

const DONATIONS_PAGE_SIZE = 1000;
const MAX_CONTEXT_RECORDS = 60;
const MAX_CONTEXT_LENGTH = 22000;

function getConfig() {
	return {
		supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
		supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
		groqKey: process.env.GROQ_API_KEY
	};
}

function textValue(value, maxLength = 120) {
	if (value === null || value === undefined) return "";
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return (text || "").trim().slice(0, maxLength);
}

function countBy(donations, getValue) {
	const counts = new Map();
	for (const donation of donations) {
		const label = textValue(getValue(donation), 60) || "Sin dato";
		counts.set(label, (counts.get(label) || 0) + 1);
	}
	return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
}

function compactDonation(donation, { includeContacts, includeDonorName, includeResponses }) {
	const donor = donation.donor || {};
	const details = donation.donation || {};
	const coordination = donation.coordination || {};
	const compact = {
		code: donation.code,
		date: donation.created_at?.slice(0, 10),
		status: donation.status,
		tracking_status: donation.tracking_status,
		category: textValue(details.categoria, 50),
		item: textValue(details.objeto, 80),
		condition: textValue(details.estado, 40),
		quantity: textValue(details.cantidad, 40),
		description: textValue(details.descripcion, 120),
		donor_type: textValue(donor.tipo, 40),
		modality: textValue(coordination.modalidad, 40),
		preference: textValue(coordination.preferencia, 100),
		has_response: donation.has_response,
		has_photos: Array.isArray(donation.photos) && donation.photos.length > 0,
		donation_details: textValue(details, 700),
		coordination_details: textValue(includeContacts
			? coordination
			: Object.fromEntries(Object.entries(coordination).filter(([key]) => !/direcci|address|telefono|phone|email|correo/i.test(key))), 500)
	};
	if (includeDonorName || includeContacts) {
		compact.donor_name = [textValue(donor.nombre, 60), textValue(donor.apellido, 60)].filter(Boolean).join(" ");
	}
	if (includeContacts) {
		compact.phone = textValue(donor.telefono, 40);
		compact.email = textValue(donor.email, 80);
		compact.address = textValue(coordination.direccion, 100);
	}
	if (includeResponses) compact.response = textValue(donation.response, 300);
	return compact;
}

function buildDonationContext(donations, question) {
	const asksForContacts = /\b(teléfono|telefono|correo|email|dirección|direccion|domicilio|contacto)\b/i.test(question);
	const asksForCoordination = /\b(coordinar|coordinación|coordinacion|retiro|entrega)\b/i.test(question);
	const requestsCoordinationContacts = asksForCoordination
		&& (/\b(datos|donante|contactar|llamar|teléfono|telefono|correo|email)\b/i.test(question)
			|| /\bMC-\d{4}-\d+\b/i.test(question));
	const includeContacts = asksForContacts || requestsCoordinationContacts;
	const includeDonorName = /\b(donante|nombre|quién|quien|persona)\b/i.test(question);
	const includeResponses = /\b(respuesta|respondida|respondido|mensaje|contestación|contestacion)\b/i.test(question);
	const stopWords = new Set(["cuantas", "cuantos", "donacion", "donaciones", "estan", "tienen", "estado", "cuales", "lista", "hay", "para", "con", "del", "las", "los", "una", "por"]);
	const terms = [...new Set((question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[\p{L}\d-]{4,}/gu) || []).filter((term) => !stopWords.has(term)))];
	const ranked = donations.map((donation, index) => {
		const record = compactDonation(donation, { includeContacts, includeDonorName, includeResponses });
		const searchable = JSON.stringify(record).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		const score = terms.reduce((total, term) => total + Number(searchable.includes(term)), 0);
		return { record, index, score };
	});
	ranked.sort((left, right) => right.score - left.score || left.index - right.index);
	const records = ranked.slice(0, MAX_CONTEXT_RECORDS).map((entry) => entry.record);
	const summary = {
		records_loaded: donations.length,
		earliest_date: donations.map((donation) => donation.created_at).filter(Boolean).sort()[0]?.slice(0, 10) || null,
		latest_date: donations.map((donation) => donation.created_at).filter(Boolean).sort().at(-1)?.slice(0, 10) || null,
		by_status: countBy(donations, (donation) => donation.status),
		by_tracking_status: countBy(donations, (donation) => donation.tracking_status),
		by_category: countBy(donations, (donation) => donation.donation?.categoria),
		by_donor_type: countBy(donations, (donation) => donation.donor?.tipo),
		by_modality: countBy(donations, (donation) => donation.coordination?.modalidad),
		with_response: donations.filter((donation) => donation.has_response).length,
		without_response: donations.filter((donation) => !donation.has_response).length
	};
	const context = {
		summary,
		records_complete: records.length === donations.length,
		records_in_context: records.length,
		records
	};
	let serialized = JSON.stringify(context);
	while (serialized.length > MAX_CONTEXT_LENGTH && context.records.length > 1) {
		context.records.pop();
		context.records_in_context = context.records.length;
		context.records_complete = context.records.length === donations.length;
		serialized = JSON.stringify(context);
	}
	return serialized;
}

async function loadDonations(supabaseUrl, supabaseKey) {
	const url = new URL(`${supabaseUrl}/rest/v1/donations`);
	url.searchParams.set("select", "id,sequence,code,created_at,donor,donation,coordination,response,status,tracking_status,photos");
	url.searchParams.set("order", "sequence.desc");
	const rows = [];
	let offset = 0;
	let total = null;

	while (total === null || offset < total) {
		const result = await fetch(url, {
			headers: {
				apikey: supabaseKey,
				Authorization: `Bearer ${supabaseKey}`,
				Prefer: "count=exact",
				Range: `${offset}-${offset + DONATIONS_PAGE_SIZE - 1}`
			}
		});
		if (!result.ok) throw new Error("No se pudieron consultar las donaciones.");
		const page = await result.json();
		if (!Array.isArray(page)) throw new Error("Supabase devolvió un formato de donaciones no válido.");

		rows.push(...page);
		offset += page.length;
		const range = result.headers.get("content-range");
		const totalMatch = range?.match(/\/(\d+)$/);
		if (totalMatch) total = Number(totalMatch[1]);
		if (!page.length || (total === null && page.length < DONATIONS_PAGE_SIZE)) break;
	}

	return rows.map((row) => ({
		id: row.id,
		sequence: row.sequence,
		code: row.code,
		created_at: row.created_at,
		donor: row.donor || {},
		donation: row.donation || {},
		coordination: row.coordination || {},
		photos: row.photos || [],
		response: row.response,
		status: row.status || "pending",
		tracking_status: row.tracking_status || "Pendiente de coordinación",
		has_response: Array.isArray(row.response)
			? row.response.length > 0
			: Boolean(row.response && String(row.response).trim())
	}));
}

export default async function handler(request, response) {
	if (request.method !== "POST") {
		return response.status(405).json({ error: "Método no permitido." });
	}

	const config = getConfig();
	const supabaseUrl = config.supabaseUrl || String(request.body?.supabaseUrl || "").trim();
	const supabaseKey = config.supabaseKey || String(request.body?.supabaseKey || "").trim();
	const groqKey = config.groqKey;
	if (!supabaseUrl || !supabaseKey || !groqKey) {
		return response.status(500).json({ error: "El asistente no está configurado todavía." });
	}

	const incomingMessages = Array.isArray(request.body?.messages)
		? request.body.messages
		: [];
	const messages = incomingMessages
		.filter((message) => message && ["user", "assistant"].includes(message.role))
		.slice(-6)
		.map((message) => ({
			role: message.role,
			content: String(message.content || "").trim().slice(0, 800)
		}))
		.filter((message) => message.content);

	if (!messages.length || messages[messages.length - 1].role !== "user") {
		return response.status(400).json({ error: "Escribe una consulta para continuar." });
	}

	try {
		const donations = await loadDonations(supabaseUrl, supabaseKey);
		const context = buildDonationContext(donations, messages[messages.length - 1].content);
		const { response: groqResponse, data } = await requestGroqChat({
			apiKey: groqKey,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "system", content: `Contexto actual de donaciones en JSON:\n${context}` },
				...messages
			],
			temperature: 0.2,
			maxCompletionTokens: 800
		});
		if (!groqResponse.ok) {
			console.error("Error de Groq para asistentes:", data);
			return response.status(502).json({ error: getGroqErrorMessage(groqResponse.status, data) });
		}

		const content = data.choices?.[0]?.message?.content?.trim();
		if (!content) {
			return response.status(502).json({ error: "El asistente no devolvió una respuesta." });
		}
		return response.status(200).json({ content });
	} catch (error) {
		console.error("Error en el asistente de asistentes:", error);
		return response.status(500).json({ error: "No pudimos consultar la información." });
	}
}