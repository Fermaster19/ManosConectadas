import { getGroqErrorMessage, requestGroqChat } from '../lib/groq-chat.js';

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de Manos Conectadas, una plataforma web municipal que centraliza y coordina donaciones solidarias.

Información del proyecto:
- El donante puede cargar una o varias donaciones en el formulario.
- Cada donación debe incluir fotografías.
- El donante indica si entregará el objeto o necesita que lo retiren.
- Cada donación recibe un código de seguimiento único.

Pautas:
- Responde en español, con tono amable, profesional y empático.
- Sé breve y claro. Ayuda a completar una donación o entender el seguimiento.
- No inventes procesos, horarios, direcciones, estados ni medios de pago.
- Si no tienes un dato, indica que debe consultarlo con la Municipalidad.
- No solicites contraseñas, claves ni datos bancarios.
 - No respondas preguntas fuera del contexto de donaciones solidarias.`;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'El asistente no está configurado todavía.' });
  }

  const incomingMessages = Array.isArray(request.body?.messages)
    ? request.body.messages
    : [];
  const messages = incomingMessages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').trim().slice(0, 800)
    }))
    .filter((message) => message.content);

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return response.status(400).json({ error: 'Escribe una consulta para continuar.' });
  }

  try {
    const { response: groqResponse, data } = await requestGroqChat({
      apiKey,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.4,
      maxCompletionTokens: 500
    });

    if (!groqResponse.ok) {
      console.error('Error de Groq:', data);
      return response.status(502).json({ error: getGroqErrorMessage(groqResponse.status, data) });
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return response.status(502).json({ error: 'El asistente no devolvió una respuesta.' });
    }

    return response.status(200).json({ content });
  } catch (error) {
    console.error('Error en el asistente:', error);
    return response.status(500).json({ error: 'No pudimos conectar con el asistente.' });
  }
}
