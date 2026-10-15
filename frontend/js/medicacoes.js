// Aba Prescrição e Tratamento / Medicações (Prescrições de Medicações e Receitas Impressas).
// Depende de js/catalogos.js e js/componentes.js. Dados em memória até existir a API.
(() => {
  "use strict"

  const { el, formatDate, todayIso } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const $ = (id) => document.getElementById(id)
  if (!$("md-tbody")) return

  // Listas PROVISÓRIAS (a API deve fornecer o catálogo de medicamentos e os modelos de impressão).
  const DRUGS = [
    "Ácido fólico 5 mg", "Anlodipino 5 mg", "Calcitriol 0,25 mcg", "Carbonato de Cálcio 500 mg", "Cinacalcete 30 mg",
    "Enoxaparina 40 mg", "Eritropoetina 4000 UI", "Furosemida 40 mg", "Heparina 5000 UI/mL", "Losartana 50 mg",
    "Omeprazol 20 mg", "Sacarato de Hidróxido de Ferro 100 mg", "Sevelamer 800 mg",
  ]
  const POSOLOGIES = [
    "1 comprimido VO de 12/12h", "1 comprimido VO de 8/8h", "1 comprimido VO 1x ao dia",
    "1 comprimido VO junto às refeições principais", "1 ampola EV na sessão de HD", "SC 3x por semana pós-HD",
  ]
  const MODELS = [["padrao", "Padrão"]]

  let meds = []
  let receipts = []
  let nextId = 1
  let selectedId = null
  let selectedDate = null
  let editingId = null
  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))
  const authorName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const statusFilter = () => document.querySelector('input[name="md-status"]:checked').value

  // ---------- Campos fixos ----------
  $("md-drug-list").replaceChildren(...DRUGS.map((d) => el("option", { value: d })))
  $("md-posology-list").replaceChildren(...POSOLOGIES.map((d) => el("option", { value: d })))
  const fillSelect = (select, options, first) => {
    select.replaceChildren(el("option", { value: "", text: first }), ...options.map(([v, l]) => el("option", { value: v, text: l })))
  }
  fillSelect($("md-author"), C.doctorOptions(), "Selecione")
  fillSelect($("md-print-author"), [["clinica", "Clínica"], ...C.doctorOptions()], "Selecione")
  $("md-print-author").value = "clinica"
  $("md-model").replaceChildren(...MODELS.map(([v, l]) => el("option", { value: v, text: l })))
  $("md-date").value = todayIso()
  $("md-date").max = todayIso()

  // ---------- Abas ----------
  const tabs = [$("md-tab-presc"), $("md-tab-receitas")]
  const panels = [$("md-panel-presc"), $("md-panel-receitas")]
  function showTab(index, focus) {
    tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === index))
      t.tabIndex = i === index ? 0 : -1
      panels[i].hidden = i !== index
    })
    if (focus) tabs[index].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => showTab(i))
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault()
        showTab((i + 1) % tabs.length, true)
      }
    })
  })

  // ---------- Lista ----------
  const inScope = (m) => (statusFilter() === "active" ? m.status === "active" : m.status !== "active")
  const selected = () => meds.find((m) => m.id === selectedId) || null

  function renderList() {
    const scoped = meds.filter(inScope).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    const dates = [...new Set(scoped.map((m) => m.date))]
    if (selectedDate && !dates.includes(selectedDate)) selectedDate = null
    const rows = scoped.filter((m) => !selectedDate || m.date === selectedDate)
    if (selectedId && !rows.some((m) => m.id === selectedId)) selectedId = null

    const dateBtn = (value, label) =>
      el("li", {}, el("button", { class: "hc-date-btn", type: "button", "data-date": value, "aria-current": String((selectedDate || "") === value), text: label }))
    $("md-dates").replaceChildren(dateBtn("", "Todas"), ...dates.map((d) => dateBtn(d, formatDate(d))))

    $("md-tbody").replaceChildren(
      ...rows.map((m) =>
        el("tr", { tabindex: "0", "data-id": m.id, class: m.id === selectedId ? "is-selected" : "", "aria-selected": String(m.id === selectedId) },
          el("td", { text: [m.drug, m.complement, m.brand && `(${m.brand})`].filter(Boolean).join(" ") }),
          el("td", { text: m.posology }),
          el("td", { text: m.hd ? "Sim" : "Não" }),
          el("td", { text: m.status === "active" ? "Ativa" : `Suspensa em ${formatDate(m.suspendedAt)}` }),
        ),
      ),
    )
    $("md-empty").hidden = rows.length > 0
    const m = selected()
    $("md-act-edit").disabled = !m || m.status !== "active"
    $("md-act-suspend").disabled = !m || m.status !== "active"
    $("md-act-delete").disabled = !m
    $("md-print-help").textContent = selectedDate
      ? `Imprime as medicações em uso de ${formatDate(selectedDate)}.`
      : "Imprime todas as medicações em uso. Selecione uma data na lista para imprimir só aquela prescrição."
    $("md-print").disabled = !meds.some((x) => x.status === "active")
  }

  $("md-dates").addEventListener("click", (e) => {
    const b = e.target.closest("[data-date]")
    if (!b) return
    selectedDate = b.dataset.date || null
    renderList()
    $("md-dates").querySelector(`[data-date="${b.dataset.date}"]`)?.focus()
  })
  $("md-tbody").addEventListener("click", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (r) { selectedId = Number(r.dataset.id); renderList() }
  })
  $("md-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      selectedId = Number(r.dataset.id)
      renderList()
      $("md-tbody").querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus()
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus()
    }
  })
  document.querySelectorAll('input[name="md-status"]').forEach((r) => r.addEventListener("change", () => { selectedDate = null; selectedId = null; renderList() }))

  // ---------- Formulário ----------
  const F = { date: $("md-date"), author: $("md-author"), hd: $("md-hd"), drug: $("md-drug"), complement: $("md-complement"), brand: $("md-brand"), posology: $("md-posology"), qty: $("md-qty"), total: $("md-total") }
  const err = $("md-error")

  function resetForm() {
    editingId = null
    Object.values(F).forEach((f) => (f.type === "checkbox" ? (f.checked = false) : (f.value = "")))
    F.date.value = todayIso()
    $("md-form-title").textContent = "Nova prescrição"
    $("md-prescribe").textContent = "Prescrever"
    $("md-cancel-edit").hidden = true
    err.hidden = true
  }

  function validateForm() {
    if (!F.date.value) return ["date", "Informe a data da prescrição."]
    if (F.date.value > todayIso()) return ["date", "A data da prescrição não pode ser futura."]
    if (!F.author.value) return ["author", "Selecione o autor da prescrição."]
    if (!DRUGS.some((d) => d.toLowerCase() === F.drug.value.trim().toLowerCase())) return ["drug", "Selecione uma droga da lista."]
    if (!F.posology.value.trim()) return ["posology", "Informe a posologia."]
    if (F.qty.value.trim() && !/^[1-9]\d{0,3}$/.test(F.qty.value.trim())) return ["qty", "A quantidade deve ser um número inteiro maior que zero."]
    return null
  }

  $("md-prescribe").addEventListener("click", () => {
    const problem = validateForm()
    if (problem) {
      err.textContent = problem[1]
      err.hidden = false
      F[problem[0]].focus()
      return
    }
    err.hidden = true
    const drug = DRUGS.find((d) => d.toLowerCase() === F.drug.value.trim().toLowerCase())
    const data = {
      date: F.date.value, author: F.author.value, hd: F.hd.checked, drug, complement: F.complement.value.trim(),
      brand: F.brand.value.trim(), posology: F.posology.value.trim(), qty: F.qty.value.trim(), total: F.total.value.trim(),
    }
    if (editingId) {
      Object.assign(meds.find((m) => m.id === editingId), data)
      selectedId = editingId
    } else {
      const m = { id: nextId++, status: "active", suspendedAt: "", ...data }
      meds.push(m)
      selectedId = m.id
      document.querySelector('input[name="md-status"][value="active"]').checked = true
    }
    selectedDate = null
    resetForm()
    renderList()
    markDirty()
  })
  $("md-cancel-edit").addEventListener("click", resetForm)

  // ---------- Diálogo de confirmação ----------
  const dialog = $("md-dialog")
  let onConfirm = null
  let returnFocus = null
  function confirmDialog({ title, text, label, danger, run }) {
    returnFocus = document.activeElement
    $("md-dialog-title").textContent = title
    $("md-dialog-body").replaceChildren(el("p", { class: "ev-confirm", text }))
    const b = $("md-dialog-confirm")
    b.textContent = label
    b.classList.toggle("btn-danger", !!danger)
    b.classList.toggle("btn-primary", !danger)
    onConfirm = run
    dialog.showModal()
    b.focus()
  }
  function closeDialog() {
    if (dialog.open) dialog.close()
    onConfirm = null
    returnFocus?.focus?.()
  }
  $("md-dialog-form").addEventListener("submit", (e) => { e.preventDefault(); const run = onConfirm; closeDialog(); run?.() })
  $("md-dialog-cancel").addEventListener("click", closeDialog)
  $("md-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog() })

  $("md-act-edit").addEventListener("click", () => {
    const m = selected()
    if (!m) return
    editingId = m.id
    F.date.value = m.date; F.author.value = m.author; F.hd.checked = m.hd; F.drug.value = m.drug
    F.complement.value = m.complement; F.brand.value = m.brand; F.posology.value = m.posology; F.qty.value = m.qty; F.total.value = m.total
    $("md-form-title").textContent = "Alterar prescrição"
    $("md-prescribe").textContent = "Salvar alteração"
    $("md-cancel-edit").hidden = false
    F.drug.focus()
    F.drug.scrollIntoView({ block: "center" })
  })
  $("md-act-suspend").addEventListener("click", () => {
    const m = selected()
    if (!m) return
    confirmDialog({
      title: "Suspender medicação", label: "Suspender",
      text: `Suspender "${m.drug}"? Ela deixa de aparecer em "Medicações em uso" e passa ao Histórico.`,
      run() { m.status = "suspended"; m.suspendedAt = todayIso(); renderList(); markDirty() },
    })
  })
  $("md-act-delete").addEventListener("click", () => {
    const m = selected()
    if (!m) return
    confirmDialog({
      title: "Excluir medicação", label: "Excluir", danger: true,
      text: `Excluir "${m.drug}" prescrita em ${formatDate(m.date)}? A exclusão remove o registro; para encerrar o uso, prefira Suspender.`,
      run() { meds = meds.filter((x) => x.id !== m.id); selectedId = null; if (editingId === m.id) resetForm(); renderList(); markDirty() },
    })
  })

  // ---------- Impressão ----------
  function renderReceipts() {
    $("md-receipts").replaceChildren(
      ...[...receipts].reverse().map((r) =>
        el("tr", {}, el("td", { text: formatDate(r.date) }), el("td", { text: r.model }), el("td", { text: r.author }), el("td", { text: r.items.join("; ") })),
      ),
    )
    $("md-receipts-empty").hidden = receipts.length > 0
  }

  $("md-print").addEventListener("click", () => {
    const items = meds.filter((m) => m.status === "active" && (!selectedDate || m.date === selectedDate))
    if (!items.length) {
      err.textContent = "Não há medicações em uso para imprimir."
      err.hidden = false
      return
    }
    const printAuthor = $("md-print-author").value
    if (!printAuthor) { $("md-print-author").focus(); return }
    const authorLabel = printAuthor === "clinica" ? "Clínica" : authorName(printAuthor)
    const modelLabel = $("md-model").selectedOptions[0].textContent
    const lines = items.map((m) => {
      const parts = [[m.drug, m.complement].filter(Boolean).join(" "), m.posology]
      if (m.qty) parts.push(`Quantidade: ${m.qty}`)
      if (m.total) parts.push(`Dose total: ${m.total}`)
      return parts.join(" — ")
    })
    $("md-print-sheet").replaceChildren(
      el("h2", { text: "Receita" }),
      el("p", { text: `Paciente: ${$("patient-name")?.textContent || ""}` }),
      el("p", { text: `Data: ${formatDate(todayIso())}` }),
      el("ol", {}, ...lines.map((l) => el("li", { text: l }))),
      el("p", { class: "md-sign", text: authorLabel }),
    )
    receipts.push({ id: receipts.length + 1, date: todayIso(), model: modelLabel, author: authorLabel, items: items.map((m) => m.drug) })
    renderReceipts()
    markDirty()
    document.body.classList.add("md-printing")
    window.print()
  })
  window.addEventListener("afterprint", () => document.body.classList.remove("md-printing"))

  renderList()
  renderReceipts()

  window.HuNefroMedicacoes = {
    getData: () => JSON.parse(JSON.stringify({ meds, receipts })),
    setData(data) {
      meds = Array.isArray(data?.meds) ? JSON.parse(JSON.stringify(data.meds)) : []
      receipts = Array.isArray(data?.receipts) ? JSON.parse(JSON.stringify(data.receipts)) : []
      nextId = meds.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedId = null; selectedDate = null
      renderList(); renderReceipts()
    },
    validate: () => ({ valid: true, errors: [] }),
  }
})()
