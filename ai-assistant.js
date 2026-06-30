/**
 * AI Assistant para Manos Conectadas
 * Herramienta colaborativa que:
 * 1. Sugiere asignación de donaciones
 * 2. Prioriza casos por urgencia
 * 3. Responde preguntas en lenguaje natural sobre la base de datos
 * 
 * La decisión final siempre la toma la asistente social.
 */

class AIAssistant {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.donations = [];
    this.questions = [];
  }

  /**
   * Carga todas las donaciones de la base de datos
   */
  async loadDonations() {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/donations?select=*&order=sequence.desc`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`
          }
        }
      );
      if (!response.ok) throw new Error("Error al cargar donaciones");
      this.donations = await response.json();
      return this.donations;
    } catch (error) {
      console.error("Error en loadDonations:", error);
      return [];
    }
  }

  /**
   * Guarda una pregunta en la base de datos
   */
  async saveDonationQuestion(donationId, question, response) {
    try {
      const payload = {
        donation_id: donationId,
        question: question.trim(),
        response: response,
        created_at: new Date().toISOString()
      };

      // Para compatibilidad, intentamos con tabla ai_donation_questions
      const result = await fetch(
        `${this.supabaseUrl}/rest/v1/ai_donation_questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        }
      );

      if (result.ok) {
        return await result.json();
      }
      // Si falla, podemos almacenar en localStorage como fallback
      this._saveToLocalStorage(payload);
      return payload;
    } catch (error) {
      console.error("Error al guardar pregunta:", error);
      this._saveToLocalStorage({ donation_id: donationId, question, response });
    }
  }

  /**
   * Guarda una pregunta de chat general
   */
  async saveChatQuestion(question, response, category = "general") {
    try {
      const payload = {
        question: question.trim(),
        response: response,
        category: category,
        timestamp: new Date().toISOString()
      };

      const result = await fetch(
        `${this.supabaseUrl}/rest/v1/ai_chat_questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        }
      );

      if (result.ok) {
        return await result.json();
      }
      this._saveToLocalStorage(payload);
      return payload;
    } catch (error) {
      console.error("Error al guardar pregunta de chat:", error);
      this._saveToLocalStorage({ question, response, category });
    }
  }

  /**
   * Fallback para guardar en localStorage
   */
  _saveToLocalStorage(data) {
    const key = "aiAssistantQuestions";
    const stored = localStorage.getItem(key) || "[]";
    const questions = JSON.parse(stored);
    questions.push(data);
    localStorage.setItem(key, JSON.stringify(questions));
  }

  /**
   * FUNCIONALIDAD 1: Sugiere asignación de una nueva donación
   * Analiza la donación y sugiere beneficiarios/instituciones que podrían necesitarla
   */
  suggestAssignment(newDonation) {
    const suggestions = [];
    const seen = new Set();
    
    // Extraer información de la donación
    const donationObj = newDonation.donation || {};
    const donationCategory = (donationObj.categoria || "").toLowerCase();
    const donationDescription = (donationObj.descripcion || "").toLowerCase();
    const donationItem = (donationObj.objeto || "").toLowerCase();
    const donationQuantity = (donationObj.cantidad || "").toLowerCase();
    const coordination = newDonation.coordination || {};

    const addSuggestion = (suggestion) => {
      const key = `${suggestion.type}|${suggestion.category}|${suggestion.reason}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push(suggestion);
      }
    };

    // Criterios de prioridad según categoría
    const categoryRules = {
      ropa: {
        reason: "Esta ropa puede asignarse a familias con bebés, niños o personas en situación de vulnerabilidad.",
        urgency: "medium"
      },
      alimentos: {
        reason: "Estos alimentos son críticos para cubrir necesidades básicas y pueden entregarse de inmediato.",
        urgency: "high"
      },
      medicamentos: {
        reason: "Medicamentos y kits de primeros auxilios requieren atención prioritaria.",
        urgency: "critical"
      },
      materiales: {
        reason: "Materiales de construcción requieren logística y coordinar con equipos de apoyo.",
        urgency: "medium"
      }
    };

    // Análisis de modalidad y coordinación
    if (coordination.modalidad) {
      const modality = coordination.modalidad.toLowerCase();
      if (modality.includes("retiro")) {
        addSuggestion({
          type: "coordination",
          category: "Retiro",
          reason: "Confirmá la dirección y horario de retiro para coordinar a un voluntario o equipo de logística.",
          urgency: "high"
        });
      }
      if (modality.includes("llevar")) {
        addSuggestion({
          type: "coordination",
          category: "Entrega",
          reason: "Organizá la entrega rápida para que la donación llegue cuanto antes al beneficiario.",
          urgency: "medium"
        });
      }
    }

    if (coordination.referencias?.toLowerCase().includes("contrafrente")) {
      addSuggestion({
        type: "coordination",
        category: "Acceso",
        reason: "Verificá el acceso del donante y la referencia de contrafrente antes de programar la visita.",
        urgency: "medium"
      });
    }

    if (coordination.preferencia) {
      const preference = coordination.preferencia.toLowerCase();
      if (preference.includes("bebé") || preference.includes("niño")) {
        addSuggestion({
          type: "beneficiary",
          category: "Familias con bebés/niños",
          reason: "El donante prioriza familias con bebés o niños, por lo que conviene asignar la donación a ese grupo.",
          urgency: "high"
        });
      }
      if (preference.includes("urgente") || preference.includes("prioridad") || preference.includes("rápido")) {
        addSuggestion({
          type: "priority",
          category: "Entrega urgente",
          reason: "La preferencia del donante indica entregar la donación preferentemente con prioridad.",
          urgency: "critical"
        });
      }
    }

    if (categoryRules[donationCategory]) {
      addSuggestion({
        type: "category",
        category: donationCategory.charAt(0).toUpperCase() + donationCategory.slice(1),
        reason: categoryRules[donationCategory].reason,
        urgency: categoryRules[donationCategory].urgency
      });
    }

    if (donationCategory.includes("ropa") || donationItem.includes("conjunto") || donationDescription.includes("prendas")) {
      addSuggestion({
        type: "recipient",
        category: "Ropa",
        reason: "Buscá beneficiarios con necesidades de ropa para bebés, niños o personas que requieren abrigo.",
        urgency: "medium"
      });
    }

    if (donationCategory.includes("alimento") || donationItem.includes("canasta") || donationDescription.includes("leche")) {
      addSuggestion({
        type: "recipient",
        category: "Alimentos",
        reason: "Asigná a familias con vulnerabilidad alimentaria o a comedores comunitarios que puedan distribuir rápidamente.",
        urgency: "high"
      });
    }

    if (donationCategory.includes("medicamento") || donationItem.includes("kit") || donationDescription.includes("salud")) {
      addSuggestion({
        type: "recipient",
        category: "Medicamentos",
        reason: "Recomendado para familias con necesidades médicas o instituciones de salud comunitaria.",
        urgency: "critical"
      });
    }

    if (donationQuantity.includes("kg") || donationQuantity.match(/\d+/)) {
      addSuggestion({
        type: "logistics",
        category: "Volumen",
        reason: "Evaluá el volumen y peso para coordinar transporte adecuado y evitar sobrecargar a voluntarios.",
        urgency: "medium"
      });
    }

    if (donationDescription.includes("urgente") || donationDescription.includes("prioridad")) {
      addSuggestion({
        type: "priority",
        category: "Urgencia detectada",
        reason: "La descripción indica una urgencia que merece atención rápida.",
        urgency: "critical"
      });
    }

    // Añadir sugerencias generales si todavía hay pocas
    if (suggestions.length < 3) {
      addSuggestion({
        type: "general",
        category: "Revisión general",
        reason: "Revisá la donación junto a un miembro del equipo antes de asignarla para asegurar el mejor destino.",
        urgency: "low"
      });
      addSuggestion({
        type: "general",
        category: "Comunicación",
        reason: "Informá al donante o voluntario responsable si se requieren datos adicionales o coordinación extra.",
        urgency: "low"
      });
    }

    return {
      donationCode: newDonation.code,
      suggestions: suggestions,
      instructions: "Revisa estas sugerencias y decide el destino final. La asistente social toma la decisión.",
      note: "Estas recomendaciones se basan en datos de la donación y deben validarse con la situación real."
    };
  }

  /**
   * FUNCIONALIDAD 2: Prioriza donaciones por urgencia
   */
  prioritizeDonations(donations) {
    const scores = donations.map(donation => {
      let score = 0;
      const coordination = donation.coordination || {};
      const donationObj = donation.donation || {};
      const donor = donation.donor || {};

      // Urgencia por preferencia
      if (coordination.preferencia?.toLowerCase().includes("urgente")) score += 50;
      if (coordination.preferencia?.toLowerCase().includes("prioridad")) score += 40;
      if (coordination.preferencia?.toLowerCase().includes("rápido")) score += 30;

      // Categoría crítica
      const category = (donationObj.categoria || "").toLowerCase();
      if (category.includes("medicamento") || category.includes("médica")) score += 35;
      if (category.includes("alimento") && donationObj.objeto?.toLowerCase().includes("leche")) score += 25;
      if (category.includes("bebé") || category.includes("niño")) score += 20;

      // Modalidad de retiro (requiere coordinación urgente)
      if (coordination.modalidad === "retiro") score += 15;

      // Antigüedad (más antigua = más prioritaria)
      const daysOld = (Date.now() - new Date(donation.created_at).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.min(daysOld * 5, 30); // Máx 30 puntos por antigüedad

      return { donation, score };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.donation,
        urgencyScore: Math.round(item.score),
        urgencyLevel: item.score >= 80 ? "CRÍTICA" : item.score >= 50 ? "ALTA" : item.score >= 30 ? "MEDIA" : "BAJA"
      }));
  }

  /**
   * FUNCIONALIDAD 3: Responde preguntas en lenguaje natural
   */
  async answerQuestion(question, forcedCategory = null) {
    if (!this.donations.length) {
      await this.loadDonations();
    }

    const q = question.toLowerCase().trim();
    let response = null;
    let category = "general";
    if (forcedCategory) category = forcedCategory;

    // Helper: buscar por código exacto
    const findByCode = code => this.donations.find(d => (d.code || "").toLowerCase() === code.toLowerCase());

    // Helper: parsear cantidad numeric desde texto (ej: "15 kg", "3 prendas", "Varios")
    const parseQuantity = text => {
      if (!text) return null;
      const n = text.match(/(\d+(?:[\.,]\d+)?)/);
      if (n) return Number(n[0].replace(',', '.'));
      if (/varios|muchos/i.test(text)) return 2;
      return null;
    };

    // 1) Consultas por código de donación
    const codeMatch = q.match(/mc-\d{4}-\d{3}/i);
    if (codeMatch) {
      category = 'detalle';
      const code = codeMatch[0];
      const donation = findByCode(code);
      if (donation) {
        response = `Donación ${donation.code}: estado "${donation.status}". Categoría: ${donation.donation?.categoria || 'No especificada'}. Modalidad: ${donation.coordination?.modalidad || 'No especificada'}.`;
      } else {
        response = `No encontré la donación con código ${code} en la base de datos.`;
      }
      await this.saveChatQuestion(question, response, category);
      return { question, response, category, timestamp: new Date().toISOString() };
    }

    // 2) Cantidades generales
    if (q.includes('cuántas') || q.includes('total de donaciones') || q.includes('total de donaciones')) {
      category = 'cantidad';
      if (q.includes('pendient')) {
        const count = this.donations.filter(d => d.status === 'pending').length;
        response = `Hay ${count} donación${count !== 1 ? 'es' : ''} pendiente${count !== 1 ? 's' : ''}.`;
      } else if (q.includes('descart')) {
        const count = this.donations.filter(d => d.status && d.status.toLowerCase().includes('descart')).length;
        response = `Hay ${count} donación${count !== 1 ? 'es' : ''} descartada${count !== 1 ? 's' : ''}.`;
      } else if (q.includes('10 kg') || q.includes('10kg') || q.includes('más de 10 kg')) {
        // buscar cantidades con kg y parsear
        const withKg = this.donations.filter(d => (d.donation?.cantidad || '').toLowerCase().includes('kg'));
        const parsed = withKg.filter(d => {
          const n = parseQuantity(d.donation?.cantidad || '');
          return n !== null && n > 10;
        });
        response = `Hay ${parsed.length} donación${parsed.length !== 1 ? 'es' : ''} con más de 10 kg.`;
      } else {
        response = `Total de donaciones: ${this.donations.length}.`;
      }
    }

    // 3) Modalidades: retiro / llevar
    else if (q.includes('modalidad') || q.includes('retiro') || q.includes('llevar')) {
      category = 'modalidad';
      if (q.includes('retiro') && q.includes('domicilio')) {
        const list = this.donations.filter(d => (d.coordination?.modalidad || '').toLowerCase().includes('retiro') && (d.coordination?.direccion || '').trim().length > 0);
        response = `Encontré ${list.length} donación${list.length !== 1 ? 'es' : ''} con modalidad retiro y dirección especificada.`;
      } else if (q.includes('llevar')) {
        const list = this.donations.filter(d => (d.coordination?.modalidad || '').toLowerCase().includes('llevar'));
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} con modalidad llevar.`;
      } else {
        const retiro = this.donations.filter(d => (d.coordination?.modalidad || '').toLowerCase().includes('retiro')).length;
        const llevar = this.donations.filter(d => (d.coordination?.modalidad || '').toLowerCase().includes('llevar')).length;
        response = `Modalidad retiro: ${retiro}. Modalidad llevar: ${llevar}.`;
      }
    }

    // 4) Urgencia / prioridad
    else if (q.includes('urgente') || q.includes('prioridad') || q.includes('priorizar')) {
      category = 'priorización';
      const urgent = this.donations.filter(d => (d.coordination?.preferencia || '').toLowerCase().includes('urgente') || (d.coordination?.preferencia || '').toLowerCase().includes('prioridad'));
      if (q.includes('cómo') || q.includes('cómo puedo') || q.includes('cómo priorizar')) {
        response = 'Para priorizar: 1) Marcar urgencia según preferencia del donante; 2) Priorizar medicamentos y alimentos para familias vulnerables; 3) Revisar antigüedad y disponibilidad de entrega. Puedo listar las más urgentes si querés.';
      } else {
        const list = this.prioritizeDonations(this.donations).slice(0,5);
        response = `Las ${list.length} donación${list.length !== 1 ? 'es' : ''} con mayor prioridad: ${list.map(d=>d.code).join(', ')}.`;
      }
    }

    // 5) Beneficiarios y donantes
    else if (q.includes('famil') || q.includes('beb') || q.includes('instituci') || q.includes('particular') || q.includes('donante')) {
      category = 'donante';
      if (q.includes('instituci')) {
        const list = this.donations.filter(d => (d.donor?.tipo || '').toLowerCase().includes('institución') || (d.donor?.tipo || '').toLowerCase().includes('institucion'));
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} cuyo donante es una institución.`;
      } else if (q.includes('particular')) {
        const list = this.donations.filter(d => (d.donor?.tipo || '').toLowerCase().includes('particular'));
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} con donante particular.`;
      } else if (q.includes('beb') || q.includes('niño') || q.includes('recién nacido')) {
        const forBabies = this.donations.filter(d => {
          const pref = (d.coordination?.preferencia || '').toLowerCase();
          const desc = (d.donation?.descripcion || '').toLowerCase();
          return pref.includes('bebé') || desc.includes('bebé') || desc.includes('recién nacido');
        });
        response = `Hay ${forBabies.length} donación${forBabies.length !== 1 ? 'es' : ''} para bebés/niños.`;
      }
    }

    // 6) Respuesta / asignación
    else if (q.includes('tienen respuesta') || q.includes('no tienen respuesta') || q.includes('asignadas') || q.includes('sin asignar')) {
      category = 'respuesta';
      if (q.includes('tienen respuesta')) {
        const list = this.donations.filter(d => d.response && (Array.isArray(d.response) ? d.response.length > 0 : String(d.response).trim().length > 0));
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} con respuesta registrada.`;
      } else if (q.includes('no tienen respuesta')) {
        const list = this.donations.filter(d => !d.response || (Array.isArray(d.response) ? d.response.length === 0 : String(d.response).trim().length === 0));
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} sin respuesta.`;
      } else if (q.includes('asignadas')) {
        const list = this.donations.filter(d => d.response && String(d.response).trim().length > 0);
        response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} asignada${list.length !== 1 ? 's' : ''}.`;
      } else {
        const unassigned = this.donations.filter(d => !d.response || (Array.isArray(d.response) ? d.response.length === 0 : String(d.response).trim().length === 0)).length;
        response = `Hay ${unassigned} donación${unassigned !== 1 ? 'es' : ''} sin asignar aún.`;
      }
    }

    // 7) Coordinación / dirección / coordenadas
    else if (q.includes('coordenadas') || q.includes('dirección') || q.includes('direccion') || q.includes('dirección de retiro')) {
      category = 'coordinación';
      const list = this.donations.filter(d => (d.coordination?.direccion || '').trim().length > 0 || (d.coordination?.coordenadas || '').toString().trim().length > 0);
      response = `Hay ${list.length} donación${list.length !== 1 ? 'es' : ''} con dirección o coordenadas de retiro especificadas.`;
    }

    // 8) Detalle por objeto o composición (ej: Canasta básica, Kit de primeros auxilios)
    else if (q.includes('canasta') || q.includes('kit') || q.includes('conjunto')) {
      category = 'detalle';
      const keywords = ['canasta', 'kit', 'conjunto', 'primero'];
      const list = this.donations.filter(d => {
        const obj = (d.donation?.objeto || '').toLowerCase();
        const desc = (d.donation?.descripcion || '').toLowerCase();
        return keywords.some(k => obj.includes(k) || desc.includes(k));
      });
      response = `Encontré ${list.length} donación${list.length !== 1 ? 'es' : ''} que mencionan objetos como canasta básica o kit de primeros auxilios.`;
    }

    // 9) Si la pregunta pide ejemplos o instrucciones para priorizar (consulta)
    else if (q.includes('preguntas conviene hacer') || q.includes('qué preguntas') || q.includes('consult')) {
      category = 'consulta';
      response = 'Preguntas útiles: 1) ¿Cuál es la urgencia de entrega? 2) ¿Hay datos de contacto completos? 3) ¿Requiere refrigeración o cuidado médico? 4) ¿Es para familia o institución? 5) ¿Preferencia de entrega/horario?';
    }

    // 10) Default: intentar ofrecer resumen o ejemplo
    else {
      response = 'Puedo responder con datos reales de donaciones. Ejemplos: "¿Cuántas donaciones pendientes hay?" o "¿Qué donaciones son urgentes?". También puedo listar códigos de donación prioritarios.';
    }

    // Guardar la pregunta y respuesta
    await this.saveChatQuestion(question, response, category);

    return {
      question: question,
      response: response,
      category: category,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene todas las preguntas guardadas del chat
   */
  async loadChatHistory() {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/ai_chat_questions?order=timestamp.desc&limit=50`,
        {
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`
          }
        }
      );
      if (!response.ok) {
        // Si la tabla no existe, devolver historial local
        const stored = localStorage.getItem("aiAssistantQuestions") || "[]";
        return JSON.parse(stored);
      }
      return await response.json();
    } catch (error) {
      console.error("Error al cargar historial:", error);
      const stored = localStorage.getItem("aiAssistantQuestions") || "[]";
      return JSON.parse(stored);
    }
  }

  /**
   * Formatea sugerencias para mostrar en la UI
   */
  formatSuggestions(suggestionObj) {
    if (!suggestionObj.suggestions || !suggestionObj.suggestions.length) {
      return "<p>No hay sugerencias para esta donación.</p>";
    }

    const html = suggestionObj.suggestions
      .map(s => {
        const urgencyClass = s.urgency === "critical" ? "urgent-critical" : 
                            s.urgency === "high" ? "urgent-high" : 
                            s.urgency === "medium" ? "urgent-medium" : "urgent-low";
        return `
          <div class="suggestion-item ${urgencyClass}">
            <div class="suggestion-category">${s.category}</div>
            <div class="suggestion-reason">${s.reason}</div>
            <div class="suggestion-urgency">Urgencia: ${s.urgency.toUpperCase()}</div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="suggestions-container">
        <p style="margin-bottom:12px; font-size:13px; color:var(--ink-60);">
          Sugerencias basadas en los datos de la donación:
        </p>
        ${html}
        <p style="margin-top:12px; font-size:12px; color:var(--ink-60); font-style:italic;">
          ⚠️ La decisión final la tomas vos. Estas son solo recomendaciones.
        </p>
      </div>
    `;
  }
}

// Exportar para uso global
window.AIAssistant = AIAssistant;
