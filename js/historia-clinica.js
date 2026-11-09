// Aba Clínico / História Clínica e Evolução.
// Depende de js/catalogos.js, js/componentes.js e js/evolucao-modelos.js. Registros ficam em memória até existir a API.
// Eventos e Diagnósticos (e suas evoluções) aparecem no histórico, lidos de window.HuNefroEventosDiagnosticos.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, markDirty, parseNumber } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const EM = window.HuNefroEvolucaoModelos
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
  const AUX = [
    ["", "Selecione"],
    ["exame-fisico", "Exame Físico"],
    ["risco-queda", "Risco de Queda (Escala de Morse)"],
    ["avaliacao", "Solicitar Avaliação"],
    ["calculo-energetico", "Cálculo Energético (aba Nutrição)"],
  ]
  const PRIORITIES = [["rotina", "Rotina"], ["prioritaria", "Prioritária"], ["urgente", "Urgente"]]
  // Destinatário da solicitação de avaliação: categoria profissional, especialidade médica ou um profissional.
  const RECIPIENT_KINDS = [["categoria", "Categoria profissional"], ["especialidade", "Especialidade médica"], ["profissional", "Profissional"]]
  const EVENT_LABELS = {
    problema: "Problema / Diagnóstico", internacao: "Internação", infeccao: "Infecção",
    transfusao: "Transfusão sanguínea", especialista: "Avaliação por outro especialista", alergia: "Alergia", outros: "Outros",
  }
  const labelOf = (list, key) => (list.find(([k]) => k === key) || [, key])[1]
  const categoryOf = (name) => {
    const prof = C.PROFESSIONALS.find((p) => p.name === name)
    return prof ? prof.category === "medico" ? "medico" : prof.category : "outros"
  }

  let notes = []
  let nextId = 1
  let selectedKey = null
  const filters = { categories: new Set(), types: new Set(), nurse: "", cancelled: false, from: "", to: "" }


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

  // Fecha os filtros de múltipla escolha ao clicar fora, ao abrir outro ou com Esc.
  const filterMenus = [...document.querySelectorAll(".hc-filter")]
  const closeMenus = (except) => filterMenus.forEach((menu) => { if (menu !== except) menu.open = false })
  filterMenus.forEach((menu) => menu.addEventListener("toggle", () => { if (menu.open) closeMenus(menu) }))
  document.addEventListener("click", (event) => closeMenus(event.target.closest(".hc-filter")))
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    const open = filterMenus.find((menu) => menu.open)
    if (!open) return
    open.open = false
    open.querySelector("summary").focus()
  })

  const nurse = $("hc-nurse")
  nurse.replaceChildren(el("option", { value: "", text: "Todos" }))
  C.PROFESSIONALS.filter((p) => p.category === "enfermagem").forEach((p) => nurse.append(el("option", { value: p.name, text: p.name })))
  nurse.addEventListener("change", () => { filters.nurse = nurse.value; render() })
  $("hc-cancelled").addEventListener("change", (e) => { filters.cancelled = e.target.checked; render() })
  ;["from", "to"].forEach((key) => $(`hc-${key}`).addEventListener("change", (e) => { filters[key] = e.target.value; render() }))
  $("hc-show-all").addEventListener("click", () => {
    filters.categories.clear(); filters.types.clear(); filters.nurse = ""; filters.cancelled = false; filters.from = ""; filters.to = ""
    document.querySelectorAll("#hc-cat-panel input, #hc-type-panel input, #hc-cancelled").forEach((b) => (b.checked = false))
    nurse.value = ""; $("hc-from").value = ""; $("hc-to").value = ""
    render()
  })

  // ---------- Impressão: imprime somente os registros visíveis com os filtros aplicados ----------
  function filterSummary() {
    const parts = []
    if (filters.from || filters.to) parts.push(`Período: ${filters.from ? formatDate(filters.from) : "início"} a ${filters.to ? formatDate(filters.to) : "hoje"}`)
    if (filters.categories.size) parts.push(`Categoria profissional: ${[...filters.categories].map((k) => labelOf(CATEGORIES, k)).join(", ")}`)
    if (filters.types.size) parts.push(`Tipo de registro: ${[...filters.types].map((k) => labelOf(FILTER_TYPES, k)).join(", ")}`)
    if (filters.nurse) parts.push(`Enfermeiro: ${filters.nurse}`)
    if (filters.cancelled) parts.push("Incluindo registros cancelados")
    return parts
  }

  // Folhas A4 no padrão de impressão HU-UFMA (peças de js/receituarios.js): 1ª folha com cabeçalho completo, paciente e
  // filtros; as seguintes com cabeçalho reduzido. Registros em ordem cronológica; um registro longo continua na folha
  // seguinte com "(continuação)". As folhas são montadas fora da tela para medir a altura de cada bloco.
  function printLines(text) {
    return String(text || "-").split("\n").map((line) => {
      const t = line.trim()
      if (!t) return el("div", { class: "pr-hc-gap" })
      if (t.startsWith("- ")) return el("p", { class: "pr-hc-p pr-hc-li", text: t.slice(2) })
      if (t.length <= 60 && (t.endsWith(":") || (t === t.toUpperCase() && /[A-ZÀ-Ú]{4}/.test(t)))) return el("p", { class: "pr-hc-p pr-hc-sub", text: t })
      return el("p", { class: "pr-hc-p", text: t })
    })
  }

  function authorLine(name) {
    const RX = window.HuNefroReceituarios
    const prof = C.PROFESSIONALS.find((p) => p.name === name)
    return [name || "-", labelOf(CATEGORIES, categoryOf(name)), prof && RX?.councilOf(prof)].filter(Boolean).join(" - ")
  }

  function entryHead(e, continued = false) {
    const marks = [e.restricted && "Registro restrito", e.cancelled && "Cancelado"].filter(Boolean)
    return el("header", { class: "pr-hc-head" },
      el("strong", { text: formatDate(e.date) }),
      el("span", { text: `${e.title}${continued ? " (continuação)" : ""}` }),
      ...(marks.length ? [el("em", { text: marks.join(" · ") })] : []))
  }

  function printPages(entries) {
    const RX = window.HuNefroReceituarios
    const ctx = RX.patientContext()
    const summary = filterSummary()
    const box = el("div", { class: "hc-measure", "aria-hidden": "true" })
    document.body.append(box)
    const body = () => el("div", { class: "pr-hc-body" })
    const foot = () => RX.footer("")
    const pages = []
    const addPage = (...head) => {
      const page = RX.page("pr-hc", ...head, body(), foot())
      pages.push(page)
      box.append(page)
      return page.querySelector(".pr-hc-body")
    }
    let target = addPage(
      RX.letterhead(),
      el("h2", { class: "pr-title", text: "HISTÓRIA CLÍNICA E EVOLUÇÃO" }),
      RX.patientBox(ctx),
      el("section", { class: "pr-hc-filters" },
        RX.field("Filtros aplicados", summary.length ? summary.join(" · ") : "Todos os registros", "pr-span-2"),
        RX.field("Registros", `${entries.length} (${entries.length ? `${formatDate(entries[0].date)} a ${formatDate(entries.at(-1).date)}` : "nenhum"})`)),
    )
    const nextPage = () => {
      target = addPage(RX.compactHead(), el("p", { class: "pr-laudo-cont-id", text: `HISTÓRIA CLÍNICA E EVOLUÇÃO (continuação) · ${ctx.name} · Prontuário ${ctx.code || "-"}` }))
    }
    const overflows = () => target.scrollHeight > target.clientHeight + 1

    if (!entries.length) target.append(el("p", { class: "pr-hc-p", text: "Nenhum registro com os filtros aplicados." }))
    entries.forEach((e) => {
      let article = el("article", { class: `pr-hc-entry${e.cancelled ? " is-cancelled" : ""}` }, entryHead(e))
      target.append(article)
      const blocks = [...printLines(e.text), el("p", { class: "pr-hc-by", text: authorLine(e.by) })]
      blocks.forEach((block) => {
        article.append(block)
        if (!overflows()) return
        block.remove()
        // A assinatura não fica sozinha na folha seguinte: leva junto a última linha do texto.
        const carry = block.classList.contains("pr-hc-by") && article.childElementCount > 2 ? article.lastElementChild : null
        carry?.remove()
        if (article.childElementCount === 1) {
          // Só o cabeçalho coube: o registro inteiro desce para a próxima folha.
          article.remove()
          nextPage()
          target.append(article)
        } else {
          nextPage()
          article = el("article", { class: `pr-hc-entry${e.cancelled ? " is-cancelled" : ""}` }, entryHead(e, true))
          target.append(article)
        }
        if (carry) article.append(carry)
        article.append(block)
      })
    })
    const printed = `Impresso em ${formatDate(todayIso())} por ${currentUserName()}`
    pages.forEach((page, i) => {
      page.querySelector(".pr-foot span").textContent = [printed, ctx.code && `Prontuário ${ctx.code}`, `Página ${i + 1} de ${pages.length}`].filter(Boolean).join(" · ")
    })
    box.remove()
    return pages
  }

  $("hc-print").addEventListener("click", () => {
    const RX = window.HuNefroReceituarios
    if (!RX) return
    const entries = visibleEntries().reverse()
    // As logos precisam estar carregadas para medir a altura do cabeçalho.
    const logos = ["logo-hu-brasil", "logo-hu", "logo-ufma"].map((name) => new Promise((done) => {
      const img = new Image()
      img.onload = img.onerror = done
      img.src = `assets/impressao/${name}.png`
    }))
    Promise.all(logos).then(() => RX.print([{ pages: () => printPages(entries) }]))
  })

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
    const own = notes.map((n) => ({ key: `n-${n.id}`, source: "nota", type: n.type, date: n.date, title: labelOf(TYPES, n.type), text: n.text, by: n.by, restricted: n.restricted, cancelled: n.cancelled, id: n.id, aux: n.aux }))
    return [...own, ...eventEntries()].sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key))
  }

  function visibleEntries() {
    return allEntries().filter((e) => {
      if (e.cancelled && !filters.cancelled) return false
      if (filters.types.size && !filters.types.has(e.type)) return false
      if (filters.categories.size && !filters.categories.has(categoryOf(e.by))) return false
      if (filters.nurse && e.by !== filters.nurse) return false
      if (filters.from && e.date < filters.from) return false
      if (filters.to && e.date > filters.to) return false
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
        if (e.aux?.length) art.append(el("p", { class: "hc-aux-tags" }, ...e.aux.map(auxBadge)))
        art.append(el("p", { class: "hc-entry-text", text: e.text || "-" }))
        const foot = el("p", { class: "hc-entry-by" }, document.createTextNode(`${e.by} - ${labelOf(CATEGORIES, categoryOf(e.by))}`))
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
            const n = parseNumber(v)
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

  // ---------- Resultado das funções auxiliares ----------
  // Cada função auxiliar insere o texto no registro e guarda os dados estruturados (para a API e para Comunicações).
  // Ao gravar, só ficam os resultados cujo texto ainda está no registro.
  let pendingAux = []

  function auxBadge(aux) {
    if (aux.kind === "risco-queda") {
      const { score, risk, tone } = EM.morseScore(aux.answers)
      return el("span", { class: `hn-badge hn-badge-${tone}`, text: `Risco de queda: ${risk} (${score})` })
    }
    return el("span", { class: "hn-badge hn-badge-info", text: `Avaliação solicitada: ${aux.recipientLabel}${aux.priority !== "rotina" ? ` (${labelOf(PRIORITIES, aux.priority).toLowerCase()})` : ""}` })
  }

  function lastMorse() {
    return notes.filter((n) => !n.cancelled && n.aux?.some((a) => a.kind === "risco-queda"))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map((n) => ({ date: n.date, ...n.aux.find((a) => a.kind === "risco-queda") }))[0] || null
  }

  // A Escala de Morse também é lançada em Exames ("Risco de queda"), para acompanhar a evolução no Flow.
  function launchFallRisk(date, aux) {
    const api = window.HuNefroExames
    if (!api) return
    const exams = api.getData()
    const { score, risk } = EM.morseScore(aux.answers)
    const id = exams.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
    api.setData([...exams, { id, date, name: "Risco de queda", result: `${score} (${risk} risco)`, description: "Escala de Morse (História Clínica e Evolução)", by: currentUserName() }])
  }

  // ---------- Risco de queda (Escala de Morse) ----------
  // Sugestões tiradas do prontuário: mais de um diagnóstico ativo e cateter venoso central como acesso ativo.
  function morseSuggestions() {
    const ctx = window.HuNefroLaudos?.context?.($("hc-date").value || todayIso())
    if (!ctx) return {}
    const out = {}
    if (ctx.problems.length || ctx.etiology) out.diagnostico = "o prontuário tem outros diagnósticos além da DRC"
    if (ctx.activeAccess?.kind === "cateter") out.endovenosa = `acesso ativo: ${ctx.activeAccess.type}`
    return out
  }

  function openFallRisk() {
    const answers = { historico: false, diagnostico: false, deambulacao: 0, endovenosa: false, marcha: 0, mental: 0 }
    const hints = morseSuggestions()
    Object.keys(hints).forEach((key) => { answers[key] = true })
    const last = lastMorse()

    const result = el("p", { class: "hc-morse-result", "aria-live": "polite" })
    const update = () => {
      const { score, risk, tone } = EM.morseScore(answers)
      result.replaceChildren(el("span", { text: "Risco de queda: " }), el("strong", { text: `${score} pontos` }), el("span", { class: `hn-badge hn-badge-${tone}`, text: `${risk} risco` }))
    }
    const rows = EM.MORSE.map((item) => {
      const id = `hc-morse-${item.key}`
      if (item.yesNo) {
        const box = el("input", { type: "checkbox", id, "data-no-dirty": true })
        box.checked = answers[item.key]
        box.addEventListener("change", () => { answers[item.key] = box.checked; update() })
        return el("div", { class: "hc-morse-item" },
          el("label", { class: "hc-check", for: id }, box, el("span", { text: item.label })),
          el("span", { class: "hc-morse-pts", text: `Sim = ${item.yesNo}` }),
          ...(hints[item.key] ? [el("small", { class: "hc-morse-hint", text: `Sugerido: ${hints[item.key]}.` })] : []))
      }
      const select = el("select", { class: "form-select form-select-sm", id, "data-no-dirty": true },
        ...item.options.map(([label, pts], i) => el("option", { value: String(i), text: `${label} (${pts})` })))
      select.addEventListener("change", () => { answers[item.key] = Number(select.value); update() })
      return el("div", { class: "hc-morse-item" }, el("label", { class: "field-label", for: id, text: item.label }), select)
    })
    update()

    openDialog({
      title: "Risco de Queda - Escala de Morse",
      confirmLabel: "Inserir no registro",
      body: el("div", { class: "hc-morse" },
        ...(last ? [el("p", { class: "hc-morse-last", text: `Última avaliação: ${formatDate(last.date)} - ${EM.morseScore(last.answers).score} pontos (${EM.morseScore(last.answers).risk} risco).` })] : []),
        ...rows, result,
        el("p", { class: "form-text", text: "Classificação: 0 a 24 baixo risco, 25 a 44 médio risco, 45 ou mais alto risco (Escala de Morse, versão brasileira)." })),
      validate: () => "",
      submit() {
        const aux = { kind: "risco-queda", answers: { ...answers } }
        aux.text = EM.morseText(aux.answers)
        pendingAux.push(aux)
        appendText(aux.text)
      },
    })
  }

  // ---------- Solicitar avaliação ----------
  const recipientOptions = (kind) => {
    if (kind === "categoria") return CATEGORIES.filter(([k]) => !["administracao", "qualidade", "suprimentos", "outros"].includes(k))
    if (kind === "especialidade") return C.specialties.filter(([, l]) => l !== "Outra")
    return C.PROFESSIONALS.filter((p) => p.name !== currentUserName()).map((p) => [p.id, p.label])
  }

  function openEvaluationRequest() {
    const kind = el("div", { class: "hc-radios", role: "radiogroup", "aria-label": "Enviar para" },
      ...RECIPIENT_KINDS.map(([v, l], i) => el("label", { class: "hc-check" },
        el("input", { type: "radio", name: "hc-av-kind", value: v, "data-no-dirty": true, ...(i === 0 ? { checked: true } : {}) }), el("span", { text: l }))))
    const recipient = el("select", { class: "form-select", id: "hc-av-to", "data-no-dirty": true })
    const fillRecipients = () => {
      const k = kind.querySelector("input:checked").value
      recipient.replaceChildren(el("option", { value: "", text: "Selecione" }), ...recipientOptions(k).map(([v, l]) => el("option", { value: v, text: l })))
    }
    kind.addEventListener("change", fillRecipients)
    fillRecipients()
    const priority = el("select", { class: "form-select", id: "hc-av-priority", "data-no-dirty": true }, ...PRIORITIES.map(([v, l]) => el("option", { value: v, text: l })))
    const due = el("input", { class: "form-control", type: "date", id: "hc-av-due", min: todayIso(), "data-no-dirty": true })
    const reason = el("textarea", { class: "form-control", id: "hc-av-reason", rows: 4, "data-no-dirty": true })
    const field = (input, label, cls = "") => el("div", { class: `field-block ${cls}` }, el("label", { class: "field-label", for: input.id, text: label }), input)

    openDialog({
      title: "Solicitar Avaliação",
      confirmLabel: "Inserir no registro",
      body: el("div", { class: "ev-form-grid" },
        el("div", { class: "field-block hc-wide" }, el("span", { class: "field-label", text: "Enviar para" }), kind),
        field(recipient, "Destinatário *", "hc-wide"),
        field(priority, "Prioridade"),
        field(due, "Data limite"),
        field(reason, "Motivo da solicitação *", "hc-wide"),
        el("p", { class: "form-text hc-wide", text: "A solicitação fica registrada na evolução e, ao gravar o registro, chega ao destinatário no quadro de Comunicações." })),
      validate() {
        if (!recipient.value) return "Selecione o destinatário."
        if (due.value && due.value < todayIso()) return "A data limite não pode ser anterior a hoje."
        if (!reason.value.trim()) return "Escreva o motivo da solicitação."
        return ""
      },
      submit() {
        const recipientKind = kind.querySelector("input:checked").value
        const recipientLabel = recipient.selectedOptions[0].textContent
        const details = [`Prioridade: ${labelOf(PRIORITIES, priority.value).toLowerCase()}`, due.value && `prazo até ${formatDate(due.value)}`].filter(Boolean).join("; ")
        const aux = {
          kind: "avaliacao", recipientKind, recipient: recipient.value, recipientLabel, priority: priority.value, due: due.value,
          reason: reason.value.trim(), status: "pendente",
        }
        aux.text = `Solicito avaliação: ${recipientLabel} (${labelOf(RECIPIENT_KINDS, recipientKind).toLowerCase()}). ${details}. Motivo: ${aux.reason.replace(/\.$/, "")}.`
        pendingAux.push(aux)
        appendText(aux.text)
      },
    })
  }

  // A solicitação gravada na evolução também vai para o quadro de Comunicações do destinatário.
  const RECIPIENT_TO_COMMUNICATION = { categoria: "grupo", especialidade: "especialidade", profissional: "usuario" }
  function sendEvaluation(aux) {
    const S = window.HuNefroComunicacoes
    if (!S) return
    const patientId = Number(new URLSearchParams(location.search).get("patient")) || undefined
    const patient = window.HuNefroMock?.patients.find((p) => p.id === patientId)
    const label = aux.recipientKind === "especialidade" ? `Especialidade: ${aux.recipientLabel}` : aux.recipientLabel
    const item = S.add({
      type: "avaliacao", source: "evolucao", priority: aux.priority, due: aux.due || undefined, patientId,
      title: `Solicitação de avaliação${patient ? `: ${patient.name}` : ""}`, text: aux.reason,
      recipients: [{ kind: RECIPIENT_TO_COMMUNICATION[aux.recipientKind] || "grupo", value: aux.recipient, label }],
    })
    aux.communicationId = item.id
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

  // Padrões: preenchem o texto com os dados do prontuário (o texto continua editável).
  $("hc-patterns").replaceChildren(
    ...EM.PATTERNS.map((p) => el("button", { class: "btn btn-outline-secondary btn-sm hc-pattern", type: "button", text: p.name, title: p.hint, "data-pattern": p.id })),
  )
  $("hc-patterns").addEventListener("click", (event) => {
    const b = event.target.closest("[data-pattern]")
    if (!b) return
    const pattern = EM.find(b.dataset.pattern)
    const ctx = EM.context($("hc-date").value || todayIso())
    appendText(ctx ? pattern.build(ctx) : `${pattern.name}: `)
    textArea.style.height = `${Math.min(textArea.scrollHeight + 4, 640)}px`
    if (!/^(evolucao|avaliacao-inicial)$/.test(typeSelect.value)) typeSelect.value = "evolucao"
    // Seleciona o primeiro [preencher] para o profissional completar.
    const blank = textArea.value.indexOf("[preencher]")
    if (blank >= 0) textArea.setSelectionRange(blank, blank + "[preencher]".length)
  })

  $("hc-aux").addEventListener("change", (event) => {
    const value = event.target.value
    event.target.value = ""
    if (value === "exame-fisico") openPhysicalExam()
    else if (value === "risco-queda") openFallRisk()
    else if (value === "avaliacao") openEvaluationRequest()
    else if (value === "calculo-energetico") document.querySelector('[data-section="nutricao"]')?.click()
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
    const aux = pendingAux.filter((a) => text.includes(a.text))
    const note = { id: nextId++, date, type: typeSelect.value, restricted: $("hc-restricted").checked, text, by: currentUserName(), cancelled: false, ...(aux.length ? { aux } : {}) }
    notes.push(note)
    aux.filter((a) => a.kind === "risco-queda").forEach((a) => launchFallRisk(date, a))
    aux.filter((a) => a.kind === "avaliacao").forEach(sendEvaluation)
    pendingAux = []
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
      pendingAux = []
      nextId = notes.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1
      selectedKey = null
      render()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
