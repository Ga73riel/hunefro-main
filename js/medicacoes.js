// Aba Prescrição e Tratamento / Medicações (Prescrições de Medicações e Receitas Impressas).
// Cada medicação tem um tipo de uso: contínuo, por tempo determinado ou por número de doses.
// A impressão (receituários e LME) é montada por js/receituarios.js.
// Depende de js/catalogos.js, js/componentes.js, js/catalogo-medicamentos.js e js/receituarios.js.
(() => {
  "use strict"

  const { el, formatDate, todayIso, markDirty, normalize } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const MED = window.HuNefroMedicamentos
  const RX = window.HuNefroReceituarios
  const $ = (id) => document.getElementById(id)
  if (!$("md-tbody")) return

  let meds = []
  let receipts = []
  let lmeDrafts = {}
  let nextId = 1
  let selectedDate = null
  let editingId = null
  let qtyTouched = false
  // Medicações marcadas na lista. Servem à impressão (vazio = imprime todas em uso) e às ações
  // Alterar (exatamente uma), Suspender e Excluir (uma ou mais).
  const picked = new Set()
  const authorName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const statusFilter = () => document.querySelector('input[name="md-status"]:checked').value
  const hdOpts = () => ({ hdDays: RX.patientContext().hdDays })

  // Medicação por tempo ou por dose cujo último dia já passou: concluída automaticamente.
  function effectiveStatus(m) {
    if (m.status !== "active") return m.status
    const end = MED.endDate(m, hdOpts())
    return end && end < todayIso() ? "finished" : "active"
  }
  const inUse = () => meds.filter((m) => effectiveStatus(m) === "active")

  // ---------- Campos fixos ----------
  $("md-drug-list").replaceChildren(...MED.DRUGS.map((d) => el("option", { value: d.name })))
  $("md-posology-list").replaceChildren(...MED.POSOLOGIES.map((d) => el("option", { value: d })))
  const fillSelect = (select, options, first) => {
    select.replaceChildren(...(first ? [el("option", { value: "", text: first })] : []), ...options.map(([v, l]) => el("option", { value: v, text: l })))
  }
  // O autor da prescrição é quem a cadastra: o usuário logado, se for médico. Não há escolha de autor.
  // A receita impressa sai no nome do médico logado, que assina e carimba à mão.
  const loggedDoctor = () => {
    const p = window.HuNefroAdmin?.currentProfessional?.()
    return p?.category === "medico" ? p : null
  }
  function syncAuthor() {
    const doctor = loggedDoctor()
    $("md-author").value = doctor?.id || ""
    $("md-author-name").value = doctor ? `${doctor.name}${RX.councilOf(doctor) ? ` - ${RX.councilOf(doctor)}` : ""}` : "Somente médico pode prescrever"
    $("md-author-name").classList.toggle("is-invalid", !doctor)
    $("md-author-name").title = "Quem cadastra a prescrição é o autor (usuário logado)."
    $("md-author-help").textContent = doctor ? "" : "Entre com o usuário de um médico (ex.: prof01@ebserh.gov.br) para prescrever."
    $("md-author-help").hidden = Boolean(doctor)
    // Médico logado: a receita sai no nome dele. Outro perfil (ex.: enfermagem imprimindo): escolhe o médico.
    $("md-print-author").hidden = Boolean(doctor)
    $("md-print-author-name").hidden = !doctor
    if (doctor) {
      $("md-print-author-name").value = doctor.name
      $("md-print-author").value = doctor.id
    }
  }
  fillSelect($("md-print-author"), C.doctorOptions())
  fillSelect($("md-duration-unit"), MED.DURATION_UNITS.map(([v, , , plural]) => [v, plural]))
  $("md-date").value = todayIso()
  $("md-date").max = todayIso()
  $("md-print-date").value = todayIso()

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
  const inScope = (m) => (statusFilter() === "active" ? effectiveStatus(m) === "active" : effectiveStatus(m) !== "active")
  const pickedMeds = () => meds.filter((m) => picked.has(m.id))
  let visibleIds = []

  function statusLabel(m) {
    const status = effectiveStatus(m)
    if (status === "active") return "Ativa"
    if (status === "finished") return `Concluída em ${formatDate(MED.endDate(m, hdOpts()))}`
    return `Suspensa em ${formatDate(m.suspendedAt)}`
  }

  // Selo da classe do medicamento (controle especial, antimicrobiano, CEAF).
  function drugTags(name) {
    const d = MED.find(name)
    if (!d) return []
    const tags = []
    if (d.control === "C1") tags.push(["Controle especial", "hn-badge-warn"])
    if (["A", "B1", "B2"].includes(d.control)) tags.push([`Notificação ${d.control === "A" ? "A" : "B"}`, "hn-badge-danger"])
    if (d.antimicrobial) tags.push(["Antimicrobiano", "hn-badge-enxerto"])
    if (d.ceaf) tags.push(["LME", "hn-badge-ok"])
    return tags
  }
  const tagNodes = (name) => drugTags(name).map(([t, cls]) => el("span", { class: `hn-badge ${cls} md-tag`, text: t }))
  const medLabel = (m) => [m.drug, m.complement, m.brand && `(${m.brand})`].filter(Boolean).join(" ")

  function renderList() {
    const opts = hdOpts()
    const scoped = meds.filter(inScope).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    const dates = [...new Set(scoped.map((m) => m.date))]
    if (selectedDate && !dates.includes(selectedDate)) selectedDate = null
    const rows = scoped.filter((m) => !selectedDate || m.date === selectedDate)
    visibleIds = rows.map((m) => m.id)
    // Só fica marcado o que está visível: nada é impresso ou excluído "escondido" por um filtro.
    ;[...picked].forEach((id) => { if (!visibleIds.includes(id)) picked.delete(id) })

    const dateBtn = (value, label) =>
      el("li", {}, el("button", { class: "hc-date-btn", type: "button", "data-date": value, "aria-current": String((selectedDate || "") === value), text: label }))
    $("md-dates").replaceChildren(dateBtn("", "Todas"), ...dates.map((d) => dateBtn(d, formatDate(d))))

    $("md-tbody").replaceChildren(
      ...rows.map((m) => {
        const on = picked.has(m.id)
        return el("tr", { tabindex: "0", "data-id": m.id, class: on ? "is-selected" : "", "aria-selected": String(on) },
          el("td", { class: "md-pick-col" }, el("input", { class: "md-pick", type: "checkbox", "data-pick": m.id, checked: on, tabindex: "-1", "aria-label": `Marcar ${m.drug}`, "data-no-dirty": true })),
          el("td", {}, el("span", { text: medLabel(m) }), ...tagNodes(m.drug)),
          el("td", { text: m.posology }),
          el("td", { text: MED.usageLabel(m, opts) }),
          el("td", { text: MED.quantityLabel(m) || "-" }),
          el("td", { text: m.hd ? "Sim" : "Não" }),
          el("td", { text: statusLabel(m) }),
        )
      }),
    )
    $("md-empty").hidden = rows.length > 0
    const all = $("md-pick-all")
    all.disabled = rows.length === 0
    all.checked = rows.length > 0 && picked.size === rows.length
    all.indeterminate = picked.size > 0 && picked.size < rows.length

    const n = picked.size
    const list = pickedMeds()
    const allActive = n > 0 && list.every((m) => effectiveStatus(m) === "active")
    $("md-act-edit").disabled = !(n === 1 && allActive)
    $("md-act-edit").title = n > 1 ? "Marque só uma medicação para alterar" : ""
    $("md-act-suspend").disabled = !allActive
    $("md-act-delete").disabled = n === 0
    $("md-pick-count").textContent = n ? `${n} marcada${n > 1 ? "s" : ""}` : ""
    $("md-pick-clear").hidden = n === 0
    renderDocuments()
  }

  function togglePick(id, on = !picked.has(id)) {
    if (on) picked.add(id); else picked.delete(id)
    renderList()
    $("md-tbody").querySelector(`tr[data-id="${id}"]`)?.focus()
  }

  $("md-dates").addEventListener("click", (e) => {
    const b = e.target.closest("[data-date]")
    if (!b) return
    selectedDate = b.dataset.date || null
    renderList()
    $("md-dates").querySelector(`[data-date="${b.dataset.date}"]`)?.focus()
  })
  // Clicar na linha (ou na caixa) marca e desmarca a medicação.
  $("md-tbody").addEventListener("click", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    const box = e.target.closest("[data-pick]")
    togglePick(Number(r.dataset.id), box ? box.checked : undefined)
  })
  $("md-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      togglePick(Number(r.dataset.id))
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus()
    }
  })
  $("md-pick-all").addEventListener("change", (e) => {
    picked.clear()
    if (e.target.checked) visibleIds.forEach((id) => picked.add(id))
    renderList()
  })
  $("md-pick-clear").addEventListener("click", () => { picked.clear(); renderList() })
  document.querySelectorAll('input[name="md-status"]').forEach((r) => r.addEventListener("change", () => { selectedDate = null; picked.clear(); renderList() }))

  // ---------- Formulário ----------
  const F = {
    date: $("md-date"), author: $("md-author"), authorName: $("md-author-name"), hd: $("md-hd"), drug: $("md-drug"), complement: $("md-complement"), brand: $("md-brand"),
    posology: $("md-posology"), duration: $("md-duration"), durationUnit: $("md-duration-unit"), doses: $("md-doses"), qty: $("md-qty"),
  }
  const err = $("md-error")
  const usage = () => document.querySelector('input[name="md-usage"]:checked').value
  const setUsage = (v) => { document.querySelector(`input[name="md-usage"][value="${v || "continuo"}"]`).checked = true }
  const formData = () => ({
    date: F.date.value, author: F.author.value, hd: F.hd.checked, drug: MED.find(F.drug.value)?.name || F.drug.value.trim(),
    complement: F.complement.value.trim(), brand: F.brand.value.trim(), posology: F.posology.value.trim(), usage: usage(),
    duration: usage() === "tempo" ? F.duration.value.trim() : "", durationUnit: F.durationUnit.value,
    doses: usage() === "dose" ? F.doses.value.trim() : "", qty: F.qty.value.trim(),
  })

  // Posologia que não combina com a forma do medicamento (ex.: "1 comprimido VO" para um frasco-ampola).
  // Só avisa, sem bloquear: há usos legítimos fora do padrão (vancomicina injetável dada por via oral, por exemplo).
  function formWarning(drug, posology) {
    const d = MED.find(drug)
    const text = normalize(posology)
    if (!d || !text) return ""
    const injectable = ["ampola", "frasco", "frascoMl"].includes(d.form)
    const saysSolid = /\b(comprimid|capsul|cp|cps)/.test(text)
    const saysVial = /\b(ampol|frasco)/.test(text)
    const parenteral = ["ev", "sc", "im"].includes(MED.route(posology)[0])
    const [, many] = MED.formOf(d.name)
    if (injectable && saysSolid) return `${d.name} é apresentado em ${many}, mas a posologia fala em comprimido ou cápsula. Confira.`
    if (!injectable && (saysVial || parenteral)) return `${d.name} é apresentado em ${many}, mas a posologia indica uso injetável. Confira.`
    return ""
  }

  // Mostra os campos do tipo de uso, recalcula a quantidade e resume o que vai ser prescrito.
  function syncForm() {
    const u = usage()
    $("md-duration-block").hidden = u !== "tempo"
    $("md-doses-block").hidden = u !== "dose"
    $("md-qty-label").textContent = u === "continuo" ? "Quantidade (30 dias)" : "Quantidade total"
    const data = formData()
    const ctx = RX.patientContext()
    if (!qtyTouched) F.qty.value = MED.suggestedQuantity(data, { hdPerWeek: ctx.hdDays.length || 3 })
    const [one, many] = MED.formOf(data.drug)
    $("md-qty-unit").textContent = Number(F.qty.value) === 1 ? one : many
    const ready = data.posology && (u === "continuo" || (u === "tempo" && Number(data.duration) > 0) || (u === "dose" && Number(data.doses) > 0))
    $("md-summary").replaceChildren(...(ready ? [
      el("span", { class: "md-summary-label", text: "Resumo" }),
      el("strong", { text: MED.usageLabel(data, { hdDays: ctx.hdDays }) }),
      ...tagNodes(data.drug),
    ] : []))
    $("md-hint").textContent = u === "continuo"
      ? "Uso contínuo: sem data de término. A quantidade cobre 30 dias e é calculada pela posologia."
      : u === "tempo"
        ? "Por tempo: informe a duração. A medicação passa ao Histórico ao terminar."
        : `Por dose: informe o número de doses.${data.hd ? " O término é calculado pelos dias de HD do paciente." : ""} A medicação passa ao Histórico após a última dose.`
    const warning = formWarning(data.drug, data.posology)
    $("md-form-warning").textContent = warning
    $("md-form-warning").hidden = !warning
  }
  document.querySelectorAll('input[name="md-usage"]').forEach((r) => r.addEventListener("change", () => { qtyTouched = false; syncForm() }))
  ;[F.posology, F.duration, F.durationUnit, F.doses, F.drug, F.hd].forEach((f) => f.addEventListener(f.type === "checkbox" || f.tagName === "SELECT" ? "change" : "input", syncForm))
  F.drug.addEventListener("change", syncForm)
  F.qty.addEventListener("input", () => { qtyTouched = F.qty.value.trim() !== ""; syncForm() })

  function resetForm() {
    editingId = null
    qtyTouched = false
    ;["drug", "complement", "brand", "posology", "duration", "doses", "qty"].forEach((k) => (F[k].value = ""))
    syncAuthor()
    F.hd.checked = false
    F.durationUnit.value = "dias"
    F.date.value = todayIso()
    setUsage("continuo")
    $("md-form-title").textContent = "Nova prescrição"
    $("md-prescribe").textContent = "Prescrever"
    $("md-cancel-edit").hidden = true
    err.hidden = true
    syncForm()
  }

  const positiveInt = (v) => /^[1-9]\d{0,3}$/.test(v)
  function validateForm() {
    if (!F.date.value) return ["date", "Informe a data da prescrição."]
    if (F.date.value > todayIso()) return ["date", "A data da prescrição não pode ser futura."]
    if (!F.author.value) return ["authorName", "Somente médico pode prescrever. Entre com o usuário de um médico."]
    if (!MED.find(F.drug.value)) return ["drug", "Selecione uma droga da lista."]
    if (!F.posology.value.trim()) return ["posology", "Informe a posologia."]
    if (usage() === "tempo" && !positiveInt(F.duration.value.trim())) return ["duration", "Informe a duração do tratamento (número inteiro)."]
    if (usage() === "dose" && !positiveInt(F.doses.value.trim())) return ["doses", "Informe o número de doses (número inteiro)."]
    if (F.qty.value.trim() && !positiveInt(F.qty.value.trim())) return ["qty", "A quantidade deve ser um número inteiro maior que zero."]
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
    const data = formData()
    if (editingId) {
      Object.assign(meds.find((m) => m.id === editingId), data)
    } else {
      meds.push({ id: nextId++, status: "active", suspendedAt: "", ...data })
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
    const [m] = pickedMeds()
    if (!m || picked.size !== 1) return
    editingId = m.id
    ;["date", "drug", "complement", "brand", "posology", "duration", "doses", "qty"].forEach((k) => (F[k].value = m[k] || ""))
    syncAuthor()
    F.hd.checked = m.hd
    F.durationUnit.value = m.durationUnit || "dias"
    setUsage(m.usage)
    qtyTouched = Boolean(m.qty)
    syncForm()
    $("md-form-title").textContent = "Alterar prescrição"
    $("md-prescribe").textContent = "Salvar alteração"
    $("md-cancel-edit").hidden = false
    F.drug.focus()
    F.drug.scrollIntoView({ block: "center" })
  })
  // Nome das medicações marcadas para o texto de confirmação: "A", "A e B", "A, B e C".
  const namesText = (list) => {
    const names = list.map((m) => `"${m.drug}"`)
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0]
  }
  $("md-act-suspend").addEventListener("click", () => {
    const list = pickedMeds()
    if (!list.length) return
    const many = list.length > 1
    confirmDialog({
      title: many ? `Suspender ${list.length} medicações` : "Suspender medicação", label: "Suspender",
      text: `Suspender ${namesText(list)}? ${many ? "Elas deixam" : "Ela deixa"} de aparecer em "Medicações em uso" e ${many ? "passam" : "passa"} ao Histórico.`,
      run() {
        list.forEach((m) => { m.status = "suspended"; m.suspendedAt = todayIso() })
        if (list.some((m) => m.id === editingId)) resetForm()
        picked.clear(); renderList(); markDirty()
      },
    })
  })
  $("md-act-delete").addEventListener("click", () => {
    const list = pickedMeds()
    if (!list.length) return
    const many = list.length > 1
    const ids = new Set(list.map((m) => m.id))
    confirmDialog({
      title: many ? `Excluir ${list.length} medicações` : "Excluir medicação", label: "Excluir", danger: true,
      text: many
        ? `Excluir ${namesText(list)}? A exclusão remove os registros; para encerrar o uso, prefira Suspender.`
        : `Excluir "${list[0].drug}" prescrita em ${formatDate(list[0].date)}? A exclusão remove o registro; para encerrar o uso, prefira Suspender.`,
      run() {
        meds = meds.filter((x) => !ids.has(x.id))
        if (ids.has(editingId)) resetForm()
        picked.clear(); renderList(); markDirty()
      },
    })
  })

  // ---------- Receituários ----------
  // Prescritor padrão: autor da prescrição mais recente em uso.
  function defaultPrescriber() {
    const latest = inUse().sort((a, b) => b.date.localeCompare(a.date))[0]
    return latest?.author || C.doctorOptions()[0]?.[0] || ""
  }

  // Cada medicação marcada sai no seu documento: receituário, antimicrobiano, controle especial (até 3 por receita),
  // folha da sessão de HD e LME do protocolo. Sem nada marcado, imprime tudo, inclusive a APAC.
  let current = { docs: [], warnings: [] }
  let apacDoc = null
  function renderDocuments() {
    if (loggedDoctor()) $("md-print-author").value = loggedDoctor().id
    else if (!$("md-print-author").dataset.touched) $("md-print-author").value = defaultPrescriber()
    const showing = statusFilter() === "active"
    $("md-print-panel").hidden = !showing
    if (!showing) return
    const chosen = pickedMeds()
    const built = RX.buildDocuments({ meds: chosen.length ? chosen : inUse(), allMeds: meds, prescriberId: $("md-print-author").value, date: $("md-print-date").value || todayIso(), lmeDrafts })
    apacDoc = built.docs.find((d) => d.key === "apac") || null
    // A APAC não depende das medicações: com medicações marcadas, sai só pelo botão próprio.
    current = chosen.length ? { ...built, docs: built.docs.filter((d) => d !== apacDoc) } : built

    $("md-print-help").replaceChildren(...(chosen.length
      ? [`${chosen.length} medicaç${chosen.length > 1 ? "ões marcadas" : "ão marcada"}: cada uma sai no seu documento.`]
      : [el("strong", { text: "Nenhuma medicação marcada: imprime todas em uso." }), " Marque na lista as que quiser imprimir."]))
    $("md-docs").replaceChildren(...current.docs.map((d) => el("li", { class: "md-doc" },
      el("span", { class: "md-doc-text" },
        el("span", { class: "md-doc-title" }, el("strong", { text: d.title }), el("span", { class: "md-doc-kind", text: d.vias > 1 ? `${d.vias} vias` : "1 via" })),
        el("span", { class: "md-doc-items", text: d.items.join(" · ") }),
        d.note ? el("span", { class: `md-doc-note${d.noteLevel === "warning" ? " is-warning" : ""}`, text: d.note }) : "",
      ),
      d.lme ? el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", "data-lme": d.lme, text: d.edited ? "Revisar LME ✓" : "Revisar LME" }) : "",
    )))
    $("md-warnings").replaceChildren(...current.warnings.map((w) => el("li", { class: "hn-alert hn-alert-warn", text: w })))
    const n = current.docs.length
    const docsText = `${n} documento${n === 1 ? "" : "s"}`
    $("md-print").textContent = chosen.length ? `Imprimir marcadas (${docsText})` : `Imprimir todas (${docsText})`
    $("md-print").disabled = n === 0
    $("md-print-apac").hidden = !(chosen.length && apacDoc)
  }

  $("md-docs").addEventListener("click", (e) => { const b = e.target.closest("[data-lme]"); if (b) openLme(b.dataset.lme) })
  $("md-print-author").addEventListener("change", () => { $("md-print-author").dataset.touched = "1"; renderDocuments() })
  $("md-print-date").addEventListener("change", renderDocuments)

  function renderReceipts() {
    $("md-receipts").replaceChildren(
      ...[...receipts].reverse().map((r) =>
        el("tr", {}, el("td", { text: formatDate(r.date) }), el("td", { text: r.model }), el("td", { text: r.author }), el("td", { text: r.items.join("; ") })),
      ),
    )
    $("md-receipts-empty").hidden = receipts.length > 0
  }

  function printDocs(docs) {
    if (!docs.length) return
    receipts.push({
      id: receipts.length + 1, date: todayIso(), model: docs.map((d) => d.title).join("; "),
      author: authorName($("md-print-author").value), items: [...new Set(docs.flatMap((d) => d.items))],
    })
    renderReceipts()
    markDirty()
    RX.print(docs)
  }
  $("md-print").addEventListener("click", () => { renderDocuments(); printDocs(current.docs) })
  $("md-print-apac").addEventListener("click", () => { renderDocuments(); printDocs(apacDoc ? [apacDoc] : []) })

  // ---------- Revisão do LME ----------
  const lmeDialog = $("md-lme-dialog")
  let lmeKey = null
  const L = {
    cid: $("md-lme-cid"), weight: $("md-lme-weight"), height: $("md-lme-height"), months: $("md-lme-months"), anamnese: $("md-lme-anamnese"),
    priorText: $("md-lme-prior-text"), guardian: $("md-lme-guardian"), filled: $("md-lme-filled"),
  }
  const radio = (name, v) => { const r = document.querySelector(`input[name="${name}"][value="${v}"]`); if (r) r.checked = true }
  const radioValue = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || "nao"

  function fillLme(draft) {
    const protocol = MED.PROTOCOLS[lmeKey]
    fillSelect(L.cid, protocol.cids.map((code) => [code, C.CID.find((c) => c.code === code)?.label || code]))
    L.cid.value = draft.cid
    L.weight.value = draft.weight
    L.height.value = draft.height
    L.months.value = String(draft.months)
    L.anamnese.value = draft.anamnese
    radio("md-lme-prior", draft.priorTreatment)
    L.priorText.value = draft.priorText
    radio("md-lme-incapable", draft.incapable)
    L.guardian.value = draft.guardian
    L.filled.value = draft.filledBy
    $("md-lme-items").replaceChildren(...draft.items.map((item, i) => el("tr", {},
      el("td", { text: item.name }),
      el("td", {}, el("input", { class: "form-control form-control-sm", "data-item": i, value: item.monthly, inputmode: "numeric", "aria-label": `Quantidade por mês de ${item.name}`, "data-no-dirty": true })),
    )))
  }

  function openLme(key) {
    const doc = current.docs.find((d) => d.lme === key)
    if (!doc) return
    lmeKey = key
    $("md-lme-title").textContent = `Revisar LME - ${MED.PROTOCOLS[key].name}`
    $("md-lme-exams").replaceChildren(...RX.examStatus(key).map((e) => el("li", { class: e.ok ? "is-ok" : "is-late" },
      el("span", { class: "md-lme-exam-mark", "aria-hidden": "true", text: e.ok ? "✓" : "!" }),
      el("strong", { text: e.name }),
      el("span", { text: e.last ? ` ${e.last.result} em ${formatDate(e.last.date)}` : " sem resultado" }),
      el("span", { class: "md-lme-exam-rule", text: e.ok ? ` · válido (até ${e.validity} dias)` : ` · precisa ter até ${e.validity} dias` }),
    )))
    $("md-lme-docs").textContent = `Para o processo: ${MED.PROTOCOLS[key].documents}`
    $("md-lme-error").hidden = true
    fillLme(doc.draft)
    lmeDialog.showModal()
    L.anamnese.focus()
  }

  $("md-lme-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const doc = current.docs.find((d) => d.lme === lmeKey)
    const items = doc.draft.items.map((item, i) => ({ ...item, monthly: $("md-lme-items").querySelector(`[data-item="${i}"]`).value.trim() }))
    const problem = !L.anamnese.value.trim() ? "Preencha a anamnese."
      : items.some((x) => !positiveInt(x.monthly)) ? "Informe a quantidade por mês de cada medicamento."
        : radioValue("md-lme-prior") === "sim" && !L.priorText.value.trim() ? "Relate o tratamento prévio."
          : radioValue("md-lme-incapable") === "sim" && !L.guardian.value.trim() ? "Informe o nome do responsável." : ""
    if (problem) { $("md-lme-error").textContent = problem; $("md-lme-error").hidden = false; return }
    lmeDrafts[lmeKey] = {
      ...doc.draft, items, cid: L.cid.value, weight: L.weight.value.trim(), height: L.height.value.trim(), months: Number(L.months.value),
      anamnese: L.anamnese.value.trim(), priorTreatment: radioValue("md-lme-prior"), priorText: L.priorText.value.trim(),
      incapable: radioValue("md-lme-incapable"), guardian: L.guardian.value.trim(), filledBy: L.filled.value,
    }
    lmeDialog.close()
    renderDocuments()
    markDirty()
  })
  $("md-lme-reset").addEventListener("click", () => fillLme(current.docs.find((d) => d.lme === lmeKey).auto))
  const closeLme = () => lmeDialog.close()
  $("md-lme-cancel").addEventListener("click", closeLme)
  $("md-lme-close").addEventListener("click", closeLme)

  // Os receituários dependem de outras abas (identificação, dados clínicos, exames): atualiza ao abrir a aba.
  document.addEventListener("click", (e) => { if (e.target.closest('[data-section="medicacoes"]')) setTimeout(renderList) })

  resetForm()
  renderList()
  renderReceipts()

  window.HuNefroMedicacoes = {
    getData: () => JSON.parse(JSON.stringify({ meds, receipts, lmeDrafts })),
    setData(data) {
      // Prescrições antigas, sem tipo de uso, passam a "uso contínuo".
      meds = Array.isArray(data?.meds) ? JSON.parse(JSON.stringify(data.meds)).map((m) => ({ usage: "continuo", duration: "", durationUnit: "dias", doses: "", ...m })) : []
      receipts = Array.isArray(data?.receipts) ? JSON.parse(JSON.stringify(data.receipts)) : []
      lmeDrafts = data?.lmeDrafts && typeof data.lmeDrafts === "object" ? JSON.parse(JSON.stringify(data.lmeDrafts)) : {}
      nextId = meds.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedDate = null
      picked.clear()
      delete $("md-print-author").dataset.touched
      renderList(); renderReceipts()
    },
    validate: () => ({ valid: true, errors: [] }),
    // Medicações em uso hoje (sem as suspensas e as concluídas): usadas nos Laudos.
    inUse: () => JSON.parse(JSON.stringify(inUse())),
  }
})()
