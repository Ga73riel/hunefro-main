// Catálogo de medicamentos da nefrologia e regras de cálculo usadas em Medicações, nas receitas e no LME.
//
// PROVISÓRIO: o catálogo virá da API (cadastro do administrador / farmácia). A classificação de cada
// medicamento decide em qual receituário ele sai:
//   control: "C1"  -> Receita de Controle Especial (Portaria SVS/MS 344/1998, alterada pela RDC 1.000/2025)
//   anticonvulsant -> limite de 6 meses de tratamento por receita, em vez de 60 dias (Portaria 344/1998, art. 59)
//   control: "B1" ou "A" -> exige Notificação de Receita numerada pela Vigilância Sanitária (não é impressa pelo sistema)
//   antimicrobial  -> receita em 2 vias com retenção, validade de 10 dias (RDC 471/2021)
//   ceaf           -> protocolo do Componente Especializado (LME)
// Depende de js/componentes.js.
(() => {
  "use strict"

  const { normalize, addDays } = window.HuNefroUI

  // Formas farmacêuticas: singular, plural e gênero (para escrever a quantidade por extenso).
  const FORMS = {
    comprimido: ["comprimido", "comprimidos", "m"],
    capsula: ["cápsula", "cápsulas", "f"],
    ampola: ["ampola", "ampolas", "f"],
    frasco: ["frasco-ampola", "frascos-ampola", "m"],
    frascoMl: ["frasco", "frascos", "m"],
  }

  // Protocolos do CEAF usados pela nefrologia. CIDs conforme os PCDT do Ministério da Saúde: Anemia na DRC
  // (Portaria SAS/MS 365/2017: N18.0, N18.8) e DMO na DRC (Portaria Conjunta 15/2022: N18.2 a N18.5, N25.0).
  // Validade dos exames (dias) segundo os guias estaduais do CEAF. Confirmar com a farmácia do estado.
  const PROTOCOLS = {
    anemia: {
      name: "Anemia na doença renal crônica",
      cids: ["N18.0", "N18.8"],
      cid: "N18.0",
      exams: [["Hemoglobina", 30, "g/dL"], ["Ferritina", 90, "ng/mL"], ["Saturação da transferrina", 90, "%"], ["Creatinina", 180, "mg/dL"]],
      documents: "Hemoglobina (até 30 dias), ferritina e saturação da transferrina (até 90 dias), creatinina/TFG (até 180 dias), prescrição médica, cópia de documento com foto, CPF, Cartão SUS e comprovante de residência.",
    },
    dmo: {
      name: "Distúrbio mineral e ósseo na doença renal crônica",
      cids: ["N18.2", "N18.3", "N18.4", "N18.5", "N25.0"],
      cid: "N18.5",
      exams: [["Fósforo", 30, "mg/dL"], ["Cálcio", 30, "mg/dL"], ["PTH", 90, "pg/mL"], ["Creatinina", 180, "mg/dL"]],
      documents: "Fósforo e cálcio (até 30 dias), PTH (até 90 dias), creatinina/TFG (até 180 dias), prescrição médica, Termo de Esclarecimento e Responsabilidade, cópia de documento com foto, CPF, Cartão SUS e comprovante de residência.",
    },
  }

  // name: como aparece na tela. dcb: denominação genérica usada na impressão (quando difere do nome).
  // lme: nome e apresentação como constam no CEAF.
  const DRUGS = [
    { name: "Ácido fólico 5 mg", form: "comprimido" },
    { name: "Alopurinol 100 mg", form: "comprimido" },
    { name: "Amitriptilina 25 mg", dcb: "Cloridrato de amitriptilina 25 mg", form: "comprimido", control: "C1" },
    { name: "Amoxicilina 500 mg", form: "capsula", antimicrobial: true },
    { name: "Anlodipino 5 mg", dcb: "Besilato de anlodipino 5 mg", form: "comprimido" },
    { name: "Atorvastatina 20 mg", form: "comprimido" },
    { name: "Calcitriol 0,25 mcg", form: "capsula", ceaf: "dmo", lme: "Calcitriol 0,25 mcg (cápsula)" },
    { name: "Carbonato de Cálcio 500 mg", dcb: "Carbonato de cálcio 500 mg", form: "comprimido" },
    { name: "Carvedilol 6,25 mg", form: "comprimido" },
    { name: "Cefalexina 500 mg", form: "capsula", antimicrobial: true },
    { name: "Cefazolina 1 g", form: "frasco", antimicrobial: true },
    { name: "Cinacalcete 30 mg", dcb: "Cloridrato de cinacalcete 30 mg", form: "comprimido", ceaf: "dmo", lme: "Cinacalcete 30 mg (comprimido)" },
    { name: "Cinacalcete 60 mg", dcb: "Cloridrato de cinacalcete 60 mg", form: "comprimido", ceaf: "dmo", lme: "Cinacalcete 60 mg (comprimido)" },
    { name: "Ciprofloxacino 500 mg", form: "comprimido", antimicrobial: true },
    { name: "Clonazepam 2 mg", form: "comprimido", control: "B1" },
    { name: "Clonidina 0,1 mg", form: "comprimido" },
    { name: "Colecalciferol 7.000 UI", form: "capsula" },
    { name: "Diazepam 10 mg", form: "comprimido", control: "B1" },
    { name: "Enoxaparina 40 mg", dcb: "Enoxaparina sódica 40 mg", form: "ampola" },
    { name: "Eritropoetina 2000 UI", dcb: "Alfaepoetina 2.000 UI", form: "frasco", ceaf: "anemia", lme: "Alfaepoetina 2.000 UI (injetável)" },
    { name: "Eritropoetina 4000 UI", dcb: "Alfaepoetina 4.000 UI", form: "frasco", ceaf: "anemia", lme: "Alfaepoetina 4.000 UI (injetável)" },
    { name: "Eritropoetina 10000 UI", dcb: "Alfaepoetina 10.000 UI", form: "frasco", ceaf: "anemia", lme: "Alfaepoetina 10.000 UI (injetável)" },
    { name: "Furosemida 40 mg", form: "comprimido" },
    { name: "Gabapentina 300 mg", form: "capsula", control: "C1", anticonvulsant: true },
    { name: "Haloperidol 5 mg", form: "comprimido", control: "C1" },
    { name: "Heparina 5000 UI/mL", dcb: "Heparina sódica 5.000 UI/mL", form: "frascoMl" },
    { name: "Hidralazina 25 mg", form: "comprimido" },
    { name: "Losartana 50 mg", dcb: "Losartana potássica 50 mg", form: "comprimido" },
    { name: "Omeprazol 20 mg", form: "capsula" },
    { name: "Paricalcitol 5 mcg/mL", form: "ampola", ceaf: "dmo", lme: "Paricalcitol 5 mcg/mL (ampola de 1 mL)" },
    { name: "Pregabalina 75 mg", form: "capsula", control: "C1", anticonvulsant: true },
    { name: "Sacarato de Hidróxido de Ferro 100 mg", dcb: "Sacarato de hidróxido férrico 100 mg", form: "ampola", ceaf: "anemia", lme: "Sacarato de hidróxido férrico 100 mg (injetável)" },
    { name: "Sertralina 50 mg", dcb: "Cloridrato de sertralina 50 mg", form: "comprimido", control: "C1" },
    { name: "Sevelamer 800 mg", dcb: "Cloridrato de sevelâmer 800 mg", form: "comprimido", ceaf: "dmo", lme: "Sevelâmer 800 mg (comprimido)" },
    { name: "Sulfametoxazol + Trimetoprima 400/80 mg", dcb: "Sulfametoxazol 400 mg + trimetoprima 80 mg", form: "comprimido", antimicrobial: true },
    { name: "Vancomicina 1 g", dcb: "Cloridrato de vancomicina 1 g", form: "frasco", antimicrobial: true },
  ]

  const POSOLOGIES = [
    "1 comprimido VO 1x ao dia", "1 comprimido VO de 12/12h", "1 comprimido VO de 8/8h", "1 comprimido VO à noite",
    "1 comprimido VO junto às refeições principais", "1 cápsula VO 1x ao dia", "1 cápsula VO de 8/8h", "1 cápsula VO 1x por semana",
    "1 ampola EV na sessão de HD", "1 ampola EV 1x por semana na sessão de HD", "SC 3x por semana pós-HD", "1 g EV após cada sessão de HD",
  ]

  const find = (name) => DRUGS.find((d) => normalize(d.name) === normalize(String(name || "").trim())) || null
  const formOf = (drug) => FORMS[find(drug)?.form] || FORMS.comprimido

  // ---------- Posologia ----------
  // Vias, na ordem em que aparecem na receita.
  const ROUTES = [
    ["oral", "Uso oral", /\b(vo|oral|via oral)\b/],
    ["sc", "Uso subcutâneo", /\b(sc|subcut)/],
    ["ev", "Uso endovenoso", /\b(ev|iv|endoven|intraven)/],
    ["im", "Uso intramuscular", /\b(im|intramusc)/],
    ["topico", "Uso tópico", /\b(topic|tópic)/],
  ]
  function route(posology) {
    const text = normalize(posology)
    return ROUTES.find(([, , rx]) => rx.test(text)) || ["outro", "Outras vias", null]
  }

  // Unidades por tomada ("2 comprimidos ...", "1 ampola ..."). Sem número: 1.
  function unitsPerDose(posology) {
    const match = normalize(posology).match(/^\s*(\d+(?:[.,]\d+)?)\s*(comprimid|capsul|ampol|frasco|unidade|cp|cps)/)
    return match ? Number(match[1].replace(",", ".")) : 1
  }

  // Tomadas por dia lidas da posologia. hdPerWeek: sessões de HD por semana do paciente.
  function dosesPerDay(posology, hdPerWeek = 3) {
    const text = normalize(posology)
    let m
    if ((m = text.match(/(\d+)\s*\/\s*(\d+)\s*h/))) return 24 / Number(m[2])
    if ((m = text.match(/(\d+)\s*x\s*(ao|por)\s*dia/))) return Number(m[1])
    if ((m = text.match(/(\d+)\s*x\s*por\s*semana/))) return Number(m[1]) / 7
    if (/semanal/.test(text)) return 1 / 7
    if (/sessao|sessoes|hd|hemodialise/.test(text)) return hdPerWeek / 7
    if (/refeic/.test(text)) return 3
    if (/a noite|ao deitar|pela manha|em jejum/.test(text)) return 1
    return 1
  }

  // Texto impresso por extenso: a receita deve ser redigida sem abreviações (Lei 5.991/1973, art. 35, I).
  const SPELLED_OUT = [
    [/\bVO\b/g, "por via oral"],
    [/\bSC\b/g, "por via subcutânea"],
    [/\b(EV|IV)\b/g, "por via endovenosa"],
    [/\bIM\b/g, "por via intramuscular"],
    [/\b(\d+)\s*\/\s*(\d+)\s*h\b/g, "$1 em $2 horas"],
    [/\b(\d+)\s*x\b/g, (_, n) => `${n} ${Number(n) === 1 ? "vez" : "vezes"}`],
    [/\bpós-HD\b/g, "após a hemodiálise"],
    [/\bHD\b/g, "hemodiálise"],
    [/(\d+(?:,\d+)?)\s*mcg\b/g, (_, n) => `${n} ${Number(n.replace(",", ".")) < 2 ? "micrograma" : "microgramas"}`],
  ]
  function spelledOut(text) {
    const out = SPELLED_OUT.reduce((acc, [rx, by]) => acc.replace(rx, by), String(text || ""))
    return out.charAt(0).toUpperCase() + out.slice(1)
  }

  // ---------- Tipo de uso: contínuo, por tempo ou por dose ----------
  const USAGE = [["continuo", "Uso contínuo"], ["tempo", "Por tempo determinado"], ["dose", "Por número de doses"]]
  const DURATION_UNITS = [["dias", 1, "dia", "dias"], ["semanas", 7, "semana", "semanas"], ["meses", 30, "mês", "meses"]]
  const durationDays = (med) => (Number(med.duration) || 0) * (DURATION_UNITS.find(([v]) => v === med.durationUnit)?.[1] || 1)
  const DAYS_PER_RECEIPT = 30 // a receita de uso contínuo cobre 30 dias

  // Data da n-ésima sessão de HD a partir de start (inclusive). hdDays: dias da semana (0 = domingo).
  function nthHdDate(start, n, hdDays) {
    if (!hdDays?.length || !n) return ""
    let date = start
    let count = 0
    for (let i = 0; i < 400; i += 1) {
      const [y, mo, d] = date.split("-").map(Number)
      if (hdDays.includes(new Date(y, mo - 1, d).getDay())) count += 1
      if (count === n) return date
      date = addDays(date, 1)
    }
    return ""
  }

  // Último dia de uso previsto (vazio no uso contínuo).
  function endDate(med, { hdDays = [] } = {}) {
    if (!med.date) return ""
    if (med.usage === "tempo" && durationDays(med) > 0) return addDays(med.date, durationDays(med) - 1)
    if (med.usage === "dose" && Number(med.doses) > 0) {
      const doses = Number(med.doses)
      const perDay = dosesPerDay(med.posology, hdDays.length || 3)
      // Uma dose a cada sessão de HD: conta as sessões pelos dias de HD do paciente.
      if (med.hd && hdDays.length && Math.abs(perDay - hdDays.length / 7) < 1e-9) return nthHdDate(med.date, doses, hdDays)
      return addDays(med.date, perDay >= 1 ? Math.ceil(doses / perDay) - 1 : Math.round((doses - 1) / perDay))
    }
    return ""
  }

  // Quantidade a dispensar (unidades da forma farmacêutica).
  function suggestedQuantity(med, { hdPerWeek = 3 } = {}) {
    if (!med.posology) return ""
    const perDose = unitsPerDose(med.posology)
    if (med.usage === "dose") return Number(med.doses) > 0 ? Math.ceil(Number(med.doses) * perDose) : ""
    const days = med.usage === "tempo" ? durationDays(med) : DAYS_PER_RECEIPT
    if (!days) return ""
    return Math.ceil(dosesPerDay(med.posology, hdPerWeek) * perDose * days)
  }
  // Quantidade mensal (LME).
  const monthlyQuantity = (med, opts) => suggestedQuantity({ ...med, usage: "continuo" }, opts)

  function usageLabel(med, opts) {
    const end = endDate(med, opts)
    const until = end ? ` (até ${end.split("-").reverse().join("/")})` : ""
    if (med.usage === "tempo") {
      const unit = DURATION_UNITS.find(([v]) => v === med.durationUnit) || DURATION_UNITS[0]
      return `Por ${med.duration} ${Number(med.duration) === 1 ? unit[2] : unit[3]}${until}`
    }
    if (med.usage === "dose") return `${med.doses} ${Number(med.doses) === 1 ? "dose" : "doses"}${until}`
    return "Uso contínuo"
  }

  function quantityLabel(med) {
    const n = Number(med.qty)
    if (!n) return ""
    const [one, many] = formOf(med.drug)
    return `${n} ${n === 1 ? one : many}`
  }

  // ---------- Número por extenso (exigido na Receita de Controle Especial) ----------
  const UNITS_M = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
  const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
  const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

  function below1000(n, feminine) {
    const unit = (u) => (feminine && u === 1 ? "uma" : feminine && u === 2 ? "duas" : UNITS_M[u])
    if (n === 100) return "cem"
    const parts = []
    const h = Math.floor(n / 100)
    const rest = n % 100
    if (h) parts.push(feminine ? HUNDREDS[h].replace(/os$/, "as") : HUNDREDS[h])
    if (rest) parts.push(rest < 20 ? unit(rest) : [TENS[Math.floor(rest / 10)], rest % 10 ? unit(rest % 10) : ""].filter(Boolean).join(" e "))
    return parts.join(" e ")
  }

  function numberToWords(value, feminine = false) {
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n < 0 || n > 999999) return ""
    if (n === 0) return "zero"
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const parts = []
    if (thousands) parts.push(thousands === 1 ? "mil" : `${below1000(thousands, false)} mil`)
    if (rest) parts.push(below1000(rest, feminine))
    const glue = thousands && rest && (rest < 100 || rest % 100 === 0) ? " e " : " "
    return parts.join(glue)
  }

  // "60 (sessenta) comprimidos"
  function quantityInWords(med) {
    const n = Number(med.qty)
    if (!n) return ""
    const [one, many, gender] = formOf(med.drug)
    return `${n} (${numberToWords(n, gender === "f")}) ${n === 1 ? one : many}`
  }

  window.HuNefroMedicamentos = {
    DRUGS, POSOLOGIES, PROTOCOLS, USAGE, DURATION_UNITS,
    find, formOf, route, unitsPerDose, dosesPerDay, endDate, suggestedQuantity, monthlyQuantity,
    usageLabel, quantityLabel, quantityInWords, numberToWords, spelledOut,
  }
})()
