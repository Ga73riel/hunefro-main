// Padrões e funções auxiliares do "Novo registro" da História Clínica e Evolução.
//
// Padrões (PROVISÓRIO: no futuro o administrador poderá cadastrar outros modelos): cada um monta o texto com os dados
// do prontuário, lidos das outras abas pela API pública delas. Dado que não existe no prontuário sai como [preencher].
// Escala de Morse: versão adaptada para o português (Urbanetto et al., 2013), com a classificação de risco usada no Brasil.
(() => {
  "use strict"

  const { formatDate, todayIso, addDays } = window.HuNefroUI
  const BLANK = "[preencher]"
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
  // Unidades dos exames mais citados (os resultados são texto livre e podem já trazer a unidade).
  const UNITS = {
    "Hemoglobina": "g/dL", "Hematócrito": "%", "Ureia pré-diálise": "mg/dL", "Ureia pós-diálise": "mg/dL", "URR (%)": "%", "Sódio": "mEq/L",
    "Potássio": "mEq/L", "Cálcio": "mg/dL", "Fósforo": "mg/dL", "TGP": "U/L", "Glicose": "mg/dL", "Creatinina": "mg/dL", "Ferritina": "ng/mL",
    "Saturação da transferrina": "%", "Ferro sérico": "mcg/dL", "Albumina": "g/dL", "Proteínas totais": "g/dL", "Globulina": "g/dL",
    "Fosfatase alcalina": "U/L", "Hemoglobina glicada": "%", "PTH": "pg/mL", "25-Hidroxivitamina D": "ng/mL",
  }
  // Não entram na lista de exames laboratoriais (do hemograma ficam hemoglobina, hematócrito, leucócitos e plaquetas).
  const NOT_LAB = new Set(["Hemácias", "VCM", "HCM", "CHCM", "RDW", "Neutrófilos", "Bastonetes", "Segmentados", "Linfócitos", "Linfócitos atípicos", "Monócitos",
    "Eosinófilos", "Basófilos", "Promielócitos", "Mielócitos", "Metamielócitos", "Prolinfócitos", "Plasmócitos", "Blastos", "VPM", "Risco de queda", "IMC", "Altura", "Peso", "Peso seco BIA (NH)", "CB", "CP", "CC", "CQ", "Prega cutânea tricipital", "PCB", "PCSI", "PCSE",
    "Peso ideal", "Adequação do peso (%)", "Adequação da CB (%)", "Adequação da PCT (%)", "CMB", "Adequação da CMB (%)", "Percentual de gordura", "RCQ"])

  const num = (v) => String(v ?? "").replace(".", ",")
  const lines = (...parts) => parts.flat(Infinity).filter((p) => p !== null && p !== undefined && p !== false).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  const bullets = (items, empty) => (items.length ? items : [empty]).map((t) => `- ${t}`)
  const listPt = (items) => items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : items[0] || ""
  const withUnit = (name, result) => {
    const unit = UNITS[name]
    return unit && /^[\d.,\s]+$/.test(String(result)) ? `${num(result)}${unit === "%" ? "%" : ` ${unit}`}` : num(result)
  }
  const patientId = () => Number(new URLSearchParams(location.search).get("patient")) || 0

  // ---------- Dados do prontuário para os padrões ----------
  function labExams(date) {
    const all = (window.HuNefroExames?.getData() || []).filter((x) => !NOT_LAB.has(x.name) && x.source !== "nutricao" && x.date <= date)
    const collection = all.map((x) => x.date).sort().at(-1) || ""
    const previous = (x) => all.filter((p) => p.name === x.name && p.date < x.date).sort((a, b) => b.date.localeCompare(a.date))[0]
    const items = all.filter((x) => x.date === collection).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((x) => {
      const prev = previous(x)
      return `${x.name.replace(" (%)", "")}: ${withUnit(x.name, x.result)}${prev ? ` (anterior ${withUnit(x.name, prev.result)} em ${formatDate(prev.date)})` : ""}`
    })
    const short = all.filter((x) => x.date === collection).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((x) => `${x.name.replace(" (%)", "")} ${withUnit(x.name, x.result)}`)
    return { collection, items, short }
  }

  function routinePending() {
    return (window.HuNefroExames?.schedule() || []).flatMap((p) => p.items
      .filter((i) => !i.when && ["danger", "off"].includes(i.status.tone))
      .map((i) => `${i.name}: ${p.label.toLowerCase()}, ${i.status.tone === "off" ? "sem registro" : i.status.label.replace(/[()]/g, "").toLowerCase()}`))
  }

  const preHdPressure = (s) => s.measures?.[0]?.pa || ""
  function meanPressure(sessions) {
    const values = sessions.map(preHdPressure).map((pa) => pa.match(/^(\d+)\s*[/x]\s*(\d+)$/)).filter(Boolean)
    if (!values.length) return ""
    const avg = (i) => Math.round(values.reduce((sum, m) => sum + Number(m[i]), 0) / values.length)
    return `${avg(1)}/${avg(2)} mmHg`
  }

  function monthSessions(date) {
    const from = addDays(date, -30)
    const sessions = (window.HuNefroSessoesDialise?.getData() || []).filter((s) => s.state === "concluida" && s.date > from && s.date <= date)
    const absences = (window.HuNefroFaltasStore?.forPatient(patientId()) || []).filter((a) => a.kind !== "remarcacao" && a.date > from && a.date <= date)
    const ufs = sessions.map((s) => Number(s.uf)).filter((n) => Number.isFinite(n) && n > 0)
    return {
      from, count: sessions.length, absences,
      pressure: meanPressure(sessions),
      uf: ufs.length ? `${Math.round(ufs.reduce((a, b) => a + b, 0) / ufs.length)} mL` : "",
      complications: sessions.filter((s) => s.complications).map((s) => `${formatDate(s.date)}: ${s.complications}`),
    }
  }

  // Contexto dos Laudos (identificação, programa, prescrição de HD, acesso, problemas, medicações) mais os dados do mês.
  function context(date = todayIso()) {
    const base = window.HuNefroLaudos?.context(date)
    if (!base) return null
    return { ...base, lab: labExams(date), month: monthSessions(date), pending: routinePending() }
  }

  // ---------- Textos comuns ----------
  const accessText = (a) => `${a.type}${a.loc ? `, ${a.loc.toLowerCase()}` : ""}${a.date ? `, desde ${a.dateBr}` : ""}`
  const hdRoutine = (ctx) => {
    const days = ctx.hdDayNames.length ? ` (${listPt(ctx.hdDayNames)})` : ""
    return `${ctx.perWeek}x por semana${days}${ctx.shift ? `, ${ctx.shift}º turno` : ""}`
  }
  const hdPrescription = (h) => [
    h.method, h.dialyzer && `dialisador ${h.dialyzer}`, h.durationText, h.bloodFlow && `Qb ${h.bloodFlow} mL/min`,
    h.dialysateFlow && `Qd ${h.dialysateFlow} mL/min`, h.dryWeight && `peso seco ${num(h.dryWeight)} kg`,
  ].filter(Boolean).join(", ")
  // Paciente em hemodiálise: tem dias de HD no Programa de Tratamento.
  const onHd = (ctx) => ctx.hdDays.length > 0
  const diagnoses = (ctx) => [
    onHd(ctx) ? "DRC estádio 5 em hemodiálise (CID-10 N18.0)" : "Doença renal crônica",
    ctx.etiology && `Doença de base: ${ctx.etiology}${ctx.baseCid ? ` (CID-10 ${ctx.baseCid})` : ""}`,
    ...ctx.problems,
  ].filter(Boolean)
  const labBlock = (ctx, title) => [
    `${title}${ctx.lab.collection ? ` - coleta de ${formatDate(ctx.lab.collection)}` : ""}:`,
    bullets(ctx.lab.items, "Sem exames laboratoriais registrados."),
  ]

  // ---------- Padrões ----------
  const PATTERNS = [
    {
      id: "exames",
      name: "Exames laborat",
      hint: "Resultados da última coleta com o valor anterior e os exames da rotina em atraso",
      build: (ctx) => lines(
        labBlock(ctx, "EXAMES LABORATORIAIS"),
        ctx.pending.length ? ["", "Rotina de exames em atraso ou sem registro:", bullets(ctx.pending)] : null,
        "",
        `Avaliação dos exames: ${BLANK}`,
        `Conduta: ${BLANK}`,
      ),
    },
    {
      id: "enc-vascular",
      name: "enc. vascular",
      hint: "Encaminhamento à Cirurgia Vascular com o acesso atual e o histórico",
      build(ctx) {
        const a = ctx.activeAccess
        const reason = !a ? "confecção de acesso vascular para hemodiálise"
          : a.kind === "cateter" ? "confecção de acesso vascular definitivo (fístula arteriovenosa)"
            : ctx.accessProblem ? "avaliação de disfunção da fístula arteriovenosa" : "avaliação da fístula arteriovenosa"
        return lines(
          `ENCAMINHAMENTO À CIRURGIA VASCULAR: encaminhad${ctx.female ? "a" : "o"} para ${reason}.`,
          `Acesso atual: ${a ? accessText(a) : "sem acesso vascular ativo registrado"}.`,
          ctx.previousAccesses.length ? ["Acessos anteriores:", bullets(ctx.previousAccesses)] : "Sem acessos anteriores registrados.",
          ctx.accessEvents.length ? ["Intercorrências recentes do acesso:", bullets(ctx.accessEvents)] : null,
          onHd(ctx) ? `Hemodiálise: ${hdRoutine(ctx)}${ctx.hd.bloodFlow ? `, Qb ${ctx.hd.bloodFlow} mL/min` : ""}.` : `Programa atual: ${ctx.program || BLANK}.`,
          ctx.allergies.length ? `Alergias: ${ctx.allergies.join(", ")}.` : "Sem alergias registradas.",
          `Observações: ${BLANK}`,
        )
      },
    },
    {
      id: "evolucao-mensal",
      name: "EVOLUÇÃO MENSAL",
      hint: "Resumo do mês: programa, prescrição de HD, sessões, acesso, exames e medicações",
      build(ctx) {
        const [, m, y] = ctx.dateBr.split("/")
        const mo = ctx.month
        const sessions = [
          `${mo.count} ${mo.count === 1 ? "sessão realizada" : "sessões realizadas"}`,
          `${mo.absences.length} ${mo.absences.length === 1 ? "falta" : "faltas"}${mo.absences.length ? ` (${mo.absences.map((a) => `${formatDate(a.date)} - ${a.reason.toLowerCase()}`).join("; ")})` : ""}`,
          mo.pressure && `PA pré-HD média ${mo.pressure}`,
          mo.uf && `UF média ${mo.uf}`,
          ctx.gid && `ganho interdialítico médio ${num(ctx.gid)}`,
        ].filter(Boolean)
        return lines(
          `EVOLUÇÃO MENSAL - ${MONTHS[Number(m) - 1]}/${y}`,
          onHd(ctx)
            ? `${ctx.name}${ctx.age !== null ? `, ${ctx.age} anos` : ""}, em hemodiálise${ctx.programStart ? ` desde ${ctx.programStart}` : ""}, ${hdRoutine(ctx)}.`
            : `${ctx.name}${ctx.age !== null ? `, ${ctx.age} anos` : ""}. Programa atual: ${ctx.program || BLANK}.`,
          "",
          "Diagnósticos:",
          bullets(diagnoses(ctx)),
          "",
          onHd(ctx) ? `Prescrição de HD: ${hdPrescription(ctx.hd) || "sem prescrição registrada"}.` : null,
          `Acesso vascular: ${ctx.activeAccess ? accessText(ctx.activeAccess) : "sem acesso ativo registrado"}${ctx.accessEvents.length ? `. Última intercorrência: ${ctx.accessEvents[0].replace(/\.$/, "")}` : ""}.`,
          onHd(ctx) ? [
            `Últimos 30 dias (${formatDate(addDays(mo.from, 1))} a ${ctx.dateBr}): ${sessions.join("; ")}.`,
            mo.complications.length ? ["Intercorrências nas sessões:", bullets(mo.complications)] : "Sem intercorrências registradas nas sessões.",
          ] : null,
          "",
          ctx.lab.collection && ctx.lab.collection > ctx.month.from
            ? `Exames do mês (coleta de ${formatDate(ctx.lab.collection)}): ${ctx.lab.short.join("; ")}.`
            : "Exames do mês: sem coleta registrada nos últimos 30 dias.",
          "",
          "Medicações em uso:",
          bullets(ctx.meds, "Sem medicações em uso registradas."),
          ctx.allergies.length ? `Alergias: ${ctx.allergies.join(", ")}.` : null,
          "",
          `Queixas e exame físico: ${BLANK}`,
          `Avaliação: ${BLANK}`,
          `Conduta: ${BLANK}`,
        )
      },
    },
  ]

  // ---------- Escala de Morse ----------
  // yesNo: item de sim ou não (caixa de seleção). options: [rótulo, pontos].
  const MORSE = [
    { key: "historico", label: "Histórico de quedas", yesNo: 25 },
    { key: "diagnostico", label: "Diagnóstico secundário", yesNo: 15 },
    { key: "deambulacao", label: "Auxílio na deambulação", options: [
      ["Nenhum / acamado / auxiliado por profissional de saúde", 0], ["Muletas / bengala / andador", 15], ["Mobiliário / parede", 30]] },
    { key: "endovenosa", label: "Terapia endovenosa / dispositivo endovenoso salinizado ou heparinizado", yesNo: 20 },
    { key: "marcha", label: "Marcha", options: [["Normal / sem deambulação / acamado / cadeira de rodas", 0], ["Fraca", 10], ["Comprometida / cambaleante", 20]] },
    { key: "mental", label: "Estado mental", options: [["Orientado / capaz quanto à sua capacidade / limitação", 0], ["Superestima capacidade / esquece limitações", 15]] },
  ]
  const MORSE_RISKS = [[45, "alto", "danger"], [25, "médio", "warn"], [0, "baixo", "ok"]]

  const morsePoints = (item, answer) => item.yesNo ? (answer ? item.yesNo : 0) : item.options[Number(answer) || 0][1]
  // answers: { historico: true, deambulacao: 1, ... } (sim/não ou índice da opção).
  function morseScore(answers) {
    const score = MORSE.reduce((sum, item) => sum + morsePoints(item, answers[item.key]), 0)
    const [, risk, tone] = MORSE_RISKS.find(([min]) => score >= min)
    return { score, risk, tone }
  }
  function morseText(answers) {
    const { score, risk } = morseScore(answers)
    const items = MORSE.map((item) => {
      const answer = item.yesNo ? (answers[item.key] ? "sim" : "não") : item.options[Number(answers[item.key]) || 0][0].toLowerCase()
      return `${item.label}: ${answer} (${morsePoints(item, answers[item.key])})`
    })
    return `Risco de queda (Escala de Morse): ${score} pontos - ${risk} risco. ${items.join("; ")}.`
  }

  // Padrões cadastrados na Gestão (js/gestao-store.js).
  PATTERNS.push(...(window.HuNefroAdmin?.customPatterns() || []))

  window.HuNefroEvolucaoModelos = {
    PATTERNS,
    find: (id) => PATTERNS.find((p) => p.id === id) || null,
    context,
    MORSE,
    morseScore,
    morseText,
  }
})()
