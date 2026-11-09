// Aba Resultados / Exames: rotina de exames por periodicidade (mensal, trimestral, semestral, anual) com situação de cada exame,
// lançamento por grupo, cálculo de diálise (Kt/V e URR) e Flow de Exames. IMC e URR são calculados automaticamente.
// Depende de js/componentes.js. Dados em memória até existir a API.
// Os resultados são texto livre (ex.: "75 (Alto)"); unidades e valores de referência dependem de definição da equipe.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, markDirty, parseNumber } = window.HuNefroUI
  const $ = (id) => document.getElementById(id)
  if (!$("ex-tbody")) return

  // Catálogo PROVISÓRIO transcrito das imagens do manual (p. 21-22) e do modelo visual do Flow. O administrador deve poder cadastrar grupos.
  const HEMOGRAM = ["Hemácias", "Hematócrito", "Hemoglobina", "VCM", "HCM", "CHCM", "RDW", "Leucócitos", "Neutrófilos", "Bastonetes", "Segmentados", "Linfócitos",
    "Linfócitos atípicos", "Monócitos", "Eosinófilos", "Basófilos", "Promielócitos", "Mielócitos", "Metamielócitos", "Prolinfócitos", "Plasmócitos", "Blastos", "Plaquetas", "VPM"]
  const ROUTINE = ["Cálcio", "Creatinina", "Fósforo", "Gasometria venosa", "Glicose", "Hematócrito", "Hemoglobina", "Potássio", "Sódio", "TGP", "Ureia", "Albumina", "Ferritina",
    "Ferro sérico", "Fosfatase alcalina", "Globulina", "Hemoglobina glicada", "Proteínas totais", "PTH", "Saturação da transferrina", "25-Hidroxivitamina D", "Anti-HBs", "Anti-HCV",
    "HBsAg", "Alumínio sérico", "Anti-HIV", "Colesterol HDL", "Colesterol LDL", "Colesterol total", "T4", "Triglicerídeos", "TSH"]
  // Nomes antigos do lançamento antropométrico manual. As medidas agora são preenchidas só na Nutrição e entram aqui
  // pelo botão "Incluir exames antropométricos" (source "nutricao"); estes nomes ficam só para exibir registros antigos.
  const ANTHROPOMETRY = ["Altura", "Peso", "Peso seco BIA (NH)", "CB", "CP", "CC", "CQ", "Prega cutânea tricipital", "PCB", "PCSI", "PCSE", "IMC", "Peso ideal",
    "Adequação do peso (%)", "Adequação da CB (%)", "Adequação da PCT (%)", "CMB", "Adequação da CMB (%)", "Percentual de gordura", "RCQ"]
  const DIALYSIS = ["Ureia pré-diálise", "Ureia pós-diálise", "URR (%)", "Kt/V"]
  const OTHERS = ["Risco de queda", "1,25-dihidroxivitamina D"]
  // Rotina por periodicidade. PROPOSTA baseada na RDC ANVISA nº 11/2014 (serviços de diálise): confirmar com a equipe médica.
  // items: exames acompanhados na situação (match = nomes que contam como realizado; request = exames da solicitação,
  // quando diferem do nome; when = condição do paciente para solicitar); launch: exames do lançamento em grupo.
  // O sódio entrou nos mensais a pedido da médica (Elias, 29/10/2026).
  const HEMOGRAM_PARTS = HEMOGRAM.filter((n) => n !== "Hematócrito" && n !== "Hemoglobina")
  const SCHEDULE = [
    { key: "mensal", label: "Mensal", days: 31, items: [
      { name: "Hematócrito" }, { name: "Hemoglobina" },
      { name: "Ureia pré-diálise" }, { name: "Ureia pós-diálise" }, { name: "Kt/V", note: "ou URR; use Cálculo de diálise", match: ["Kt/V", "URR (%)"], request: [] },
      { name: "Sódio" }, { name: "Potássio" }, { name: "Cálcio" }, { name: "Fósforo" }, { name: "TGP" },
      { name: "Glicose", note: "pacientes diabéticos", when: "diabetic" }, { name: "Creatinina", note: "durante o 1º ano", when: "firstYear" },
    ], launch: ["Hematócrito", "Hemoglobina", "Ureia pré-diálise", "Ureia pós-diálise", "URR (%)", "Sódio", "Potássio", "Cálcio", "Fósforo", "TGP", "Glicose", "Creatinina"] },
    { key: "trimestral", label: "Trimestral", days: 92, items: [
      { name: "Hemograma completo", match: HEMOGRAM_PARTS }, { name: "Saturação da transferrina" }, { name: "Ferritina" }, { name: "Ferro sérico" },
      { name: "Proteínas totais e frações", match: ["Proteínas totais", "Albumina", "Globulina"] }, { name: "Fosfatase alcalina" },
      { name: "Hemoglobina glicada", note: "pacientes diabéticos", when: "diabetic" },
    ], launch: ["Saturação da transferrina", "Ferritina", "Ferro sérico", "Proteínas totais", "Albumina", "Globulina", "Fosfatase alcalina", "Hemoglobina glicada"] },
    { key: "semestral", label: "Semestral", days: 183, items: [
      { name: "PTH" }, { name: "Anti-HBs" }, { name: "HBsAg", note: "pacientes suscetíveis", when: "hbvSusceptible" }, { name: "Anti-HCV", note: "pacientes suscetíveis", when: "hcvSusceptible" },
      { name: "25-Hidroxivitamina D" },
    ], launch: ["PTH", "Anti-HBs", "HBsAg", "Anti-HCV", "25-Hidroxivitamina D"] },
    { key: "anual", label: "Anual", days: 365, items: [
      { name: "Colesterol total e frações", match: ["Colesterol total", "Colesterol HDL", "Colesterol LDL"], request: ["Colesterol total", "Colesterol HDL", "Colesterol LDL"] }, { name: "Triglicerídeos" },
      { name: "Anti-HIV" }, { name: "Alumínio sérico" }, { name: "T4" }, { name: "TSH" },
    ], launch: ["Colesterol total", "Colesterol HDL", "Colesterol LDL", "Triglicerídeos", "Anti-HIV", "Alumínio sérico", "T4", "TSH"] },
  ]
  const ANTHRO_GROUP = "Aval. Antrop."
  const GROUPS = [
    ...SCHEDULE.map((p) => [p.label, p.launch]), ["Hemograma", HEMOGRAM], ["Aval. Antrop.", []], ["Diálise", DIALYSIS],
  ]
  const CATALOG = [...new Set([...HEMOGRAM, ...ROUTINE, ...ANTHROPOMETRY, ...DIALYSIS, ...OTHERS, ...SCHEDULE.flatMap((p) => p.launch)])].sort((a, b) => a.localeCompare(b, "pt-BR"))
  // Lançamento manual: tudo menos a antropometria, que vem da aba Nutrição.
  const ANTHRO_SET = new Set(ANTHROPOMETRY)
  const MANUAL_CATALOG = CATALOG.filter((n) => !ANTHRO_SET.has(n))
  const isAnthropometric = (x) => x.source === "nutricao" || ANTHRO_SET.has(x.name)
  const URR_NOTE = "Calculado automaticamente a partir da ureia pré e pós-diálise."
  const AUTO_NOTE = "Calculado automaticamente a partir de Peso e Altura da mesma data."

  let exams = []
  let nextId = 1
  let selectedId = null
  let editingId = null
  let flowGroup = ""
  let flowRow = null
  const dec = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",")

  // ---------- Abas ----------
  const tabs = [$("ex-tab-list"), $("ex-tab-flow"), $("ex-tab-req")]
  const panels = [$("ex-panel-list"), $("ex-panel-flow"), $("ex-panel-req")]
  function showTab(i, focus) {
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i })
    if (i === 1) renderFlow()
    if (i === 2) document.dispatchEvent(new CustomEvent("hunefro:solicitacao-exames"))
    if (focus) tabs[i].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => showTab(i))
    t.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); showTab((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true) } })
  })

  // ---------- Lista ----------
  const selected = () => exams.find((x) => x.id === selectedId) || null
  const sorted = () => [...exams].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)

  function renderList() {
    renderSchedule()
    const q = $("ex-filter").value.trim().toLowerCase()
    const rows = sorted().filter((x) => !q || `${x.name} ${x.result} ${x.by}`.toLowerCase().includes(q))
    if (selectedId && !rows.some((x) => x.id === selectedId)) selectedId = null
    $("ex-tbody").replaceChildren(
      ...rows.map((x) => el("tr", { tabindex: "0", "data-id": x.id, class: x.id === selectedId ? "is-selected" : "", "aria-selected": String(x.id === selectedId) },
        el("td", { text: formatDate(x.date) }), el("td", { text: x.name }), el("td", { text: x.result }), el("td", { text: x.by }))),
    )
    $("ex-empty").hidden = rows.length > 0
    $("ex-empty").textContent = exams.length ? "Nenhum exame com este filtro." : "Nenhum exame registrado."
    const sel = selected()
    $("ex-text").textContent = sel ? sel.description || "Sem descrição registrada para este exame." : "Selecione um exame para ver a descrição."
    $("ex-edit").disabled = !sel
    $("ex-delete").disabled = !sel
  }
  $("ex-filter").addEventListener("input", renderList)
  $("ex-tbody").addEventListener("click", (e) => { const r = e.target.closest("tr[data-id]"); if (r) { selectedId = Number(r.dataset.id); renderList() } })
  $("ex-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectedId = Number(r.dataset.id); renderList(); $("ex-tbody").querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus() }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus() }
  })

  // ---------- IMC automático ----------
  // Altura aceita metros (1,62) ou centímetros (162). Devolve o IMC ou null.
  function bmiOf(weight, height) {
    const w = parseNumber(weight), h = parseNumber(height)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
    const meters = h > 3 ? h / 100 : h
    const bmi = w / meters ** 2
    return Number.isFinite(bmi) && bmi > 5 && bmi < 100 ? bmi : null
  }
  function urrOf(pre, post) {
    const a = parseNumber(pre), b = parseNumber(post)
    return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && b < a ? (1 - b / a) * 100 : null
  }
  const latestOn = (name, date) => sorted().find((x) => x.name === name && x.date === date) || null
  // Cria, atualiza ou remove o IMC automático de uma data conforme Peso e Altura daquela data.
  function syncBmi(date) {
    const weight = latestOn("Peso", date), height = latestOn("Altura", date)
    const bmi = weight && height ? bmiOf(weight.result, height.result) : null
    const auto = exams.find((x) => x.name === "IMC" && x.date === date && x.auto)
    if (bmi == null) { if (auto) exams = exams.filter((x) => x !== auto); return }
    const values = { result: dec(bmi), description: AUTO_NOTE, by: weight.by }
    if (auto) Object.assign(auto, values)
    else exams.push({ id: nextId++, date, name: "IMC", auto: true, ...values })
  }

  // ---------- Formulário individual ----------
  const F = { date: $("ex-date"), name: $("ex-name"), result: $("ex-result"), desc: $("ex-desc") }
  F.name.replaceChildren(el("option", { value: "", text: "Selecione" }), ...MANUAL_CATALOG.map((n) => el("option", { value: n, text: n })))
  F.date.max = todayIso()
  const err = $("ex-error")
  function resetForm() {
    editingId = null
    F.date.value = todayIso(); F.name.value = ""; F.result.value = ""; F.desc.value = ""
    $("ex-save").textContent = "Incluir"; $("ex-cancel").hidden = true; $("ex-form-title").textContent = "Lançamento de exame"; err.hidden = true
  }
  resetForm()
  $("ex-save").addEventListener("click", () => {
    let msg = "", target = null
    if (!F.date.value) { msg = "Informe a data do exame."; target = F.date }
    else if (F.date.value > todayIso()) { msg = "A data do exame não pode ser futura."; target = F.date }
    else if (!F.name.value) { msg = "Selecione o exame."; target = F.name }
    else if (F.name.value === "IMC") { msg = "O IMC é calculado automaticamente: lance Peso e Altura na mesma data."; target = F.name }
    else if (!F.result.value.trim()) { msg = "Informe o resultado."; target = F.result }
    if (msg) { err.textContent = msg; err.hidden = false; target.focus(); return }
    const values = { date: F.date.value, name: F.name.value, result: F.result.value.trim(), description: F.desc.value.trim() }
    const previousDate = editingId ? exams.find((x) => x.id === editingId).date : null
    if (editingId) { Object.assign(exams.find((x) => x.id === editingId), values); selectedId = editingId }
    else { const rec = { id: nextId++, ...values, by: currentUserName() }; exams.push(rec); selectedId = rec.id }
    syncBmi(values.date)
    if (previousDate && previousDate !== values.date) syncBmi(previousDate)
    resetForm(); renderList(); markDirty()
  })
  $("ex-edit").addEventListener("click", () => {
    const x = selected(); if (!x) return
    if (x.source === "nutricao") {
      open({ title: "Alterar exame", confirm: "Fechar", submit: () => "",
        body: el("p", { class: "ev-confirm", text: `"${x.name}" veio da avaliação antropométrica da aba Nutrição. Altere a medida lá e use "Incluir exames antropométricos" para atualizar esta lista.` }) })
      $("ex-dialog-cancel").hidden = true
      return
    }
    editingId = x.id
    F.date.value = x.date; F.name.value = x.name; F.result.value = x.result; F.desc.value = x.description
    $("ex-save").textContent = "Salvar alteração"; $("ex-cancel").hidden = false; $("ex-form-title").textContent = "Alterar exame"; err.hidden = true
    F.result.focus(); F.result.scrollIntoView({ block: "center" })
  })
  $("ex-cancel").addEventListener("click", resetForm)

  // ---------- Diálogo ----------
  const dialog = $("ex-dialog")
  let returnFocus = null, onSubmit = null
  const showError = (m) => { $("ex-dialog-error").textContent = m; $("ex-dialog-error").hidden = !m }
  function open({ title, body, confirm = "Salvar", submit, count = false }) {
    returnFocus = document.activeElement
    $("ex-dialog-title").textContent = title
    $("ex-dialog-confirm").textContent = confirm
    $("ex-dialog-confirm").classList.add("btn-primary"); $("ex-dialog-confirm").classList.remove("btn-danger")
    $("ex-dialog-body").replaceChildren(body)
    $("ex-count").textContent = ""
    showError("")
    onSubmit = submit
    dialog.showModal()
    $("ex-dialog-body").querySelector("input, select, textarea")?.focus()
  }
  function closeDialog() { if (dialog.open) dialog.close(); onSubmit = null; returnFocus?.focus?.() }
  $("ex-dialog-cancel").addEventListener("click", closeDialog)
  $("ex-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog() })
  $("ex-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const problem = onSubmit?.()
    if (problem) showError(problem)
    else closeDialog()
  })
  $("ex-dialog-body").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") e.preventDefault() })

  const dateControls = () => {
    const date = el("input", { class: "form-control", type: "date", id: "ex-d-date", value: todayIso(), max: todayIso(), "data-no-dirty": true })
    return { date, node: el("div", { class: "md-grid", style: "margin-bottom:.9rem" },
      el("div", { class: "field-block md-c4" }, el("label", { class: "field-label", for: "ex-d-date", text: "Data de realização do exame *" }), date)) }
  }

  // ---------- Hemograma / Rotina ----------
  function openBatch(title, names) {
    const dc = dateControls()
    const inputs = names.map((n, i) => {
      const auto = n === "IMC" || n === "URR (%)"
      const input = el("input", { class: `form-control form-control-sm${auto ? " derived-field" : ""}`, id: `ex-b-${i}`, autocomplete: "off", maxlength: "60", "data-no-dirty": true, readonly: auto, title: auto ? AUTO_NOTE : null })
      return [n, input, el("div", { class: "field-block" }, el("label", { class: "field-label", for: input.id, text: auto ? `${n} (automático)` : n }), input)]
    })
    const grid = el("div", { class: "ex-batch" }, ...inputs.map((x) => x[2]))
    const field = (name) => inputs.find(([n]) => n === name)?.[1]
    const update = () => {
      if (field("IMC")) { const bmi = bmiOf(field("Peso")?.value, field("Altura")?.value); field("IMC").value = bmi == null ? "" : dec(bmi) }
      if (field("URR (%)")) { const urr = urrOf(field("Ureia pré-diálise")?.value, field("Ureia pós-diálise")?.value); field("URR (%)").value = urr == null ? "" : dec(urr, 1) }
      $("ex-count").textContent = `Preenchidos: ${inputs.filter((x) => x[1].value.trim()).length} de ${names.length}`
    }
    grid.addEventListener("input", update)
    open({
      title, body: el("div", {}, dc.node, grid), confirm: "Salvar",
      submit() {
        if (!dc.date.value) return "Informe a data de realização do exame."
        if (dc.date.value > todayIso()) return "A data do exame não pode ser futura."
        const filled = inputs.filter((x) => x[1].value.trim() && x[0] !== "IMC")
        if (!filled.length) return "Preencha ao menos um resultado."
        filled.forEach(([name, input]) => exams.push({ id: nextId++, date: dc.date.value, name, result: input.value.trim(), description: name === "URR (%)" ? URR_NOTE : "", by: currentUserName() }))
        syncBmi(dc.date.value)
        selectedId = null
        renderList(); markDirty()
        return ""
      },
    })
    update()
  }
  $("ex-hemogram").addEventListener("click", () => openBatch("Lançar exames - Hemograma", HEMOGRAM))
  // ---------- Rotina por periodicidade ----------
  const DAY = 24 * 60 * 60 * 1000
  const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / DAY)
  function itemStatus(period, item) {
    const names = item.match || [item.name]
    const last = sorted().find((x) => names.includes(x.name))
    if (!last) return { last: null, left: null, tone: "off", label: "Sem registro" }
    const left = period.days - daysBetween(last.date, todayIso())
    if (left < 0) return { last, left, tone: "danger", label: `Atrasado (${-left} ${-left === 1 ? "dia" : "dias"})` }
    if (left <= 7) return { last, left, tone: "warn", label: left === 0 ? "Vence hoje" : `Vence em ${left} ${left === 1 ? "dia" : "dias"}` }
    return { last, left, tone: "ok", label: "Em dia" }
  }

  function renderSchedule() {
    const box = $("ex-schedule")
    if (!box) return
    box.replaceChildren(...SCHEDULE.map((period) => {
      const rows = period.items.map((item) => {
        const st = itemStatus(period, item)
        return el("li", { class: "ex-sched-item" },
          el("strong", { class: "ex-sched-name", text: item.name }),
          el("span", { class: `hn-badge hn-badge-${st.tone}`, text: st.label }),
          el("small", { class: "ex-sched-meta", text: [item.note, st.last ? `Último: ${formatDate(st.last.date)} · ${st.last.result}` : ""].filter(Boolean).join(" · ") }))
      })
      const late = period.items.filter((item) => ["danger", "off"].includes(itemStatus(period, item).tone)).length
      const launch = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", "data-period": period.key, text: `Lançar ${period.label.toLowerCase()}` })
      return el("section", { class: "ex-sched-col", "aria-labelledby": `ex-sched-${period.key}` },
        el("header", { class: "ex-sched-head" },
          el("h4", { id: `ex-sched-${period.key}`, text: period.label }),
          el("span", { class: `hn-badge hn-badge-${late ? "warn" : "ok"}`, text: late ? `${late} pendente${late > 1 ? "s" : ""}` : "Em dia" })),
        el("ul", {}, ...rows), launch)
    }))
  }
  $("ex-schedule")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-period]")
    if (!b) return
    const period = SCHEDULE.find((p) => p.key === b.dataset.period)
    openBatch(`Lançar exames - ${period.label}`, period.launch)
  })
  // ---------- Exames antropométricos: vêm da aba Nutrição (único lugar de preenchimento) ----------
  // Inclui as medidas de cada avaliação com data; se a mesma medida da mesma data já foi incluída, o resultado é atualizado.
  function openAnthropometryImport() {
    const incoming = window.HuNefroNutricao?.anthropometryExams?.() || []
    if (!incoming.length) {
      open({ title: "Incluir exames antropométricos", confirm: "Fechar", submit: () => "",
        body: el("p", { class: "ev-confirm", text: "Não há avaliação antropométrica com data e medidas na aba Nutrição. Preencha a avaliação em Nutrição > Antropometria e depois inclua os exames aqui." }) })
      $("ex-dialog-cancel").hidden = true
      return
    }
    const sameAs = (item) => (x) => x.source === "nutricao" && x.name === item.name && x.date === item.date
    const byEvaluation = new Map()
    incoming.forEach((item) => {
      const key = `${item.date}|${item.origin}`
      const group = byEvaluation.get(key) || { date: item.date, origin: item.origin, added: 0, updated: 0, same: 0 }
      const current = exams.find(sameAs(item))
      if (!current) group.added++
      else if (current.result !== item.result || (current.description || "") !== item.description) group.updated++
      else group.same++
      byEvaluation.set(key, group)
    })
    const groups = [...byEvaluation.values()].sort((a, b) => a.date.localeCompare(b.date))
    const pending = groups.reduce((sum, g) => sum + g.added + g.updated, 0)
    const describe = (g) => [g.added && `${g.added} ${g.added === 1 ? "nova" : "novas"}`, g.updated && `${g.updated} ${g.updated === 1 ? "atualizada" : "atualizadas"}`, g.same && `${g.same} já ${g.same === 1 ? "incluída" : "incluídas"}`].filter(Boolean).join(", ")
    const body = el("div", {},
      el("p", { class: "ev-confirm", text: pending ? "Estas avaliações da aba Nutrição serão incluídas na lista de exames:" : "Todas as medidas da aba Nutrição já estão na lista de exames." }),
      el("ul", { class: "ex-import-list" }, ...groups.map((g) => el("li", {}, el("strong", { text: `${g.origin} - ${formatDate(g.date)}: ` }), document.createTextNode(describe(g))))),
    )
    open({
      title: "Incluir exames antropométricos", body, confirm: pending ? "Incluir" : "Fechar",
      submit() {
        if (!pending) return ""
        const by = currentUserName()
        incoming.forEach((item) => {
          const current = exams.find(sameAs(item))
          if (current) Object.assign(current, { result: item.result, description: item.description })
          else exams.push({ id: nextId++, date: item.date, name: item.name, result: item.result, description: item.description, by, source: "nutricao" })
        })
        selectedId = null
        renderList(); renderFlow(); markDirty()
        return ""
      },
    })
    if (!pending) $("ex-dialog-cancel").hidden = true
  }
  $("ex-anthropometry").addEventListener("click", openAnthropometryImport)

  // ---------- Cálculo de diálise (adequação: URR e Kt/V) ----------
  // URR = (1 − ureia pós / ureia pré) × 100. Kt/V de pool único pela fórmula de Daugirdas (2ª geração):
  // Kt/V = −ln(R − 0,008 × t) + (4 − 3,5 × R) × UF / P, com R = ureia pós / ureia pré, t em horas, UF em litros e P = peso pós-diálise (kg).
  // A data e os dados da sessão vêm da sessão de hemodiálise mais recente, quando existe.
  function latestSession() {
    const list = window.HuNefroSessoesDialise?.getData() || []
    return list.sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""))[0] || null
  }
  const toMinutes = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null }

  function openDialysis() {
    const dc = dateControls()
    const session = latestSession()
    const mk = (id, label, value = "") => {
      const input = el("input", { class: "form-control", id, autocomplete: "off", inputmode: "decimal", value, "data-no-dirty": true })
      return [input, el("div", { class: "field-block md-c4" }, el("label", { class: "field-label", for: id, text: label }), input)]
    }
    const duration = session ? (toMinutes(session.end) ?? 0) - (toMinutes(session.start) ?? 0) : 0
    const [pre, f1] = mk("ex-dl-pre", "Ureia pré-diálise (mg/dL) *")
    const [post, f2] = mk("ex-dl-post", "Ureia pós-diálise (mg/dL) *")
    const [time, f3] = mk("ex-dl-time", "Duração da sessão (horas) *", duration > 0 ? dec(duration / 60) : "")
    const [uf, f4] = mk("ex-dl-uf", "Ultrafiltração (litros) *", session?.uf ? dec(parseNumber(session.uf) / 1000) : "")
    const [weight, f5] = mk("ex-dl-weight", "Peso pós-diálise (kg) *", session?.weightEnd ? dec(session.weightEnd) : "")
    if (session) dc.date.value = session.date
    const out = el("div", { class: "ex-fast-result", "aria-live": "polite", text: "Preencha os campos e use Calcular." })
    const source = el("p", { class: "form-text", text: session ? `Duração, UF, peso e data preenchidos a partir da sessão de ${formatDate(session.date)}. Confira antes de gravar.` : "Nenhuma sessão registrada: preencha todos os campos." })
    let last = null

    function compute() {
      const v = { pre: parseNumber(pre.value), post: parseNumber(post.value), t: parseNumber(time.value), uf: parseNumber(uf.value), w: parseNumber(weight.value) }
      if (![pre, post, time, uf, weight].every((i) => i.value.trim())) return "Preencha todos os campos do cálculo."
      if (!Object.values(v).every(Number.isFinite) || v.pre <= 0 || v.post <= 0 || v.post >= v.pre || v.t <= 0 || v.t > 12 || v.uf < 0 || v.uf > 10 || v.w <= 0 || v.w > 400) return "Valores inválidos. A ureia pós deve ser menor que a pré; duração em horas, UF em litros e peso em kg."
      const r = v.post / v.pre
      const urr = (1 - r) * 100
      const ktv = -Math.log(r - 0.008 * v.t) + (4 - 3.5 * r) * (v.uf / v.w)
      if (!Number.isFinite(ktv)) return "Não foi possível calcular o Kt/V com estes valores."
      last = { v, urr, ktv }
      const ok = urr >= 65 && ktv >= 1.2
      out.textContent = `URR = ${dec(urr, 1)} % · Kt/V = ${dec(ktv)} · ${ok ? "Dentro da meta (URR ≥ 65 % e Kt/V ≥ 1,2)" : "Abaixo da meta (URR ≥ 65 % e Kt/V ≥ 1,2)"}`
      out.classList.toggle("is-below", !ok)
      return ""
    }
    const calcBtn = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", text: "Calcular" })
    const calcErr = el("div", { class: "hc-error", role: "alert", hidden: true })
    calcBtn.addEventListener("click", () => { const m = compute(); calcErr.textContent = m; calcErr.hidden = !m })

    open({
      title: "Cálculo de diálise (Kt/V e URR)",
      confirm: "Gravar",
      body: el("div", { class: "ex-fast" }, dc.node, source, el("div", { class: "md-grid" }, f1, f2, f3, f4, f5), el("div", {}, calcBtn), calcErr, out,
        el("p", { class: "form-text", text: "Kt/V pela fórmula de Daugirdas (2ª geração). Metas de referência: URR ≥ 65 % e Kt/V ≥ 1,2 (KDOQI) - confirmar com a equipe." })),
      submit() {
        if (!dc.date.value) return "Informe a data."
        if (dc.date.value > todayIso()) return "A data do exame não pode ser futura."
        const m = compute(); calcErr.hidden = true
        if (m) return m
        const by = currentUserName()
        const detail = `Ureia pré ${dec(last.v.pre, 0)} mg/dL; ureia pós ${dec(last.v.post, 0)} mg/dL; duração ${dec(last.v.t)} h; UF ${dec(last.v.uf)} L; peso pós ${dec(last.v.w)} kg.`
        ;[
          ["Ureia pré-diálise", dec(last.v.pre, 0), ""],
          ["Ureia pós-diálise", dec(last.v.post, 0), ""],
          ["URR (%)", dec(last.urr, 1), `URR calculado. ${detail}`],
          ["Kt/V", dec(last.ktv), `Kt/V (Daugirdas 2ª geração) calculado. ${detail}`],
        ].forEach(([name, result, description]) => exams.push({ id: nextId++, date: dc.date.value, name, result, description, by }))
        selectedId = null; renderList(); markDirty()
        return ""
      },
    })
  }
  $("ex-dialysis").addEventListener("click", openDialysis)

  // ---------- Excluir ----------
  $("ex-delete").addEventListener("click", () => {
    const x = selected(); if (!x) return
    open({
      title: "Excluir exame", confirm: "Excluir",
      body: el("p", { class: "ev-confirm", text: `Excluir o exame "${x.name}" de ${formatDate(x.date)} (resultado: ${x.result})?` }),
      submit() { exams = exams.filter((e) => e.id !== x.id); selectedId = null; if (editingId === x.id) resetForm(); if (x.name !== "IMC") syncBmi(x.date); renderList(); markDirty(); return "" },
    })
    $("ex-dialog-confirm").classList.add("btn-danger"); $("ex-dialog-confirm").classList.remove("btn-primary")
  })

  // ---------- Flow ----------
  const MONTHS = 8
  function monthKeys() {
    const d = new Date(); d.setDate(1)
    return Array.from({ length: MONTHS }, (_, i) => { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}` })
  }
  const monthLabel = (k) => `${k.slice(5)}/${k.slice(0, 4)}`

  function flowNames() {
    // Na ordem em que foram incluídas (a mesma da ficha da Nutrição).
    const anthropometric = () => [...new Set([...exams].sort((a, b) => a.id - b.id).filter(isAnthropometric).map((x) => x.name))]
    if (flowGroup === ANTHRO_GROUP) return anthropometric()
    if (flowGroup) return GROUPS.find(([g]) => g === flowGroup)[1]
    return [...CATALOG.filter((n) => !ANTHRO_SET.has(n) && exams.some((x) => x.name === n)), ...anthropometric()]
  }

  function renderGroups() {
    const items = [["", "<TODOS>"], ...GROUPS.map(([g]) => [g, g])]
    $("ex-groups").replaceChildren(...items.map(([v, l]) => {
      const b = el("button", { class: "ex-group-btn", type: "button", "aria-pressed": String(flowGroup === v), "data-group": v, text: l })
      return el("li", {}, b)
    }))
  }
  $("ex-groups").addEventListener("click", (e) => {
    const b = e.target.closest("[data-group]"); if (!b) return
    flowGroup = b.dataset.group; flowRow = null; renderGroups(); renderFlow()
    $("ex-groups").querySelector(`[data-group="${flowGroup}"]`)?.focus()
  })
  $("ex-only-results").addEventListener("change", renderFlow)

  function renderFlow() {
    let months = monthKeys()
    const names = flowNames()
    const cell = (name, key) => sorted().filter((x) => x.name === name && x.date.startsWith(key))[0]
    if ($("ex-only-results").checked) months = months.filter((k) => names.some((n) => cell(n, k)))
    if (flowRow && !names.includes(flowRow)) flowRow = null
    const table = $("ex-flow-table")
    $("ex-flow-empty").hidden = names.length > 0
    if (!names.length) { table.replaceChildren(); $("ex-chart").disabled = true; return }
    const head = el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Exame" }), ...months.map((k) => el("th", { scope: "col", text: monthLabel(k) }))))
    const body = el("tbody", {}, ...names.map((n) => {
      const tr = el("tr", { tabindex: "0", "data-name": n, class: n === flowRow ? "is-selected" : "", "aria-selected": String(n === flowRow) }, el("th", { scope: "row", text: n }))
      months.forEach((k, i) => { const x = cell(n, k); tr.append(el("td", { text: x ? x.result : "", class: x && i === 0 ? "is-latest" : "" })) })
      return tr
    }))
    table.replaceChildren(head, body)
    $("ex-chart").disabled = !flowRow
    $("ex-chart-help").textContent = flowRow ? `Exame selecionado: ${flowRow}.` : "Clique em uma linha da tabela para escolher o exame do gráfico."
  }
  $("ex-flow-table").addEventListener("click", (e) => { const r = e.target.closest("tr[data-name]"); if (r) { flowRow = r.dataset.name; renderFlow() } })
  $("ex-flow-table").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-name]"); if (!r) return
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flowRow = r.dataset.name; renderFlow(); $("ex-flow-table").querySelector(`tr[data-name="${CSS.escape(flowRow)}"]`)?.focus() }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus() }
  })

  // Gráfico simples em SVG (sem biblioteca): valores numéricos do exame selecionado ao longo do tempo.
  $("ex-chart").addEventListener("click", () => {
    const name = flowRow
    const points = sorted().filter((x) => x.name === name).map((x) => ({ date: x.date, v: parseFloat(String(x.result).replace(",", ".")) })).filter((p) => Number.isFinite(p.v)).reverse()
    const ns = "http://www.w3.org/2000/svg"
    const svgEl = (tag, attrs = {}, text) => { const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n }
    let body
    if (points.length < 2) body = el("p", { class: "ev-confirm", text: points.length ? "Há apenas um resultado numérico para este exame; o gráfico precisa de pelo menos dois." : "Este exame não tem resultados numéricos para o gráfico." })
    else {
      const W = 560, H = 260, L = 48, R = 16, T = 16, B = 40
      const vs = points.map((p) => p.v); let lo = Math.min(...vs), hi = Math.max(...vs); if (lo === hi) { lo -= 1; hi += 1 }
      const pad = (hi - lo) * 0.1; lo -= pad; hi += pad
      const x = (i) => L + (i * (W - L - R)) / (points.length - 1), y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo)
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "ex-chart", role: "img", "aria-labelledby": "ex-chart-t" })
      svg.append(svgEl("title", { id: "ex-chart-t" }, `${name}: ${points.map((p) => `${formatDate(p.date)} = ${dec(p.v)}`).join("; ")}`))
      for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4; svg.append(svgEl("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: "currentColor", "stroke-opacity": ".15" }), svgEl("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }, dec(v, 1))) }
      svg.append(svgEl("polyline", { points: points.map((p, i) => `${x(i)},${y(p.v)}`).join(" "), fill: "none", stroke: "#0d5c5f", "stroke-width": "2" }))
      points.forEach((p, i) => { svg.append(svgEl("circle", { cx: x(i), cy: y(p.v), r: 4, fill: "#0d5c5f" }), svgEl("text", { x: x(i), y: H - B + 16, "text-anchor": "middle" }, formatDate(p.date).slice(0, 5)), svgEl("text", { x: x(i), y: y(p.v) - 8, "text-anchor": "middle" }, dec(p.v))) })
      body = svg
    }
    open({ title: `Gráfico - ${name}`, body, confirm: "Fechar", submit: () => "" })
    $("ex-dialog-cancel").hidden = true
  })
  dialog.addEventListener("close", () => { $("ex-dialog-cancel").hidden = false })

  document.querySelector('[data-section="exames"]')?.addEventListener("click", () => { renderList(); renderFlow() })
  renderGroups(); renderList(); renderFlow()

  window.HuNefroExames = {
    getData: () => JSON.parse(JSON.stringify(exams)),
    setData(list) {
      exams = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = exams.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedId = null; renderList(); renderFlow()
    },
    validate: () => ({ valid: true, errors: [] }),
    // Último resultado de um exame pelo nome (usado em Prescrição de HD: Na+).
    latest: (name) => sorted().find((x) => x.name === name) || null,
    // Rotina por periodicidade com a situação de cada exame (usada na Solicitação de exames).
    schedule: () => SCHEDULE.map((period) => ({ key: period.key, label: period.label, days: period.days,
      items: period.items.map((item) => ({ ...item, request: item.request || [item.name], status: itemStatus(period, item) })) })),
  }
})()
