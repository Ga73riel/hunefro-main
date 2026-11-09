// Aba Prescrição e Tratamento / Sessões de Diálise (histórico das sessões de HD do paciente).
// As sessões são iniciadas e concluídas na tela Sessões do dia (sessoes-do-dia.html); aqui ficam o histórico
// e as correções (Alterar/Excluir), gravadas ao clicar em Salvar.
// Depende de js/catalogos.js, js/componentes.js e js/dados-mock.js (sessões provisórias até existir a API).
// Sem box de HDF (removido conforme o manual).
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, createSelectWithOther, markDirty, parseNumber, isCatheterAccess, NEEDLE_NOT_APPLICABLE } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const store = window.HuNefroSessoesStore
  const faltas = window.HuNefroFaltasStore
  const $ = (id) => document.getElementById(id)
  if (!$("sd-tbody")) return
  const patientId = Number(new URLSearchParams(location.search).get("patient")) || 1

  const opts = (list) => list.map((v) => [v, v])
  // PROVISÓRIAS: listas copiadas da tela de Prescrição de HD / manual; turnos e salas dependem do cadastro da unidade.
  const METHODS = opts(["Hemodiálise", "Hemodiálise Pediátrica"]) // a unidade só trabalha com HD e HD pediátrica
  const DIALYZERS = opts(window.HuNefroAdmin?.dialyzerNames?.() || ["B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR", "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4"])
  const SOLUTIONS = opts(["Acetato", "Bicarbonato", "Padrão", "Solução C/ Glic", "Solução C/ Potá", "Solução Modific", "Solução S/ Potá"])
  const SHIFTS = opts(window.HuNefroMock?.SHIFTS || ["1º Turno", "2º Turno", "3º Turno"]) // os 3 turnos da unidade
  // Reúso do dialisador: limite de 20 usos por dialisador (o aviso aparece em toda sessão).
  const MAX_DIALYZER_USES = store.MAX_DIALYZER_USES
  const SALINE = [["300", "300 mL"], ["500", "500 mL"]]

  // Faixas só barram erro de digitação (PROVISÓRIAS; confirmar com a equipe). Pesos em kg.
  const GROUPS = [
    ["Identificação da sessão", [
      { key: "date", label: "Data", kind: "date", req: true, cls: "ph-f3" },
      { key: "start", label: "Início (hh:mm)", kind: "time", req: true, cls: "ph-f3" },
      { key: "end", label: "Fim (hh:mm)", kind: "time", req: true, cls: "ph-f3" },
      { key: "number", label: "Nº da diálise (automático)", kind: "auto", cls: "ph-f3" },
      { key: "room", label: "Sala", kind: "text", cls: "ph-f3" },
      { key: "shift", label: "Turno", kind: "select", options: SHIFTS, cls: "ph-f3" },
      { key: "machine", label: "Máquina", kind: "text", cls: "ph-f3" },
      { key: "responsible", label: "Responsável", kind: "select", options: C.professionalOptions(), cls: "ph-f3" },
    ]],
    ["Parâmetros da sessão", [
      { key: "method", label: "Método de tratamento", kind: "select", options: METHODS, cls: "ph-f3" },
      { key: "dialyzer", label: "Dialisador", kind: "select", options: DIALYZERS, other: "Outro dialisador", cls: "ph-f3" },
      { key: "newDialyzer", label: "Dialisador novo nesta sessão", kind: "check", cls: "ph-f3" },
      { key: "usage", label: "Uso atual do dialisador (automático)", kind: "auto", cls: "ph-f3" },
      { key: "usageMax", label: "Uso máximo do dialisador", kind: "auto", cls: "ph-f3" },
      { key: "priming", label: "Priming zero do dialisador (mL)", kind: "number", min: 0, max: 5000, unit: "mL", cls: "ph-f3" },
      { key: "solution", label: "Solução", kind: "select", options: SOLUTIONS, cls: "ph-f3" },
      { key: "access", label: "Acesso", kind: "access", cls: "ph-f6" },
      { key: "needle", label: "Agulha (FAV ou enxerto)", kind: "text", cls: "ph-f3" },
      { key: "heparin", label: "Heparina (UI)", kind: "number", min: 0, max: 50000, unit: "UI", cls: "ph-f3" },
      { key: "bloodFlow", label: "Fluxo de sangue (mL/min)", kind: "number", min: 0, max: 600, unit: "mL/min", cls: "ph-f3" },
      { key: "dialysateFlow", label: "Fluxo de dialisato (mL/min)", kind: "number", min: 0, max: 1000, unit: "mL/min", cls: "ph-f3" },
      { key: "bicarbonate", label: "Bicarbonato (mEq/L)", kind: "number", min: 0, max: 60, unit: "mEq/L", cls: "ph-f3" },
      { key: "bathTemp", label: "Temperatura do banho (°C)", kind: "number", min: 30, max: 40, unit: "°C", cls: "ph-f3" },
      { key: "ufProfile", label: "Perfil de UF", kind: "text", cls: "ph-f3" },
      { key: "naBase", label: "Sódio: base (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
      { key: "naConc", label: "Sódio: concentração (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
      { key: "naProfile", label: "Sódio: perfil", kind: "text", cls: "ph-f3" },
      { key: "naInitial", label: "Sódio: inicial (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
    ]],
    ["Pesos e ultrafiltração", [
      { key: "dryWeight", label: "Peso seco (kg)", kind: "number", min: 1, max: 400, unit: "kg", cls: "ph-f3" },
      // Soro da devolução: uma única vez, ao final da HD, para devolver o sangue do circuito ao paciente.
      { key: "extra", label: "Soro da devolução ao final (mL)", kind: "select", options: SALINE, empty: "Nenhum", cls: "ph-f3" },
      { key: "weightStart", label: "Peso inicial (kg)", kind: "number", min: 1, max: 400, unit: "kg", req: true, cls: "ph-f3" },
      { key: "weightEnd", label: "Peso final (kg)", kind: "number", min: 1, max: 400, unit: "kg", req: true, cls: "ph-f3" },
      { key: "uf", label: "UF (mL)", kind: "number", min: 0, max: 10000, unit: "mL", req: true, cls: "ph-f3" },
    ]],
    ["Complicações e observações", [
      { key: "complications", label: "Complicações / medicações", kind: "text", cls: "ph-f12" },
      { key: "notes", label: "Observações", kind: "textarea", cls: "ph-f12" },
    ]],
  ]
  const FIELDS = GROUPS.flatMap(([, f]) => f)
  const MEASURE_FIELDS = [
    { key: "time", label: "Hora (hh:mm)", kind: "time" },
    { key: "pa", label: "PA (mmHg)", kind: "pa" },
    { key: "fc", label: "FC (bpm)", kind: "number", min: 20, max: 300 },
    { key: "tax", label: "T.Ax. (°C)", kind: "number", min: 30, max: 45 },
    { key: "hep", label: "Hep. (UI)", kind: "number", min: 0, max: 50000 },
    { key: "flow", label: "Fluxo (mL/min)", kind: "number", min: 0, max: 600 },
    { key: "pArt", label: "P.Art (mmHg)", kind: "number", min: -500, max: 500 },
    { key: "pVen", label: "P.Ven (mmHg)", kind: "number", min: -500, max: 500 },
  ]

  let sessions = store.forPatient(patientId)
  let pendingEdits = false // correções feitas aqui e ainda não salvas
  let selectedId = null
  let range = { from: "", to: "" }
  const dec = (v) => String(v).replace(".", ",")
  const hasNum = (v) => v !== "" && v != null && Number.isFinite(parseNumber(v))
  const profName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const minutes = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null }
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

  // ---------- Contagens automáticas (regras em js/dados-mock.js, as mesmas da tela Sessões do dia) ----------
  const sessionNumber = (rec) => store.sessionNumber(sessions, rec)
  const dialyzerUse = (rec) => store.dialyzerUse(sessions, rec)
  function useNotice(uses) {
    if (uses == null) return null
    const left = MAX_DIALYZER_USES - uses
    if (uses > MAX_DIALYZER_USES) return ["danger", `Dialisador no ${uses}º uso: o limite é de ${MAX_DIALYZER_USES} usos. Troque o dialisador e marque "Dialisador novo nesta sessão".`]
    if (left === 0) return ["danger", `Último uso permitido do dialisador (${uses} de ${MAX_DIALYZER_USES}). Descarte após esta sessão.`]
    if (left <= 3) return ["warn", `Dialisador no ${uses}º uso de ${MAX_DIALYZER_USES}: restam ${left} ${left === 1 ? "uso" : "usos"}.`]
    return ["info", `Dialisador no ${uses}º uso de ${MAX_DIALYZER_USES} (restam ${left}).`]
  }

  // ---------- Cálculos ----------
  function previousEndWeight(rec) {
    const prev = sessions.filter((s) => s.id !== rec.id && hasNum(s.weightEnd) && (s.date < rec.date || (s.date === rec.date && (s.start || "") < (rec.start || ""))))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""))[0]
    return prev ? parseNumber(prev.weightEnd) : null
  }
  function calc(rec, prevEnd = previousEndWeight(rec)) {
    const ws = hasNum(rec.weightStart) ? parseNumber(rec.weightStart) : null
    const dw = hasNum(rec.dryWeight) ? parseNumber(rec.dryWeight) : null
    const we = hasNum(rec.weightEnd) ? parseNumber(rec.weightEnd) : null
    const ex = hasNum(rec.extra) ? parseNumber(rec.extra) / 1000 : 0 // soro fisiológico (mL) convertido em kg
    const a = minutes(rec.start), b = minutes(rec.end)
    return {
      toLose: ws != null && dw != null ? round(ws - dw + ex, 2) : null, // peso a perder = inicial − seco + soro da devolução
      overweight: ws != null && dw ? round(((ws - dw) / dw) * 100, 2) : null,
      gain: ws != null && prevEnd != null ? round(ws - prevEnd, 2) : null,
      lost: ws != null && we != null ? round(ws - we, 2) : null,
      duration: a != null && b != null && b > a ? b - a : null,
    }
  }
  const fmtKg = (n) => (n == null ? "-" : `${dec(n)} kg`)
  const fmtDur = (m) => (m == null ? "-" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")} h`)

  function status(rec) {
    if (rec.state === "em-andamento") return ["Em andamento", "◔"]
    if (rec.date > todayIso()) return ["Agendada", "◷"]
    const empty = !hasNum(rec.weightStart) && !hasNum(rec.weightEnd) && !(rec.measures || []).length
    if (empty) return ["Sessão vazia", "!"]
    if (!hasNum(rec.weightStart) || !hasNum(rec.weightEnd)) return ["Incompleta", "!"]
    return ["Concluída", "✓"]
  }

  // ---------- Lista ----------
  const inRange = (s) => (!range.from || s.date >= range.from) && (!range.to || s.date <= range.to)
  const sorted = () => sessions.filter(inRange).sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""))
  const selected = () => sessions.find((s) => s.id === selectedId) || null
  const paText = (s) => {
    const m = s.measures || []
    return m.length ? `${m[0].pa || "-"} / ${m[m.length - 1].pa || "-"}` : "-"
  }

  function render() {
    const rows = sorted()
    if (selectedId && !rows.some((s) => s.id === selectedId)) selectedId = null
    $("sd-tbody").replaceChildren(
      ...rows.map((s) => {
        const c = calc(s), [label, icon] = status(s)
        const td = (t) => el("td", { text: t })
        return el("tr", { tabindex: "0", "data-id": s.id, class: s.id === selectedId ? "is-selected" : "", "aria-selected": String(s.id === selectedId) },
          el("td", { class: "sd-status" }, el("span", { "aria-hidden": "true", text: `${icon} ` }), document.createTextNode(label)),
          td(formatDate(s.date)), td(s.start ? `${s.start}${s.end ? ` - ${s.end}` : ""}` : "-"), td(paText(s)),
          td(hasNum(s.dryWeight) ? fmtKg(parseNumber(s.dryWeight)) : "-"), td(hasNum(s.weightStart) ? fmtKg(parseNumber(s.weightStart)) : "-"), td(hasNum(s.weightEnd) ? fmtKg(parseNumber(s.weightEnd)) : "-"),
          td(hasNum(s.uf) ? `${s.uf} mL` : "-"), td(c.overweight == null ? "-" : `${dec(c.overweight)} %`), td(fmtKg(c.gain)),
          s.dialyzer ? el("td", {}, document.createTextNode(`${s.dialyzer} `), usageBadge(s.usage, s.singleUse)) : td("-"), td(s.access || "-"), td(s.complications || "Nenhuma"),
          td(profName(s.responsible) || "-"), td([s.room, s.shift].filter(Boolean).join(" - ") || "-"), td(fmtDur(c.duration)))
      }),
    )
    $("sd-empty").hidden = rows.length > 0
    $("sd-total").textContent = `Total de registros: ${rows.length}`
    $("sd-edit").disabled = !selectedId
    $("sd-delete").disabled = !selectedId
    renderDetail()
    renderAbsences()
    renderExtras()
  }

  // ---------- Faltas, reposições e remarcações (registradas na tela Sessões do dia; somente leitura aqui) ----------
  // kind "falta": o paciente faltou; makeup é a reposição (null enquanto a enfermeira não remarca).
  // kind "remarcacao": a sessão foi adiantada ou adiada antes de acontecer (não conta como falta).
  function makeupStatus(a, all) {
    if (!a.makeup) return ["A remarcar", "danger"]
    const done = sessions.find((s) => s.date === a.makeup.date && (!s.shift || s.shift === a.makeup.shift))
    if (done) return done.state === "em-andamento" ? ["Em andamento", "warn"] : ["Realizada", "ok"]
    if (all.some((x) => x.makeupOf === a.id)) return ["Faltou também", "danger"]
    return a.makeup.date < todayIso() ? ["Não realizada", "danger"] : ["Agendada", "off"]
  }
  function kindLabel(a) {
    if (a.kind !== "remarcacao") return "Falta"
    const n = Math.round((Date.parse(`${a.makeup.date}T12:00:00`) - Date.parse(`${a.date}T12:00:00`)) / 86400000)
    return n < 0 ? "Adiantamento" : n > 0 ? "Adiamento" : "Troca de turno"
  }
  function renderAbsences() {
    const all = faltas.forPatient(patientId)
    const rows = all.filter(inRange).sort((a, b) => b.date.localeCompare(a.date))
    const td = (t) => el("td", { text: t })
    $("sd-absence-tbody").replaceChildren(...rows.map((a) => {
      const [label, tone] = makeupStatus(a, all)
      return el("tr", {},
        td(formatDate(a.date)), td(kindLabel(a)), td(`${a.shift} - ${a.room}`), td(a.reason || "-"),
        td(a.makeup ? `${formatDate(a.makeup.date)} - ${a.makeup.shift} - ${a.makeup.room}` : "-"),
        el("td", {}, el("span", { class: `hn-badge hn-badge-${tone}`, text: label })),
        el("td", { class: "sd-absence-note", text: a.note || "-" }), td(a.by || "-"), td(a.makeup?.by || "-"))
    }))
    $("sd-absence-empty").hidden = rows.length > 0
    const missed = rows.filter((a) => a.kind !== "remarcacao").length
    const moved = rows.length - missed
    $("sd-absence-total").textContent = `Faltas no período: ${missed}${moved ? ` · Remarcações: ${moved}` : ""}`
  }

  // ---------- Sessões extras por orientação médica (programados em Sessões do dia; somente leitura aqui) ----------
  function renderExtras() {
    const X = window.HuNefroTurnosExtrasStore
    const tbody = $("sd-extra-tbody")
    if (!X || !tbody) return
    // Sessões extras em que o paciente entrou pela orientação médica (não as reposições de falta).
    const mine = X.all().filter((x) => (x.patientIds || []).includes(patientId))
    const rows = mine.map((x) => ({ date: x.date, shift: x.shift, room: x.room, start: x.start, x }))
      .filter((r) => !range.from || r.date >= range.from).sort((a, b) => b.date.localeCompare(a.date))
    const absent = faltas.forPatient(patientId)
    const td = (t) => el("td", { text: t })
    tbody.replaceChildren(...rows.map((r) => {
      const done = sessions.find((s) => s.date === r.date && s.shift === r.shift)
      const missed = absent.find((a) => a.date === r.date && a.shift === r.shift)
      const [label, tone] = done ? (done.state === "em-andamento" ? ["Em andamento", "warn"] : ["Realizada", "ok"]) : missed ? ["Falta", "danger"] : r.date < todayIso() ? ["Não realizada", "danger"] : ["Agendada", "off"]
      return el("tr", {}, td(formatDate(r.date)), td(`${r.start || "-"} - ${r.room}`),
        el("td", {}, el("span", { class: `hn-badge hn-badge-${tone}`, text: label })), td(r.x.doctorName || "-"),
        el("td", { class: "sd-absence-note", text: `${r.x.reason || "-"}${r.x.note ? `. ${r.x.note}` : ""}` }), td(r.x.by || "-"))
    }))
    $("sd-extra-empty").hidden = rows.length > 0
    $("sd-extra-total").textContent = `HD em sessão extra no período: ${rows.length}`
  }

  // Uso único: a sessão já gravada assim, ou a sorologia atual do paciente (RDC 11/2014, art. 27).
  function isSingleUse() {
    const saved = editingId ? sessions.find((x) => x.id === editingId) : null
    return Boolean(saved?.singleUse || window.HuNefroMock?.serologyOf?.(patientId).singleUse)
  }

  function usageBadge(uses, single) {
    if (single) return el("span", { class: "hn-badge hn-badge-danger", title: "Sorologia positiva ou desconhecida: dialisador descartado após a sessão (RDC 11/2014)", text: "uso único" })
    if (!uses) return document.createTextNode("")
    const n = Number(uses)
    const tone = n >= MAX_DIALYZER_USES ? "danger" : MAX_DIALYZER_USES - n <= 3 ? "warn" : "off"
    return el("span", { class: `hn-badge hn-badge-${tone}`, title: `Uso ${n} de ${MAX_DIALYZER_USES}`, text: `uso ${n}/${MAX_DIALYZER_USES}` })
  }

  function display(f, v, rec) {
    if (f.key === "extra") return v ? `${v} mL` : "Nenhum"
    if (f.key === "newDialyzer") return v ? "Sim" : "Não"
    if (f.key === "needle" && isCatheterAccess(rec?.access)) return NEEDLE_NOT_APPLICABLE
    if (v === "" || v == null) return "-"
    if (f.kind === "date") return formatDate(v)
    if (f.key === "responsible") return profName(v) || "-"
    if (f.kind === "number") return `${dec(v)} ${f.unit}`
    if (f.kind === "time") return `${v} h`
    return String(v)
  }

  function renderDetail() {
    const rec = selected()
    const box = $("sd-detail")
    if (!rec) { box.replaceChildren(el("p", { class: "ev-empty", text: "Selecione uma sessão na lista para ver os detalhes." })); return }
    const c = calc(rec)
    const nodes = []
    GROUPS.forEach(([title, fields]) => {
      nodes.push(el("h4", { class: "ph-group-title", text: title }))
      if (title.startsWith("Complicações")) {
        nodes.push(el("p", { class: "ph-notes", text: `Complicações: ${rec.complications || "Nenhuma"}` }), el("p", { class: "ph-notes", text: `Observações: ${rec.notes || "-"}` }))
        return
      }
      const items = fields.map((f) => [f.label, display(f, rec[f.key], rec)])
      if (title.startsWith("Pesos")) {
        // Peso final e peso perdido ficam junto dos demais pesos (conforme o manual).
        items.push(["Peso a perder (kg)", fmtKg(c.toLose)], ["Peso perdido (kg)", fmtKg(c.lost)], ["Ganho interdialítico (kg)", fmtKg(c.gain)], ["Sobrepeso (%)", c.overweight == null ? "-" : `${dec(c.overweight)} %`])
      }
      if (title.startsWith("Identificação")) items.push(["Duração efetiva", fmtDur(c.duration)], ["Situação", status(rec)[0]])
      nodes.push(el("dl", { class: "ph-dl" }, ...items.map(([l, v]) => el("div", {}, el("dt", { text: l }), el("dd", { text: v })))))
    })
    nodes.push(el("h4", { class: "ph-group-title", text: "Evolução (aferições)" }))
    nodes.push(rec.measures.length ? measuresTable(rec.measures) : el("p", { class: "ev-empty", text: "Nenhuma aferição registrada." }))
    box.replaceChildren(...nodes)
    $("sd-detail-title").textContent = `Sessão de ${formatDate(rec.date)}`
  }

  function measuresTable(measures, onRemove) {
    const head = el("tr", {}, ...MEASURE_FIELDS.map((f) => el("th", { scope: "col", text: f.label.replace(/ \(.*\)/, "") })), ...(onRemove ? [el("th", { scope: "col", text: "Ação" })] : []))
    const body = measures.map((m, i) => el("tr", {}, ...MEASURE_FIELDS.map((f) => el("td", { text: m[f.key] === "" || m[f.key] == null ? "-" : f.kind === "number" ? dec(m[f.key]) : m[f.key] })),
      ...(onRemove ? [el("td", {}, el("button", { class: "btn btn-outline-danger btn-sm", type: "button", text: "Remover", "aria-label": `Remover aferição das ${m.time}`, "data-remove": i }))] : [])))
    const table = el("table", { class: "table table-sm sd-measures" }, el("thead", {}, head), el("tbody", {}, ...body))
    // No formulário a tabela já fica dentro de .sd-measure-wrap, que tem a própria rolagem.
    if (onRemove) return el("div", { class: "history-table-wrap" }, table)
    return el("div", { class: "history-table-wrap hn-scroll-table sd-measure-scroll", tabindex: "0", "aria-label": "Aferições da sessão, com rolagem" }, table)
  }

  $("sd-tbody").addEventListener("click", (e) => { const r = e.target.closest("tr[data-id]"); if (r) { selectedId = Number(r.dataset.id); render() } })
  $("sd-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectedId = Number(r.dataset.id); render(); $("sd-tbody").querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus() }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus() }
  })
  document.querySelector('[data-section="sessoes-dialise"]')?.addEventListener("click", render)

  // ---------- Filtro de período ----------
  function defaultRange() {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, to: "" }
  }
  range = defaultRange()
  $("sd-from").value = range.from
  $("sd-filters").addEventListener("submit", (e) => {
    e.preventDefault()
    const from = $("sd-from").value, to = $("sd-to").value
    const err = $("sd-filter-error")
    if (from && to && from > to) { err.textContent = "A data inicial não pode ser posterior à final."; err.hidden = false; $("sd-from").focus(); return }
    err.hidden = true
    range = { from, to }
    render()
  })

  // ---------- Diálogo ----------
  const dialog = $("sd-dialog")
  let returnFocus = null, controls = {}, draftMeasures = [], editingId = null, mode = "form", confirmRun = null
  const showError = (m) => { $("sd-dialog-error").textContent = m; $("sd-dialog-error").hidden = !m }
  function closeDialog() { if (dialog.open) dialog.close(); returnFocus?.focus?.() }
  $("sd-dialog-cancel").addEventListener("click", closeDialog)
  $("sd-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog() })

  function accessOptions() {
    const api = window.HuNefroAcessosVasculares
    const list = api ? api.getData().access : []
    return [...list].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.date.localeCompare(a.date))
      .map((a) => `${a.type} - ${a.loc}${a.status === "active" ? "" : " (encerrado)"}`)
  }

  function buildField(f, value) {
    const id = `sd-f-${f.key}`
    let control
    if (f.other) {
      const built = createSelectWithOther({ id, options: f.options, otherLabel: f.other, placeholder: "Informe o dialisador", value: value ?? "" })
      controls[f.key] = built.control
      return el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.label }), built.root)
    }
    if (f.kind === "check") {
      control = el("input", { type: "checkbox", id, "data-no-dirty": true })
      control.checked = Boolean(value)
      controls[f.key] = control
      return el("label", { class: `md-check ${f.cls}` }, control, el("span", { text: f.label }))
    }
    if (f.kind === "auto") {
      control = el("input", { class: "form-control derived-field", id, readonly: true, tabindex: "-1", "data-no-dirty": true })
      controls[f.key] = control
      return el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.label }), control)
    }
    if (f.kind === "select" || (f.kind === "access" && accessOptions().length)) {
      const options = f.kind === "access" ? accessOptions().map((v) => [v, v]) : f.options
      control = el("select", { class: "form-select", id, "data-no-dirty": true }, el("option", { value: "", text: f.empty || "Selecione" }), ...options.map(([v, l]) => el("option", { value: v, text: l })))
    } else if (f.kind === "textarea") control = el("textarea", { class: "form-control", id, rows: "3", "data-no-dirty": true })
    else if (f.kind === "date") control = el("input", { class: "form-control", id, type: "date", "data-no-dirty": true })
    else control = el("input", { class: "form-control", id, type: "text", autocomplete: "off", inputmode: f.kind === "number" ? "decimal" : f.kind === "int" || f.kind === "time" ? "numeric" : "text", placeholder: f.kind === "time" ? "12:00" : "", "data-no-dirty": true })
    // Valor gravado fora da lista (ex.: acesso informado na tela Sessões do dia) continua selecionado.
    if (control.tagName === "SELECT" && value && ![...control.options].some((o) => o.value === value)) control.append(el("option", { value, text: value }))
    control.value = f.kind === "number" ? dec(value ?? "") : value ?? ""
    controls[f.key] = control
    return el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), control)
  }

  function renderCalcBox() {
    const box = $("sd-calc")
    if (!box) return
    const rec = {}
    FIELDS.forEach((f) => { rec[f.key] = f.kind === "check" ? controls[f.key]?.checked : controls[f.key]?.value.trim() ?? "" })
    rec.id = editingId || -1
    rec.singleUse = isSingleUse()
    ;["dryWeight", "extra", "weightStart", "weightEnd"].forEach((k) => (rec[k] = rec[k].replace(",", ".")))
    const c = calc(rec)
    // Campos automáticos: nº da diálise e uso do dialisador (uso único com sorologia positiva ou desconhecida).
    const uses = rec.singleUse ? null : dialyzerUse(rec)
    controls.number.value = rec.date ? String(sessionNumber(rec)) : ""
    controls.usage.value = rec.singleUse ? "Uso único" : uses == null ? "" : String(uses)
    controls.usageMax.value = String(MAX_DIALYZER_USES)
    const notice = useNotice(uses)
    const alertBox = $("sd-usage-alert")
    if (alertBox) {
      alertBox.hidden = !notice
      if (notice) {
        alertBox.className = `hn-alert ${notice[0] === "info" ? "sd-usage-info" : `hn-alert-${notice[0]}`}`
        alertBox.replaceChildren(el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: notice[0] === "info" ? "i" : "!" }), el("span", { text: notice[1] }))
      }
    }
    box.replaceChildren(
      el("span", { text: `Peso a perder: ${fmtKg(c.toLose)}` }), el("span", { text: `Peso perdido: ${fmtKg(c.lost)}` }),
      el("span", { text: `Ganho interdialítico: ${fmtKg(c.gain)}` }), el("span", { text: `Sobrepeso: ${c.overweight == null ? "-" : `${dec(c.overweight)} %`}` }),
      el("span", { text: `Duração efetiva: ${fmtDur(c.duration)}` }),
    )
  }

  function buildMeasuresBlock() {
    const form = el("div", { class: "sd-measure-form" })
    const inputs = {}
    MEASURE_FIELDS.forEach((f) => {
      const id = `sd-m-${f.key}`
      const input = el("input", { class: "form-control form-control-sm", id, type: "text", autocomplete: "off", inputmode: f.kind === "number" ? "decimal" : "text", "data-no-dirty": true })
      inputs[f.key] = input
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add() } })
      form.append(el("div", { class: "field-block" }, el("label", { class: "field-label", for: id, text: f.label }), input))
    })
    const msg = el("div", { class: "hc-error", role: "alert", hidden: true })
    const listBox = el("div", { class: "sd-measure-wrap" })
    function paint() {
      listBox.replaceChildren(draftMeasures.length ? measuresTable(draftMeasures, true) : el("p", { class: "ev-empty", style: "padding:.5rem .75rem", text: "Nenhuma aferição adicionada." }))
    }
    function add() {
      const m = {}
      for (const f of MEASURE_FIELDS) {
        const v = inputs[f.key].value.trim()
        m[f.key] = v
        if (f.key === "time" && !v) return fail("Informe a hora da aferição.", inputs.time)
        if (!v) continue
        if (f.kind === "time" && minutes(/^\d:/.test(v) ? `0${v}` : v) == null) return fail("Hora inválida. Use hh:mm.", inputs[f.key])
        if (f.kind === "pa") {
          const p = v.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/)
          if (!p || +p[1] < 40 || +p[1] > 300 || +p[2] < 20 || +p[2] > 200 || +p[2] >= +p[1]) return fail("PA inválida. Use sistólica/diastólica, ex.: 120/80.", inputs[f.key])
          m[f.key] = `${p[1]}/${p[2]}`
        }
        if (f.kind === "number") {
          const n = parseNumber(v)
          if (!Number.isFinite(n) || n < f.min || n > f.max) return fail(`${f.label.replace(/ \(.*\)/, "")} deve estar entre ${f.min} e ${f.max}.`, inputs[f.key])
          m[f.key] = String(n)
        }
      }
      if (/^\d:/.test(m.time)) m.time = `0${m.time}`
      msg.hidden = true
      draftMeasures.push(m)
      draftMeasures.sort((a, b) => a.time.localeCompare(b.time))
      Object.values(inputs).forEach((i) => (i.value = ""))
      paint()
      inputs.time.focus()
    }
    function fail(text, input) { msg.textContent = text; msg.hidden = false; input.focus() }
    const addBtn = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", text: "Adicionar aferição" })
    addBtn.addEventListener("click", add)
    form.append(addBtn)
    listBox.addEventListener("click", (e) => { const b = e.target.closest("[data-remove]"); if (b) { draftMeasures.splice(Number(b.dataset.remove), 1); paint() } })
    paint()
    return [el("h4", { text: "Evolução (aferições durante a sessão)" }), form, el("div", { style: "grid-column:1/-1" }, msg), listBox]
  }

  function buildForm(base) {
    controls = {}
    const form = el("div", { class: "ph-form" })
    GROUPS.forEach(([title, fields]) => {
      form.append(el("h4", { text: title }))
      fields.forEach((f) => form.append(buildField(f, base?.[f.key])))
      if (title.startsWith("Parâmetros")) form.append(el("div", { class: "hn-alert sd-usage-info", id: "sd-usage-alert", role: "status", hidden: true }))
      if (title.startsWith("Pesos")) form.append(el("div", { class: "sd-calc", id: "sd-calc", "aria-live": "polite" }))
      if (title.startsWith("Pesos")) form.append(...buildMeasuresBlock())
    })
    // Cateter: sem punção, então o campo Agulha some e fica vazio.
    const syncNeedle = () => {
      const catheter = isCatheterAccess(controls.access.value)
      controls.needle.closest(".field-block").hidden = catheter
      if (catheter) controls.needle.value = ""
    }
    const refresh = (e) => { if (e.target.closest(".sd-measure-form")) return; syncNeedle(); renderCalcBox() }
    form.addEventListener("input", refresh)
    form.addEventListener("change", refresh)
    syncNeedle()
    return form
  }

  function openForm(rec) {
    returnFocus = document.activeElement
    mode = "form"
    // Só corrige sessões já registradas: iniciar e concluir é feito na tela Sessões do dia.
    editingId = rec.id
    draftMeasures = (rec.measures || []).map((m) => ({ ...m }))
    $("sd-dialog-title").textContent = `Alterar sessão de ${formatDate(rec.date)}`
    const confirm = $("sd-dialog-confirm")
    confirm.textContent = "Gravar"; confirm.classList.add("btn-primary"); confirm.classList.remove("btn-danger")
    $("sd-dialog-body").replaceChildren(buildForm(rec))
    renderCalcBox()
    showError("")
    dialog.showModal()
    controls.date.focus()
  }

  function readAndValidate() {
    const out = {}
    const scheduled = controls.date.value > todayIso() // sessão agendada ainda não tem horários e pesos
    const running = sessions.find((s) => s.id === editingId)?.state === "em-andamento" // ainda não concluída na tela do dia
    for (const f of FIELDS) {
      const c = controls[f.key]
      if (f.kind === "auto") continue
      if (f.kind === "check") { out[f.key] = c.checked; continue }
      const v = c.value.trim()
      out[f.key] = v
      if (c.missingOther) return { error: "Informe qual é o outro dialisador.", focus: c }
      if (f.req && !v && !(scheduled && f.key !== "date") && !(running && ["end", "weightEnd", "uf"].includes(f.key))) return { error: `Informe o campo "${f.label.replace(/ \(.*\)/, "")}" (obrigatório).`, focus: c }
      if (!v) continue
      const name = f.label.replace(/ \(.*\)/, "")
      if (f.kind === "date" && f.key === "date" && !rec_ok(v)) return { error: "Data inválida.", focus: c }
      if (f.kind === "time") {
        const n = /^\d:/.test(v) ? `0${v}` : v
        if (minutes(n) == null || minutes(n) > 1439) return { error: `${name}: use hh:mm (00:00 a 23:59).`, focus: c }
        out[f.key] = n
      }
      if (f.kind === "number" || f.kind === "int") {
        const n = parseNumber(v)
        if (!Number.isFinite(n) || n < f.min || n > f.max || (f.kind === "int" && !Number.isInteger(n))) return { error: `${name} deve estar entre ${f.min} e ${f.max}${f.unit ? ` ${f.unit}` : ""}${f.kind === "int" ? " (número inteiro)" : ""}.`, focus: c }
        out[f.key] = String(n)
      }
    }
    if (isCatheterAccess(out.access)) out.needle = ""
    if (out.start && out.end && minutes(out.end) <= minutes(out.start)) return { error: "O fim da sessão deve ser posterior ao início.", focus: controls.end }
    if (out.dryWeight && out.weightStart && parseNumber(out.weightStart) < parseNumber(out.dryWeight) - 5) return { error: "O peso inicial está muito abaixo do peso seco. Confira os valores (kg).", focus: controls.weightStart }
    out.singleUse = isSingleUse()
    if (out.singleUse) out.newDialyzer = true
    const draft = { ...out, id: editingId || -1 }
    out.number = String(sessionNumber(draft))
    out.usage = out.dialyzer ? String(dialyzerUse(draft)) : ""
    out.usageMax = String(MAX_DIALYZER_USES)
    if (out.usage && Number(out.usage) > MAX_DIALYZER_USES) return { error: `O dialisador passaria do limite de ${MAX_DIALYZER_USES} usos. Troque o dialisador e marque "Dialisador novo nesta sessão".`, focus: controls.newDialyzer }
    return { values: out }
  }
  function rec_ok(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) }

  $("sd-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    if (mode === "confirm") { const run = confirmRun; closeDialog(); run?.(); return }
    const res = readAndValidate()
    if (res.error) { showError(res.error); res.focus.focus(); return }
    showError("")
    Object.assign(sessions.find((s) => s.id === editingId), res.values, { measures: draftMeasures, editedBy: currentUserName() })
    selectedId = editingId
    pendingEdits = true
    closeDialog()
    render()
    markDirty()
  })

  $("sd-edit").addEventListener("click", () => { const s = selected(); if (s) openForm(s) })
  $("sd-delete").addEventListener("click", () => {
    const s = selected()
    if (!s) return
    returnFocus = document.activeElement
    mode = "confirm"
    confirmRun = () => { sessions = sessions.filter((x) => x.id !== s.id); selectedId = null; pendingEdits = true; render(); markDirty() }
    $("sd-dialog-title").textContent = "Excluir sessão"
    $("sd-dialog-body").replaceChildren(el("p", { class: "ev-confirm", text: `Excluir a sessão de ${formatDate(s.date)}? Pesos, aferições e observações serão removidos.` }))
    const confirm = $("sd-dialog-confirm")
    confirm.textContent = "Excluir"; confirm.classList.add("btn-danger"); confirm.classList.remove("btn-primary")
    showError("")
    dialog.showModal()
    confirm.focus()
  })

  $("sd-print").addEventListener("click", () => {
    document.body.classList.add("sd-printing")
    window.print()
  })
  window.addEventListener("afterprint", () => document.body.classList.remove("sd-printing"))

  // Salvar (rodapé do prontuário) grava as correções; sessões iniciadas/concluídas em outra aba aparecem sozinhas.
  document.addEventListener("hunefro:save", () => {
    if (!pendingEdits) return
    store.replacePatient(patientId, sessions)
    pendingEdits = false
  })
  store.subscribe(() => {
    renderAbsences()
    if (pendingEdits) return
    sessions = store.forPatient(patientId)
    render()
  })

  render()

  window.HuNefroSessoesDialise = {
    getData: () => JSON.parse(JSON.stringify(sessions)),
    setData(list) {
      sessions = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      selectedId = null
      render()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
