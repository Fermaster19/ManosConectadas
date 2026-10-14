const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

async function sendRequest(apiKey, model, messages, temperature, maxCompletionTokens) {
	const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages,
			temperature,
			max_completion_tokens: maxCompletionTokens
		})
	});
	const data = await response.json().catch(() => ({}));
	return { response, data };
}

export async function requestGroqChat({ apiKey, messages, temperature, maxCompletionTokens }) {
	const configuredModel = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
	let result = await sendRequest(apiKey, configuredModel, messages, temperature, maxCompletionTokens);

	if (result.response.status === 404 && configuredModel !== DEFAULT_GROQ_MODEL) {
		console.warn(`Groq no encontró el modelo ${configuredModel}; se probará ${DEFAULT_GROQ_MODEL}.`);
		result = await sendRequest(apiKey, DEFAULT_GROQ_MODEL, messages, temperature, maxCompletionTokens);
	}

	return result;
}

export function getGroqErrorMessage(status, data) {
	const providerMessage = String(data.error?.message || "").trim().slice(0, 240);
	if (status === 401) return "La clave de Groq no es válida o venció. Revisa GROQ_API_KEY.";
	if (status === 403) return "La clave de Groq no tiene acceso al modelo configurado.";
	if (status === 404) return "Groq no encuentra el modelo. Revisa GROQ_MODEL y los modelos habilitados en tu cuenta.";
	if (status === 413) return "La consulta supera el límite de tokens de Groq. Prueba con una pregunta más breve.";
	if (status === 429) return "Groq alcanzó el límite de uso o cuota disponible.";
	return `Groq rechazó la consulta (HTTP ${status})${providerMessage ? `: ${providerMessage}` : "."}`;
}