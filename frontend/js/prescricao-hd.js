// Aba Prescrição e Tratamento / Prescrição de Hemodiálise.
// Depende de js/catalogos.js e js/componentes.js. Prescrições ficam em memória até existir a API.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName } = window.HuNefroUI
  const $ = (id) => document.getElementById(id)
  if (!$("ph-tbody")) return

  // Listas transcritas das imagens do manual (p. 29). PROVISÓRIAS: o administrador deve poder cadastrar novas.
  const opts = (list) => list.map((v) => [v, v])
  const DIALYZERS = opts([
    "B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR",
    "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4",
  ])
  const METHODS = opts(["Hemodiálise", "HDF Mix", "HDF Pré", "HDF Pós", "HF Mix", "HF Pré", "HF Pós"])
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
      { key: "dialyzer", label: "Dialisador", kind: "select", options: DIALYZERS, req: true, cls: "ph-f3" },
      { key: "duration", label: "Duração (hh:mm)", kind: "time", req: true, cls: "ph-f3" },
      { key: "solution", label: "Solução do dialisato", kind: "select", options: SOLUTIONS, req: true, cls: "ph-f3" },
    ]],
    ["Fluxos e acesso", [
      { key: "bloodFlow", label: "Fluxo de sangue (mL/min)", kind: "number", min: 50, max: 600, unit: "mL/min", cls: "ph-f4" },
      { key: "dialysateFlow", label: "Fluxo de dialisato (mL/min)", kind: "number", min: 100, max: 1000, unit: "mL/min", cls: "ph-f4" },
      { key: "needle", label: "Agulha", kind: "text", cls: "ph-f4" },
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
  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))
  const sorted = () => [...items].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const current = () => sorted()[0] || null
  const shown = () => items.find((x) => x.id === selectedId) || current()
  const num = (v) => Number(String(v).trim().replace(",", "."))

  function display(f, v) {
    if (v === "" || v == null) return "—"
    if (f.kind === "date") return formatDate(v)
    if (f.kind === "number") return `${String(v).replace(".", ",")} ${f.unit}`
    if (f.kind === "time") return `${v} h`
    return String(v)
  }

  // ---------- Detalhe ----------
  function renderChips() {
    const api = window.HuNefroAcessosVasculares
    const active = api ? api.getData().access.filter((a) => a.status === "active").sort((a, b) => b.date.localeCompare(a.date))[0] : null
    $("ph-access").textContent = active ? `Acesso atual: ${active.type} — ${active.loc}` : "Acesso atual: nenhum acesso ativo cadastrado"
    const ex = window.HuNefroExames?.latest("Sódio")
    $("ph-na").textContent = ex ? `Último exame Na+: ${ex.result} (${formatDate(ex.date)})` : "Último exame Na+: não disponível"
  }

  function detailNodes(rec) {
    const nodes = []
    GROUPS.forEach(([title, fields]) => {
      if (fields[0].kind === "textarea") {
        nodes.push(el("h4", { class: "ph-group-title", text: title }), el("p", { class: "ph-notes", text: rec.notes || "—" }))
        return
      }
      nodes.push(
        el("h4", { class: "ph-group-title", text: title }),
        el("dl", { class: "ph-dl" }, ...fields.map((f) => el("div", {}, el("dt", { text: f.label }), el("dd", { text: display(f, rec[f.key]) })))),
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
          el("td", { text: x.dryWeight ? `${String(x.dryWeight).replace(".", ",")} kg` : "—" }), el("td", { text: x.ufMax ? `${x.ufMax} mL` : "—" }), el("td", { text: x.by })),
      ),
    )
    $("ph-empty").hidden = rows.length > 0
    const rec = shown()
    $("ph-detail-title").textContent = !rec ? "Prescrição vigente" : rec.id === cur.id ? `Prescrição vigente — ${formatDate(rec.date)}` : `Prescrição de ${formatDate(rec.date)} (anterior)`
    $("ph-detail").replaceChildren(...(rec ? detailNodes(rec) : [el("p", { class: "ev-empty", text: "Nenhuma prescrição de hemodiálise registrada." })]))
    $("ph-print").disabled = !rec
    $("ph-delete").disabled = !selectedId
  }

  $("ph-tbody").addEventListener("click", (e) => {
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
        if (f.kind === "select") {
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
        form.append(el("div", { class: `field-block ${f.cls}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), control))
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
      if (f.req && !v) return { error: `Informe o campo "${f.label.replace(/ \(.*\)/, "")}".`, focus: c }
      if (!v) continue
      if (f.kind === "date" && v > todayIso()) return { error: "A data da prescrição não pode ser futura.", focus: c }
      if (f.kind === "number") {
        const n = num(v)
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
    $("ph-dialog-body").replaceChildren(buildForm(shown()))
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
      el("p", { text: `Paciente: ${$("patient-name")?.textContent || ""} — Data: ${formatDate(rec.date)}` }),
      ...GROUPS.flatMap(([title, fields]) =>
        fields[0].kind === "textarea"
          ? [el("h3", { text: title }), el("p", { text: rec.notes || "—", style: "white-space:pre-wrap" })]
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
