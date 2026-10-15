// Aba Clínico / Eventos e Diagnósticos.
// Depende de js/catalogos.js (listas provisórias) e js/componentes.js (HuNefroUI).
// Os eventos ficam em memória até existir a API; a tela expõe getData()/setData()/validate().
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, createCidField } = window.HuNefroUI
  const C = window.HuNefroCatalogos

  const profName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const optionLabel = (options, value) => (options.find(([v]) => v === value) || [, value])[1]

  // Tipos de evento. Campos: kind = text | textarea | select | cid | multi
  const KINDS = {
    problema: {
      label: "Problema / Diagnóstico",
      typeLabel: "Problema",
      types: C.tiposProblema,
      fields: [
        { name: "cid", label: "CID", kind: "cid", wide: true },
        { name: "observacao", label: "Observações", kind: "textarea", wide: true },
      ],
    },
    internacao: {
      label: "Internação",
      typeLabel: "Motivo da internação",
      types: C.tiposInternacao,
      medication: true,
      fields: [
        { name: "cid", label: "CID", kind: "cid", wide: true },
        { name: "medico", label: "Médico assistente", kind: "select", options: C.doctorOptions() },
        { name: "observacao", label: "Observações", kind: "textarea", wide: true },
      ],
    },
    infeccao: {
      label: "Infecção",
      typeLabel: "Tipo de infecção",
      types: C.tiposInfeccao,
      medication: true,
      culture: true,
      fields: [
        {
          name: "relacao",
          label: "Relação",
          kind: "select",
          options: [
            ["tratamento", "Relacionada ao Tratamento / Acesso"],
            ["outra", "Não relacionada ao tratamento"],
          ],
        },
        { name: "posicao", label: "Posição", kind: "select", options: C.posicoesInfeccao },
        { name: "cid", label: "CID", kind: "cid", wide: true },
        { name: "sinais", label: "Sinais e sintomas", kind: "textarea", wide: true },
        { name: "conduta", label: "Conduta", kind: "textarea", wide: true },
        { name: "fator", label: "Fator predisponente", kind: "textarea", wide: true },
      ],
    },
    transfusao: {
      label: "Transfusão sanguínea",
      typeLabel: "Tipo de transfusão",
      types: C.tiposTransfusao,
      singleDate: true,
      fields: [
        { name: "responsavel", label: "Médico responsável", kind: "select", options: C.doctorOptions() },
        { name: "observacao", label: "Observações", kind: "textarea", wide: true },
      ],
    },
    especialista: {
      label: "Avaliação por outro especialista",
      typeLabel: "Especialidade",
      types: C.specialties,
      fields: [
        { name: "especialista", label: "Especialista", kind: "select", options: C.specialistOptions() },
        { name: "observacao", label: "Parecer / observações", kind: "textarea", wide: true },
      ],
    },
    alergia: {
      label: "Alergia",
      typeLabel: "Tipo de alergia",
      types: C.tiposAlergia,
      fields: [
        { name: "substancia", label: "Substância / alimento", kind: "text" },
        { name: "reacao", label: "Reação", kind: "textarea", wide: true },
      ],
    },
  }

  let events = []
  let selectedId = null
  let nextId = 1
  let dialogState = null // { submit(), validate() }

  // ---------- Referências ----------
  const $ = (id) => document.getElementById(id)
  const refs = {
    newType: $("ev-new-type"),
    addButton: $("ev-add-button"),
    filterType: $("ev-filter-type"),
    filterStatus: $("ev-filter-status"),
    tbody: $("ev-tbody"),
    empty: $("ev-empty"),
    detail: $("ev-detail"),
    dialog: $("ev-dialog"),
    dialogTitle: $("ev-dialog-title"),
    dialogBody: $("ev-dialog-body"),
    dialogError: $("ev-dialog-error"),
    dialogForm: $("ev-dialog-form"),
    dialogConfirm: $("ev-dialog-confirm"),
    actions: {
      edit: $("ev-act-edit"),
      evolution: $("ev-act-evolution"),
      medication: $("ev-act-medication"),
      culture: $("ev-act-culture"),
      finish: $("ev-act-finish"),
      delete: $("ev-act-delete"),
    },
  }
  if (!refs.tbody) return

  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))

  function fillSelect(select, options, firstLabel) {
    select.replaceChildren(el("option", { value: "", text: firstLabel }))
    options.forEach(([value, label]) => select.append(el("option", { value, text: label })))
  }

  // ---------- Lista ----------
  function visibleEvents() {
    const kind = refs.filterType.value
    const status = refs.filterStatus.value
    return events
      .filter((e) => (!kind || e.kind === kind) && (!status || (status === "open" ? !e.end : !!e.end)))
      .sort((a, b) => (b.start || "").localeCompare(a.start || ""))
  }

  const selected = () => events.find((e) => e.id === selectedId) || null

  function renderTable() {
    const rows = visibleEvents()
    if (selectedId && !rows.some((e) => e.id === selectedId)) selectedId = null
    refs.tbody.replaceChildren(
      ...rows.map((e) => {
        const tr = el(
          "tr",
          { tabindex: "0", "data-id": e.id, "aria-selected": String(e.id === selectedId), class: e.id === selectedId ? "is-selected" : "" },
          el("td", { text: formatDate(e.start) }),
          el("td", { text: e.end ? formatDate(e.end) : e.kind === "transfusao" ? "—" : "Em andamento" }),
          el("td", { text: KINDS[e.kind].label }),
          el("td", { text: e.type }),
          el("td", { text: `Em ${formatDate(e.createdAt)} por ${e.createdBy}` }),
          el("td", { text: `Em ${formatDate(e.updatedAt)}` }),
        )
        return tr
      }),
    )
    refs.empty.hidden = rows.length > 0
    refs.empty.textContent = events.length ? "Nenhum evento com este filtro." : "Nenhum evento registrado."
    renderActions()
    renderDetail()
  }

  function renderActions() {
    const e = selected()
    const kind = e && KINDS[e.kind]
    refs.actions.edit.disabled = !e
    refs.actions.evolution.disabled = !e
    refs.actions.medication.disabled = !(kind && kind.medication)
    refs.actions.culture.disabled = !(kind && kind.culture)
    refs.actions.finish.disabled = !e || !!e.end || !!(kind && kind.singleDate)
    refs.actions.delete.disabled = !e
  }

  function detailLine(label, value) {
    return el("p", { class: "ev-line" }, el("strong", { text: `${label}: ` }), document.createTextNode(value))
  }

  function renderDetail() {
    const e = selected()
    if (!e) {
      refs.detail.replaceChildren(el("p", { class: "ev-empty", text: "Selecione um evento na lista para ver os detalhes." }))
      return
    }
    const kind = KINDS[e.kind]
    const nodes = [el("h4", { class: "ev-detail-title", text: `${kind.label} - ${e.type}` })]
    const lines = el("div", { class: "ev-detail-grid" })
    const left = el("div")
    left.append(detailLine(kind.singleDate ? "Data" : "Início", formatDate(e.start)))
    if (!kind.singleDate) left.append(detailLine("Fim", e.end ? formatDate(e.end) : "Em andamento"))
    kind.fields.forEach((f) => {
      const raw = e.data[f.name]
      if (!raw) return
      let text = raw
      if (f.kind === "cid") text = raw.label
      else if (f.kind === "select") text = f.name === "medico" || f.name === "responsavel" || f.name === "especialista" ? profName(raw) : optionLabel(f.options, raw)
      left.append(detailLine(f.label, text))
    })
    lines.append(left)

    const right = el("div")
    e.cultures.forEach((c, i) => {
      right.append(detailLine(`Cultura ${i + 1}`, c.culture))
      if (c.agent) right.append(detailLine("Agente", c.agent))
      if (c.sensitive.length) right.append(detailLine("Antibióticos sensíveis", c.sensitive.join(", ")))
      if (c.resistant.length) right.append(detailLine("Antibióticos resistentes", c.resistant.join(", ")))
    })
    e.medications.forEach((m) => {
      const period = `${formatDate(m.start)}${m.end ? ` a ${formatDate(m.end)}` : ""}`
      right.append(detailLine("Medicação", `${m.name} — ${m.posology} (${period})`))
    })
    lines.append(right)
    nodes.push(lines)

    if (e.evolutions.length) {
      const list = el("ul", { class: "ev-evolutions" })
      e.evolutions.forEach((evo) => {
        list.append(el("li", {}, el("strong", { text: `${formatDate(evo.date)} por ${evo.by}` }), el("div", { text: evo.text })))
      })
      nodes.push(el("h5", { class: "ev-subtitle", text: "Evolução" }), list)
    }
    refs.detail.replaceChildren(...nodes)
  }

  function select(id) {
    selectedId = id
    renderTable()
  }

  refs.tbody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]")
    if (row) select(Number(row.dataset.id))
  })
  refs.tbody.addEventListener("keydown", (event) => {
    const row = event.target.closest("tr[data-id]")
    if (!row) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      select(Number(row.dataset.id))
      refs.tbody.querySelector(`tr[data-id="${row.dataset.id}"]`)?.focus()
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const sibling = event.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling
      sibling?.focus()
    }
  })
  refs.filterType.addEventListener("change", renderTable)
  refs.filterStatus.addEventListener("change", renderTable)

  // ---------- Diálogo genérico ----------
  let returnFocus = null

  function openDialog({ title, confirmLabel = "Gravar", body, validate, submit }) {
    returnFocus = document.activeElement
    refs.dialogTitle.textContent = title
    refs.dialogConfirm.textContent = confirmLabel
    refs.dialogBody.replaceChildren(body)
    refs.dialogError.hidden = true
    dialogState = { validate, submit }
    refs.dialog.showModal()
    const first = refs.dialogBody.querySelector("input:not([type=hidden]), select, textarea, button")
    first?.focus()
  }

  function closeDialog() {
    if (refs.dialog.open) refs.dialog.close()
    dialogState = null
    returnFocus?.focus?.()
  }

  function showError(message) {
    refs.dialogError.textContent = message
    refs.dialogError.hidden = !message
  }

  refs.dialogForm.addEventListener("submit", (event) => {
    event.preventDefault()
    if (!dialogState) return
    const error = dialogState.validate()
    if (error) {
      showError(error)
      return
    }
    dialogState.submit()
    closeDialog()
  })
  $("ev-dialog-cancel").addEventListener("click", closeDialog)
  $("ev-dialog-close").addEventListener("click", closeDialog)
  refs.dialog.addEventListener("cancel", (event) => {
    event.preventDefault()
    closeDialog()
  })

  // Campos reutilizáveis do diálogo
  let uid = 0
  function field({ label, control, wide, help, labelFor }) {
    const id = labelFor || control.id || `ev-f-${++uid}`
    if (!labelFor) control.id = id
    const children = [el("label", { class: "field-label", for: id, text: label }), control]
    if (help) children.push(el("div", { class: "form-text", text: help }))
    return el("div", { class: `field-block${wide ? " ev-wide" : ""}` }, ...children)
  }
  const inputEl = (type, value = "") => el("input", { class: "form-control", type, value, autocomplete: "off", "data-no-dirty": true })
  const textareaEl = (value = "") => {
    const t = el("textarea", { class: "form-control", rows: "3", "data-no-dirty": true })
    t.value = value
    return t
  }
  const selectEl = (options, value = "") => {
    const s = el("select", { class: "form-select", "data-no-dirty": true })
    fillSelect(s, options, "Selecione")
    s.value = value
    return s
  }

  function checklist(options, values, legend) {
    const set = new Set(values)
    const wrap = el("fieldset", { class: "ev-checklist" }, el("legend", { class: "field-label", text: legend }))
    const boxes = options.map(([value, label]) => {
      const box = el("input", { type: "checkbox", value, "data-no-dirty": true })
      box.checked = set.has(value)
      wrap.append(el("label", { class: "ev-check" }, box, el("span", { text: label })))
      return box
    })
    return { node: wrap, values: () => boxes.filter((b) => b.checked).map((b) => b.value) }
  }

  // ---------- Formulário do evento (incluir / alterar) ----------
  function openEventForm(kindKey, existing) {
    const kind = KINDS[kindKey]
    const grid = el("div", { class: "ev-form-grid" })
    const controls = {}

    const typeSelect = selectEl(kind.types, existing?.type || "")
    grid.append(field({ label: `${kind.typeLabel} *`, control: typeSelect, wide: true }))

    const startInput = inputEl("date", existing?.start || todayIso())
    grid.append(field({ label: kind.singleDate ? "Data *" : "Início *", control: startInput }))
    let endInput = null
    if (!kind.singleDate) {
      endInput = inputEl("date", existing?.end || "")
      grid.append(field({ label: "Fim", control: endInput, help: "Deixe em branco enquanto o evento estiver em andamento." }))
    }

    kind.fields.forEach((f) => {
      const value = existing?.data[f.name]
      if (f.kind === "cid") {
        const cid = createCidField({ id: `ev-cid-${++uid}`, items: C.CID })
        if (value) cid.combo.setByCode(value.code)
        controls[f.name] = { get: () => cid.combo.value }
        grid.append(field({ label: f.label, control: cid.root, labelFor: cid.input.id, wide: true }))
      } else {
        const control =
          f.kind === "textarea" ? textareaEl(value || "") : f.kind === "select" ? selectEl(f.options, value || "") : inputEl("text", value || "")
        controls[f.name] = { get: () => control.value }
        grid.append(field({ label: f.label, control, wide: f.wide }))
      }
    })

    openDialog({
      title: `${existing ? "Alterar" : "Novo"} evento — ${kind.label}`,
      body: grid,
      validate() {
        if (!typeSelect.value) return `Informe o campo "${kind.typeLabel}".`
        if (!startInput.value) return `Informe ${kind.singleDate ? "a data" : "o início"} do evento.`
        if (endInput?.value && endInput.value < startInput.value) return "O fim não pode ser anterior ao início."
        return ""
      },
      submit() {
        const data = {}
        Object.entries(controls).forEach(([name, c]) => {
          const v = c.get()
          if (v) data[name] = v
        })
        const now = todayIso()
        if (existing) {
          Object.assign(existing, { type: typeSelect.value, start: startInput.value, end: kind.singleDate ? startInput.value : endInput.value, data, updatedAt: now })
          select(existing.id)
        } else {
          const event = {
            id: nextId++, kind: kindKey, type: typeSelect.value, start: startInput.value,
            end: kind.singleDate ? startInput.value : endInput.value, data,
            evolutions: [], cultures: [], medications: [],
            createdAt: now, createdBy: currentUserName(), updatedAt: now,
          }
          events.push(event)
          select(event.id)
        }
        markDirty()
      },
    })
  }

  // ---------- Evolução ----------
  function openEvolution() {
    const e = selected()
    if (!e) return
    const text = textareaEl()
    text.rows = 5
    openDialog({
      title: `Evolução — ${KINDS[e.kind].label}`,
      body: el("div", { class: "ev-form-grid" }, field({ label: "Evolução *", control: text, wide: true })),
      validate: () => (text.value.trim() ? "" : "Escreva a evolução."),
      submit() {
        e.evolutions.push({ date: todayIso(), by: currentUserName(), text: text.value.trim() })
        e.updatedAt = todayIso()
        select(e.id)
        markDirty()
      },
    })
  }

  // ---------- Medicação (Internação e Infecção) ----------
  // Sem imagem no manual: campos mínimos, a confirmar com a equipe (ver docs/PROXIMAS-TELAS.md).
  function openMedication() {
    const e = selected()
    if (!e) return
    const name = inputEl("text")
    const posology = inputEl("text")
    const start = inputEl("date", todayIso())
    const end = inputEl("date")
    openDialog({
      title: `Medicação — ${KINDS[e.kind].label}`,
      body: el(
        "div",
        { class: "ev-form-grid" },
        field({ label: "Medicamento *", control: name, wide: true }),
        field({ label: "Posologia *", control: posology, wide: true }),
        field({ label: "Início *", control: start }),
        field({ label: "Fim", control: end }),
      ),
      validate() {
        if (!name.value.trim()) return "Informe o medicamento."
        if (!posology.value.trim()) return "Informe a posologia."
        if (!start.value) return "Informe o início."
        if (end.value && end.value < start.value) return "O fim não pode ser anterior ao início."
        return ""
      },
      submit() {
        e.medications.push({ name: name.value.trim(), posology: posology.value.trim(), start: start.value, end: end.value })
        e.updatedAt = todayIso()
        select(e.id)
        markDirty()
      },
    })
  }

  // ---------- Cultura (Infecção) ----------
  function openCulture() {
    const e = selected()
    if (!e) return
    const culture = selectEl(C.culturas, "")
    const agent = selectEl(C.agentes, "")
    const sensitive = checklist(C.antibioticos, [], "Antibióticos sensíveis")
    const resistant = checklist(C.antibioticos, [], "Antibióticos resistentes")
    openDialog({
      title: "Cultura — Infecção",
      body: el(
        "div",
        { class: "ev-form-grid" },
        field({ label: "Cultura *", control: culture, wide: true }),
        field({ label: "Agente", control: agent, wide: true }),
        el("div", { class: "ev-wide ev-two-lists" }, sensitive.node, resistant.node),
      ),
      validate() {
        if (!culture.value) return "Informe a cultura."
        const both = sensitive.values().filter((v) => resistant.values().includes(v))
        if (both.length) return `O antibiótico "${both[0]}" está como sensível e resistente ao mesmo tempo.`
        return ""
      },
      submit() {
        e.cultures.push({ culture: culture.value, agent: agent.value, sensitive: sensitive.values(), resistant: resistant.values() })
        e.updatedAt = todayIso()
        select(e.id)
        markDirty()
      },
    })
  }

  // ---------- Finalizar / Excluir ----------
  function openFinish() {
    const e = selected()
    if (!e) return
    const end = inputEl("date", todayIso())
    openDialog({
      title: "Finalizar evento",
      confirmLabel: "Finalizar",
      body: el("div", { class: "ev-form-grid" }, field({ label: "Data de término *", control: end })),
      validate() {
        if (!end.value) return "Informe a data de término."
        if (end.value < e.start) return "O fim não pode ser anterior ao início."
        return ""
      },
      submit() {
        e.end = end.value
        e.updatedAt = todayIso()
        select(e.id)
        markDirty()
      },
    })
  }

  function openDelete() {
    const e = selected()
    if (!e) return
    openDialog({
      title: "Excluir evento",
      confirmLabel: "Excluir",
      body: el("p", { class: "ev-confirm", text: `Excluir "${KINDS[e.kind].label} - ${e.type}" iniciado em ${formatDate(e.start)}? Esta ação remove também evoluções, culturas e medicações do evento.` }),
      validate: () => "",
      submit() {
        events = events.filter((x) => x.id !== e.id)
        selectedId = null
        renderTable()
        markDirty()
      },
    })
    refs.dialogConfirm.classList.add("btn-danger")
    refs.dialogConfirm.classList.remove("btn-primary")
  }
  refs.dialog.addEventListener("close", () => {
    refs.dialogConfirm.classList.remove("btn-danger")
    refs.dialogConfirm.classList.add("btn-primary")
  })

  refs.actions.edit.addEventListener("click", () => selected() && openEventForm(selected().kind, selected()))
  refs.actions.evolution.addEventListener("click", openEvolution)
  refs.actions.medication.addEventListener("click", openMedication)
  refs.actions.culture.addEventListener("click", openCulture)
  refs.actions.finish.addEventListener("click", openFinish)
  refs.actions.delete.addEventListener("click", openDelete)

  // ---------- Inicialização ----------
  const kindOptions = Object.entries(KINDS).map(([key, k]) => [key, k.label])
  fillSelect(refs.newType, kindOptions, "Selecione o tipo de evento")
  fillSelect(refs.filterType, kindOptions, "Todos")
  refs.addButton.addEventListener("click", () => {
    if (!refs.newType.value) {
      refs.newType.focus()
      refs.newType.setAttribute("aria-invalid", "true")
      return
    }
    refs.newType.removeAttribute("aria-invalid")
    openEventForm(refs.newType.value)
  })
  refs.newType.addEventListener("change", () => refs.newType.removeAttribute("aria-invalid"))
  renderTable()

  // ---------- Integração com a API ----------
  window.HuNefroEventosDiagnosticos = {
    getData: () => JSON.parse(JSON.stringify(events)),
    setData(list) {
      events = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = events.reduce((max, e) => Math.max(max, e.id || 0), 0) + 1
      selectedId = null
      renderTable()
    },
    validate: () => ({ valid: true, errors: [] }), // as regras são aplicadas no momento de gravar cada evento
  }
})()
