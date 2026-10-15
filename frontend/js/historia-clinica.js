// Aba Clínico / História Clínica e Evolução.
// Depende de js/catalogos.js e js/componentes.js. Registros ficam em memória até existir a API.
// Eventos e Diagnósticos (e suas evoluções) aparecem no histórico, lidos de window.HuNefroEventosDiagnosticos.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const $ = (id) => document.getElementById(id)
  if (!$("hc-entries")) return

  // Listas provisórias (a API/administração devem fornecer).
  const CATEGORIES = [
    ["administracao", "Administração"], ["aux-enfermagem", "Aux. Enfermagem"], ["medico", "Corpo médico"],
    ["educacao-fisica", "Educação física"], ["enfermagem", "Enfermagem"], ["farmacia", "Farmácia"],
    ["fisioterapia", "Fisioterapia"], ["fonoaudiologia", "Fonoaudiologia"], ["nutricao", "Nutrição"],
    ["odontologia", "Odontologia"], ["outros", "Outros"], ["psicologia", "Psicologia"],
    ["qualidade", "Qualidade"], ["servico-social", "Serviço Social"], ["suprimentos", "Suprimentos"],
    ["tec-enfermagem", "Téc. Enfermagem"], ["tec-radiologia", "Técnico em Radiologia"], ["terapia-ocupacional", "Terapia ocupacional"],
  ]
  const TYPES = [
    ["anotacao", "Anotação"],
    ["avaliacao-inicial", "Avaliação Inicial"],
    ["evolucao", "Evolução"],
  ]
  const FILTER_TYPES = [...TYPES, ["evento", "Eventos e Diagnósticos"]]
  const PATTERNS = ["Ação educativa", "enc. vascular", "Evol Nutrição", "EVOLUÇÃO MENSAL", "Exames laborat"] // textos a cadastrar pelo administrador
  const AUX = [
    ["", "Selecione"],
    ["exame-fisico", "Exame Físico"],
  ]
  const EVENT_LABELS = {
    problema: "Problema / Diagnóstico", internacao: "Internação", infeccao: "Infecção",
    transfusao: "Transfusão sanguínea", especialista: "Avaliação por outro especialista", alergia: "Alergia",
  }
  const labelOf = (list, key) => (list.find(([k]) => k === key) || [, key])[1]
  const categoryOf = (name) => {
    const prof = C.PROFESSIONALS.find((p) => p.name === name)
    return prof ? prof.category === "medico" ? "medico" : prof.category : "outros"
  }

  let notes = []
  let nextId = 1
  let selectedKey = null
  const filters = { categories: new Set(), types: new Set(), nurse: "", cancelled: false }

  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))

  // ---------- Filtros ----------
  function checkPanel(panel, options, set) {
    panel.replaceChildren(
      ...options.map(([key, label]) => {
        const box = el("input", { type: "checkbox", value: key, "data-no-dirty": true })
        box.addEventListener("change", () => {
          box.checked ? set.add(key) : set.delete(key)
          render()
        })
        return el("label", { class: "hc-check" }, box, el("span", { text: label }))
      }),
    )
  }
  checkPanel($("hc-cat-panel"), CATEGORIES, filters.categories)
  checkPanel($("hc-type-panel"), FILTER_TYPES, filters.types)

  const nurse = $("hc-nurse")
  nurse.replaceChildren(el("option", { value: "", text: "Todos" }))
  C.PROFESSIONALS.filter((p) => p.category === "enfermagem").forEach((p) => nurse.append(el("option", { value: p.name, text: p.name })))
  nurse.addEventListener("change", () => { filters.nurse = nurse.value; render() })
  $("hc-cancelled").addEventListener("change", (e) => { filters.cancelled = e.target.checked; render() })
  $("hc-show-all").addEventListener("click", () => {
    filters.categories.clear(); filters.types.clear(); filters.nurse = ""; filters.cancelled = false
    document.querySelectorAll("#hc-cat-panel input, #hc-type-panel input, #hc-cancelled").forEach((b) => (b.checked = false))
    nurse.value = ""
    render()
  })
  $("hc-print").addEventListener("click", () => window.print())

  // ---------- Montagem da lista de registros ----------
  function eventEntries() {
    const api = window.HuNefroEventosDiagnosticos
    const events = api ? api.getData() : []
    const out = []
    events.forEach((e) => {
      const title = `${EVENT_LABELS[e.kind] || e.kind} - ${e.type}`
      const parts = []
      Object.entries(e.data || {}).forEach(([k, v]) => { if (typeof v === "string") parts.push(v); else if (v && v.label) parts.push(`CID: ${v.label}`) })
      out.push({ key: `ev-${e.id}`, source: "evento", type: "evento", date: e.start, title, text: parts.join("\n"), by: e.createdBy, cancelled: false })
      e.evolutions.forEach((evo, i) =>
        out.push({ key: `ev-${e.id}-evo-${i}`, source: "evento", type: "evento", date: evo.date, title: `${title} (Evolução)`, text: evo.text, by: evo.by, cancelled: false }),
      )
    })
    return out
  }

  function allEntries() {
    const own = notes.map((n) => ({ key: `n-${n.id}`, source: "nota", type: n.type, date: n.date, title: labelOf(TYPES, n.type), text: n.text, by: n.by, restricted: n.restricted, cancelled: n.cancelled, id: n.id }))
    return [...own, ...eventEntries()].sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key))
  }

  function visibleEntries() {
    return allEntries().filter((e) => {
      if (e.cancelled && !filters.cancelled) return false
      if (filters.types.size && !filters.types.has(e.type)) return false
      if (filters.categories.size && !filters.categories.has(categoryOf(e.by))) return false
      if (filters.nurse && e.by !== filters.nurse) return false
      return true
    })
  }

  // ---------- Renderização ----------
  function render() {
    const entries = visibleEntries()
    if (selectedKey && !entries.some((e) => e.key === selectedKey)) selectedKey = null

    const dates = $("hc-dates")
    dates.replaceChildren(
      ...entries.map((e) => {
        const btn = el("button", { class: "hc-date-btn", type: "button", "data-key": e.key, "aria-current": String(e.key === selectedKey) },
          el("span", { text: formatDate(e.date) }), el("span", { class: "hc-date-type", text: labelOf(FILTER_TYPES, e.type) }))
        return el("li", {}, btn)
      }),
    )

    const box = $("hc-entries")
    if (!entries.length) {
      box.replaceChildren(el("p", { class: "ev-empty", text: allEntries().length ? "Nenhum registro com estes filtros." : "Nenhum registro no histórico." }))
      return
    }
    box.replaceChildren(
      ...entries.map((e) => {
        const art = el("article", { class: `hc-entry${e.cancelled ? " is-cancelled" : ""}${e.key === selectedKey ? " is-selected" : ""}`, id: `hc-entry-${e.key}` })
        const head = el("h4", { class: "hc-entry-title" }, el("span", { text: formatDate(e.date) }), document.createTextNode(` ${e.title}`))
        art.append(head)
        const tags = []
        if (e.restricted) tags.push("Restrito")
        if (e.cancelled) tags.push("Cancelado")
        if (tags.length) art.append(el("p", { class: "hc-tags", text: tags.join(" · ") }))
        art.append(el("p", { class: "hc-entry-text", text: e.text || "—" }))
        const foot = el("p", { class: "hc-entry-by" }, document.createTextNode(`${e.by} — ${labelOf(CATEGORIES, categoryOf(e.by))}`))
        if (e.source === "nota" && !e.cancelled) {
          const cancel = el("button", { class: "btn btn-outline-danger btn-sm hc-cancel", type: "button", "data-cancel": e.id, text: "Cancelar registro" })
          foot.append(cancel)
        }
        art.append(foot)
        return art
      }),
    )
  }

  $("hc-dates").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-key]")
    if (!btn) return
    selectedKey = btn.dataset.key
    render()
    const target = document.getElementById(`hc-entry-${selectedKey}`)
    target?.scrollIntoView({ block: "nearest" })
    $("hc-dates").querySelector(`[data-key="${selectedKey}"]`)?.focus()
  })

  // ---------- Diálogo ----------
  const dialog = $("hc-dialog")
  let dialogState = null
  let returnFocus = null

  function openDialog({ title, confirmLabel, body, validate, submit, danger }) {
    returnFocus = document.activeElement
    $("hc-dialog-title").textContent = title
    const confirm = $("hc-dialog-confirm")
    confirm.textContent = confirmLabel
    confirm.classList.toggle("btn-danger", !!danger)
    confirm.classList.toggle("btn-primary", !danger)
    $("hc-dialog-body").replaceChildren(body)
    $("hc-dialog-error").hidden = true
    dialogState = { validate, submit }
    dialog.showModal()
    $("hc-dialog-body").querySelector("input, select, textarea")?.focus()
  }
  function closeDialog() {
    if (dialog.open) dialog.close()
    dialogState = null
    returnFocus?.focus?.()
  }
  $("hc-dialog-form").addEventListener("submit", (event) => {
    event.preventDefault()
    if (!dialogState) return
    const error = dialogState.validate()
    if (error) {
      $("hc-dialog-error").textContent = error
      $("hc-dialog-error").hidden = false
      return
    }
    dialogState.submit()
    closeDialog()
  })
  $("hc-dialog-cancel").addEventListener("click", closeDialog)
  $("hc-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog() })

  $("hc-entries").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-cancel]")
    if (!btn) return
    const note = notes.find((n) => n.id === Number(btn.dataset.cancel))
    if (!note) return
    openDialog({
      title: "Cancelar registro",
      confirmLabel: "Cancelar registro",
      danger: true,
      body: el("p", { class: "ev-confirm", text: `Cancelar o registro de ${formatDate(note.date)} (${labelOf(TYPES, note.type)})? Ele deixa de aparecer no histórico, mas pode ser visto em "Ver cancelados".` }),
      validate: () => "",
      submit() { note.cancelled = true; render(); markDirty() },
    })
  })

  // ---------- Exame Físico (função auxiliar) ----------
  const EXAM_FIELDS = [
    { name: "pa", label: "PA (mmHg)", hint: "Ex.: 120/80", inputmode: "numeric" },
    { name: "peso", label: "Peso (kg)", min: 1, max: 400, unit: "kg" },
    { name: "altura", label: "Altura (cm)", min: 30, max: 250, unit: "cm" },
    { name: "temp", label: "Temperatura (°C)", min: 30, max: 45, unit: "°C" },
    { name: "diurese", label: "Diurese (mL)", min: 0, max: 10000, unit: "mL" },
    { name: "fc", label: "FC (bpm)", min: 20, max: 300, unit: "bpm" },
  ]
  const num = (v) => Number(String(v).trim().replace(",", "."))

  function openPhysicalExam() {
    const grid = el("div", { class: "ev-form-grid" })
    const inputs = {}
    EXAM_FIELDS.forEach((f, i) => {
      const input = el("input", { class: "form-control", id: `hc-ex-${f.name}`, autocomplete: "off", inputmode: f.inputmode || "decimal", "data-no-dirty": true })
      inputs[f.name] = input
      grid.append(el("div", { class: "field-block" }, el("label", { class: "field-label", for: input.id, text: f.label }), input, ...(f.hint ? [el("div", { class: "form-text", text: f.hint })] : [])))
    })
    openDialog({
      title: "Exame Físico",
      confirmLabel: "Gravar",
      body: grid,
      validate() {
        for (const f of EXAM_FIELDS) {
          const v = inputs[f.name].value.trim()
          if (!v) continue
          if (f.name === "pa") {
            const m = v.match(/^(\d{2,3})\s*[/x]\s*(\d{2,3})$/i)
            if (!m || +m[1] < 40 || +m[1] > 300 || +m[2] < 20 || +m[2] > 200 || +m[2] >= +m[1]) return "PA inválida. Use o formato sistólica/diastólica, ex.: 120/80."
          } else {
            const n = num(v)
            if (!Number.isFinite(n) || n < f.min || n > f.max) return `${f.label.split(" (")[0]} deve estar entre ${f.min} e ${f.max} ${f.unit}.`
          }
        }
        return EXAM_FIELDS.some((f) => inputs[f.name].value.trim()) ? "" : "Preencha ao menos um campo."
      },
      submit() {
        const parts = EXAM_FIELDS.filter((f) => inputs[f.name].value.trim()).map((f) => {
          const v = inputs[f.name].value.trim().replace(/\s+/g, "")
          return f.name === "pa" ? `PA ${v} mmHg` : `${f.label.split(" (")[0]} ${v} ${f.unit}`
        })
        appendText(`Exame físico: ${parts.join("; ")}.`)
      },
    })
  }

  // ---------- Novo registro ----------
  const textArea = $("hc-text")
  const textError = $("hc-text-error")
  const typeSelect = $("hc-type")
  typeSelect.replaceChildren(...TYPES.map(([v, l]) => el("option", { value: v, text: l })))
  $("hc-date").value = todayIso()
  $("hc-date").max = todayIso()
  $("hc-aux").replaceChildren(...AUX.map(([v, l]) => el("option", { value: v, text: l })))

  function appendText(text) {
    textArea.value = textArea.value ? `${textArea.value.replace(/\s+$/, "")}\n${text}` : text
    textArea.focus()
    textError.hidden = true
  }

  $("hc-patterns").replaceChildren(
    ...PATTERNS.map((name) => el("button", { class: "btn btn-outline-secondary btn-sm hc-pattern", type: "button", text: name, "data-pattern": name })),
  )
  $("hc-patterns").addEventListener("click", (event) => {
    const b = event.target.closest("[data-pattern]")
    if (b) appendText(`${b.dataset.pattern}: `)
  })

  $("hc-aux").addEventListener("change", (event) => {
    const value = event.target.value
    event.target.value = ""
    if (value === "exame-fisico") openPhysicalExam()
  })

  $("hc-save").addEventListener("click", () => {
    const date = $("hc-date").value
    const text = textArea.value.trim()
    let error = ""
    if (!date) error = "Informe a data do registro."
    else if (date > todayIso()) error = "A data do registro não pode ser futura."
    else if (!text) error = "Escreva o texto do registro."
    if (error) {
      textError.textContent = error
      textError.hidden = false
      ;(date && date <= todayIso() ? textArea : $("hc-date")).focus()
      return
    }
    textError.hidden = true
    const note = { id: nextId++, date, type: typeSelect.value, restricted: $("hc-restricted").checked, text, by: currentUserName(), cancelled: false }
    notes.push(note)
    selectedKey = `n-${note.id}`
    textArea.value = ""
    $("hc-restricted").checked = false
    render()
    markDirty()
    document.getElementById(`hc-entry-${selectedKey}`)?.scrollIntoView({ block: "nearest" })
  })

  // Eventos podem ter mudado em outra aba: atualiza ao abrir esta.
  document.querySelector('[data-section="historia-clinica"]')?.addEventListener("click", () => render())
  if (new URLSearchParams(location.search).get("section") === "historia-clinica") render()

  render()

  window.HuNefroHistoriaClinica = {
    getData: () => JSON.parse(JSON.stringify(notes)),
    setData(list) {
      notes = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = notes.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1
      selectedKey = null
      render()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
