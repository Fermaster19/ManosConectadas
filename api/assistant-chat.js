const SYSTEM_PROMPT = `Eres una IA de apoyo para asistentes sociales de Manos Conectadas.

Usa exclusivamente los datos de donaciones incluidos en el contexto. Responde en español, con tono claro, profesional y breve. Puedes contar, filtrar, comparar y resumir donaciones; también puedes sugerir prioridades, pero la decisión final siempre la toma la asistente social.

No inventes datos. Si el contexto no permite responder, dilo explícitamente. Los asistentes pueden solicitar los datos del donante para coordinar una entrega o retiro; muestra teléfono, correo y dirección solo cuando la consulta los pida o sean necesarios para esa coordinación. Nunca expongas contraseñas. Cuando listes donaciones, incluye su código y el dato relevante. Los estados de seguimiento pueden ser: Pendiente de coordinación, Para retirar, En bodega de la municipalidad, En tránsito y Entregada.`;

function getConfig() {
	return {
		supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
		supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
		groqKey: process.env.GROQ_API_KEY
	};
}

async function loadDonations(supabaseUrl, supabaseKey) {
	const url = `${supabaseUrl}/rest/v1/donations?select=id,sequence,code,created_at,donor,donation,coordination,response,status,tracking_status&order=sequence.desc&limit=200`;
	const result = await fetch(url, {
		headers: {
			apikey: supabaseKey,
			Authorization: `Bearer ${supabaseKey}`
		}
	});
	if (!result.ok) throw new Error("No se pudieron consultar las donaciones.");
	const rows = await result.json();
	return rows.map((row) => ({
		id: row.id,
		sequence: row.sequence,
		code: row.code,
		created_at: row.created_at,
		donor: row.donor || {},
		donation: row.donation || {},
		coordination: row.coordination || {},
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
		.slice(-10)
		.map((message) => ({
			role: message.role,
			content: String(message.content || "").trim().slice(0, 2000)
		}))
		.filter((message) => message.content);

	if (!messages.length || messages[messages.length - 1].role !== "user") {
		return response.status(400).json({ error: "Escribe una consulta para continuar." });
	}

	try {
		const donations = await loadDonations(supabaseUrl, supabaseKey);
		const context = JSON.stringify(donations);
		const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${groqKey}`
			},
			body: JSON.stringify({
				model: process.env.GROQ_MODEL || "groq/compound-mini",
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "system", content: `Contexto actual de donaciones en JSON:\n${context}` },
					...messages
				],
				temperature: 0.2,
				max_completion_tokens: 700
			})
		});

		const data = await groqResponse.json();
		if (!groqResponse.ok) {
			console.error("Error de Groq para asistentes:", data);
			return response.status(502).json({ error: "No pudimos responder en este momento." });
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