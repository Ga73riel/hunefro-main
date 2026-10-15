// Aba Resultados / Exames: Lista de Exames, lançamento por grupo (Hemograma, Rotina), cálculo do Fast PET e Flow de Exames.
// Depende de js/componentes.js. Dados em memória até existir a API.
// Os resultados são texto livre (ex.: "75 (Alto)"); unidades e valores de referência dependem de definição da equipe.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName } = window.HuNefroUI
  const $ = (id) => document.getElementById(id)
  if (!$("ex-tbody")) return

  // Catálogo PROVISÓRIO transcrito das imagens do manual (p. 21-22) e do modelo visual do Flow. O administrador deve poder cadastrar grupos.
  const HEMOGRAM = ["Hemácias", "Hematócrito", "Hemoglobina", "VCM", "HCM", "CHCM", "RDW", "Leucócitos", "Neutrófilos", "Bastonetes", "Segmentados", "Linfócitos",
    "Linfócitos atípicos", "Monócitos", "Eosinófilos", "Basófilos", "Promielócitos", "Mielócitos", "Metamielócitos", "Prolinfócitos", "Plasmócitos", "Blastos", "Plaquetas", "VPM"]
  const ROUTINE = ["Cálcio", "Creatinina", "Fósforo", "Gasometria venosa", "Glicose", "Hematócrito", "Hemoglobina", "Potássio", "Sódio", "TGP", "Ureia", "Albumina", "Ferritina",
    "Ferro sérico", "Fosfatase alcalina", "Globulina", "Hemoglobina glicada", "Proteínas totais", "PTH", "Saturação da transferrina", "25-Hidroxivitamina D", "Anti-HBs", "Anti-HCV",
    "HBsAg", "Alumínio sérico", "Anti-HIV", "Colesterol HDL", "Colesterol LDL", "Colesterol total", "T4", "Triglicerídeos", "TSH"]
  const ANTHROPOMETRY = ["Altura", "Peso", "Peso seco BIA (NH)", "CB", "CP", "CC", "CQ", "Prega cutânea tricipital", "PCB", "PCSI", "PCSE", "IMC", "Peso ideal",
    "Adequação do peso (%)", "Adequação da CB (%)", "Adequação da PCT (%)", "CMB", "Adequação da CMB (%)", "Percentual de gordura", "RCQ"]
  const OTHERS = ["Risco de queda", "1,25-dihidroxivitamina D", "Fast PET"]
  const GROUPS = [["Hemograma", HEMOGRAM], ["Rotina", ROUTINE], ["Aval. Antrop.", ANTHROPOMETRY]]
  const CATALOG = [...new Set([...HEMOGRAM, ...ROUTINE, ...ANTHROPOMETRY, ...OTHERS])].sort((a, b) => a.localeCompare(b, "pt-BR"))

  let exams = []
  let nextId = 1
  let selectedId = null
  let editingId = null
  let flowGroup = ""
  let flowRow = null
  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))
  const num = (v) => Number(String(v).trim().replace(",", "."))
  const dec = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",")

  // ---------- Abas ----------
  const tabs = [$("ex-tab-list"), $("ex-tab-flow")]
  const panels = [$("ex-panel-list"), $("ex-panel-flow")]
  function showTab(i, focus) {
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i })
    if (i === 1) renderFlow()
    if (focus) tabs[i].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => showTab(i))
    t.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); showTab((i + 1) % 2, true) } })
  })

  // ---------- Lista ----------
  const selected = () => exams.find((x) => x.id === selectedId) || null
  const sorted = () => [...exams].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)

  function renderList() {
    const q = $("ex-filter").value.trim().toLowerCase()
    const rows = sorted().filter((x) => !q || `${x.name} ${x.result} ${x.by}`.toLowerCase().includes(q))
    if (selectedId && !rows.some((x) => x.id === selectedId)) selectedId = null
    $("ex-tbody").replaceChildren(
      ...rows.map((x) => el("tr", { tabindex: "0", "data-id": x.id, class: x.id === selectedId ? "is-selected" : "", "aria-selected": String(x.id === selectedId) },
        el("td", { text: formatDate(x.date) }), el("td", { text: x.name }), el("td", { text: x.result }), el("td", { text: x.noCharge ? "Sim" : "Não" }), el("td", { text: x.by }))),
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

  // ---------- Formulário individual ----------
  const F = { date: $("ex-date"), name: $("ex-name"), result: $("ex-result"), nocharge: $("ex-nocharge"), desc: $("ex-desc") }
  F.name.replaceChildren(el("option", { value: "", text: "Selecione" }), ...CATALOG.map((n) => el("option", { value: n, text: n })))
  F.date.max = todayIso()
  const err = $("ex-error")
  function resetForm() {
    editingId = null
    F.date.value = todayIso(); F.name.value = ""; F.result.value = ""; F.nocharge.checked = false; F.desc.value = ""
    $("ex-save").textContent = "Incluir"; $("ex-cancel").hidden = true; $("ex-form-title").textContent = "Lançamento de exame"; err.hidden = true
  }
  resetForm()
  $("ex-save").addEventListener("click", () => {
    let msg = "", target = null
    if (!F.date.value) { msg = "Informe a data do exame."; target = F.date }
    else if (F.date.value > todayIso()) { msg = "A data do exame não pode ser futura."; target = F.date }
    else if (!F.name.value) { msg = "Selecione o exame."; target = F.name }
    else if (!F.result.value.trim()) { msg = "Informe o resultado."; target = F.result }
    if (msg) { err.textContent = msg; err.hidden = false; target.focus(); return }
    const values = { date: F.date.value, name: F.name.value, result: F.result.value.trim(), noCharge: F.nocharge.checked, description: F.desc.value.trim() }
    if (editingId) { Object.assign(exams.find((x) => x.id === editingId), values); selectedId = editingId }
    else { const rec = { id: nextId++, ...values, by: currentUserName() }; exams.push(rec); selectedId = rec.id }
    resetForm(); renderList(); markDirty()
  })
  $("ex-edit").addEventListener("click", () => {
    const x = selected(); if (!x) return
    editingId = x.id
    F.date.value = x.date; F.name.value = x.name; F.result.value = x.result; F.nocharge.checked = x.noCharge; F.desc.value = x.description
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
    const nc = el("input", { type: "checkbox", id: "ex-d-nc", "data-no-dirty": true })
    return { date, nc, node: el("div", { class: "md-grid", style: "margin-bottom:.9rem" },
      el("div", { class: "field-block md-c4" }, el("label", { class: "field-label", for: "ex-d-date", text: "Data de realização do exame *" }), date),
      el("label", { class: "md-check md-c4" }, nc, el("span", { text: "Não cobrar" }))) }
  }

  // ---------- Hemograma / Rotina ----------
  function openBatch(title, names) {
    const dc = dateControls()
    const inputs = names.map((n, i) => {
      const input = el("input", { class: "form-control form-control-sm", id: `ex-b-${i}`, autocomplete: "off", maxlength: "60", "data-no-dirty": true })
      return [n, input, el("div", { class: "field-block" }, el("label", { class: "field-label", for: input.id, text: n }), input)]
    })
    const grid = el("div", { class: "ex-batch" }, ...inputs.map((x) => x[2]))
    const update = () => { $("ex-count").textContent = `Preenchidos: ${inputs.filter((x) => x[1].value.trim()).length} de ${names.length}` }
    grid.addEventListener("input", update)
    open({
      title, body: el("div", {}, dc.node, grid), confirm: "Salvar",
      submit() {
        if (!dc.date.value) return "Informe a data de realização do exame."
        if (dc.date.value > todayIso()) return "A data do exame não pode ser futura."
        const filled = inputs.filter((x) => x[1].value.trim())
        if (!filled.length) return "Preencha ao menos um resultado."
        filled.forEach(([name, input]) => exams.push({ id: nextId++, date: dc.date.value, name, result: input.value.trim(), noCharge: dc.nc.checked, description: "", by: currentUserName() }))
        selectedId = null
        renderList(); markDirty()
        return ""
      },
    })
    update()
  }
  $("ex-hemogram").addEventListener("click", () => openBatch("Lançar exames — Hemograma", HEMOGRAM))
  $("ex-routine").addEventListener("click", () => openBatch("Lançar exames — Rotina", ROUTINE))

  // ---------- Fast PET (faixas da tabela do manual, p. 22) ----------
  const RANGES = {
    dp: [["Baixo", 0.34, 0.49], ["Médio baixo", 0.5, 0.64], ["Médio", 0.65, 0.65], ["Médio alto", 0.66, 0.81], ["Alto", 0.82, 1.03]],
    glucose: [["Baixo", 945, 1214], ["Médio baixo", 724, 944], ["Médio", 723, 723], ["Médio alto", 502, 722], ["Alto", 230, 501]],
    uf: [["Baixo", 2651, 3326], ["Médio baixo", 2369, 2650], ["Médio", 2368, 2368], ["Médio alto", 2085, 2367], ["Alto", 1580, 2084]],
  }
  const classify = (list, v) => (list.find(([, lo, hi]) => v >= lo && v <= hi) || [null])[0]

  function openFastPet() {
    const dc = dateControls()
    const mk = (id, label, help) => {
      const input = el("input", { class: "form-control", id, autocomplete: "off", inputmode: "decimal", "data-no-dirty": true })
      return [input, el("div", { class: "field-block md-c6" }, el("label", { class: "field-label", for: id, text: label }), input)]
    }
    const [cd, f1] = mk("ex-fp-cd", "Creatinina do dialisato (mg/dL) *")
    const [cp, f2] = mk("ex-fp-cp", "Plasma creatinina (mg/dL) *")
    const [gl, f3] = mk("ex-fp-gl", "Glicose do dialisato (mg/dL) *")
    const [uf, f4] = mk("ex-fp-uf", "Volume de ultrafiltração (mL) *")
    const out = el("div", { class: "ex-fast-result", "aria-live": "polite", text: "Preencha os campos e use Calcular." })
    let last = null

    function compute() {
      const v = { cd: num(cd.value), cp: num(cp.value), gl: num(gl.value), uf: num(uf.value) }
      if (![cd, cp, gl, uf].every((i) => i.value.trim())) return "Preencha todos os campos do Fast PET."
      if (![v.cd, v.cp, v.gl, v.uf].every(Number.isFinite) || v.cd <= 0 || v.cp <= 0 || v.gl <= 0 || v.uf < 0 || v.cd > 50 || v.cp > 50 || v.gl > 5000 || v.uf > 10000) return "Valores inválidos. Confira creatinina (mg/dL), glicose (mg/dL) e volume (mL)."
      const dp = Math.round((v.cd / v.cp) * 100) / 100
      last = { dp, dpClass: classify(RANGES.dp, dp), glClass: classify(RANGES.glucose, Math.round(v.gl)), ufClass: classify(RANGES.uf, Math.round(v.uf)), v }
      const label = (c) => c || "fora da faixa de referência"
      out.textContent = `Dialisato/Plasma creatinina = ${dec(dp)} (${label(last.dpClass)}) · Glicose do dialisato: ${label(last.glClass)} · Ultrafiltração: ${label(last.ufClass)}`
      return ""
    }
    const calcBtn = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", text: "Calcular" })
    const calcErr = el("div", { class: "hc-error", role: "alert", hidden: true })
    calcBtn.addEventListener("click", () => { const m = compute(); calcErr.textContent = m; calcErr.hidden = !m })

    const refRows = RANGES.dp.map(([name, lo, hi], i) => el("tr", {}, el("th", { scope: "row", text: name }),
      ...["dp", "glucose", "uf"].map((k) => { const [, a, b] = RANGES[k][i]; return el("td", { text: a === b ? (k === "dp" ? dec(a) : String(a)) : (k === "dp" ? `${dec(a)} - ${dec(b)}` : `${a} - ${b}`) }) })))
    const ref = el("table", { class: "table table-sm ex-ref-table" }, el("caption", { text: "Classificação do transporte (referência do manual)" }),
      el("thead", {}, el("tr", {}, ...["Classificação", "Dialisato/Plasma creatinina", "Glicose do dialisato", "Volume de ultrafiltração"].map((h) => el("th", { scope: "col", text: h })))), el("tbody", {}, ...refRows))

    open({
      title: "Cálculo do Fast PET",
      confirm: "Gravar",
      body: el("div", { class: "ex-fast" }, dc.node, el("div", { class: "md-grid" }, f1, f2, f3, f4), el("div", {}, calcBtn), calcErr, out, ref),
      submit() {
        if (!dc.date.value) return "Informe a data."
        if (dc.date.value > todayIso()) return "A data do exame não pode ser futura."
        const m = compute(); calcErr.hidden = true
        if (m) return m
        const label = (c) => c || "fora da faixa"
        exams.push({
          id: nextId++, date: dc.date.value, name: "Fast PET", noCharge: dc.nc.checked, by: currentUserName(),
          result: `D/P creatinina ${dec(last.dp)} - ${label(last.dpClass)}`,
          description: `Fast PET: creatinina do dialisato ${dec(last.v.cd)} mg/dL; plasma creatinina ${dec(last.v.cp)} mg/dL; glicose do dialisato ${dec(last.v.gl, 0)} mg/dL (${label(last.glClass)}); volume de ultrafiltração ${dec(last.v.uf, 0)} mL (${label(last.ufClass)}). Dialisato/plasma creatinina ${dec(last.dp)}: transporte ${label(last.dpClass)}.`,
        })
        selectedId = null; renderList(); markDirty()
        return ""
      },
    })
  }
  $("ex-fastpet").addEventListener("click", openFastPet)

  // ---------- Excluir ----------
  $("ex-delete").addEventListener("click", () => {
    const x = selected(); if (!x) return
    open({
      title: "Excluir exame", confirm: "Excluir",
      body: el("p", { class: "ev-confirm", text: `Excluir o exame "${x.name}" de ${formatDate(x.date)} (resultado: ${x.result})?` }),
      submit() { exams = exams.filter((e) => e.id !== x.id); selectedId = null; if (editingId === x.id) resetForm(); renderList(); markDirty(); return "" },
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
    if (flowGroup) return GROUPS.find(([g]) => g === flowGroup)[1]
    return CATALOG.filter((n) => exams.some((x) => x.name === n))
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
    open({ title: `Gráfico — ${name}`, body, confirm: "Fechar", submit: () => "" })
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
  }
})()
