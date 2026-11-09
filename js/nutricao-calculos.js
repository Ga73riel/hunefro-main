// Funções matemáticas puras da ficha nutricional.
// Não contém acesso ao DOM ou persistência. As únicas regras clínicas aqui são as tabelas de referência (P50),
// a mediana do MAP, o P5 da força de preensão manual, os pontos de corte e as faixas de classificação fornecidos pela nutrição.
;(function exposeNutritionCalculations(root, factory) {
  const calculations = factory()

  if (typeof module === "object" && module.exports) {
    module.exports = calculations
  }

  if (root) {
    root.HuNefroNutritionCalculations = calculations
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict"

  // ---------- Critério de Classificação Econômica Brasil (CCEB / ABEP 2024, válido a partir de 27/06/2024) ----------
  // Pontos por quantidade possuída: índice 0 = não possui, 1, 2, 3 e 4 = "4 ou +".
  const CCEB_ITEMS = Object.freeze([
    Object.freeze({ key: "banheiro", label: "Banheiros", points: [0, 3, 7, 10, 14] }),
    Object.freeze({ key: "empregado", label: "Trabalhadores domésticos", points: [0, 3, 7, 10, 13] }),
    Object.freeze({ key: "automovel", label: "Automóveis", points: [0, 3, 5, 8, 11] }),
    Object.freeze({ key: "computador", label: "Microcomputador", points: [0, 3, 6, 8, 11] }),
    Object.freeze({ key: "lava-loucas", label: "Lava-louça", points: [0, 3, 6, 6, 6] }),
    Object.freeze({ key: "geladeira", label: "Geladeira", points: [0, 2, 3, 5, 5] }),
    Object.freeze({ key: "freezer", label: "Freezer", points: [0, 2, 4, 6, 6] }),
    Object.freeze({ key: "lava-roupa", label: "Lava-roupa", points: [0, 2, 4, 6, 6] }),
    Object.freeze({ key: "dvd", label: "DVD", points: [0, 1, 3, 4, 6] }),
    Object.freeze({ key: "microondas", label: "Micro-ondas", points: [0, 2, 4, 4, 4] }),
    Object.freeze({ key: "moto", label: "Motocicleta", points: [0, 1, 3, 3, 3] }),
    Object.freeze({ key: "secadora", label: "Secadora de roupa", points: [0, 2, 2, 2, 2] }),
  ])

  // Grau de instrução do chefe da família (quem contribui com a maior parte da renda do domicílio).
  const CCEB_EDUCATION = Object.freeze([
    Object.freeze({ value: "analfabeto-fundamental-1-incompleto", label: "Analfabeto / Fundamental I incompleto", points: 0 }),
    Object.freeze({ value: "fundamental-1-completo", label: "Fundamental I completo / Fundamental II incompleto", points: 1 }),
    Object.freeze({ value: "fundamental-2-completo", label: "Fundamental II completo / Médio incompleto", points: 2 }),
    Object.freeze({ value: "medio-completo", label: "Médio completo / Superior incompleto", points: 4 }),
    Object.freeze({ value: "superior-completo", label: "Superior completo", points: 7 }),
  ])

  const CCEB_PUBLIC_SERVICES = Object.freeze({ aguaEncanada: 4, ruaPavimentada: 2 })

  // Cortes do Critério Brasil e renda média domiciliar estimada de cada estrato (PNADC 2023).
  const CCEB_CLASSES = Object.freeze([
    Object.freeze({ code: "A", min: 45, max: 100, income: 26811.68 }),
    Object.freeze({ code: "B1", min: 38, max: 44, income: 12683.34 }),
    Object.freeze({ code: "B2", min: 29, max: 37, income: 7017.64 }),
    Object.freeze({ code: "C1", min: 23, max: 28, income: 3980.38 }),
    Object.freeze({ code: "C2", min: 17, max: 22, income: 2403.04 }),
    Object.freeze({ code: "DE", min: 0, max: 16, income: 1087.77 }),
  ])

  function ccebItemPoints(key, quantity) {
    const item = CCEB_ITEMS.find((entry) => entry.key === key)
    const count = Number(quantity)
    if (!item || quantity === null || quantity === undefined || quantity === "" || !Number.isFinite(count) || count < 0) return null
    return item.points[Math.min(4, Math.floor(count))]
  }

  function classifyCceb(points) {
    if (!Number.isFinite(points)) return null
    return CCEB_CLASSES.find((entry) => points >= entry.min && points <= entry.max) || null
  }

  // input: { items: { banheiro: 1, ... }, education: valor de CCEB_EDUCATION, aguaEncanada: bool, ruaPavimentada: bool }
  // Itens sem resposta ficam em `missing`; a classe só sai com o questionário completo.
  function calculateCceb(input = {}) {
    const items = input.items || {}
    const missing = []
    let points = 0
    CCEB_ITEMS.forEach((item) => {
      const itemPoints = ccebItemPoints(item.key, items[item.key])
      if (itemPoints === null) missing.push(item.label)
      else points += itemPoints
    })
    const education = CCEB_EDUCATION.find((entry) => entry.value === input.education)
    if (!education) missing.push("Grau de instrução do chefe da família")
    else points += education.points
    if (input.aguaEncanada) points += CCEB_PUBLIC_SERVICES.aguaEncanada
    if (input.ruaPavimentada) points += CCEB_PUBLIC_SERVICES.ruaPavimentada
    const complete = missing.length === 0
    return { points, complete, missing, classification: complete ? classifyCceb(points) : null }
  }

  const DURNIN_WOMERSLEY_COEFFICIENTS = Object.freeze([
    Object.freeze({
      minAge: 17,
      maxAge: 19,
      male: Object.freeze({ constant: 1.162, multiplier: 0.063 }),
      female: Object.freeze({ constant: 1.1549, multiplier: 0.0678 }),
    }),
    Object.freeze({
      minAge: 20,
      maxAge: 29,
      male: Object.freeze({ constant: 1.1631, multiplier: 0.0632 }),
      female: Object.freeze({ constant: 1.1599, multiplier: 0.0717 }),
    }),
    Object.freeze({
      minAge: 30,
      maxAge: 39,
      male: Object.freeze({ constant: 1.1422, multiplier: 0.0544 }),
      female: Object.freeze({ constant: 1.1423, multiplier: 0.0632 }),
    }),
    Object.freeze({
      minAge: 40,
      maxAge: 49,
      male: Object.freeze({ constant: 1.162, multiplier: 0.07 }),
      female: Object.freeze({ constant: 1.1333, multiplier: 0.0612 }),
    }),
    Object.freeze({
      minAge: 50,
      maxAge: Number.POSITIVE_INFINITY,
      male: Object.freeze({ constant: 1.1715, multiplier: 0.0779 }),
      female: Object.freeze({ constant: 1.1339, multiplier: 0.0645 }),
    }),
  ])

  // Referência P50 de CB (cm), PCT (mm) e CMB (cm) por faixa etária (anos completos) e sexo.
  // Fonte: tabelas da nutrição. A tabela de CB termina em 74 anos; acima disso não há referência.
  const row = (minAge, maxAge, male, female) =>
    Object.freeze({ minAge, maxAge, male, female })
  const ARM_REFERENCE_P50 = Object.freeze({
    armCircumferenceCm: Object.freeze([
      row(18, 24, 30.7, 26.8),
      row(25, 29, 31.8, 27.6),
      row(30, 34, 32.5, 28.6),
      row(35, 39, 32.9, 29.4),
      row(40, 44, 32.8, 29.7),
      row(45, 49, 32.6, 30.1),
      row(50, 54, 32.3, 30.6),
      row(55, 59, 32.3, 30.9),
      row(60, 64, 32, 30.8),
      row(65, 69, 31.1, 30.5),
      row(70, 74, 30.7, 30.3),
    ]),
    tricepsSkinfoldMm: Object.freeze([
      row(18, 24, 10, 18.5),
      row(25, 29, 11, 20),
      row(30, 34, 12, 22.5),
      row(35, 39, 12, 23.5),
      row(40, 44, 12, 24.5),
      row(45, 49, 12, 25.5),
      row(50, 54, 11.5, 25.5),
      row(55, 59, 11.5, 26),
      row(60, 69, 12.7, 24.1),
      row(70, 79, 12.4, 21.8),
      row(80, Number.POSITIVE_INFINITY, 11.2, 18.1),
    ]),
    armMuscleCircumferenceCm: Object.freeze([
      row(18, 18, 26.4, 20.2),
      row(19, 24, 27.3, 20.7),
      row(25, 34, 27.9, 21.2),
      row(35, 44, 28.6, 21.8),
      row(45, 54, 28.1, 22),
      row(55, 59, 27.8, 22.5),
      row(60, 69, 28.4, 23.5),
      row(70, 79, 27.2, 23),
      row(80, Number.POSITIVE_INFINITY, 25.7, 22.6),
    ]),
  })

  // FPM (kg): P5 da dinamometria por mão, sexo e faixa etária (anos completos); população brasileira, tabela da nutrição.
  // A tabela traz "> 60" e deixa os 60 anos sem faixa; aqui a última faixa vale de 60 anos em diante.
  // A tabela recebida não traz a faixa de 60 anos ou mais da mão não dominante, que fica sem referência.
  const HANDGRIP_P5_KG = Object.freeze({
    dominant: Object.freeze([
      row(18, 30, 30, 16),
      row(31, 59, 27, 16),
      row(60, Number.POSITIVE_INFINITY, 18, 11),
    ]),
    nonDominant: Object.freeze([row(18, 30, 30, 13), row(31, 59, 26, 10)]),
  })
  // Métrica da linha da ficha → mão na tabela.
  const HANDGRIP_METRICS = Object.freeze({
    handgripDominantKg: "dominant",
    handgripNonDominantKg: "nonDominant",
  })

  // MAP (mm): mediana de referência da ficha, por sexo.
  const ADDUCTOR_POLLICIS_REFERENCE_MM = Object.freeze({ male: 12, female: 10 })

  // Classificações por ponto de corte. `cutoff` é por sexo ({ male, female }) ou único (número).
  // `riskWhen`: "gte" marca o achado quando valor ≥ corte; "lt" quando valor < corte.
  // `digits`: casas com que o valor é exibido; a comparação usa o valor arredondado assim (o que o profissional vê).
  const cutoffRule = (cutoff, riskWhen, positive, negative, digits = null) =>
    Object.freeze({
      cutoff: typeof cutoff === "number" ? cutoff : Object.freeze(cutoff),
      riskWhen,
      positive,
      negative,
      digits,
    })
  const CUTOFF_CLASSIFICATIONS = Object.freeze({
    waistCm: cutoffRule(
      { male: 94, female: 80 },
      "gte",
      "Com risco de complicação metabólica associada à obesidade",
      "Sem risco de complicação metabólica associada à obesidade",
    ),
    waistHipRatio: cutoffRule(
      { male: 1, female: 0.85 },
      "gte",
      "Com risco de gordura abdominal, HAS, DM e dislipidemia",
      "Sem risco de gordura abdominal, HAS, DM e dislipidemia",
      2,
    ),
    thighCm: cutoffRule(
      { male: 56, female: 68 },
      "gte",
      "Com risco de DCV e mortalidade",
      "Sem risco de DCV e mortalidade",
    ),
    neckCm: cutoffRule(
      { male: 37, female: 34 },
      "gte",
      "Com risco de excesso de peso",
      "Sem risco de excesso de peso",
    ),
    calfCm: cutoffRule(31, "lt", "Com depleção muscular", "Sem depleção muscular"),
    sagittalAbdominalDiameterCm: cutoffRule(
      { male: 20.2, female: 21 },
      "gte",
      "Com excesso de gordura visceral",
      "Sem excesso de gordura visceral",
    ),
  })

  // % de gordura corporal por sexo e faixa etária (adaptada de Gallagher et al., 2000).
  // limites: [abaixo disto = desnutrição, a partir daqui = pré-obesidade, a partir daqui = obesidade]; entre o 1º e o 2º, eutrofia.
  const bodyFatBand = (minAge, maxAge, underBelow, preObesityFrom, obesityFrom) =>
    Object.freeze({ minAge, maxAge, underBelow, preObesityFrom, obesityFrom })
  const BODY_FAT_AGE_LIMITS = Object.freeze({ min: 20, max: 79 })
  const BODY_FAT_REFERENCE = Object.freeze({
    male: Object.freeze([
      bodyFatBand(20, 39, 8, 20, 25),
      bodyFatBand(40, 59, 11, 22, 28),
      bodyFatBand(60, 79, 13, 25, 30),
    ]),
    female: Object.freeze([
      bodyFatBand(20, 39, 21, 33, 39),
      bodyFatBand(40, 59, 23, 34, 40),
      bodyFatBand(60, 79, 24, 36, 42),
    ]),
  })

  function parseNumeric(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (value === null || value === undefined) return null

    const text = String(value).trim().replace(/\s/g, "")
    if (!text) return null

    const decimalComma = text.lastIndexOf(",")
    const decimalPoint = text.lastIndexOf(".")
    let normalized = text

    if (decimalComma >= 0 && decimalPoint >= 0) {
      normalized =
        decimalComma > decimalPoint
          ? text.replace(/\./g, "").replace(",", ".")
          : text.replace(/,/g, "")
    } else if (decimalComma >= 0) {
      normalized = text.replace(",", ".")
    }

    const number = Number(normalized)
    return Number.isFinite(number) ? number : null
  }

  function positiveNumber(value) {
    const number = parseNumeric(value)
    return number !== null && number > 0 ? number : null
  }

  function calculateBmi(weightKg, heightM) {
    const weight = positiveNumber(weightKg)
    const height = positiveNumber(heightM)
    if (weight === null || height === null) return null

    const result = weight / height ** 2
    return Number.isFinite(result) ? result : null
  }

  function calculateAverageWeight(weights) {
    if (!Array.isArray(weights)) return null
    const valid = weights.map(positiveNumber).filter((value) => value !== null)
    if (!valid.length) return null
    const sum = valid.reduce((total, value) => total + value, 0)
    const result = sum / valid.length
    return Number.isFinite(result) ? result : null
  }

  function calculateGpiPercentage(preWeight, dryWeight) {
    const pre = positiveNumber(preWeight)
    const dry = positiveNumber(dryWeight)
    if (pre === null || dry === null || dry <= 0) return null
    const result = ((pre - dry) / dry) * 100
    return Number.isFinite(result) ? result : null
  }

  function calculateAdequacy(measuredValue, p50Reference) {
    const measured = positiveNumber(measuredValue)
    const reference = positiveNumber(p50Reference)
    if (measured === null || reference === null) return null

    const result = (measured / reference) * 100
    return Number.isFinite(result) ? result : null
  }

  // Classificação pela % de adequação ao P50.
  // CB e PCT: depleção calórica grave < 70, moderada 70-80, leve 80-90; eutrofia 90-110, sobrepeso 110-120, obesidade > 120.
  // CMB: depleção proteica grave < 70, moderada 70-80, leve 80-90; eutrofia > 90 (a tabela não prevê excesso para a CMB).
  // Nos limites, o valor cai na faixa superior de depleção (70 → moderada, 80 → leve, 90 → eutrofia)
  // e na faixa inferior de excesso (110 → Eutrofia, 120 → Sobrepeso).
  function classifyArmAdequacy(percentage, metric = "armCircumferenceCm") {
    const value = parseNumeric(percentage)
    if (value === null || value < 0) return null
    const depletion =
      metric === "armMuscleCircumferenceCm"
        ? "Depleção proteica"
        : "Depleção calórica"
    if (value < 70) return `${depletion} grave`
    if (value < 80) return `${depletion} moderada`
    if (value < 90) return `${depletion} leve`
    if (metric === "armMuscleCircumferenceCm") return "Eutrofia"
    if (value <= 110) return "Eutrofia"
    if (value <= 120) return "Sobrepeso"
    return "Obesidade"
  }

  // Mediana de referência do MAP (mm) para o sexo; null se o sexo não for informado.
  function getAdductorPollicisReference(sex) {
    const referenceSex = normalizeReferenceSex(sex)
    return referenceSex === null
      ? null
      : ADDUCTOR_POLLICIS_REFERENCE_MM[referenceSex]
  }

  // % de adequação do MAP aferido à mediana de referência do sexo (MAP ÷ mediana × 100).
  function calculateAdductorPollicisAdequacy(mapMm, sex) {
    const reference = getAdductorPollicisReference(sex)
    return reference === null ? null : calculateAdequacy(mapMm, reference)
  }

  // Ausência de depleção a partir de 100%; leve 90-99%; moderada 60-90%; grave < 60%.
  // Nos limites o valor cai na faixa menos grave (90 → leve, 60 → moderada), como nas demais classificações.
  function classifyAdductorPollicisAdequacy(percentage) {
    const value = parseNumeric(percentage)
    if (value === null || value < 0) return null
    if (value < 60) return "Depleção grave"
    if (value < 90) return "Depleção moderada"
    if (value < 100) return "Depleção leve"
    return "Ausência de depleção"
  }

  // Faixa do P5 de FPM para a mão ("dominant" ou "nonDominant") e a idade; null se não houver referência.
  function getHandgripReferenceRow(hand, ageYears) {
    const table = HANDGRIP_P5_KG[hand]
    const age = parseNumeric(ageYears)
    if (!table || age === null || age < 0) return null

    const completedYears = Math.floor(age)
    return (
      table.find(
        ({ minAge, maxAge }) =>
          completedYears >= minAge && completedYears <= maxAge,
      ) || null
    )
  }

  // P5 (kg) da mão, da idade e do sexo; null sem referência.
  function getHandgripP5(hand, ageYears, sex) {
    const referenceSex = normalizeReferenceSex(sex)
    if (referenceSex === null) return null

    const range = getHandgripReferenceRow(hand, ageYears)
    return range ? range[referenceSex] : null
  }

  // Só pelo P5: abaixo do P5 = com risco de depleção; a partir do P5 = sem risco (o P5 em si fica sem risco).
  // Aceita 0 kg (sem força de preensão), que é uma medida válida e fica abaixo de qualquer P5.
  function classifyHandgrip(measuredValue, hand, ageYears, sex) {
    const measured = parseNumeric(measuredValue)
    const p5 = getHandgripP5(hand, ageYears, sex)
    if (measured === null || measured < 0 || p5 === null) return null
    return measured < p5 ? "Com risco de depleção" : "Sem risco de depleção"
  }

  // Ponto de corte da métrica para o sexo; null se a métrica não existir ou se faltar o sexo (quando o corte é por sexo).
  function getCutoff(metric, sex) {
    const rule = CUTOFF_CLASSIFICATIONS[metric]
    if (!rule) return null
    if (typeof rule.cutoff === "number") return rule.cutoff
    const referenceSex = normalizeReferenceSex(sex)
    return referenceSex === null ? null : rule.cutoff[referenceSex]
  }

  // Cintura, RCQ, coxa, pescoço, panturrilha e DAS: classificação pelo ponto de corte (≥ corte; panturrilha < corte).
  function classifyByCutoff(metric, measuredValue, sex) {
    const rule = CUTOFF_CLASSIFICATIONS[metric]
    const cutoff = getCutoff(metric, sex)
    const measured = positiveNumber(measuredValue)
    if (!rule || cutoff === null || measured === null) return null

    const value =
      rule.digits === null ? measured : Number(measured.toFixed(rule.digits))
    const flagged = rule.riskWhen === "lt" ? value < cutoff : value >= cutoff
    return flagged ? rule.positive : rule.negative
  }

  // Faixa da tabela de % de gordura para a idade (anos completos) e o sexo; null fora de 20 a 79 anos ou sem sexo.
  function getBodyFatReferenceBand(ageYears, sex) {
    const age = parseNumeric(ageYears)
    const referenceSex = normalizeReferenceSex(sex)
    if (age === null || referenceSex === null) return null

    const completedYears = Math.floor(age)
    return (
      BODY_FAT_REFERENCE[referenceSex].find(
        ({ minAge, maxAge }) =>
          completedYears >= minAge && completedYears <= maxAge,
      ) || null
    )
  }

  // Desnutrição, eutrofia, pré-obesidade ou obesidade pela % de gordura. Limite inferior de cada faixa inclusivo
  // (ex.: homens de 20 a 39 anos: 8 → eutrofia, 20 → pré-obesidade, 25 → obesidade).
  function classifyBodyFat(percentage, ageYears, sex) {
    const value = parseNumeric(percentage)
    const band = getBodyFatReferenceBand(ageYears, sex)
    if (value === null || band === null) return null

    if (value < band.underBelow) return "Desnutrição"
    if (value < band.preObesityFrom) return "Eutrofia"
    if (value < band.obesityFrom) return "Pré-obesidade"
    return "Obesidade"
  }

  function calculateArmMuscleCircumference(
    armCircumferenceCm,
    tricepsSkinfoldMm,
  ) {
    const armCircumference = positiveNumber(armCircumferenceCm)
    const tricepsSkinfold = positiveNumber(tricepsSkinfoldMm)
    if (armCircumference === null || tricepsSkinfold === null) return null

    const result = armCircumference - (Math.PI * tricepsSkinfold) / 10
    return Number.isFinite(result) && result > 0 ? result : null
  }

  function calculatePediatricSkinfoldSum(
    tricepsSkinfoldMm,
    subscapularSkinfoldMm,
  ) {
    const triceps = positiveNumber(tricepsSkinfoldMm)
    const subscapular = positiveNumber(subscapularSkinfoldMm)
    if (triceps === null || subscapular === null) return null

    const result = triceps + subscapular
    return Number.isFinite(result) ? result : null
  }

  function calculatePediatricArmMuscleCircumference(
    armCircumferenceCm,
    tricepsSkinfoldMm,
  ) {
    const armCircumference = positiveNumber(armCircumferenceCm)
    const tricepsSkinfold = positiveNumber(tricepsSkinfoldMm)
    if (armCircumference === null || tricepsSkinfold === null) return null

    const result = armCircumference - 0.314 * tricepsSkinfold
    return Number.isFinite(result) && result > 0 ? result : null
  }

  function calculateWaistHipRatio(waistCm, hipCm) {
    const waist = positiveNumber(waistCm)
    const hip = positiveNumber(hipCm)
    if (waist === null || hip === null) return null

    const result = waist / hip
    return Number.isFinite(result) ? result : null
  }

  function normalizeReferenceSex(sex) {
    const normalized = String(sex || "")
      .trim()
      .toLocaleLowerCase("pt-BR")

    if (["m", "masculino", "male"].includes(normalized)) return "male"
    if (["f", "feminino", "female"].includes(normalized)) return "female"
    return null
  }

  function parseDate(value) {
    if (!value) return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    const text = String(value).trim()
    const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (brMatch) {
      const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T00:00:00`)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const fallback = new Date(text)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  function calculateAgeInMonths(birthDate, evaluationDate) {
    const birth = parseDate(birthDate)
    const evaluation = parseDate(evaluationDate)
    if (!birth || !evaluation || evaluation < birth) return null

    let months =
      (evaluation.getFullYear() - birth.getFullYear()) * 12 +
      (evaluation.getMonth() - birth.getMonth())
    if (evaluation.getDate() < birth.getDate()) {
      months -= 1
    }

    return months >= 0 ? months : null
  }

  function calculateAgeAtDate(birthDate, evaluationDate) {
    const months = calculateAgeInMonths(birthDate, evaluationDate)
    return months === null ? null : Math.floor(months / 12)
  }

  // 1. Limite de Faixa Etária: 0 a 17 anos e 11 meses (0 a 215 meses). A partir dos 18 anos (>= 216 meses), desativa ou direciona para adultos.
  function isPediatricPatient(birthDate, referenceDate) {
    const months = calculateAgeInMonths(birthDate, referenceDate)
    return months !== null && months >= 0 && months <= 215
  }

  // Matriz JSON de parâmetros LMS (CDC/NCHS / Frisancho) para o limite máximo de 215 meses (< 18 anos)
  const PEDIATRIC_LMS_DATA = Object.freeze({
    metadata: Object.freeze({
      source: "CDC/NCHS Growth Charts (2000) & Frisancho (1990)",
      unit_age: "months",
      max_age_months: 215,
      description:
        "Parâmetros LMS para métricas antropométricas pediátricas estritamente para a faixa etária de 0 a 17 anos e 11 meses (< 18 anos).",
    }),
    metrics: Object.freeze({
      height_for_age: Object.freeze({
        label: "Estatura / idade (m)",
        unit: "m",
        male: Object.freeze([
          Object.freeze({ age_months: 24, L: 1.0, M: 0.8682, S: 0.036 }),
          Object.freeze({ age_months: 215, L: 1.0, M: 1.761, S: 0.041 }),
        ]),
        female: Object.freeze([
          Object.freeze({ age_months: 24, L: 1.0, M: 0.8553, S: 0.037 }),
          Object.freeze({ age_months: 215, L: 1.0, M: 1.631, S: 0.04 }),
        ]),
      }),
      dry_weight_for_age: Object.freeze({
        label: "Peso seco / idade (kg)",
        unit: "kg",
        male: Object.freeze([
          Object.freeze({ age_months: 24, L: -0.28, M: 12.54, S: 0.108 }),
          Object.freeze({ age_months: 215, L: -0.83, M: 68.2, S: 0.168 }),
        ]),
        female: Object.freeze([
          Object.freeze({ age_months: 24, L: -0.35, M: 11.98, S: 0.11 }),
          Object.freeze({ age_months: 215, L: -0.9, M: 56.4, S: 0.178 }),
        ]),
      }),
      bmi_for_age: Object.freeze({
        label: "IMC / idade (kg/m²)",
        unit: "kg/m²",
        male: Object.freeze([
          Object.freeze({ age_months: 24, L: -1.97, M: 16.57, S: 0.0801 }),
          Object.freeze({ age_months: 215, L: -2.43, M: 22.4, S: 0.13 }),
        ]),
        female: Object.freeze([
          Object.freeze({ age_months: 24, L: -2.01, M: 16.32, S: 0.082 }),
          Object.freeze({ age_months: 215, L: -2.48, M: 21.4, S: 0.142 }),
        ]),
      }),
      arm_circ_for_age: Object.freeze({
        label: "Circunferência do braço / idade (cm)",
        unit: "cm",
        male: Object.freeze([{ age_months: 215, L: -0.5, M: 26.5, S: 0.11 }]),
        female: Object.freeze([{ age_months: 215, L: -0.5, M: 25.8, S: 0.12 }]),
      }),
      triceps_skinfold_for_age: Object.freeze({
        label: "PCT / idade (mm)",
        unit: "mm",
        male: Object.freeze([{ age_months: 215, L: -0.8, M: 12.5, S: 0.28 }]),
        female: Object.freeze([{ age_months: 215, L: -0.8, M: 18.0, S: 0.26 }]),
      }),
      subscapular_skinfold_for_age: Object.freeze({
        label: "PCSE / idade (mm)",
        unit: "mm",
        male: Object.freeze([{ age_months: 215, L: -0.9, M: 10.2, S: 0.3 }]),
        female: Object.freeze([{ age_months: 215, L: -0.9, M: 14.5, S: 0.32 }]),
      }),
      sum_skinfolds_for_age: Object.freeze({
        label: "Soma PCT + PCSE (mm)",
        unit: "mm",
        male: Object.freeze([{ age_months: 215, L: -0.85, M: 22.7, S: 0.29 }]),
        female: Object.freeze([
          { age_months: 215, L: -0.85, M: 32.5, S: 0.28 },
        ]),
      }),
      arm_muscle_circ_for_age: Object.freeze({
        label: "CMB / idade (cm)",
        unit: "cm",
        male: Object.freeze([{ age_months: 215, L: 1.0, M: 22.5, S: 0.09 }]),
        female: Object.freeze([{ age_months: 215, L: 1.0, M: 20.1, S: 0.095 }]),
      }),
    }),
  })

  // Matriz JSON de parâmetros LMS do CDC para Peso por Altura (0 a 60 meses, 45 cm a 121,5 cm)
  const WEIGHT_FOR_STATURE_DATA = Object.freeze({
    valid_ranges: Object.freeze({
      length_cm_min: 45.0,
      length_cm_max: 121.5,
      age_months_max: 60,
    }),
    male: Object.freeze([
      Object.freeze({ stature_cm: 45.0, L: 0.582, M: 2.45, S: 0.089 }),
      Object.freeze({ stature_cm: 70.0, L: -0.12, M: 8.52, S: 0.081 }),
      Object.freeze({ stature_cm: 100.0, L: -0.45, M: 15.6, S: 0.092 }),
      Object.freeze({ stature_cm: 121.5, L: -0.68, M: 22.8, S: 0.105 }),
    ]),
    female: Object.freeze([
      Object.freeze({ stature_cm: 45.0, L: 0.612, M: 2.41, S: 0.091 }),
      Object.freeze({ stature_cm: 70.0, L: -0.15, M: 8.28, S: 0.083 }),
      Object.freeze({ stature_cm: 100.0, L: -0.48, M: 15.25, S: 0.095 }),
      Object.freeze({ stature_cm: 121.5, L: -0.71, M: 22.1, S: 0.108 }),
    ]),
  })

  // Matriz LMS de Estatura por Idade (CDC/NCHS) para busca de Idade Estatural (mediana M = estatura)
  const HEIGHT_AGE_LOOKUP_DATA = Object.freeze({
    male: Object.freeze([
      Object.freeze({ age_months: 12, M_stature_cm: 75.74 }),
      Object.freeze({ age_months: 24, M_stature_cm: 86.82 }),
      Object.freeze({ age_months: 36, M_stature_cm: 95.1 }),
      Object.freeze({ age_months: 48, M_stature_cm: 102.3 }),
      Object.freeze({ age_months: 60, M_stature_cm: 109.2 }),
      Object.freeze({ age_months: 120, M_stature_cm: 138.4 }),
      Object.freeze({ age_months: 215, M_stature_cm: 176.1 }),
    ]),
    female: Object.freeze([
      Object.freeze({ age_months: 12, M_stature_cm: 74.24 }),
      Object.freeze({ age_months: 24, M_stature_cm: 85.53 }),
      Object.freeze({ age_months: 36, M_stature_cm: 94.0 }),
      Object.freeze({ age_months: 48, M_stature_cm: 101.6 }),
      Object.freeze({ age_months: 60, M_stature_cm: 108.4 }),
      Object.freeze({ age_months: 120, M_stature_cm: 138.1 }),
      Object.freeze({ age_months: 215, M_stature_cm: 163.1 }),
    ]),
  })

  function getWeightForStatureLms(statureCm, sex) {
    const referenceSex = normalizeReferenceSex(sex)
    if (!referenceSex) return null

    let h = parseNumeric(statureCm)
    if (h === null || h <= 0) return null
    if (h <= 3) h = h * 100

    const ranges = WEIGHT_FOR_STATURE_DATA.valid_ranges
    if (h < ranges.length_cm_min || h > ranges.length_cm_max) {
      return null
    }

    const points = WEIGHT_FOR_STATURE_DATA[referenceSex]
    if (!points || !points.length) return null

    if (h <= points[0].stature_cm) {
      return Object.freeze({ L: points[0].L, M: points[0].M, S: points[0].S })
    }
    const last = points[points.length - 1]
    if (h >= last.stature_cm) {
      return Object.freeze({ L: last.L, M: last.M, S: last.S })
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      if (h >= p1.stature_cm && h <= p2.stature_cm) {
        const span = p2.stature_cm - p1.stature_cm
        const t = span === 0 ? 0 : (h - p1.stature_cm) / span
        return Object.freeze({
          L: p1.L + t * (p2.L - p1.L),
          M: p1.M + t * (p2.M - p1.M),
          S: p1.S + t * (p2.S - p1.S),
        })
      }
    }
    return null
  }

  function calculateWeightForStature({ weightKg, statureCm, ageMonths, sex }) {
    const weight = positiveNumber(weightKg)
    let stature = positiveNumber(statureCm)
    if (stature !== null && stature <= 3) {
      stature = stature * 100
    }
    const age = parseNumeric(ageMonths)

    const ranges = WEIGHT_FOR_STATURE_DATA.valid_ranges

    // Regra: Para crianças de 0 a 60 meses (comprimento/estatura entre 45 cm e 121,5 cm)
    // Para idades/estaturas acima desse limite, exiba a mensagem ou estado indicando "Recomendado uso de IMC por Idade"
    const ageAboveLimit = age !== null && age > ranges.age_months_max
    const statureAboveLimit = stature !== null && stature > ranges.length_cm_max
    const statureBelowLimit = stature !== null && stature < ranges.length_cm_min

    if (ageAboveLimit || statureAboveLimit || statureBelowLimit) {
      return Object.freeze({
        outOfRange: true,
        message: "Recomendado uso de IMC por Idade",
        zScore: null,
        percentile: null,
      })
    }

    if (weight === null || stature === null || age === null) {
      return Object.freeze({
        outOfRange: false,
        message: "",
        zScore: null,
        percentile: null,
      })
    }

    const lms = getWeightForStatureLms(stature, sex)
    if (!lms) {
      return Object.freeze({
        outOfRange: false,
        message: "",
        zScore: null,
        percentile: null,
      })
    }

    const zScore = calculateLmsZScore(weight, lms)
    const percentile = zScore !== null ? zScoreToPercentile(zScore) : null

    return Object.freeze({
      outOfRange: false,
      message: "",
      zScore,
      percentile,
    })
  }

  function classifyWeightForStature(percentile, zScore, outOfRange = false) {
    if (outOfRange) {
      return "Recomendado uso de IMC por Idade"
    }
    const p = parseNumeric(percentile)
    const z = parseNumeric(zScore)
    if (p === null && z === null) return ""

    const perc = p !== null ? p : zScoreToPercentile(z)
    if (perc === null) return ""

    if (perc < 0.1) return "Magreza acentuada"
    if (perc < 3) return "Magreza"
    if (perc <= 85) return "Eutrofia"
    if (perc <= 97) return "Risco de sobrepeso"
    return "Obesidade"
  }

  function calculateHeightAgeMonths(statureCm, sex) {
    const referenceSex = normalizeReferenceSex(sex)
    if (!referenceSex) return null

    let h = positiveNumber(statureCm)
    if (h === null) return null
    if (h <= 3) h = h * 100

    const points = HEIGHT_AGE_LOOKUP_DATA[referenceSex]
    if (!points || !points.length) return null

    if (h <= points[0].M_stature_cm) {
      const birthStature = referenceSex === "male" ? 50.0 : 49.3
      if (h <= birthStature) return 0
      const span = points[0].M_stature_cm - birthStature
      const t = (h - birthStature) / span
      const months = t * points[0].age_months
      return Math.max(0, Math.min(215, months))
    }

    const last = points[points.length - 1]
    if (h >= last.M_stature_cm) {
      return last.age_months
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      if (h >= p1.M_stature_cm && h <= p2.M_stature_cm) {
        const span = p2.M_stature_cm - p1.M_stature_cm
        const t = span === 0 ? 0 : (h - p1.M_stature_cm) / span
        const months = p1.age_months + t * (p2.age_months - p1.age_months)
        return Math.max(0, Math.min(215, months))
      }
    }

    return null
  }

  function formatHeightAge(ageMonths) {
    const num = parseNumeric(ageMonths)
    if (num === null || num < 0) return ""
    const totalMonths = Math.round(num)
    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12

    const yearsStr = `${years} ${years === 1 ? "ano" : "anos"}`
    const monthsStr = `${months} ${months === 1 ? "mês" : "meses"}`

    if (years > 0 && months > 0) {
      return `${yearsStr} e ${monthsStr}`
    }
    if (years > 0) {
      return yearsStr
    }
    return monthsStr
  }

  function calculateAndFormatHeightAge(statureCm, sex) {
    const months = calculateHeightAgeMonths(statureCm, sex)
    return months !== null ? formatHeightAge(months) : ""
  }

  function getPediatricLmsParameters(metricKey, ageMonths, sex) {
    const referenceSex = normalizeReferenceSex(sex)
    if (
      !referenceSex ||
      ageMonths === null ||
      ageMonths === undefined ||
      ageMonths < 0 ||
      ageMonths > 215
    ) {
      return null
    }

    const metric = PEDIATRIC_LMS_DATA.metrics[metricKey]
    if (!metric) return null

    const points = metric[referenceSex]
    if (!points || !points.length) return null

    if (points.length === 1) {
      return Object.freeze({ L: points[0].L, M: points[0].M, S: points[0].S })
    }

    if (ageMonths <= points[0].age_months) {
      return Object.freeze({ L: points[0].L, M: points[0].M, S: points[0].S })
    }

    const last = points[points.length - 1]
    if (ageMonths >= last.age_months) {
      return Object.freeze({ L: last.L, M: last.M, S: last.S })
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      if (ageMonths >= p1.age_months && ageMonths <= p2.age_months) {
        const span = p2.age_months - p1.age_months
        const t = span === 0 ? 0 : (ageMonths - p1.age_months) / span
        return Object.freeze({
          L: p1.L + t * (p2.L - p1.L),
          M: p1.M + t * (p2.M - p1.M),
          S: p1.S + t * (p2.S - p1.S),
        })
      }
    }

    return null
  }

  // Escore-Z pelo método LMS:
  // Se L != 0: Z = [ (X / M)^L - 1 ] / (L * S)
  // Se L == 0: Z = ln(X / M) / S
  function calculateLmsZScore(x, lms) {
    const value = positiveNumber(x)
    if (value === null || !lms || !lms.M || !lms.S) return null

    let z
    if (Math.abs(lms.L) < 1e-7) {
      z = Math.log(value / lms.M) / lms.S
    } else {
      z = (Math.pow(value / lms.M, lms.L) - 1) / (lms.L * lms.S)
    }

    return Number.isFinite(z) ? z : null
  }

  function calculatePediatricZScore(metricKey, measuredValue, ageMonths, sex) {
    let x = positiveNumber(measuredValue)
    if (x === null) return null

    if (metricKey === "height_for_age" && x > 3) {
      x = x / 100
    }

    const lms = getPediatricLmsParameters(metricKey, ageMonths, sex)
    if (!lms) return null

    return calculateLmsZScore(x, lms)
  }

  // Função erro (Abramowitz & Stegun 7.1.26)
  function erf(x) {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    const absX = Math.abs(x)
    const t = 1.0 / (1.0 + p * absX)
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-absX * absX)
    return sign * y
  }

  // Converte Escore-Z no Percentil acumulado correspondente (0 a 100)
  function zScoreToPercentile(z) {
    const num = parseNumeric(z)
    if (num === null) return null
    const cdf = 0.5 * (1 + erf(num / Math.SQRT2))
    const p = cdf * 100
    return Math.max(0.01, Math.min(99.99, p))
  }

  // Algoritmo de Peter J. Acklam para inversa da normal (Percentil -> Escore-Z)
  function percentileToZScore(percentile) {
    const num = parseNumeric(percentile)
    if (num === null || num <= 0 || num >= 100) return null
    const prob = num / 100

    const a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ]
    const b = [
      -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1,
    ]
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ]
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
      3.754408661907416,
    ]

    const pLow = 0.02425
    const pHigh = 1 - pLow
    let z

    if (prob < pLow) {
      const q = Math.sqrt(-2 * Math.log(prob))
      z =
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    } else if (prob <= pHigh) {
      const q = prob - 0.5
      const r = q * q
      z =
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r +
          a[5]) *
          q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - prob))
      z =
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    }

    return Number.isFinite(z) ? z : null
  }

  function classifyPediatricMetric(metricKey, percentile, zScore) {
    const p = parseNumeric(percentile)
    const z = parseNumeric(zScore)
    if (p === null && z === null) return ""

    const perc = p !== null ? p : zScoreToPercentile(z)
    if (perc === null) return ""

    if (metricKey === "height_for_age") {
      if (perc < 0.1) return "Muito baixa estatura"
      if (perc < 3) return "Baixa estatura para a idade"
      if (perc <= 97) return "Estatura adequada"
      return "Alta estatura"
    }

    if (metricKey === "dry_weight_for_age") {
      if (perc < 0.1) return "Muito baixo peso"
      if (perc < 3) return "Baixo peso para a idade"
      if (perc < 10) return "Risco de baixo peso"
      if (perc <= 85) return "Peso adequado"
      if (perc <= 97) return "Sobrepeso"
      return "Peso elevado para a idade"
    }

    if (metricKey === "bmi_for_age") {
      if (perc < 0.1) return "Magreza acentuada"
      if (perc < 3) return "Magreza"
      if (perc <= 85) return "Eutrofia"
      if (perc <= 97) return "Sobrepeso"
      return "Obesidade"
    }

    if (metricKey === "weight_for_stature") {
      return classifyWeightForStature(perc, z, false)
    }

    // Soma PCT + PCSE com ênfase direta em percentual de gordura corporal
    if (metricKey === "sum_skinfolds_for_age") {
      if (perc < 5) return "Percentual de gordura muito baixo (depleção grave)"
      if (perc < 15) return "Percentual de gordura baixo (risco de depleção)"
      if (perc <= 85) return "Percentual de gordura adequado (eutrofia)"
      if (perc <= 95) return "Percentual de gordura elevado (sobrepeso)"
      return "Percentual de gordura excessivo (obesidade)"
    }

    // CMB com ênfase em massa muscular
    if (metricKey === "arm_muscle_circ_for_age") {
      if (perc < 5) return "Depleção proteica grave"
      if (perc < 15) return "Risco de depleção proteica"
      if (perc <= 85) return "Eutrofia muscular"
      if (perc <= 95) return "Musculatura desenvolvida"
      return "Hipertrofia muscular"
    }

    // Dobras cutâneas individuais (PCT / PCSE) e circunferência do braço
    if (perc < 5) return "Depleção grave"
    if (perc < 15) return "Risco de depleção"
    if (perc <= 85) return "Eutrofia"
    if (perc <= 95) return "Sobrepeso"
    return "Obesidade"
  }

  function generatePediatricAnthropometricDiagnosis(quarterMetrics = {}) {
    const bmiP = parseNumeric(quarterMetrics.bmiPercentile)
    const heightP = parseNumeric(quarterMetrics.heightPercentile)
    const weightP = parseNumeric(quarterMetrics.weightPercentile)
    const armMuscleP = parseNumeric(quarterMetrics.armMusclePercentile)
    const skinfoldSumP = parseNumeric(quarterMetrics.skinfoldSumPercentile)
    const wfsP = parseNumeric(quarterMetrics.weightForStaturePercentile)
    const isWfsOutOfRange = Boolean(quarterMetrics.weightForStatureOutOfRange)
    const heightAgeStr = quarterMetrics.heightAgeFormatted || ""
    const ageMonths = parseNumeric(quarterMetrics.ageMonths)

    let status = ""

    // Para crianças de 0 a 60 meses, considerar Peso por Altura se estiver na faixa
    const isUnder5 = ageMonths !== null && ageMonths <= 60
    if (isUnder5 && wfsP !== null && !isWfsOutOfRange) {
      if (wfsP < 0.1) status = "Magreza acentuada (peso por altura)"
      else if (wfsP < 3) status = "Magreza (baixo peso para a altura)"
      else if (wfsP <= 85) status = "Eutrofia (peso adequado para a altura)"
      else if (wfsP <= 97) status = "Risco de sobrepeso"
      else status = "Obesidade"
    } else if (bmiP !== null) {
      if (bmiP < 0.1) status = "Magreza acentuada"
      else if (bmiP < 3) status = "Magreza"
      else if (bmiP <= 85) status = "Eutrofia"
      else if (bmiP <= 97) status = "Sobrepeso"
      else status = "Obesidade"
    } else if (weightP !== null) {
      if (weightP < 0.1) status = "Muito baixo peso para a idade"
      else if (weightP < 3) status = "Baixo peso para a idade"
      else if (weightP < 10) status = "Risco de baixo peso"
      else if (weightP <= 85) status = "Eutrofia"
      else if (weightP <= 97) status = "Sobrepeso"
      else status = "Obesidade"
    }

    if (!status && wfsP !== null && !isWfsOutOfRange) {
      if (wfsP < 0.1) status = "Magreza acentuada (peso por altura)"
      else if (wfsP < 3) status = "Magreza (baixo peso para a altura)"
      else if (wfsP <= 85) status = "Eutrofia (peso adequado para a altura)"
      else if (wfsP <= 97) status = "Risco de sobrepeso"
      else status = "Obesidade"
    }

    if (!status) return ""

    let heightStatus = ""
    if (heightP !== null) {
      if (heightP < 0.1) heightStatus = "muito baixa estatura para a idade"
      else if (heightP < 3) heightStatus = "baixa estatura para a idade"
      else if (heightP <= 97) heightStatus = "estatura adequada para a idade"
      else heightStatus = "alta estatura para a idade"
    }

    if (heightAgeStr) {
      if (heightStatus) {
        heightStatus += ` (idade estatural: ${heightAgeStr})`
      } else {
        heightStatus = `idade estatural de ${heightAgeStr}`
      }
    }

    const compStatus = []
    if (armMuscleP !== null) {
      if (armMuscleP < 5) compStatus.push("depleção muscular grave")
      else if (armMuscleP < 15) compStatus.push("risco de depleção muscular")
    }

    if (skinfoldSumP !== null) {
      if (skinfoldSumP < 5) compStatus.push("percentual de gordura muito baixo")
      else if (skinfoldSumP < 15) compStatus.push("percentual de gordura baixo")
      else if (skinfoldSumP > 95) compStatus.push("percentual de gordura excessivo")
      else if (skinfoldSumP > 85) compStatus.push("percentual de gordura elevado")
    }

    let result = status
    if (heightStatus) result += ` com ${heightStatus}`
    if (compStatus.length > 0) result += ` e ${compStatus.join(" e ")}`
    return result
  }

  function generatePediatricNutritionalDiagnosis(quarterMetrics = {}) {
    const bmiP = parseNumeric(quarterMetrics.bmiPercentile)
    const weightP = parseNumeric(quarterMetrics.weightPercentile)
    const armMuscleP = parseNumeric(quarterMetrics.armMusclePercentile)

    const p = bmiP !== null ? bmiP : weightP
    if (p === null) return ""

    if (p < 0.1) return "Desnutrição proteico-calórica grave"
    if (p < 3) return "Desnutrição proteico-calórica moderada"
    if (p < 10) return "Risco de desnutrição proteico-calórica"
    if (p <= 85) {
      if (armMuscleP !== null && armMuscleP < 5) {
        return "Eutrofia com depleção proteica"
      }
      return "Eutrofia nutricional"
    }
    if (p <= 97) return "Sobrepeso"
    return "Obesidade"
  }

  function getArmReferenceRow(metric, ageYears) {
    const table = ARM_REFERENCE_P50[metric]
    const age = parseNumeric(ageYears)
    if (!table || age === null || age < 0) return null

    const completedYears = Math.floor(age)
    return (
      table.find(
        ({ minAge, maxAge }) =>
          completedYears >= minAge && completedYears <= maxAge,
      ) || null
    )
  }

  function getArmReferenceP50(metric, ageYears, sex) {
    const referenceSex = normalizeReferenceSex(sex)
    if (referenceSex === null) return null

    const range = getArmReferenceRow(metric, ageYears)
    return range ? range[referenceSex] : null
  }

  // % de adequação de CB, PCT ou CMB ao P50 da idade e do sexo (medida ÷ P50 × 100).
  function calculateArmReferenceAdequacy(metric, measuredValue, ageYears, sex) {
    const p50 = getArmReferenceP50(metric, ageYears, sex)
    return p50 === null ? null : calculateAdequacy(measuredValue, p50)
  }

  function getDurninWomersleyCoefficients(ageYears, sex) {
    const age = parseNumeric(ageYears)
    const referenceSex = normalizeReferenceSex(sex)
    if (
      age === null ||
      !Number.isInteger(age) ||
      age < 17 ||
      referenceSex === null
    ) {
      return null
    }

    const range = DURNIN_WOMERSLEY_COEFFICIENTS.find(
      ({ minAge, maxAge }) => age >= minAge && age <= maxAge,
    )
    return range ? range[referenceSex] : null
  }

  function calculateFourSkinfoldBodyFat({
    tricepsMm,
    subscapularMm,
    bicepsMm,
    suprailiacMm,
    ageYears,
    sex,
  }) {
    const skinfolds = [
      positiveNumber(tricepsMm),
      positiveNumber(subscapularMm),
      positiveNumber(bicepsMm),
      positiveNumber(suprailiacMm),
    ]
    if (skinfolds.some((value) => value === null)) return null

    const coefficients = getDurninWomersleyCoefficients(ageYears, sex)
    if (!coefficients) return null

    const sum = skinfolds.reduce((total, value) => total + value, 0)
    if (sum <= 0) return null

    const density =
      coefficients.constant - coefficients.multiplier * Math.log10(sum)
    if (!Number.isFinite(density) || density <= 0) return null

    const bodyFatPercentage = 495 / density - 450
    if (!Number.isFinite(bodyFatPercentage)) return null

    return Object.freeze({
      sum,
      density,
      bodyFatPercentage,
    })
  }

  return Object.freeze({
    DURNIN_WOMERSLEY_COEFFICIENTS,
    parseNumeric,
    calculateBmi,
    calculateAverageWeight,
    calculateGpiPercentage,
    ARM_REFERENCE_P50,
    calculateAdequacy,
    classifyArmAdequacy,
    HANDGRIP_P5_KG,
    HANDGRIP_METRICS,
    getHandgripReferenceRow,
    getHandgripP5,
    classifyHandgrip,
    ADDUCTOR_POLLICIS_REFERENCE_MM,
    getAdductorPollicisReference,
    calculateAdductorPollicisAdequacy,
    classifyAdductorPollicisAdequacy,
    CUTOFF_CLASSIFICATIONS,
    getCutoff,
    classifyByCutoff,
    BODY_FAT_AGE_LIMITS,
    BODY_FAT_REFERENCE,
    getBodyFatReferenceBand,
    classifyBodyFat,
    getArmReferenceRow,
    getArmReferenceP50,
    calculateArmReferenceAdequacy,
    calculateArmMuscleCircumference,
    calculatePediatricSkinfoldSum,
    calculatePediatricArmMuscleCircumference,
    calculateWaistHipRatio,
    normalizeReferenceSex,
    calculateAgeAtDate,
    isPediatricPatient,
    getDurninWomersleyCoefficients,
    calculateFourSkinfoldBodyFat,
    parseDate,
    calculateAgeInMonths,
    PEDIATRIC_LMS_DATA,
    getPediatricLmsParameters,
    calculateLmsZScore,
    calculatePediatricZScore,
    erf,
    zScoreToPercentile,
    percentileToZScore,
    classifyPediatricMetric,
    generatePediatricAnthropometricDiagnosis,
    generatePediatricNutritionalDiagnosis,
    WEIGHT_FOR_STATURE_DATA,
    HEIGHT_AGE_LOOKUP_DATA,
    getWeightForStatureLms,
    calculateWeightForStature,
    classifyWeightForStature,
    calculateHeightAgeMonths,
    formatHeightAge,
    calculateAndFormatHeightAge,
    CCEB_ITEMS,
    CCEB_EDUCATION,
    CCEB_PUBLIC_SERVICES,
    CCEB_CLASSES,
    ccebItemPoints,
    classifyCceb,
    calculateCceb,
  })
})
