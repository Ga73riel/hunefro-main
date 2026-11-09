// Lista de pacientes: busca, filtro por situação, abertura do prontuário (uma aba por paciente) e exclusão.
;(() => {
  "use strict"

  // Pacientes de demonstração: js/dados-mock.js (substituir pela API).
  const mockPatients = window.HuNefroMock?.patients || []

  const appMain = document.querySelector("#conteudo-principal")
  const patientListCard = document.querySelector("#lista-pacientes")
  const patientFilters = document.querySelector("#patient-filters")
  const searchInput = document.querySelector("#patient-search")
  const situationFilter = document.querySelector("#situation-filter")
  const clearFiltersButton = document.querySelector("#clear-filters")
  const emptyClearFiltersButton = document.querySelector("#empty-clear-filters")
  const patientTableBody = document.querySelector("#patient-table-body")
  const patientTableWrap = document.querySelector("#patient-table-wrap")
  const resultSummary = document.querySelector("#result-summary")
  const resultFooter = document.querySelector("#result-footer")
  const filterSummary = document.querySelector("#filter-summary")
  const resultsAnnouncer = document.querySelector("#results-announcer")
  const emptyState = document.querySelector("#empty-state")
  const emptyStateTitle = document.querySelector("#empty-state-title")
  const emptyStateMessage = document.querySelector("#empty-state-message")
  const errorState = document.querySelector("#error-state")
  const retryLoadButton = document.querySelector("#retry-load")
  const feedbackRegion = document.querySelector("#feedback-region")
  const newRecordButton = document.querySelector("#new-record-button")
  const actionMenu = document.querySelector("#patient-action-menu")
  const deleteMenuItem = document.querySelector("#delete-menu-item")
  const deleteDialog = document.querySelector("#delete-dialog")
  const dialogCloseButton = document.querySelector("#dialog-close")
  const dialogCancelButton = document.querySelector("#dialog-cancel")
  const dialogConfirmDeleteButton = document.querySelector("#dialog-confirm-delete")
  const deletePatientName = document.querySelector("#delete-patient-name")
  const deletePatientCode = document.querySelector("#delete-patient-code")

  let patients = []
  let selectedPatientId = null
  let actionPatientId = null
  let activeMenuTrigger = null
  let patientToDelete = null
  let lastFocusedElement = null
  let loadState = "loading"

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }

  function normalize(value) {
    return value.trim().toLocaleLowerCase("pt-BR")
  }

  function getFilteredPatients() {
    const query = normalize(searchInput.value)
    return patients.filter((patient) => {
      const matchesQuery =
        !query ||
        [patient.name, patient.code, patient.cpf, patient.cns].some((value) => normalize(value).includes(query))

      return matchesQuery && (!situationFilter.value || patient.situation === situationFilter.value)
    })
  }

  function getActiveFilterCount() {
    return [searchInput.value.trim(), situationFilter.value].filter(Boolean).length
  }

  function getActiveFilterDescription() {
    const filters = []
    const query = searchInput.value.trim()
    if (query) filters.push(`busca “${query}”`)
    if (situationFilter.value) {
      filters.push(`situação “${situationFilter.value}”`)
    }
    return filters.length === 0 ? "Nenhum filtro aplicado" : `Filtros aplicados: ${filters.join("; ")}`
  }

  function createDataCell(label, content) {
    const cell = document.createElement("td")
    cell.dataset.label = label
    if (content instanceof Node) {
      cell.append(content)
    } else {
      cell.textContent = content
    }
    return cell
  }

  function createPatientRow(patient) {
    const row = document.createElement("tr")
    row.dataset.patientId = String(patient.id)
    if (selectedPatientId === patient.id) row.classList.add("is-selected")

    const patientCell = document.createElement("th")
    patientCell.scope = "row"
    patientCell.dataset.label = "Paciente"
    patientCell.append(createElement("strong", "patient-name", patient.name))
    patientCell.append(createElement("span", "patient-code", `Código ${patient.code}`))
    if (selectedPatientId === patient.id) {
      patientCell.append(createElement("span", "badge selected-indicator", "Selecionado"))
    }

    const program = createElement("span", "badge program-label", patient.program)
    const situation = createElement("span", "situation-label", patient.situation)

    const actions = createElement("div", "patient-actions")
    const openButton = createElement("button", "btn btn-outline-primary btn-sm", "Abrir prontuário")
    openButton.type = "button"
    openButton.dataset.action = "open"
    openButton.dataset.patientId = String(patient.id)
    openButton.setAttribute("aria-label", `Abrir prontuário de ${patient.name} em nova aba`)
    openButton.title = "Abre o prontuário em uma nova aba do navegador"

    const menuButton = createElement("button", "btn btn-outline-secondary btn-sm", "Ações")
    menuButton.type = "button"
    menuButton.dataset.action = "menu"
    menuButton.dataset.patientId = String(patient.id)
    menuButton.setAttribute("aria-haspopup", "menu")
    menuButton.setAttribute("aria-expanded", "false")
    menuButton.setAttribute("aria-controls", "patient-action-menu")
    menuButton.setAttribute("aria-label", `Abrir ações para ${patient.name}`)
    actions.append(openButton, menuButton)

    const identifiers = createElement("div", "patient-identifiers")

    const cpfLine = createElement("span", "document-line")
    cpfLine.append(createElement("span", "document-label", "CPF"), createElement("span", "document-value", patient.cpf))

    const cnsLine = createElement("span", "document-line")
    cnsLine.append(createElement("span", "document-label", "CNS"), createElement("span", "document-value", patient.cns))

    identifiers.append(cpfLine, cnsLine)

    row.append(
      patientCell,
      createDataCell("Nascimento", patient.birthDate),
      createDataCell("Programa de tratamento", program),
      createDataCell("Situação", situation),
      createDataCell("CPF / CNS", identifiers),
      createDataCell("Telefone", patient.phone),
      createDataCell("Ações", actions),
    )

    return row
  }

  function renderLoading() {
    patientListCard.setAttribute("aria-busy", "true")
    patientTableBody.replaceChildren()
    const row = document.createElement("tr")
    const cell = document.createElement("td")
    cell.colSpan = 7
    cell.className = "loading-cell"
    const spinner = createElement("span", "spinner-border spinner-border-sm")
    spinner.setAttribute("aria-hidden", "true")
    cell.append(spinner, createElement("span", "", "Carregando pacientes..."))
    row.append(cell)
    patientTableBody.append(row)
    patientTableWrap.hidden = false
    emptyState.hidden = true
    errorState.hidden = true
    clearFiltersButton.hidden = true
    resultSummary.textContent = "Carregando registros..."
    resultFooter.textContent = "Carregando registros..."
    resultsAnnouncer.textContent = "Carregando pacientes."
  }

  function renderError() {
    patientListCard.setAttribute("aria-busy", "false")
    patientTableBody.replaceChildren()
    patientTableWrap.hidden = true
    emptyState.hidden = true
    errorState.hidden = false
    clearFiltersButton.hidden = true
    resultSummary.textContent = "Falha ao carregar os registros"
    resultFooter.textContent = "Nenhum registro disponível"
    resultsAnnouncer.textContent = ""
  }

  function renderPatients() {
    if (loadState === "loading") {
      renderLoading()
      return
    }

    if (loadState === "error") {
      renderError()
      return
    }

    const filteredPatients = getFilteredPatients()
    const filterCount = getActiveFilterCount()
    patientListCard.setAttribute("aria-busy", "false")
    patientTableBody.replaceChildren(...filteredPatients.map(createPatientRow))
    patientTableWrap.hidden = filteredPatients.length === 0
    emptyState.hidden = filteredPatients.length !== 0
    errorState.hidden = true
    clearFiltersButton.hidden = filterCount === 0

    if (patients.length === 0 && filterCount === 0) {
      emptyStateTitle.textContent = "Nenhum paciente cadastrado"
      emptyStateMessage.textContent = "Não há registros disponíveis."
      emptyClearFiltersButton.hidden = true
    } else {
      emptyStateTitle.textContent = "Nenhum paciente encontrado"
      emptyStateMessage.textContent = "Revise a busca ou remova os filtros para consultar todos os registros."
      emptyClearFiltersButton.hidden = false
    }

    const resultWord = filteredPatients.length === 1 ? "resultado" : "resultados"
    resultSummary.textContent = `${filteredPatients.length} ${resultWord} encontrado${
      filteredPatients.length === 1 ? "" : "s"
    }`
    resultFooter.textContent = `Exibindo ${filteredPatients.length} de ${patients.length} registros`
    filterSummary.textContent = getActiveFilterDescription()
    filterSummary.classList.toggle("has-active-filters", filterCount > 0)
    resultsAnnouncer.textContent = `${resultSummary.textContent}. ${filterSummary.textContent}.`
  }

  function clearFilters() {
    patientFilters.reset()
    closeActionMenu()
    renderPatients()
    searchInput.focus()
  }

  function showFeedback(kind, title, message) {
    const alert = createElement("div", `alert ${kind === "success" ? "alert-success" : "alert-info"} page-feedback`)
    const copy = createElement("div", "feedback-copy")
    copy.append(createElement("strong", "", title), createElement("span", "", message))

    const closeButton = createElement("button", "btn-close")
    closeButton.type = "button"
    closeButton.setAttribute("aria-label", "Fechar mensagem")
    closeButton.addEventListener("click", () => alert.remove())
    alert.append(copy, closeButton)
    feedbackRegion.replaceChildren(alert)
  }

  function openRecord(patientId, section = "") {
    const patient = patients.find((item) => item.id === patientId)
    if (!patient) return
    closeActionMenu()
    // Abre em outra aba do navegador. O nome da janela é por paciente: abrir o mesmo paciente de novo reaproveita a aba dele.
    // window.open sem "noopener" copia o sessionStorage (login) para a nova aba.
    const url = `prontuario.html?patient=${patient.id}${section ? `&section=${section}` : ""}`
    const tab = window.open(url, `hunefro-prontuario-${patient.id}`)
    if (tab) tab.focus()
    else window.location.assign(url) // bloqueador de pop-up: abre na mesma aba
  }

  function positionActionMenu(trigger) {
    const triggerRect = trigger.getBoundingClientRect()
    const menuWidth = actionMenu.offsetWidth
    const left = Math.min(triggerRect.right - menuWidth, document.documentElement.clientWidth - menuWidth - 8)
    actionMenu.style.left = `${Math.max(8, left)}px`
    actionMenu.style.top = `${triggerRect.bottom + 6}px`
  }

  function openActionMenu(trigger, patientId) {
    closeActionMenu()
    const patient = patients.find((item) => item.id === patientId)
    activeMenuTrigger = trigger
    actionPatientId = patientId
    actionMenu.setAttribute("aria-label", patient ? `Ações de ${patient.name}` : "Ações do paciente")
    trigger.setAttribute("aria-expanded", "true")
    actionMenu.hidden = false
    positionActionMenu(trigger)
    requestAnimationFrame(() => deleteMenuItem.focus())
  }

  function closeActionMenu({ restoreFocus = false } = {}) {
    if (activeMenuTrigger) {
      activeMenuTrigger.setAttribute("aria-expanded", "false")
      if (restoreFocus) activeMenuTrigger.focus()
    }
    actionMenu.hidden = true
    actionMenu.removeAttribute("style")
    activeMenuTrigger = null
    actionPatientId = null
  }

  function focusAdjacentFromTrigger(direction) {
    if (!activeMenuTrigger) return
    const trigger = activeMenuTrigger
    const focusableElements = Array.from(
      document.querySelectorAll(
        'a[href], button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !actionMenu.contains(element) && !deleteDialog.contains(element))
    const triggerIndex = focusableElements.indexOf(trigger)
    const targetIndex = triggerIndex + direction
    const target = focusableElements[targetIndex]
    closeActionMenu()
    target?.focus()
  }

  function openDeleteDialog(patientId) {
    const patient = patients.find((item) => item.id === patientId)
    if (!patient) return
    patientToDelete = patient
    lastFocusedElement = activeMenuTrigger
    deletePatientName.textContent = patient.name
    deletePatientCode.textContent = patient.code
    closeActionMenu()
    deleteDialog.showModal()
    requestAnimationFrame(() => dialogCancelButton.focus())
  }

  function closeDeleteDialog() {
    if (deleteDialog.open) deleteDialog.close()
  }

  function deletePatient() {
    if (!patientToDelete) return
    const deletedPatient = patientToDelete
    patients = patients.filter((patient) => patient.id !== deletedPatient.id)
    if (selectedPatientId === deletedPatient.id) selectedPatientId = null
    patientToDelete = null
    lastFocusedElement = searchInput
    closeDeleteDialog()
    renderPatients()
    showFeedback("success", "Prontuário excluído", `${deletedPatient.name} foi removido da lista.`)
  }

  function loadPatients({ forceSuccess = false } = {}) {
    const requestedState = new URLSearchParams(window.location.search).get("state")
    loadState = "loading"
    renderPatients()

    window.setTimeout(() => {
      if (requestedState === "error" && !forceSuccess) {
        loadState = "error"
        renderPatients()
        return
      }

      patients = requestedState === "empty" && !forceSuccess ? [] : mockPatients.map((patient) => ({ ...patient }))
      loadState = "success"
      renderPatients()
    }, 450)
  }

  searchInput.addEventListener("input", renderPatients)
  situationFilter.addEventListener("change", renderPatients)
  clearFiltersButton.addEventListener("click", clearFilters)
  emptyClearFiltersButton.addEventListener("click", clearFilters)
  retryLoadButton.addEventListener("click", () => loadPatients({ forceSuccess: true }))

  patientTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]")
    if (!button) return
    const patientId = Number(button.dataset.patientId)

    if (button.dataset.action === "open") {
      openRecord(patientId)
    } else if (button.dataset.action === "menu") {
      if (activeMenuTrigger === button) {
        closeActionMenu({ restoreFocus: true })
      } else {
        openActionMenu(button, patientId)
      }
    }
  })

  // ---------- Incluir paciente (Recepção) ----------
  // A recepcionista digita o CPF e o sistema busca o cadastro no AGHU (nome, nascimento, sexo e CNS).
  // Ela só confirma a inclusão: os dados não são digitados aqui. O programa é sugerido pela idade
  // (o HU só atende Hemodiálise e Hemodiálise Pediátrica) e o restante é completado no Programa de Tratamento.
  // PROVISÓRIO: a consulta é simulada por js/aghu-mock.js até existir a API.
  const nrDialog = document.querySelector("#new-record-dialog")
  const nr = (id) => document.querySelector(`#nr-${id}`)
  const onlyDigits = (v) => String(v || "").replace(/\D/g, "")
  function validCpf(value) {
    const d = onlyDigits(value)
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
    const check = (len) => { const sum = [...d.slice(0, len)].reduce((acc, n, i) => acc + Number(n) * (len + 1 - i), 0); const r = (sum * 10) % 11; return r === 10 ? 0 : r }
    return check(9) === Number(d[9]) && check(10) === Number(d[10])
  }
  const formatCpf = (v) => onlyDigits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
  const maskCpf = (v) => { const d = onlyDigits(v).slice(0, 11); return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2") }
  const ageOn = (iso) => { const b = new Date(`${iso}T12:00:00`), t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a -= 1; return a }
  const toBr = (iso) => iso.split("-").reverse().join("/")
  const canInclude = () => window.HuNefroSessao?.can?.("incluir-paciente") ?? true
  let found = null
  let searching = false

  function nrError(message, field) {
    const box = nr("error")
    box.hidden = !message
    box.textContent = message || ""
    field?.focus()
  }
  function nrStatus(content, warn = false) {
    const box = nr("status")
    box.hidden = !content
    box.className = `nr-status${warn ? " is-warn" : ""}`
    box.replaceChildren(...(content ? [].concat(content) : []))
  }
  function resetFound() {
    found = null
    nr("result").hidden = true
    nr("submit").disabled = true
  }

  // CPFs fictícios do AGHU simulado, para testar sem decorar números.
  const testCpfs = window.HuNefroAGHU?.cpfsDeTeste?.() || []
  if (testCpfs.length) {
    nr("test-cpfs").replaceChildren(document.createTextNode("CPFs de teste do AGHU simulado: "), ...testCpfs.flatMap((c, i) => {
      const b = createElement("button", "", c)
      b.type = "button"
      b.addEventListener("click", () => { nr("cpf").value = c; search() })
      return i ? [document.createTextNode(", "), b] : [b]
    }))
  }

  async function search() {
    if (searching) return
    nrError("")
    resetFound()
    const value = nr("cpf").value
    if (!validCpf(value)) { nrStatus(""); return nrError("CPF inválido. Confira os 11 dígitos.", nr("cpf")) }
    nr("cpf").value = formatCpf(value)
    const cpf = formatCpf(value)
    const existing = patients.find((p) => p.cpf === cpf)
    if (existing) {
      const link = createElement("a", "", "Abrir prontuário")
      link.href = "#"
      link.addEventListener("click", (e) => { e.preventDefault(); nrDialog.close(); openRecord(existing.id) })
      return nrStatus([document.createTextNode(`Este paciente já está no sistema: ${existing.name} (código ${existing.code}). `), link], true)
    }
    searching = true
    nr("search").disabled = true
    nr("search").textContent = "Buscando..."
    nrStatus("Consultando o cadastro no AGHU...")
    try {
      const answer = await window.HuNefroAGHU.buscarPorCpf(cpf)
      if (!answer.found) {
        nrStatus("CPF não encontrado no AGHU. Confira o número ou faça o cadastro do paciente no AGHU antes de incluí-lo aqui.", true)
        return
      }
      const p = answer.person
      const dup = patients.find((x) => x.cns === p.cns)
      if (dup) return nrStatus(`O CNS deste cadastro já pertence ao prontuário de ${dup.name} (código ${dup.code}). Confira com o AGHU.`, true)
      found = p
      nrStatus("")
      nr("name").textContent = p.name
      nr("birth").textContent = toBr(p.birth)
      nr("sex").textContent = p.sex
      nr("cns").textContent = p.cns
      const age = ageOn(p.birth)
      nr("hint").textContent = age < 18
        ? `Paciente com ${age} ${age === 1 ? "ano" : "anos"}: entra no programa Hemodiálise Pediátrica.`
        : `Paciente com ${age} anos: entra no programa Hemodiálise. Dias, turno e sala são definidos no Programa de Tratamento.`
      nr("result").hidden = false
      nr("submit").disabled = false
      nr("submit").focus()
    } catch {
      nrStatus("Não foi possível consultar o AGHU agora. Tente de novo em instantes.", true)
    } finally {
      searching = false
      nr("search").disabled = false
      nr("search").textContent = "Buscar no AGHU"
    }
  }

  nr("search").addEventListener("click", search)
  nr("cpf").addEventListener("input", () => { nr("cpf").value = maskCpf(nr("cpf").value); if (found) resetFound(); nrStatus("") })
  nr("cpf").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); search() } })

  // Só a Recepção inclui pacientes (permissão em js/sessao.js).
  function syncIncludeButton() {
    const allowed = canInclude()
    newRecordButton.disabled = !allowed
    newRecordButton.title = allowed ? "Busca o paciente pelo CPF no AGHU" : "Inclusão de paciente: perfil Recepção"
  }
  syncIncludeButton()
  document.addEventListener("hunefro:perfil", syncIncludeButton)

  newRecordButton.addEventListener("click", () => {
    if (!canInclude()) return
    document.querySelector("#new-record-form").reset()
    nrError("")
    nrStatus("")
    resetFound()
    nrDialog.showModal()
    nr("cpf").focus()
  })
  const closeNewRecord = () => { nrDialog.close(); newRecordButton.focus() }
  document.querySelector("#new-record-close").addEventListener("click", closeNewRecord)
  document.querySelector("#new-record-cancel").addEventListener("click", closeNewRecord)
  document.querySelector("#new-record-form").addEventListener("submit", (event) => {
    event.preventDefault()
    if (!found) return search()
    const p = found
    const program = ageOn(p.birth) < 18 ? "Hemodiálise Pediátrica" : "Hemodiálise"
    const created = window.HuNefroMock.addPatient({
      name: p.name.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase()).replace(/ (Da|De|Do|Das|Dos|E) /g, (m) => m.toLowerCase()),
      birthDate: toBr(p.birth), sex: p.sex, cpf: p.cpf, cns: p.cns, mother: p.mother, phone: p.phone, program, aghu: p,
      createdBy: sessionStorage.getItem("huNefroUsername") || "Recepção",
    })
    patients.push({ ...created })
    nrDialog.close()
    renderPatients()
    showFeedback("success", "Paciente incluído", `${created.name}, código ${created.code}. Complete o Programa de Tratamento (dias, turno e sala) no prontuário que abriu em nova aba.`)
    openRecord(created.id, "programa")
  })

  deleteMenuItem.addEventListener("click", () => {
    if (actionPatientId !== null) openDeleteDialog(actionPatientId)
  })

  dialogCloseButton.addEventListener("click", closeDeleteDialog)
  dialogCancelButton.addEventListener("click", closeDeleteDialog)
  dialogConfirmDeleteButton.addEventListener("click", deletePatient)

  deleteDialog.addEventListener("close", () => {
    patientToDelete = null
    lastFocusedElement?.focus()
    lastFocusedElement = null
  })

  deleteDialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return
    const focusableElements = [dialogCloseButton, dialogCancelButton, dialogConfirmDeleteButton]
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  })

  document.addEventListener("mousedown", (event) => {
    if (!actionMenu.hidden && !actionMenu.contains(event.target) && !event.target.closest('[data-action="menu"]')) {
      closeActionMenu()
    }
  })

  document.addEventListener("keydown", (event) => {
    if (!actionMenu.hidden) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeActionMenu({ restoreFocus: true })
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault()
        deleteMenuItem.focus()
      } else if (event.key === "Tab") {
        event.preventDefault()
        focusAdjacentFromTrigger(event.shiftKey ? -1 : 1)
      }
    }
  })

  function repositionActionMenu() {
    if (!actionMenu.hidden && activeMenuTrigger) positionActionMenu(activeMenuTrigger)
  }

  window.addEventListener("resize", repositionActionMenu)
  window.addEventListener("scroll", repositionActionMenu)
  patientTableWrap.addEventListener("scroll", repositionActionMenu)

  loadPatients()

  // Dados de teste (provisório): apaga sessões, faltas e prontuários salvos no navegador e recria os dados fictícios.
  document.getElementById("reset-test-data")?.addEventListener("click", () => {
    const ok = window.confirm(
      "Restaurar os dados de teste? Tudo o que foi salvo neste navegador (prontuários, sessões e faltas) será apagado e os dados fictícios serão recriados.",
    )
    if (!ok) return
    window.HuNefroMock?.resetTestData()
    window.location.reload()
  })
})()
