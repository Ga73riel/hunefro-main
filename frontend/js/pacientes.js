// Demonstração de navegação autenticada.
// Não substitui autenticação/autorização real no backend.
if (sessionStorage.getItem("huNefroAuthenticated") !== "true") {
  window.location.replace("login.html")
}

const mockPatients = Object.freeze([
  {
    id: 1,
    name: "Ana Martins",
    code: "000184",
    birthDate: "18/04/1967",
    cpf: "***.***.***-12",
    cns: "*** **** **** 003",
    phone: "(98) 9****-3102",
    program: "Hemodiálise",
    situation: "Clientes em HD",
  },
  {
    id: 2,
    name: "Carlos Eduardo Lima",
    code: "000219",
    birthDate: "07/11/1981",
    cpf: "***.***.***-40",
    cns: "*** **** **** 118",
    phone: "(98) 9****-8821",
    program: "Transplantado",
    situation: "Clientes em pós TX",
  },
  {
    id: 3,
    name: "Joana Ribeiro",
    code: "000247",
    birthDate: "22/01/1974",
    cpf: "***.***.***-08",
    cns: "*** **** **** 542",
    phone: "(98) 9****-1450",
    program: "Em branco",
    situation: "Clientes consultório",
  },
  {
    id: 4,
    name: "Marcos Vinícius Silva",
    code: "000305",
    birthDate: "03/09/1990",
    cpf: "***.***.***-71",
    cns: "*** **** **** 729",
    phone: "(98) 9****-6714",
    program: "Hemodiálise",
    situation: "Clientes em HD",
  },
  {
    id: 5,
    name: "Rosa Maria Nunes",
    code: "000328",
    birthDate: "14/06/1959",
    cpf: "***.***.***-36",
    cns: "*** **** **** 884",
    phone: "(98) 9****-4208",
    program: "Transferido",
    situation: "Clientes em DP",
  },
  {
    id: 6,
    name: "Fernanda Sousa Alves",
    code: "000391",
    birthDate: "08/03/1985",
    cpf: "***.***.***-22",
    cns: "*** **** **** 471",
    phone: "(98) 9****-7340",
    program: "Em branco",
    situation: "Doadores em pré TX",
  },
])

const logoutButton = document.querySelector("#logout-button")
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
const dialogConfirmDeleteButton = document.querySelector(
  "#dialog-confirm-delete",
)
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
      [patient.name, patient.code, patient.cpf, patient.cns].some((value) =>
        normalize(value).includes(query),
      )

    return (
      matchesQuery &&
      (!situationFilter.value || patient.situation === situationFilter.value)
    )
  })
}

function getActiveFilterCount() {
  return [searchInput.value.trim(), situationFilter.value].filter(Boolean)
    .length
}

function getActiveFilterDescription() {
  const filters = []
  const query = searchInput.value.trim()
  if (query) filters.push(`busca “${query}”`)
  if (situationFilter.value) {
    filters.push(`situação “${situationFilter.value}”`)
  }
  return filters.length === 0
    ? "Nenhum filtro aplicado"
    : `Filtros aplicados: ${filters.join("; ")}`
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
  patientCell.append(
    createElement("span", "patient-code", `Código ${patient.code}`),
  )
  if (selectedPatientId === patient.id) {
    patientCell.append(
      createElement("span", "badge selected-indicator", "Selecionado"),
    )
  }

  const program = createElement("span", "badge program-label", patient.program)
  const situation = createElement("span", "situation-label", patient.situation)

  const actions = createElement("div", "patient-actions")
  const openButton = createElement(
    "button",
    "btn btn-outline-primary btn-sm",
    "Abrir prontuário",
  )
  openButton.type = "button"
  openButton.dataset.action = "open"
  openButton.dataset.patientId = String(patient.id)
  openButton.setAttribute("aria-label", `Abrir prontuário de ${patient.name}`)

  const menuButton = createElement(
    "button",
    "btn btn-outline-secondary btn-sm",
    "Ações",
  )
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
  cpfLine.append(
    createElement("span", "document-label", "CPF"),
    createElement("span", "document-value", patient.cpf),
  )

  const cnsLine = createElement("span", "document-line")
  cnsLine.append(
    createElement("span", "document-label", "CNS"),
    createElement("span", "document-value", patient.cns),
  )

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
    emptyStateMessage.textContent =
      "Não há registros disponíveis."
    emptyClearFiltersButton.hidden = true
  } else {
    emptyStateTitle.textContent = "Nenhum paciente encontrado"
    emptyStateMessage.textContent =
      "Revise a busca ou remova os filtros para consultar todos os registros."
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
  const alert = createElement(
    "div",
    `alert ${
      kind === "success" ? "alert-success" : "alert-info"
    } page-feedback`,
  )
  const copy = createElement("div", "feedback-copy")
  copy.append(
    createElement("strong", "", title),
    createElement("span", "", message),
  )

  const closeButton = createElement("button", "btn-close")
  closeButton.type = "button"
  closeButton.setAttribute("aria-label", "Fechar mensagem")
  closeButton.addEventListener("click", () => alert.remove())
  alert.append(copy, closeButton)
  feedbackRegion.replaceChildren(alert)
}

function openRecord(patientId) {
  const patient = patients.find((item) => item.id === patientId)
  if (!patient) return
  closeActionMenu()
  window.location.assign(`prontuario.html?patient=${patient.id}`)
}

function positionActionMenu(trigger) {
  const triggerRect = trigger.getBoundingClientRect()
  const menuWidth = actionMenu.offsetWidth
  const left = Math.min(
    triggerRect.right - menuWidth,
    document.documentElement.clientWidth - menuWidth - 8,
  )
  actionMenu.style.left = `${Math.max(8, left)}px`
  actionMenu.style.top = `${triggerRect.bottom + 6}px`
}

function openActionMenu(trigger, patientId) {
  closeActionMenu()
  const patient = patients.find((item) => item.id === patientId)
  activeMenuTrigger = trigger
  actionPatientId = patientId
  actionMenu.setAttribute(
    "aria-label",
    patient ? `Ações de ${patient.name}` : "Ações do paciente",
  )
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
  ).filter(
    (element) =>
      !actionMenu.contains(element) && !deleteDialog.contains(element),
  )
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
  showFeedback(
    "success",
    "Prontuário excluído",
    `${deletedPatient.name} foi removido da lista.`,
  )
}

function loadPatients({ forceSuccess = false } = {}) {
  const requestedState = new URLSearchParams(window.location.search).get(
    "state",
  )
  loadState = "loading"
  renderPatients()

  window.setTimeout(() => {
    if (requestedState === "error" && !forceSuccess) {
      loadState = "error"
      renderPatients()
      return
    }

    patients =
      requestedState === "empty" && !forceSuccess
        ? []
        : mockPatients.map((patient) => ({ ...patient }))
    loadState = "success"
    renderPatients()
  }, 450)
}

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("huNefroAuthenticated")
  sessionStorage.removeItem("huNefroUsername")
  window.location.replace("login.html")
})

searchInput.addEventListener("input", renderPatients)
situationFilter.addEventListener("change", renderPatients)
clearFiltersButton.addEventListener("click", clearFilters)
emptyClearFiltersButton.addEventListener("click", clearFilters)
retryLoadButton.addEventListener("click", () =>
  loadPatients({ forceSuccess: true }),
)

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

newRecordButton.addEventListener("click", () => {
  showFeedback(
    "info",
    "Novo prontuário",
    "A ação está disponível, mas o cadastro depende da definição dos campos e do contrato REST.",
  )
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
  const focusableElements = [
    dialogCloseButton,
    dialogCancelButton,
    dialogConfirmDeleteButton,
  ]
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
  if (
    !actionMenu.hidden &&
    !actionMenu.contains(event.target) &&
    !event.target.closest('[data-action="menu"]')
  ) {
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
  if (!actionMenu.hidden && activeMenuTrigger)
    positionActionMenu(activeMenuTrigger)
}

window.addEventListener("resize", repositionActionMenu)
window.addEventListener("scroll", repositionActionMenu)
patientTableWrap.addEventListener("scroll", repositionActionMenu)

loadPatients()
