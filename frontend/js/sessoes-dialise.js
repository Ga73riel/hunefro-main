// Aba Prescrição e Tratamento / Sessões de Diálise (histórico e registro das sessões de HD).
// Depende de js/catalogos.js, js/componentes.js; usa dados de Acessos Vasculares e Prescrição de HD quando existem.
// Dados em memória até existir a API. Sem box de HDF (removido conforme o manual).
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const $ = (id) => document.getElementById(id)
  if (!$("sd-tbody")) return

  const opts = (list) => list.map((v) => [v, v])
  // PROVISÓRIAS: listas copiadas da tela de Prescrição de HD / manual; turnos e salas dependem do cadastro da unidade.
  const METHODS = opts(["Hemodiálise", "HDF Mix", "HDF Pré", "HDF Pós", "HF Mix", "HF Pré", "HF Pós"])
  const DIALYZERS = opts(["B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR", "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4"])
  const SOLUTIONS = opts(["Acetato", "Bicarbonato", "Padrão", "Solução C/ Glic", "Solução C/ Potá", "Solução Modific", "Solução S/ Potá"])
  const SHIFTS = opts(["1º Turno", "2º Turno", "3º Turno"])

  // Faixas só barram erro de digitação (PROVISÓRIAS; confirmar com a equipe). Pesos em kg.
  const GROUPS = [
    ["Identificação da sessão", [
      { key: "date", label: "Data", kind: "date", req: true, cls: "ph-f3" },
      { key: "start", label: "Início (hh:mm)", kind: "time", cls: "ph-f3" },
      { key: "end", label: "Fim (hh:mm)", kind: "time", cls: "ph-f3" },
      { key: "number", label: "Nº da diálise", kind: "int", min: 1, max: 9999, cls: "ph-f3" },
      { key: "room", label: "Sala", kind: "text", cls: "ph-f3" },
      { key: "shift", label: "Turno", kind: "select", options: SHIFTS, cls: "ph-f3" },
      { key: "machine", label: "Máquina", kind: "text", cls: "ph-f3" },
      { key: "responsible", label: "Responsável", kind: "select", options: C.professionalOptions(), cls: "ph-f3" },
    ]],
    ["Parâmetros da sessão", [
      { key: "method", label: "Método de tratamento", kind: "select", options: METHODS, cls: "ph-f3" },
      { key: "dialyzer", label: "Dialisador", kind: "select", options: DIALYZERS, cls: "ph-f3" },
      { key: "usage", label: "Uso atual do dialisador", kind: "int", min: 0, max: 200, cls: "ph-f3" },
      { key: "usageMax", label: "Uso máximo do dialisador", kind: "int", min: 1, max: 200, cls: "ph-f3" },
      { key: "priming", label: "Priming zero do dialisador (mL)", kind: "number", min: 0, max: 5000, unit: "mL", cls: "ph-f3" },
      { key: "solution", label: "Solução", kind: "select", options: SOLUTIONS, cls: "ph-f3" },
      { key: "access", label: "Acesso", kind: "access", cls: "ph-f6" },
      { key: "needle", label: "Agulha", kind: "text", cls: "ph-f3" },
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
      { key: "extra", label: "Acréscimo (kg)", kind: "number", min: 0, max: 10, unit: "kg", cls: "ph-f3" },
      { key: "weightStart", label: "Peso inicial (kg)", kind: "number", min: 1, max: 400, unit: "kg", cls: "ph-f3" },
      { key: "weightEnd", label: "Peso final (kg)", kind: "number", min: 1, max: 400, unit: "kg", cls: "ph-f3" },
      { key: "uf", label: "UF (mL)", kind: "number", min: 0, max: 10000, unit: "mL", cls: "ph-f3" },
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
    { key: "saline", label: "Soro (mL)", kind: "number", min: 0, max: 5000 },
  ]

  let sessions = []
  let nextId = 1
  let selectedId = null
  let range = { from: "", to: "" }
  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))
  const num = (v) => Number(String(v).trim().replace(",", "."))
  const dec = (v) => String(v).replace(".", ",")
  const hasNum = (v) => v !== "" && v != null && Number.isFinite(num(v))
  const profName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const minutes = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null }
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d

  // ---------- Cálculos ----------
  function previousEndWeight(rec) {
    const prev = sessions.filter((s) => s.id !== rec.id && hasNum(s.weightEnd) && (s.date < rec.date || (s.date === rec.date && (s.start || "") < (rec.start || ""))))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""))[0]
    return prev ? num(prev.weightEnd) : null
  }
  function calc(rec, prevEnd = previousEndWeight(rec)) {
    const ws = hasNum(rec.weightStart) ? num(rec.weightStart) : null
    const dw = hasNum(rec.dryWeight) ? num(rec.dryWeight) : null
    const we = hasNum(rec.weightEnd) ? num(rec.weightEnd) : null
    const ex = hasNum(rec.extra) ? num(rec.extra) : 0
    const a = minutes(rec.start), b = minutes(rec.end)
    return {
      toLose: ws != null && dw != null ? round(ws - dw + ex, 2) : null, // peso a perder = inicial − seco + acréscimo
      overweight: ws != null && dw ? round(((ws - dw) / dw) * 100, 2) : null,
      gain: ws != null && prevEnd != null ? round(ws - prevEnd, 2) : null,
      lost: ws != null && we != null ? round(ws - we, 2) : null,
      duration: a != null && b != null && b > a ? b - a : null,
    }
  }
  const fmtKg = (n) => (n == null ? "—" : `${dec(n)} kg`)
  const fmtDur = (m) => (m == null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")} h`)

  function status(rec) {
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
    return m.length ? `${m[0].pa || "—"} / ${m[m.length - 1].pa || "—"}` : "—"
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
          td(formatDate(s.date)), td(s.start ? `${s.start}${s.end ? ` - ${s.end}` : ""}` : "—"), td(paText(s)),
          td(hasNum(s.dryWeight) ? fmtKg(num(s.dryWeight)) : "—"), td(hasNum(s.weightStart) ? fmtKg(num(s.weightStart)) : "—"), td(hasNum(s.weightEnd) ? fmtKg(num(s.weightEnd)) : "—"),
          td(hasNum(s.uf) ? `${s.uf} mL` : "—"), td(c.overweight == null ? "—" : `${dec(c.overweight)} %`), td(fmtKg(c.gain)),
          td(s.dialyzer ? `${s.dialyzer}${s.usage ? ` (uso ${s.usage})` : ""}` : "—"), td(s.access || "—"), td(s.complications || "Nenhuma"),
          td(profName(s.responsible) || "—"), td([s.room, s.shift].filter(Boolean).join(" - ") || "—"), td(fmtDur(c.duration)))
      }),
    )
    $("sd-empty").hidden = rows.length > 0
    $("sd-total").textContent = `Total de registros: ${rows.length}`
    $("sd-edit").disabled = !selectedId
    $("sd-delete").disabled = !selectedId
    renderDetail()
  }

  function display(f, v, rec) {
    if (v === "" || v == null) return "—"
    if (f.kind === "date") return formatDate(v)
    if (f.key === "responsible") return profName(v) || "—"
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
        nodes.push(el("p", { class: "ph-notes", text: `Complicações: ${rec.complications || "Nenhuma"}` }), el("p", { class: "ph-notes", text: `Observações: ${rec.notes || "—"}` }))
        return
      }
      const items = fields.map((f) => [f.label, display(f, rec[f.key], rec)])
      if (title.startsWith("Pesos")) {
        // Peso final e peso perdido ficam junto dos demais pesos (conforme o manual).
        items.push(["Peso a perder (kg)", fmtKg(c.toLose)], ["Peso perdido (kg)", fmtKg(c.lost)], ["Ganho interdialítico (kg)", fmtKg(c.gain)], ["Sobrepeso (%)", c.overweight == null ? "—" : `${dec(c.overweight)} %`])
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
    const body = measures.map((m, i) => el("tr", {}, ...MEASURE_FIELDS.map((f) => el("td", { text: m[f.key] === "" || m[f.key] == null ? "—" : f.kind === "number" ? dec(m[f.key]) : m[f.key] })),
      ...(onRemove ? [el("td", {}, el("button", { class: "btn btn-outline-danger btn-sm", type: "button", text: "Remover", "aria-label": `Remover aferição das ${m.time}`, "data-remove": i }))] : [])))
    const table = el("table", { class: "table table-sm sd-measures" }, el("thead", {}, head), el("tbody", {}, ...body))
    return el("div", { class: "history-table-wrap" }, table)
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
      .map((a) => `${a.type} — ${a.loc}${a.status === "active" ? "" : " (encerrado)"}`)
  }

  function lastPrescription() {
    const api = window.HuNefroPrescricaoHD
    const list = api ? api.getData() : []
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0] || null
  }

  function buildField(f, value) {
    const id = `sd-f-${f.key}`
    let control
    if (f.kind === "select" || (f.kind === "access" && accessOptions().length)) {
      const options = f.kind === "access" ? accessOptions().map((v) => [v, v]) : f.options
      control = el("select", { class: "form-select", id, "data-no-dirty": true }, el("option", { value: "", text: "Selecione" }), ...options.map(([v, l]) => el("option", { value: v, text: l })))
    } else if (f.kind === "textarea") control = el("textarea", { class: "form-control", id, rows: "3", "data-no-dirty": true })
    else if (f.kind === "date") control = el("input", { class: "form-control", id, type: "date", "data-no-dirty": true })
    else control = el("input", { class: "form-control", id, type: "text", autocomplete: "off", inputmode: f.kind === "number" ? "decimal" : f.kind === "int" || f.kind === "time" ? "numeric" : "text", placeholder: f.kind === "time" ? "12:00" : "", "data-no-dirty": true })
    control.value = f.kind === "number" ? dec(value ?? "") : value ?? ""
    controls[f.key] = control
    return el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), control)
  }

  function renderCalcBox() {
    const box = $("sd-calc")
    if (!box) return
    const rec = {}
    FIELDS.forEach((f) => { rec[f.key] = controls[f.key]?.value.trim() ?? "" })
    rec.id = editingId || -1
    ;["dryWeight", "extra", "weightStart", "weightEnd"].forEach((k) => (rec[k] = rec[k].replace(",", ".")))
    const c = calc(rec)
    box.replaceChildren(
      el("span", { text: `Peso a perder: ${fmtKg(c.toLose)}` }), el("span", { text: `Peso perdido: ${fmtKg(c.lost)}` }),
      el("span", { text: `Ganho interdialítico: ${fmtKg(c.gain)}` }), el("span", { text: `Sobrepeso: ${c.overweight == null ? "—" : `${dec(c.overweight)} %`}` }),
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
          const n = num(v)
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

  function buildForm(base, isNew) {
    controls = {}
    const form = el("div", { class: "ph-form" })
    GROUPS.forEach(([title, fields]) => {
      form.append(el("h4", { text: title }))
      fields.forEach((f) => form.append(buildField(f, f.key === "date" && isNew ? todayIso() : base?.[f.key])))
      if (title.startsWith("Pesos")) form.append(el("div", { class: "sd-calc", id: "sd-calc", "aria-live": "polite" }))
      if (title.startsWith("Pesos")) form.append(...buildMeasuresBlock())
    })
    form.addEventListener("input", (e) => { if (e.target.closest(".sd-measure-form")) return; renderCalcBox() })
    return form
  }

  function openForm(rec) {
    returnFocus = document.activeElement
    mode = "form"
    editingId = rec ? rec.id : null
    draftMeasures = rec ? rec.measures.map((m) => ({ ...m })) : []
    let base = rec
    if (!rec) {
      // Nova sessão parte da prescrição de HD mais recente e do peso seco informado nela.
      const p = lastPrescription()
      base = p ? { method: p.method, dialyzer: p.dialyzer, solution: p.solution, machine: p.machine, needle: p.needle, heparin: p.heparin, bloodFlow: p.bloodFlow, dialysateFlow: p.dialysateFlow, bicarbonate: p.bicarbonate, bathTemp: p.bathTemp, ufProfile: p.ufProfile, naBase: p.naBase, naConc: p.naConc, naProfile: p.naProfile, naInitial: p.naInitial, dryWeight: p.dryWeight } : {}
    }
    $("sd-dialog-title").textContent = rec ? `Alterar sessão de ${formatDate(rec.date)}` : "Nova sessão de hemodiálise"
    const confirm = $("sd-dialog-confirm")
    confirm.textContent = "Gravar"; confirm.classList.add("btn-primary"); confirm.classList.remove("btn-danger")
    $("sd-dialog-body").replaceChildren(buildForm(base, !rec))
    renderCalcBox()
    showError("")
    dialog.showModal()
    controls.date.focus()
  }

  function readAndValidate() {
    const out = {}
    for (const f of FIELDS) {
      const c = controls[f.key]
      const v = c.value.trim()
      out[f.key] = v
      if (f.req && !v) return { error: `Informe o campo "${f.label}".`, focus: c }
      if (!v) continue
      const name = f.label.replace(/ \(.*\)/, "")
      if (f.kind === "date" && f.key === "date" && !rec_ok(v)) return { error: "Data inválida.", focus: c }
      if (f.kind === "time") {
        const n = /^\d:/.test(v) ? `0${v}` : v
        if (minutes(n) == null || minutes(n) > 1439) return { error: `${name}: use hh:mm (00:00 a 23:59).`, focus: c }
        out[f.key] = n
      }
      if (f.kind === "number" || f.kind === "int") {
        const n = num(v)
        if (!Number.isFinite(n) || n < f.min || n > f.max || (f.kind === "int" && !Number.isInteger(n))) return { error: `${name} deve estar entre ${f.min} e ${f.max}${f.unit ? ` ${f.unit}` : ""}${f.kind === "int" ? " (número inteiro)" : ""}.`, focus: c }
        out[f.key] = String(n)
      }
    }
    if (out.start && out.end && minutes(out.end) <= minutes(out.start)) return { error: "O fim da sessão deve ser posterior ao início.", focus: controls.end }
    if (out.dryWeight && out.weightStart && num(out.weightStart) < num(out.dryWeight) - 5) return { error: "O peso inicial está muito abaixo do peso seco. Confira os valores (kg).", focus: controls.weightStart }
    return { values: out }
  }
  function rec_ok(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) }

  $("sd-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    if (mode === "confirm") { const run = confirmRun; closeDialog(); run?.(); return }
    const res = readAndValidate()
    if (res.error) { showError(res.error); res.focus.focus(); return }
    showError("")
    if (editingId) {
      Object.assign(sessions.find((s) => s.id === editingId), res.values, { measures: draftMeasures })
      selectedId = editingId
    } else {
      const rec = { id: nextId++, ...res.values, measures: draftMeasures, by: currentUserName() }
      sessions.push(rec)
      selectedId = rec.id
      if (rec.date < range.from || (range.to && rec.date > range.to)) { range = { from: "", to: "" }; $("sd-from").value = ""; $("sd-to").value = "" }
    }
    closeDialog()
    render()
    markDirty()
  })

  $("sd-new").addEventListener("click", () => openForm(null))
  $("sd-edit").addEventListener("click", () => { const s = selected(); if (s) openForm(s) })
  $("sd-delete").addEventListener("click", () => {
    const s = selected()
    if (!s) return
    returnFocus = document.activeElement
    mode = "confirm"
    confirmRun = () => { sessions = sessions.filter((x) => x.id !== s.id); selectedId = null; render(); markDirty() }
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

  render()

  window.HuNefroSessoesDialise = {
    getData: () => JSON.parse(JSON.stringify(sessions)),
    setData(list) {
      sessions = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = sessions.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedId = null
      render()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
