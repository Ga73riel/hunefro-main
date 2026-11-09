// Aba Prescrição e Tratamento / Prescrição de Hemodiálise.
// Depende de js/catalogos.js e js/componentes.js. Prescrições ficam em memória até existir a API.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, createSelectWithOther, markDirty, parseNumber, isCatheterAccess, NEEDLE_NOT_APPLICABLE } = window.HuNefroUI
  const $ = (id) => document.getElementById(id)
  if (!$("ph-tbody")) return

  // Listas transcritas das imagens do manual (p. 29). PROVISÓRIAS: o administrador deve poder cadastrar novas.
  const opts = (list) => list.map((v) => [v, v])
  // Modelos de dialisador cadastrados em Gestão > Dialisadores (gestao-store.js); sem o cadastro, a lista original.
  const DIALYZERS = opts(window.HuNefroAdmin?.dialyzerNames?.() || [
    "B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR",
    "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4",
  ])
  const METHODS = opts(["Hemodiálise", "Hemodiálise Pediátrica"]) // a unidade só trabalha com HD e HD pediátrica
  const SOLUTIONS = opts(["Acetato", "Bicarbonato", "Padrão", "Solução C/ Glic", "Solução C/ Potá", "Solução Modific", "Solução S/ Potá"])

  // Faixas numéricas apenas barram valores absurdos (erro de digitação). PROVISÓRIAS: confirmar com a equipe clínica.
  // kind: date | select | text | number | time | textarea
  const GROUPS = [
    ["Parâmetros gerais", [
      { key: "date", label: "Data", kind: "date", req: true, cls: "ph-f3" },
      { key: "method", label: "Método de tratamento", kind: "select", options: METHODS, req: true, cls: "ph-f3" },
      { key: "machine", label: "Modelo da máquina", kind: "text", cls: "ph-f3" },
      { key: "dryWeight", label: "Peso seco (kg)", kind: "number", min: 1, max: 400, req: true, unit: "kg", cls: "ph-f3" },
      { key: "ufMax", label: "UF máxima (mL)", kind: "number", min: 0, max: 10000, unit: "mL", cls: "ph-f3" },
      { key: "dialyzer", label: "Dialisador", kind: "select", options: DIALYZERS, other: "Outro dialisador", req: true, cls: "ph-f3" },
      { key: "duration", label: "Duração (hh:mm)", kind: "time", req: true, cls: "ph-f3" },
      { key: "solution", label: "Solução do dialisato", kind: "select", options: SOLUTIONS, req: true, cls: "ph-f3" },
    ]],
    ["Fluxos e acesso", [
      { key: "bloodFlow", label: "Fluxo de sangue (mL/min)", kind: "number", min: 50, max: 600, unit: "mL/min", cls: "ph-f4" },
      { key: "dialysateFlow", label: "Fluxo de dialisato (mL/min)", kind: "number", min: 100, max: 1000, unit: "mL/min", cls: "ph-f4" },
      { key: "needle", label: "Agulha (FAV ou enxerto)", kind: "text", cls: "ph-f4" },
    ]],
    ["Banho e heparina", [
      { key: "heparin", label: "Heparina (UI)", kind: "number", min: 0, max: 50000, unit: "UI", cls: "ph-f3" },
      { key: "bicarbonate", label: "Bicarbonato (mEq/L)", kind: "number", min: 0, max: 60, unit: "mEq/L", cls: "ph-f3" },
      { key: "bathTemp", label: "Temperatura do banho (°C)", kind: "number", min: 30, max: 40, unit: "°C", cls: "ph-f3" },
      { key: "ufProfile", label: "Perfil de UF", kind: "text", cls: "ph-f3" },
      { key: "naBase", label: "Base Na+ (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
      { key: "naConc", label: "Concentração Na+ (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
      { key: "naProfile", label: "Perfil de Na+", kind: "text", cls: "ph-f3" },
      { key: "naInitial", label: "Na+ inicial (mEq/L)", kind: "number", min: 100, max: 160, unit: "mEq/L", cls: "ph-f3" },
    ]],
    ["Orientações e recomendações clínicas", [
      { key: "notes", label: "Orientações", kind: "textarea", cls: "ph-f12" },
    ]],
  ]
  const FIELDS = GROUPS.flatMap(([, f]) => f)

  let items = []
  let nextId = 1
  let selectedId = null
  const sorted = () => [...items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const current = () => sorted()[0] || null
  const shown = () => items.find((x) => x.id === selectedId) || current()

  function display(f, v) {
    if (v === "" || v == null) return "-"
    if (f.kind === "date") return formatDate(v)
    if (f.kind === "number") return `${String(v).replace(".", ",")} ${f.unit}`
    if (f.kind === "time") return `${v} h`
    return String(v)
  }

  // ---------- Detalhe ----------
  function activeAccess() {
    const api = window.HuNefroAcessosVasculares
    return api ? api.getData().access.filter((a) => a.status === "active").sort((a, b) => b.date.localeCompare(a.date))[0] : null
  }

  // Acesso ativo por cateter: sem punção, então a agulha não se aplica (campo oculto e vazio).
  const catheterActive = () => isCatheterAccess(activeAccess()?.kind)

  // Sem acesso ativo: chip e aviso em vermelho (a prescrição continua permitida, mas o alerta fica evidente).
  function noAccessAlert() {
    return el("div", { class: "hn-alert hn-alert-danger", role: "alert" },
      el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }),
      el("div", {}, el("strong", { text: "Paciente sem acesso vascular ativo." }),
        el("span", { text: "Cadastre o acesso em Prescrição e Tratamento › Acessos Vasculares antes da sessão de hemodiálise." })))
  }

  function renderChips() {
    const active = activeAccess()
    $("ph-access").textContent = active ? `Acesso atual: ${active.type} - ${active.loc}` : "Sem acesso vascular ativo"
    $("ph-access").classList.toggle("ph-chip-danger", !active)
    $("ph-no-access").replaceChildren(...(active ? [] : [noAccessAlert()]))
    const ex = window.HuNefroExames?.latest("Sódio")
    $("ph-na").textContent = ex ? `Último exame Na+: ${ex.result} (${formatDate(ex.date)})` : "Último exame Na+: não disponível"
  }

  function detailNodes(rec) {
    const nodes = []
    GROUPS.forEach(([title, fields]) => {
      if (fields[0].kind === "textarea") {
        nodes.push(el("h4", { class: "ph-group-title", text: title }), el("p", { class: "ph-notes", text: rec.notes || "-" }))
        return
      }
      nodes.push(
        el("h4", { class: "ph-group-title", text: title }),
        el("dl", { class: "ph-dl" }, ...fields.map((f) => el("div", {}, el("dt", { text: f.label }), el("dd", { text: f.key === "needle" && !rec.needle && catheterActive() ? NEEDLE_NOT_APPLICABLE : display(f, rec[f.key]) })))),
      )
    })
    return nodes
  }

  function render() {
    renderChips()
    const rows = sorted()
    if (selectedId && !items.some((x) => x.id === selectedId)) selectedId = null
    const cur = current()
    $("ph-tbody").replaceChildren(
      ...rows.map((x) =>
        el("tr", { tabindex: "0", "data-id": x.id, class: x.id === (shown()?.id) ? "is-selected" : "", "aria-selected": String(x.id === shown()?.id) },
          el("td", { text: formatDate(x.date) }), el("td", { text: x.method }), el("td", { text: x.dialyzer }), el("td", { text: `${x.duration} h` }),
          el("td", { text: x.dryWeight ? `${String(x.dryWeight).replace(".", ",")} kg` : "-" }), el("td", { text: x.ufMax ? `${x.ufMax} mL` : "-" }), el("td", { text: x.by }),
          el("td", {}, verHdButton(x))),
      ),
    )
    $("ph-empty").hidden = rows.length > 0
    const rec = shown()
    $("ph-detail-title").textContent = !rec ? "Prescrição vigente" : rec.id === cur.id ? `Prescrição vigente - ${formatDate(rec.date)}` : `Prescrição de ${formatDate(rec.date)} (anterior)`
    $("ph-detail").replaceChildren(...(rec ? detailNodes(rec) : [el("p", { class: "ev-empty", text: "Nenhuma prescrição de hemodiálise registrada." })]))
    $("ph-print").disabled = !rec
    $("ph-delete").disabled = !selectedId
  }

  $("ph-tbody").addEventListener("click", (e) => {
    if (e.target.closest(".ph-verhd")) return
    const r = e.target.closest("tr[data-id]")
    if (r) { selectedId = Number(r.dataset.id); render() }
  })
  $("ph-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      selectedId = Number(r.dataset.id)
      render()
      $("ph-tbody").querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus()
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus()
    }
  })
  document.querySelector('[data-section="prescricao-hd"]')?.addEventListener("click", render)

  // ---------- Ver HD ----------
  // Para cada prescrição, as sessões de HD feitas enquanto ela valia (da data dela até a próxima prescrição).
  // Cada HD mostra os dados do paciente naquele dia: sessão, prescrição, acesso vascular, exames e sorologia.
  const fmtNum = (v, unit) => (v === "" || v == null ? "-" : `${String(v).replace(".", ",")} ${unit}`)
  const C = window.HuNefroCatalogos
  const profName = (id) => C?.PROFESSIONALS?.find((p) => p.id === id)?.name || id || "-"
  function sessionsOf(rec) {
    const next = sorted().filter((x) => x.date > rec.date).sort((a, b) => a.date.localeCompare(b.date))[0]
    const list = window.HuNefroSessoesDialise?.getData() || []
    return list.filter((s) => s.date >= rec.date && (!next || s.date < next.date) && s.state !== "em-andamento")
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""))
  }
  function accessOn(date) {
    const list = window.HuNefroAcessosVasculares?.getData().access || []
    return list.filter((a) => a.date <= date && (a.status === "active" || !a.closedAt || a.closedAt >= date)).sort((a, b) => b.date.localeCompare(a.date))[0] || null
  }
  // Exames do dia ou, se não houver, o último resultado de cada exame nos 30 dias anteriores.
  function examsOn(date) {
    const all = window.HuNefroExames?.getData() || []
    const from = new Date(`${date}T12:00:00`); from.setDate(from.getDate() - 30)
    const min = from.toISOString().slice(0, 10)
    const latest = new Map()
    all.filter((x) => x.date <= date && x.date >= min).sort((a, b) => b.date.localeCompare(a.date)).forEach((x) => { if (!latest.has(x.name)) latest.set(x.name, x) })
    return [...latest.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
  const dl = (pairs) => el("dl", { class: "ph-dl" }, ...pairs.map(([l, v]) => el("div", {}, el("dt", { text: l }), el("dd", { text: v || "-" }))))

  const hd = { rec: null, list: [], index: 0 }
  function verHdButton(rec) {
    const n = sessionsOf(rec).length
    const b = el("button", { type: "button", class: "btn btn-sm btn-outline-primary ph-verhd", text: "Ver HD", disabled: !n,
      title: n ? `${n} ${n === 1 ? "sessão" : "sessões"} nesta prescrição` : "Nenhuma sessão de HD nesta prescrição", "aria-label": `Ver HD da prescrição de ${formatDate(rec.date)}` })
    b.addEventListener("click", (ev) => { ev.stopPropagation(); openVerHd(rec) })
    return b
  }
  function openVerHd(rec) {
    hd.rec = rec
    hd.list = sessionsOf(rec)
    hd.index = hd.list.length - 1
    renderVerHd()
    $("ph-hd-dialog").showModal()
    $("ph-hd-ok").focus()
  }
  function renderVerHd() {
    const s = hd.list[hd.index]
    if (!s) return
    const rec = hd.rec
    const access = accessOn(s.date)
    const exams = examsOn(s.date)
    const sero = window.HuNefroMock?.serologyRules?.(window.HuNefroDadosClinicos?.getData().marcadores_virais || {})
    const pas = (s.measures || []).map((m) => m.pa).filter(Boolean)
    $("ph-hd-title").textContent = `HD de ${formatDate(s.date)}`
    $("ph-hd-sub").textContent = `Sessão ${hd.index + 1} de ${hd.list.length} da prescrição de ${formatDate(rec.date)}${s.number ? ` · diálise nº ${s.number}` : ""}`
    $("ph-hd-prev").disabled = hd.index === 0
    $("ph-hd-next").disabled = hd.index === hd.list.length - 1
    $("ph-hd-body").replaceChildren(
      el("h4", { class: "ph-group-title", text: "Sessão" }),
      dl([
        ["Horário", s.start ? `${s.start} - ${s.end || "-"}` : "-"], ["Turno e sala", [s.shift, s.room].filter(Boolean).join(" · ")], ["Máquina", s.machine], ["Responsável", profName(s.responsible)],
        ["Peso inicial / final", `${fmtNum(s.weightStart, "kg")} / ${fmtNum(s.weightEnd, "kg")}`], ["UF", fmtNum(s.uf, "mL")], ["PA inicial / final", pas.length ? `${pas[0]} / ${pas[pas.length - 1]}` : "-"],
        ["Dialisador", s.dialyzer ? `${s.dialyzer} (${s.singleUse ? "uso único" : `uso ${s.usage || "-"}/${s.usageMax || 20}`})` : "-"], ["Complicações", s.complications || "Nenhuma"],
      ]),
      el("h4", { class: "ph-group-title", text: "Prescrição naquele dia" }),
      dl([
        ["Método", rec.method], ["Dialisador prescrito", rec.dialyzer], ["Duração", rec.duration ? `${rec.duration} h` : "-"], ["Peso seco", fmtNum(rec.dryWeight, "kg")],
        ["UF máxima", fmtNum(rec.ufMax, "mL")], ["Fluxo de sangue", fmtNum(rec.bloodFlow, "mL/min")], ["Heparina", fmtNum(rec.heparin, "UI")], ["Solução", rec.solution],
      ]),
      el("h4", { class: "ph-group-title", text: "Acesso vascular" }),
      dl([["Acesso no dia", access ? `${access.type} - ${access.loc}` : "Sem acesso ativo registrado"], ["Usado na sessão", s.access], ["Agulha", isCatheterAccess(s.access) ? NEEDLE_NOT_APPLICABLE : s.needle]]),
      el("h4", { class: "ph-group-title", text: "Exames (do dia ou até 30 dias antes)" }),
      exams.length ? el("dl", { class: "ph-dl" }, ...exams.slice(0, 16).map((x) => el("div", {}, el("dt", { text: x.name }), el("dd", { text: `${x.result}${x.date !== s.date ? ` (${formatDate(x.date)})` : ""}` }))))
        : el("p", { class: "ev-empty", text: "Nenhum exame nos 30 dias anteriores." }),
      ...(sero?.tags.length ? [el("div", { class: `hn-alert ${sero.tone === "danger" ? "hn-alert-danger" : "hn-alert-warn"}`, role: "note" },
        el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }), el("span", { text: `Sorologia atual: ${sero.tags.join(", ")}.` }))] : []),
    )
  }
  const closeVerHd = () => $("ph-hd-dialog").close()
  $("ph-hd-close").addEventListener("click", closeVerHd)
  $("ph-hd-ok").addEventListener("click", closeVerHd)
  $("ph-hd-prev").addEventListener("click", () => { hd.index = Math.max(0, hd.index - 1); renderVerHd() })
  $("ph-hd-next").addEventListener("click", () => { hd.index = Math.min(hd.list.length - 1, hd.index + 1); renderVerHd() })

  // ---------- Diálogo de nova prescrição ----------
  const dialog = $("ph-dialog")
  let returnFocus = null
  let controls = {}
  let mode = "form" // form | confirm
  let confirmRun = null

  function showError(msg) {
    $("ph-dialog-error").textContent = msg
    $("ph-dialog-error").hidden = !msg
  }
  function closeDialog() {
    if (dialog.open) dialog.close()
    returnFocus?.focus?.()
  }
  $("ph-dialog-cancel").addEventListener("click", closeDialog)
  $("ph-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog() })

  function buildForm(base) {
    controls = {}
    const form = el("div", { class: "ph-form" })
    GROUPS.forEach(([title, fields]) => {
      form.append(el("h4", { text: title }))
      fields.forEach((f, i) => {
        const id = `ph-f-${f.key}`
        let control
        let node = null
        if (f.other) {
          const built = createSelectWithOther({ id, options: f.options, otherLabel: f.other, placeholder: "Informe o dialisador" })
          control = built.control
          node = built.root
        } else if (f.kind === "select") {
          control = el("select", { class: "form-select", id, "data-no-dirty": true }, el("option", { value: "", text: "Selecione" }), ...f.options.map(([v, l]) => el("option", { value: v, text: l })))
        } else if (f.kind === "textarea") {
          control = el("textarea", { class: "form-control", id, rows: "4", "data-no-dirty": true })
        } else if (f.kind === "date") {
          control = el("input", { class: "form-control", id, type: "date", max: todayIso(), "data-no-dirty": true })
        } else {
          control = el("input", { class: "form-control", id, type: "text", autocomplete: "off", inputmode: f.kind === "number" ? "decimal" : f.kind === "time" ? "numeric" : "text", placeholder: f.kind === "time" ? "04:00" : "", "data-no-dirty": true })
        }
        const raw = f.key === "date" ? todayIso() : base?.[f.key] ?? ""
        const value = f.kind === "number" ? String(raw).replace(".", ",") : raw
        control.value = value
        controls[f.key] = control
        const block = el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), node || control)
        if (f.key === "needle" && catheterActive()) { block.hidden = true; control.value = "" }
        form.append(block)
      })
    })
    return form
  }

  function readAndValidate() {
    const out = {}
    for (const f of FIELDS) {
      const c = controls[f.key]
      const v = c.value.trim()
      out[f.key] = v
      if (c.missingOther) return { error: `Informe qual é o ${f.other.toLowerCase()}.`, focus: c }
      if (f.req && !v) return { error: `Informe o campo "${f.label.replace(/ \(.*\)/, "")}".`, focus: c }
      if (!v) continue
      if (f.kind === "date" && v > todayIso()) return { error: "A data da prescrição não pode ser futura.", focus: c }
      if (f.kind === "number") {
        const n = parseNumber(v)
        if (!Number.isFinite(n) || n < f.min || n > f.max) return { error: `${f.label.replace(/ \(.*\)/, "")} deve estar entre ${String(f.min).replace(".", ",")} e ${f.max} ${f.unit}.`, focus: c }
        out[f.key] = String(n)
      }
      if (f.kind === "time") {
        const m = v.match(/^(\d{1,2}):([0-5]\d)$/)
        const minutes = m ? +m[1] * 60 + +m[2] : 0
        if (!m || minutes < 30 || minutes > 720) return { error: "Duração inválida. Use hh:mm entre 00:30 e 12:00, ex.: 04:00.", focus: c }
        out[f.key] = `${m[1].padStart(2, "0")}:${m[2]}`
      }
    }
    if (catheterActive()) out.needle = ""
    return { values: out }
  }

  $("ph-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    if (mode === "confirm") { const run = confirmRun; closeDialog(); run?.(); return }
    const res = readAndValidate()
    if (res.error) { showError(res.error); res.focus.focus(); return }
    showError("")
    const rec = { id: nextId++, ...res.values, by: currentUserName() }
    items.push(rec)
    selectedId = null
    closeDialog()
    render()
    markDirty()
  })

  $("ph-new").addEventListener("click", () => {
    returnFocus = document.activeElement
    mode = "form"
    $("ph-dialog-title").textContent = "Nova prescrição de hemodiálise"
    $("ph-dialog-confirm").textContent = "Prescrever"
    $("ph-dialog-confirm").classList.add("btn-primary"); $("ph-dialog-confirm").classList.remove("btn-danger")
    // Parte dos valores da prescrição exibida para evitar redigitação; a data é sempre a de hoje.
    const base = shown()
    const form = buildForm(base)
    // Programa atual "Hemodiálise Pediátrica" (Programa de Tratamento) sugere o método pediátrico na primeira prescrição.
    if (!base && document.getElementById("programa-atual")?.value === "Hemodiálise Pediátrica") controls.method.value = "Hemodiálise Pediátrica"
    $("ph-dialog-body").replaceChildren(...(activeAccess() ? [] : [noAccessAlert()]), form)
    showError("")
    dialog.showModal()
    controls.date.focus()
  })

  $("ph-delete").addEventListener("click", () => {
    const rec = items.find((x) => x.id === selectedId)
    if (!rec) return
    returnFocus = document.activeElement
    mode = "confirm"
    confirmRun = () => { items = items.filter((x) => x.id !== rec.id); selectedId = null; render(); markDirty() }
    $("ph-dialog-title").textContent = "Excluir prescrição"
    $("ph-dialog-body").replaceChildren(el("p", { class: "ev-confirm", text: `Excluir a prescrição de ${formatDate(rec.date)}? Prefira registrar uma nova prescrição para manter o histórico.` }))
    $("ph-dialog-confirm").textContent = "Excluir"
    $("ph-dialog-confirm").classList.add("btn-danger"); $("ph-dialog-confirm").classList.remove("btn-primary")
    showError("")
    dialog.showModal()
    $("ph-dialog-confirm").focus()
  })

  // ---------- Impressão ----------
  $("ph-print").addEventListener("click", () => {
    const rec = shown()
    if (!rec) return
    const sheet = $("ph-print-sheet")
    sheet.replaceChildren(
      el("h2", { text: "Prescrição de Hemodiálise" }),
      el("p", { text: `Paciente: ${$("patient-name")?.textContent || ""} - Data: ${formatDate(rec.date)}` }),
      ...GROUPS.flatMap(([title, fields]) =>
        fields[0].kind === "textarea"
          ? [el("h3", { text: title }), el("p", { text: rec.notes || "-", style: "white-space:pre-wrap" })]
          : [el("h3", { text: title }), el("dl", {}, ...fields.map((f) => el("div", {}, el("dt", { text: f.label }), el("dd", { text: display(f, rec[f.key]) }))))],
      ),
      el("p", { text: `Prescrito por: ${rec.by}` }),
    )
    document.body.classList.add("ph-printing")
    window.print()
  })
  window.addEventListener("afterprint", () => document.body.classList.remove("ph-printing"))

  render()

  window.HuNefroPrescricaoHD = {
    getData: () => JSON.parse(JSON.stringify(items)),
    setData(list) {
      items = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = items.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedId = null
      render()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
