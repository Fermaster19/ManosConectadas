/**
 * Corrección automática de textos para donaciones (español rioplatense).
 */
(function (global) {
  const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'von', 'van']);

  const WORD_FIXES = {
    pantalon: 'pantalón',
    pantalones: 'pantalones',
    sabana: 'sábana',
    sabanas: 'sábanas',
    edredon: 'edredón',
    sofa: 'sofá',
    sofas: 'sofás',
    sillon: 'sillón',
    estanteria: 'estantería',
    television: 'televisión',
    util: 'útil',
    utiles: 'útiles',
    azucar: 'azúcar',
    panales: 'pañales',
    panial: 'pañal',
    paniales: 'pañales',
    muneca: 'muñeca',
    muneco: 'muñeco',
    lapiz: 'lápiz',
    lapices: 'lápices',
    geografia: 'geografía',
    matematica: 'matemática',
    camara: 'cámara',
    telefono: 'teléfono',
    plastico: 'plástico',
    hermetico: 'hermético',
    generico: 'genérico',
    imitacion: 'imitación',
    direccion: 'dirección',
    porton: 'portón',
    piyama: 'pijama',
    pulover: 'pulóver',
    pullover: 'pulóver',
    remer: 'remera',
    camper: 'campera',
    colchon: 'colchón',
    electrodomestico: 'electrodoméstico',
    electrodomesticos: 'electrodomésticos',
    refrigerador: 'refrigerador',
    computadora: 'computadora',
    bicicleta: 'bicicleta',
    mochila: 'mochila',
    cuaderno: 'cuaderno',
    cuadernos: 'cuadernos',
    zapatilla: 'zapatilla',
    zapatillas: 'zapatillas',
    sandalia: 'sandalia',
    sandalias: 'sandalias',
    ojota: 'ojota',
    ojotas: 'ojotas',
    bermuda: 'bermuda',
    bermudas: 'bermudas',
    pollera: 'pollera',
    vestido: 'vestido',
    abrigo: 'abrigo',
    bufanda: 'bufanda',
    gorro: 'gorro',
    gorra: 'gorra',
    calza: 'calza',
    calzas: 'calzas',
    buzo: 'buzo',
    campera: 'campera',
    remera: 'remera',
    frazada: 'frazada',
    almohada: 'almohada',
    vajilla: 'vajilla',
    sarten: 'sartén',
    licuadora: 'licuadora',
    batidora: 'batidora',
    aspiradora: 'aspiradora',
    ventilador: 'ventilador',
    calefactor: 'calefactor',
    estufa: 'estufa',
    heladera: 'heladera',
    lavarropas: 'lavarropas',
    lavarropa: 'lavarropas',
    microondas: 'microondas',
    auriculares: 'auriculares',
    cargador: 'cargador',
    tablet: 'tablet',
    impresora: 'impresora',
    monitor: 'monitor',
    teclado: 'teclado',
    parlante: 'parlante',
    cochecito: 'cochecito',
    mamadera: 'mamadera',
    andador: 'andador',
    pelota: 'pelota',
    juguete: 'juguete',
    juguetes: 'juguetes',
    rompecabezas: 'rompecabezas',
    cartuchera: 'cartuchera',
    marcadores: 'marcadores',
    calculadora: 'calculadora',
    accesorios: 'accesorios',
    accesorio: 'accesorio',
    talle: 'talle',
    talles: 'talles',
    marca: 'marca',
    color: 'color',
    medidas: 'medidas',
    unidad: 'unidad',
    unidades: 'unidades',
    par: 'par',
    pares: 'pares',
    bolsa: 'bolsa',
    caja: 'caja',
    litro: 'litro',
    litros: 'litros',
    kilo: 'kilo',
    kilos: 'kilos',
    kg: 'kg',
    gramos: 'gramos',
    gramo: 'gramo',
    varon: 'varón',
    mujer: 'mujer',
    hombre: 'hombre',
    adulto: 'adulto',
    adulta: 'adulta',
    adolescente: 'adolescente',
    bebe: 'bebé',
    bebes: 'bebés',
    recien: 'recién',
    nacido: 'nacido',
    nacida: 'nacida',
    escolar: 'escolar',
    primaria: 'primaria',
    secundaria: 'secundaria',
    jardin: 'jardín',
    maternal: 'maternal',
    familia: 'familia',
    familias: 'familias',
    institucion: 'institución',
    escuela: 'escuela',
    colegio: 'colegio',
    iglesia: 'iglesia',
    municipio: 'municipio',
    villa: 'villa',
    barrio: 'barrio',
    calle: 'calle',
    avenida: 'avenida',
    esquina: 'esquina',
    reja: 'reja',
    timbre: 'timbre',
    cochera: 'cochera',
    departamento: 'departamento',
    depto: 'depto.',
    piso: 'piso',
    manana: 'mañana',
    tarde: 'tarde',
    tardes: 'tardes',
    mananas: 'mañanas',
    horario: 'horario',
    horarios: 'horarios',
    lunes: 'lunes',
    martes: 'martes',
    miercoles: 'miércoles',
    jueves: 'jueves',
    viernes: 'viernes',
    sabado: 'sábado',
    domingo: 'domingo',
    enero: 'enero',
    febrero: 'febrero',
    marzo: 'marzo',
    abril: 'abril',
    junio: 'junio',
    julio: 'julio',
    agosto: 'agosto',
    septiembre: 'septiembre',
    octubre: 'octubre',
    noviembre: 'noviembre',
    diciembre: 'diciembre',
  };

  function normalizeSpaces(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  function preserveCase(original, fixed) {
    if (!original) return fixed;
    if (original === original.toUpperCase()) return fixed.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
      return fixed.charAt(0).toUpperCase() + fixed.slice(1);
    }
    return fixed;
  }

  function fixWords(text) {
    return text.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (word) => {
      const key = word.toLowerCase();
      const fixed = WORD_FIXES[key];
      return fixed ? preserveCase(word, fixed) : word;
    });
  }

  function ensureLeadingCapital(text) {
    if (!text) return '';
    let i = 0;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length || !/[a-záéíóúüñ]/.test(text[i])) return text;
    const upper = text[i].toLocaleUpperCase('es-AR');
    if (text[i] === upper) return text;
    return text.slice(0, i) + upper + text.slice(i + 1);
  }

  function capitalizeSentences(text) {
    if (!text) return text;
    let result = '';
    let capitalizeNext = true;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (capitalizeNext && /[a-záéíóúüñ]/i.test(ch)) {
        result += ch.toUpperCase();
        capitalizeNext = false;
      } else {
        result += ch;
        if (/[.!?…]/.test(ch)) capitalizeNext = true;
      }
    }
    return result;
  }

  function toTitleCaseName(text) {
    return normalizeSpaces(text)
      .split(' ')
      .filter(Boolean)
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && NAME_PARTICLES.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  }

  function correct(text, mode) {
    if (!text || typeof text !== 'string') return text || '';

    let result = normalizeSpaces(text);
    result = fixWords(result);

    if (mode === 'name') {
      result = toTitleCaseName(result);
    } else if (mode === 'object') {
      result = ensureLeadingCapital(result);
    } else if (mode === 'sentence') {
      result = capitalizeSentences(result);
    } else if (mode === 'light') {
      result = result.toLowerCase().replace(/\b(\d+)\s*([a-záéíóúüñ]+)/gi, (_, num, unit) => {
        const fixed = WORD_FIXES[unit.toLowerCase()];
        const word = fixed || unit.toLowerCase();
        return `${num} ${preserveCase(unit, word)}`;
      });
      result = capitalizeSentences(result);
    }

    return result;
  }

  function correctFieldElement(el, mode) {
    if (!el || el.disabled || el.readOnly) return false;
    const before = el.value;
    const after = correct(before, mode);
    if (after === before) return false;
    el.value = after;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function flashCorrected(el) {
    el.classList.add('field-corrected');
    window.setTimeout(() => el.classList.remove('field-corrected'), 1600);
  }

  function initLeadingCapitalOnInput(el) {
    if (!el) return;
    el.addEventListener('input', () => {
      const before = el.value;
      const after = ensureLeadingCapital(before);
      if (after === before) return;
      const pos = el.selectionStart;
      el.value = after;
      if (typeof pos === 'number') {
        el.setSelectionRange(pos, pos);
      }
    });
  }

  function initFormCorrector(fieldMap) {
    fieldMap.forEach(({ id, mode, liveCapital }) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (liveCapital) initLeadingCapitalOnInput(el);
      el.addEventListener('blur', () => {
        if (correctFieldElement(el, mode)) flashCorrected(el);
      });
    });
  }

  global.TextCorrector = {
    correct,
    correctFieldElement,
    initFormCorrector,
    flashCorrected,
    ensureLeadingCapital,
  };
})(window);
