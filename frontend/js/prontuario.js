// Protótipo de prontuário Hu-Nefro.
// Persistência e autorização reais devem ser implementadas no backend Django/DRF.

if (sessionStorage.getItem("huNefroAuthenticated") !== "true") {
  window.location.replace("login.html")
}

const views = [...document.querySelectorAll(".record-view")]
const navItems = [...document.querySelectorAll(".record-nav-item:not([disabled])")]
const unsavedIndicator = document.querySelector("#unsaved-indicator")
const footerStatus = document.querySelector("#footer-status")
const saveButton = document.querySelector("#save-button")
const cancelButton = document.querySelector("#cancel-button")
const sidebar = document.querySelector("#record-sidebar")
const sidebarOpen = document.querySelector("#sidebar-open")
const sidebarClose = document.querySelector("#sidebar-close")
const sidebarBackdrop = document.querySelector("#sidebar-backdrop")
// Altura real do cabeçalho fixo (muda com a largura da tela); usada pelo menu lateral fixo.
const stickyHeader = document.querySelector("#record-sticky-header")

function syncStickyHeight() {
  if (stickyHeader) {
    document.documentElement.style.setProperty("--hn-sticky-height", `${stickyHeader.offsetHeight}px`)
  }
}

syncStickyHeight()
window.addEventListener("resize", syncStickyHeight)
if (stickyHeader && "ResizeObserver" in window) new ResizeObserver(syncStickyHeight).observe(stickyHeader)

let hasUnsavedChanges = false
let activeSection = "cadastro"

function setUnsaved(value) {
  hasUnsavedChanges = value
  if (unsavedIndicator) unsavedIndicator.hidden = !value
  if (footerStatus) footerStatus.textContent = value ? "Há alterações não salvas" : ""
}

function showSection(sectionId, updateUrl = true) {
  const target = views.find((view) => view.dataset.view === sectionId)
  if (!target) return

  activeSection = sectionId
  views.forEach((view) => view.classList.toggle("active", view === target))
  navItems.forEach((item) => {
    const active = item.dataset.section === sectionId
    item.classList.toggle("active", active)
    if (active) item.setAttribute("aria-current", "page")
    else item.removeAttribute("aria-current")
  })

  if (updateUrl) {
    const url = new URL(window.location.href)
    url.searchParams.set("section", sectionId)
    window.history.replaceState({}, "", url)
  }

  syncNavGroups()
  document.querySelector("#conteudo-principal")?.focus({ preventScroll: true })
  closeSidebar()
}

// Grupos do menu (Clínico, Prescrição e Tratamento, Resultados): o grupo da tela ativa fica aberto.
const navGroups = [...document.querySelectorAll(".record-nav-group")]

function setGroupOpen(group, open) {
  group.querySelector(".record-nav-group-toggle")?.setAttribute("aria-expanded", String(open))
  const subnav = group.querySelector(".record-subnav")
  if (subnav) subnav.hidden = !open
}

function syncNavGroups() {
  navGroups.forEach((group) => {
    const hasActive = Boolean(group.querySelector(".sub-item.active"))
    group.classList.toggle("has-active", hasActive)
    if (hasActive) setGroupOpen(group, true)
  })
}

navGroups.forEach((group) => {
  const toggle = group.querySelector(".record-nav-group-toggle")
  toggle?.addEventListener("click", () => {
    setGroupOpen(group, toggle.getAttribute("aria-expanded") !== "true")
  })
})

function openSidebar() {
  sidebar?.classList.add("open")
  if (sidebarBackdrop) sidebarBackdrop.hidden = false
  sidebarOpen?.setAttribute("aria-expanded", "true")
}

function closeSidebar() {
  sidebar?.classList.remove("open")
  if (sidebarBackdrop) sidebarBackdrop.hidden = true
  sidebarOpen?.setAttribute("aria-expanded", "false")
}

navItems.forEach((item) => {
  item.addEventListener("click", () => showSection(item.dataset.section))
})

const initialSection = new URLSearchParams(window.location.search).get("section")
if (initialSection) showSection(initialSection, false)

sidebarOpen?.addEventListener("click", openSidebar)
sidebarClose?.addEventListener("click", closeSidebar)
sidebarBackdrop?.addEventListener("click", closeSidebar)

// Marcação de alterações sem criar regras clínicas.
document.querySelectorAll("input, select, textarea").forEach((field) => {
  if (field.hasAttribute("data-no-dirty")) return // campos de rascunho (busca/entrada ainda não confirmada)
  field.addEventListener("input", () => setUnsaved(true))
  field.addEventListener("change", () => setUnsaved(true))
})

// Seções carregadas por outros scripts (ex.: dados-clinicos.js) sinalizam alterações por este evento.
document.addEventListener("hunefro:dirty", () => setUnsaved(true))

saveButton?.addEventListener("click", () => {
  setUnsaved(false)
  saveButton.textContent = "✓ Salvo"
  window.setTimeout(() => {
    saveButton.textContent = "▣  Salvar"
  }, 1200)
})

cancelButton?.addEventListener("click", () => {
  if (!hasUnsavedChanges) return

  const confirmed = window.confirm("Cancelar as alterações não salvas?")
  if (!confirmed) return

  window.location.reload()
})

// Demonstração do lançamento de movimentações na aba Programa de Tratamento.
const movementTypeField = document.querySelector("#movement-type")
const movementDetail = document.querySelector("#movement-detail")
const movementDetailGroups = [...document.querySelectorAll("[data-movement-detail]")]
const movementHistoryBody = document.querySelector("#movement-history-body")
const currentProgramField = document.querySelector("#programa-atual")

const startProcedureField = document.querySelector("#inicio-procedimento")
const startClassificationField = document.querySelector("#inicio-cronico-agudo")
const startClassificationContainer = document.querySelector("#inicio-classificacao-field")

const returnProcedureField = document.querySelector("#retorno-procedimento")
const returnClassificationField = document.querySelector("#retorno-cronico-agudo")
const returnClassificationContainer = document.querySelector("#retorno-classificacao-field")

function updateDependentClassification(procedureField, classificationContainer, classificationField) {
  const hasProcedure = Boolean(procedureField?.value)
  if (classificationContainer) classificationContainer.hidden = !hasProcedure
  if (!hasProcedure && classificationField) classificationField.value = ""
}

function updateMovementDetail() {
  const selectedType = movementTypeField?.value || ""

  movementDetailGroups.forEach((group) => {
    group.hidden = group.dataset.movementDetail !== selectedType
  })

  updateDependentClassification(
    startProcedureField,
    startClassificationContainer,
    startClassificationField,
  )
  updateDependentClassification(
    returnProcedureField,
    returnClassificationContainer,
    returnClassificationField,
  )

  if (movementDetail) {
    movementDetail.setAttribute(
      "aria-label",
      selectedType
        ? `Campos adicionais da movimentação ${movementTypeField.options[movementTypeField.selectedIndex]?.text || ""}`
        : "Campos adicionais da movimentação",
    )
  }
}

function formatDisplayDate(value) {
  const parts = value.split("/")
  if (parts.length === 3 && parts.every(Boolean)) return value

  const isoParts = value.split("-")
  if (isoParts.length === 3) {
    return `${isoParts[2]}/${isoParts[1]}/${isoParts[0]}`
  }

  return value
}

function getProgramValueFromMovement() {
  const type = movementTypeField?.value || ""

  if (type === "abandono") return "Abandono"
  if (type === "alta-ambulatorial") return "Alta"
  if (type === "obito") return "Óbito"
  if (type === "transferencia-centro") return "Transferido"
  if (type === "transplante") return "Transplantado"

  if (type === "inicio-programa") {
    return startProcedureField?.selectedOptions[0]?.textContent?.trim() || ""
  }

  if (type === "retorno") {
    return returnProcedureField?.selectedOptions[0]?.textContent?.trim() || ""
  }

  // Rejeição/perda de transplante não altera o valor automaticamente
  // porque o material de referência não define qual programa deve ser assumido.
  return ""
}

function updateCurrentProgramFromMovement() {
  const programValue = getProgramValueFromMovement()
  if (programValue && currentProgramField) {
    currentProgramField.value = programValue
  }
}

movementTypeField?.addEventListener("change", () => {
  updateMovementDetail()
  setUnsaved(true)
})

startProcedureField?.addEventListener("change", () => {
  updateDependentClassification(
    startProcedureField,
    startClassificationContainer,
    startClassificationField,
  )
  setUnsaved(true)
})

returnProcedureField?.addEventListener("change", () => {
  updateDependentClassification(
    returnProcedureField,
    returnClassificationContainer,
    returnClassificationField,
  )
  setUnsaved(true)
})

document.querySelector("#register-movement")?.addEventListener("click", () => {
  const dateField = document.querySelector("#movement-date")
  const typeField = document.querySelector("#movement-type")
  const date = dateField?.value.trim()
  const type = typeField?.value
  const selectedTypeLabel = typeField?.options[typeField.selectedIndex]?.text || ""

  if (!date) {
    dateField?.focus()
    return
  }

  if (!type) {
    typeField?.focus()
    return
  }

  const row = document.createElement("tr")
  const dateCell = document.createElement("td")
  const typeCell = document.createElement("td")
  const responsibleCell = document.createElement("td")

  dateCell.textContent = formatDisplayDate(date)
  typeCell.textContent = selectedTypeLabel
  responsibleCell.textContent =
    sessionStorage.getItem("huNefroUsername") || "Usuário"

  row.append(dateCell, typeCell, responsibleCell)

  const emptyRow = movementHistoryBody?.querySelector(".empty-history")
  if (emptyRow) emptyRow.closest("tr")?.remove()
  movementHistoryBody?.appendChild(row)

  updateCurrentProgramFromMovement()

  if (dateField) dateField.value = ""
  if (typeField) typeField.value = ""

  movementDetailGroups.forEach((group) => {
    group.hidden = true
    group.querySelectorAll("input, select, textarea").forEach((field) => {
      field.value = ""
    })
  })

  updateMovementDetail()
  setUnsaved(true)
})

updateMovementDetail()

// Os dias da semana são a fonte do calendário de Dias de HD Previstos.
// O calendário apenas visualiza os dias resultantes e não cria uma segunda agenda.
const dayCheckboxes = [...document.querySelectorAll('input[name="dias-hd"]')]
const calendarDays = document.querySelector("#calendar-days")
const calendarMonth = document.querySelector("#calendar-month")
const calendarNavigation = [...document.querySelectorAll(".calendar-nav")]

let calendarCursor = new Date(2026, 9, 1)

const weekdayMap = {
  diaria: null,
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

function getSelectedWeekdays() {
  const selected = new Set()
  const daily = dayCheckboxes.find((input) => input.value === "diaria")

  if (daily?.checked) {
    for (let day = 0; day <= 6; day += 1) selected.add(day)
    return selected
  }

  dayCheckboxes.forEach((input) => {
    if (input.checked && weekdayMap[input.value] !== null && weekdayMap[input.value] !== undefined) {
      selected.add(weekdayMap[input.value])
    }
  })

  return selected
}

function renderPredictedDays() {
  if (!calendarDays || !calendarMonth) return

  const year = calendarCursor.getFullYear()
  const month = calendarCursor.getMonth()
  const monthText = `${year}/${String(month + 1).padStart(2, "0")}`
  const selectedWeekdays = getSelectedWeekdays()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  calendarMonth.textContent = monthText
  calendarDays.replaceChildren()

  for (let day = 1; day <= daysInMonth; day += 1) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "calendar-day"
    button.disabled = true
    button.setAttribute("aria-label", `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`)
    button.textContent = String(day).padStart(2, "0")

    const weekday = new Date(year, month, day).getDay()
    if (selectedWeekdays.has(weekday)) {
      button.classList.add("selected")
      button.setAttribute("aria-current", "date")
    }

    calendarDays.appendChild(button)
  }
}

dayCheckboxes.forEach((input) => {
  input.addEventListener("change", () => {
    const daily = dayCheckboxes.find((item) => item.value === "diaria")

    if (input.value === "diaria" && input.checked) {
      dayCheckboxes.filter((item) => item !== input).forEach((item) => {
        item.checked = false
      })
    } else if (input.value !== "diaria" && input.checked && daily) {
      daily.checked = false
    }

    renderPredictedDays()
    setUnsaved(true)
  })
})

calendarNavigation.forEach((button, index) => {
  button.addEventListener("click", () => {
    calendarCursor = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth() + (index === 0 ? -1 : 1),
      1,
    )
    renderPredictedDays()
    setUnsaved(true)
  })
})

renderPredictedDays()

