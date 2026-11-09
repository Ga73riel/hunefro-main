// Aba Resultados / Exames > Solicitação de Exames: nova solicitação, cópia da última, histórico e impressão
// (Solicitação de exames no padrão HU-UFMA e Laudo para Solicitação de APAC para os exames de alto custo).
// Rotinas por periodicidade com um clique (mensal, trimestral, semestral, anual) mais os outros exames.
// Destino do pedido (Elias, 04/11/2026): "Pedir exames via AGHU" (integração por API, simulada em js/aghu-mock.js)
// ou "Pedir em outro laboratório" (registra o laboratório e imprime a solicitação).
// Alta complexidade / alto custo (catálogo apac: true): exige o Laudo para Solicitação de APAC, autorizado pelo
// gestor (regulação) antes da realização; o número da APAC (13 dígitos, Portaria SAS/MS nº 492/2008) vem do autorizador.
// Os exames de rotina de laboratório não usam APAC: saem só na requisição (registro em BPA pelo faturamento).
// A sugestão segue a Rotina de exames por periodicidade (HuNefroExames.schedule): todos os mensais e os
// trimestrais, semestrais e anuais atrasados, sem registro ou que vencem nos próximos 30 dias.
// Os Esquemas do sistema antigo (Rotina SUS, Rotina, Rotina Padrão) não são usados (Elias, 29/10/2026).
// Depende de js/catalogos.js, js/componentes.js, js/receituarios.js e js/exames.js. Dados em memória até existir a API.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, markDirty, normalize, brToIso, addDays } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const RX = window.HuNefroReceituarios
  const $ = (id) => document.getElementById(id)
  if (!$("ex-panel-req")) return

  const CATALOG = C.EXAMES_SOLICITACAO
  const GROUPS = [["lab", "Exames laboratoriais"], ["imagem", "Exames de imagem"], ["outros", "Outros exames"], ["apac", "Alta complexidade / alto custo (exige APAC)"]]
  const PERIOD_PLURAL = { Mensal: "mensais", Trimestral: "trimestrais", Semestral: "semestrais", Anual: "anuais" }
  const isApac = (x) => Boolean(x.apac || byName(x.name)?.apac)
  const DEST_LABEL = { aghu: "AGHU", externo: "Outro laboratório" }
  const MIN_APAC_JUSTIFICATION = 30
  const WINDOW_DAYS = 30
  const PAGE_ROWS = 22
  const DEFAULT_CID = "N18.0"
  const INDICATION = "Doença renal crônica estádio 5 em hemodiálise. Exames de controle periódico do programa de hemodiálise."
  const byName = (name) => CATALOG.find((x) => x.name === name)

  let requests = []
  let nextId = 1
  let selectedId = null
  // Itens da solicitação em edição: { name, group, code, sigtap, qty, note, reason, tone }
  let draft = []
  let touched = false

  const itemOf = (name, extra = {}) => {
    const cat = byName(name)
    return { name, group: cat?.group || "outros", code: cat?.code || "", sigtap: cat?.sigtap || "", qty: 1, note: cat?.note || "", reason: "", tone: "off", apac: Boolean(cat?.apac), ...extra }
  }

  // ---------- Condições do paciente para os exames condicionais da rotina ----------
  function patientConditions() {
    const ctx = RX.patientContext()
    const clinical = window.HuNefroDadosClinicos?.getData() || {}
    const markers = clinical.marcadores_virais || {}
    const events = window.HuNefroEventosDiagnosticos?.getData() || []
    const nutrition = window.HuNefroNutricao?.getData?.() || {}
    const diabetic = /^E1[0-4]/.test(ctx.baseCid || "") || /diabet/i.test(ctx.etiology || "") || Boolean(nutrition.dm1 || nutrition.dm2)
      || events.some((e) => !e.end && /diabetes|"E1[0-4]/i.test(JSON.stringify(e)))
    const start = brToIso(ctx.programStart) || ctx.programStart
    return {
      ctx,
      diabetic,
      firstYear: Boolean(start) && start >= addDays(todayIso(), -365),
      hbvSusceptible: markers.hepatiteB !== "positivo",
      hcvSusceptible: markers.hepatiteC !== "positivo",
    }
  }

  // ---------- Sugestão pela periodicidade ----------
  function suggestion() {
    const cond = patientConditions()
    const schedule = window.HuNefroExames?.schedule() || []
    const items = []
    const counts = {}
    const skipped = []
    schedule.forEach((period) => {
      period.items.forEach((item) => {
        if (!item.request.length) return
        if (item.when && !cond[item.when]) { skipped.push(`${item.name} (${item.note})`); return }
        const st = item.status
        const due = period.key === "mensal" || st.left === null || st.left <= WINDOW_DAYS
        if (!due) return
        const reason = period.key === "mensal" ? "Mensal" : `${period.label} - ${st.left === null ? "sem registro" : st.left < 0 ? "atrasado" : st.left === 0 ? "vence hoje" : `vence em ${st.left} ${st.left === 1 ? "dia" : "dias"}`}`
        const tone = period.key === "mensal" ? "ok" : st.left === null || st.left < 0 ? "danger" : "warn"
        item.request.forEach((name) => { if (!items.some((x) => x.name === name)) items.push(itemOf(name, { reason, tone, period: period.key })) })
        counts[period.label] = (counts[period.label] || 0) + 1
      })
    })
    return { items, counts, skipped }
  }

  function applySuggestion() {
    const s = suggestion()
    draft = s.items
    const parts = Object.entries(s.counts).map(([label, n]) => `${n} ${n > 1 ? PERIOD_PLURAL[label] : label.toLowerCase()}`)
    showSummary(draft.length
      ? `O que está vencendo pela periodicidade: ${draft.length} exames (${parts.join(", ")}).${s.skipped.length ? ` Não incluídos pela condição do paciente: ${s.skipped.join(", ")}.` : ""} Revise antes de pedir.`
      : "Nenhum exame devido pela periodicidade.")
    renderDraft()
  }

  // ---------- Rotinas com um clique ----------
  // Cada rotina traz todos os exames dela (os condicionais só quando o paciente se encaixa: diabético,
  // 1º ano de HD, suscetível a hepatite B ou C). Clicar de novo retira a rotina.
  function routines() {
    const cond = patientConditions()
    const schedule = window.HuNefroExames?.schedule() || []
    return schedule.map((period) => {
      const names = [], skipped = []
      period.items.forEach((item) => {
        if (!item.request.length) return
        if (item.when && !cond[item.when]) { skipped.push(item.name); return }
        item.request.forEach((n) => { if (!names.includes(n)) names.push(n) })
      })
      return { key: period.key, label: period.label, names, skipped }
    }).filter((r) => r.names.length)
  }
  function renderRoutines() {
    const list = routines()
    $("sx-routines").replaceChildren(...list.map((r) => {
      const inDraft = r.names.filter((n) => draft.some((x) => x.name === n)).length
      const full = inDraft === r.names.length
      return el("button", {
        type: "button", class: `sx-routine${full ? " is-on" : inDraft ? " is-partial" : ""}`, "data-routine": r.key, "aria-pressed": String(full),
        title: `${r.names.join(", ")}${r.skipped.length ? `. Fora pela condição do paciente: ${r.skipped.join(", ")}` : ""}`,
      }, el("span", { class: "sx-routine-check", "aria-hidden": "true", text: full ? "✓" : "+" }),
      el("strong", { text: r.label }), el("small", { text: `${inDraft ? `${inDraft} de ` : ""}${r.names.length} exames` }))
    }))
    $("sx-routine-help").textContent = "Clique na rotina para incluir todos os exames dela; clique de novo para retirar. Os outros exames entram por \"Selecionar exames\" em cada grupo."
  }
  $("sx-routines").addEventListener("click", (e) => {
    const b = e.target.closest("[data-routine]")
    if (!b) return
    const r = routines().find((x) => x.key === b.dataset.routine)
    if (!r) return
    const full = r.names.every((n) => draft.some((x) => x.name === n))
    if (full) {
      draft = draft.filter((x) => !r.names.includes(x.name))
      showSummary(`Rotina ${r.label.toLowerCase()} retirada (${r.names.length} exames).`)
    } else {
      r.names.forEach((n) => { if (!draft.some((x) => x.name === n)) draft.push(itemOf(n, { reason: r.label, tone: r.key === "mensal" ? "ok" : "off", period: r.key })) })
      showSummary(`Rotina ${r.label.toLowerCase()} incluída: ${r.names.length} exames${r.skipped.length ? `. Fora pela condição do paciente: ${r.skipped.join(", ")}` : ""}.`)
    }
    touched = true
    renderDraft()
    b.blur()
    $("sx-routines").querySelector(`[data-routine="${r.key}"]`)?.focus()
  })

  // Aviso do Laudo APAC quando há exame de alto custo na solicitação.
  function renderApacNote() {
    const list = draft.filter(isApac)
    const box = $("sx-apac-note")
    box.hidden = !list.length
    if (!list.length) return
    box.replaceChildren(el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }),
      el("div", {}, el("strong", { text: `${list.length === 1 ? "1 exame de alto custo" : `${list.length} exames de alto custo`}: exige Laudo para Solicitação de APAC` }),
        el("span", { text: `${list.map((x) => x.name).join(", ")}. Preencha a indicação clínica (justificativa, com pelo menos ${MIN_APAC_JUSTIFICATION} caracteres) e o CID-10. O laudo vai para a autorização do gestor (regulação) e o exame só é realizado depois do número da APAC.` })))
    if ($("sx-model").value === "solicitacao") $("sx-model").value = "ambos"
  }

  const showSummary = (text) => { $("sx-summary").textContent = text; $("sx-summary").hidden = !text }

  // ---------- Formulário ----------
  $("sx-author").replaceChildren(el("option", { value: "", text: "Selecione" }), ...C.doctorOptions().map(([id, name]) => el("option", { value: id, text: name })))
  function resetForm() {
    $("sx-date").value = todayIso()
    $("sx-date").max = todayIso()
    $("sx-author").value = C.doctorOptions()[0]?.[0] || ""
    $("sx-cid").value = DEFAULT_CID
    $("sx-indication").value = INDICATION
    $("sx-notes").value = ""
    $("sx-error").hidden = true
  }

  function renderDraft() {
    $("sx-groups").replaceChildren(...GROUPS.map(([key, label]) => {
      const list = draft.filter((x) => x.group === key)
      const select = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", "data-select": key, text: "Selecionar exames" })
      return el("section", { class: "sx-group", "aria-labelledby": `sx-g-${key}` },
        el("header", { class: "sx-group-head" },
          el("h4", { id: `sx-g-${key}`, text: `${label} (${list.length})` }), select),
        list.length
          ? el("ul", { class: "sx-list" }, ...list.map((x) => el("li", { class: "sx-item" },
            el("span", { class: "sx-item-name" }, el("strong", { text: x.name }), el("small", { text: [x.code || (isApac(x) ? "código SIGTAP a confirmar" : "sem código SIGTAP"), x.note].filter(Boolean).join(" · ") })),
            ...(isApac(x) ? [el("span", { class: "hn-badge hn-badge-warn", text: "exige APAC" })] : x.reason ? [el("span", { class: `hn-badge hn-badge-${x.tone}`, text: x.reason })] : []),
            el("button", { class: "sx-remove", type: "button", "data-remove": x.name, "aria-label": `Retirar ${x.name}`, title: "Retirar", text: "×" }))))
          : el("p", { class: "ev-empty", text: "Nenhum exame selecionado." }))
    }))
    renderRoutines()
    renderApacNote()
  }
  $("sx-groups").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]")
    if (rm) { draft = draft.filter((x) => x.name !== rm.dataset.remove); touched = true; renderDraft(); return }
    const sel = e.target.closest("[data-select]")
    if (sel) openSelect(sel.dataset.select)
  })
  ;["sx-date", "sx-author", "sx-cid", "sx-indication", "sx-notes"].forEach((id) => $(id).addEventListener("input", () => { touched = true }))

  $("sx-suggest").addEventListener("click", () => { applySuggestion(); touched = true })
  $("sx-clear").addEventListener("click", () => { draft = []; touched = true; resetForm(); showSummary(""); renderDraft() })
  $("sx-copy-last").addEventListener("click", () => {
    const last = sortedRequests()[0]
    if (!last) { showSummary("Ainda não há solicitação anterior para copiar."); return }
    copyRequest(last)
  })
  function copyRequest(rec) {
    draft = rec.items.map((x) => itemOf(x.name, { qty: x.qty || 1, note: x.note ?? byName(x.name)?.note ?? "", group: x.group || byName(x.name)?.group || "outros", code: x.code ?? byName(x.name)?.code ?? "" }))
    $("sx-cid").value = rec.cid || DEFAULT_CID
    $("sx-indication").value = rec.indication || ""
    $("sx-notes").value = rec.notes || ""
    touched = true
    showSummary(`Copiada a solicitação de ${formatDate(rec.date)} (${rec.items.length} exames). A data e o solicitante são os de hoje.`)
    renderDraft()
    $("sx-title").scrollIntoView({ block: "start" })
  }

  // ---------- Diálogo "Selecionar exames" ----------
  const dialog = $("sx-dialog")
  let dialogGroup = "lab", returnFocus = null
  function openSelect(group) {
    dialogGroup = group
    returnFocus = document.activeElement
    const chosen = new Set(draft.filter((x) => x.group === group).map((x) => x.name))
    const search = el("input", { class: "form-control form-control-sm", id: "sx-d-search", type: "search", placeholder: "Buscar exame", autocomplete: "off", "data-no-dirty": true })
    const options = CATALOG.filter((x) => x.group === group)
    const boxes = options.map((x, i) => {
      const input = el("input", { type: "checkbox", id: `sx-d-${i}`, value: x.name, checked: chosen.has(x.name), "data-no-dirty": true })
      return el("label", { class: "hc-check sx-option", for: input.id, "data-search": normalize(`${x.name} ${x.code} ${x.sigtap}`) }, input, el("span", { text: x.name }), el("small", { text: x.code || (x.apac ? "APAC" : "sem código") }))
    })
    // Exames fora do catálogo já informados (texto livre) continuam marcados.
    draft.filter((x) => x.group === group && !byName(x.name)).forEach((x, i) => {
      const input = el("input", { type: "checkbox", id: `sx-d-free-${i}`, value: x.name, checked: true, "data-no-dirty": true })
      boxes.push(el("label", { class: "hc-check sx-option", for: input.id, "data-search": normalize(x.name) }, input, el("span", { text: x.name }), el("small", { text: "outro" })))
    })
    const list = el("div", { class: "sx-options" }, ...boxes)
    const other = el("input", { class: "form-control form-control-sm", id: "sx-d-other", maxlength: "80", autocomplete: "off", placeholder: "Nome do exame", "data-no-dirty": true })
    const addOther = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", text: "Incluir" })
    const count = () => { $("sx-count").textContent = `Marcados: ${list.querySelectorAll("input:checked").length}` }
    search.addEventListener("input", () => { const q = normalize(search.value.trim()); boxes.forEach((b) => { b.hidden = q && !b.dataset.search.includes(q) }) })
    list.addEventListener("change", count)
    addOther.addEventListener("click", () => {
      const name = other.value.trim()
      if (!name) { other.focus(); return }
      const input = el("input", { type: "checkbox", id: `sx-d-new-${boxes.length}`, value: name, checked: true, "data-no-dirty": true })
      const label = el("label", { class: "hc-check sx-option", for: input.id, "data-search": normalize(name) }, input, el("span", { text: name }), el("small", { text: "outro" }))
      boxes.push(label); list.append(label); other.value = ""; count()
    })
    other.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addOther.click() } })
    $("sx-dialog-title").textContent = `Selecionar exames - ${GROUPS.find(([k]) => k === group)[1]}`
    $("sx-dialog-body").replaceChildren(
      el("p", { class: "form-text sx-d-help", text: "Os exames já informados vêm marcados. Desmarque para retirar." }),
      search,
      list,
      el("div", { class: "field-block sx-d-other" }, el("label", { class: "field-label", for: "sx-d-other", text: "Outro exame (fora da lista)" }), el("div", { class: "sx-d-other-row" }, other, addOther)),
    )
    $("sx-dialog-error").hidden = true
    count()
    dialog.showModal()
    search.focus()
  }
  function closeSelect() { if (dialog.open) dialog.close(); returnFocus?.focus?.() }
  $("sx-dialog-cancel").addEventListener("click", closeSelect)
  $("sx-dialog-close").addEventListener("click", closeSelect)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeSelect() })
  $("sx-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const checked = [...$("sx-dialog-body").querySelectorAll(".sx-options input:checked")].map((i) => i.value)
    // O grupo fica com os marcados: os já informados mantêm a origem (periodicidade) e os novos entram no fim.
    const keep = draft.filter((x) => x.group !== dialogGroup || checked.includes(x.name))
    const added = checked.filter((n) => !keep.some((x) => x.name === n)).map((n) => itemOf(n, byName(n) ? {} : { group: dialogGroup }))
    draft = [...keep, ...added]
    touched = true
    renderDraft()
    closeSelect()
  })

  // ---------- Pedir exames (AGHU ou outro laboratório) ----------
  function validate() {
    if (!$("sx-date").value) return ["Informe a data da solicitação.", $("sx-date")]
    if ($("sx-date").value > todayIso()) return ["A data da solicitação não pode ser futura.", $("sx-date")]
    if (!$("sx-author").value) return ["Selecione o(a) médico(a) solicitante.", $("sx-author")]
    if (!/^[A-Z]\d{2}(\.\d)?$/i.test($("sx-cid").value.trim())) return ["Informe o CID-10 (ex.: N18.0).", $("sx-cid")]
    if (!draft.length) return ["Selecione ao menos um exame (uma rotina ou pelo Selecionar exames).", $("sx-routines").querySelector("button") || $("sx-suggest")]
    // Laudo APAC: justificativa clínica e CID são obrigatórios para a autorização do gestor.
    if (draft.some(isApac) && $("sx-indication").value.trim().length < MIN_APAC_JUSTIFICATION)
      return [`Exame de alto custo exige Laudo APAC: descreva a indicação clínica (justificativa) com pelo menos ${MIN_APAC_JUSTIFICATION} caracteres.`, $("sx-indication")]
    return null
  }
  function showError(problem) {
    if (!problem) { $("sx-error").hidden = true; return false }
    $("sx-error").textContent = problem[0]; $("sx-error").hidden = false; problem[1]?.focus(); return true
  }
  function buildRecord(extra) {
    const apacItems = draft.filter(isApac).map((x) => x.name)
    return {
      id: nextId++, date: $("sx-date").value, author: $("sx-author").value, cid: $("sx-cid").value.trim().toUpperCase(),
      indication: $("sx-indication").value.trim(), notes: $("sx-notes").value.trim(),
      items: draft.map(({ name, group, code, qty, note }) => ({ name, group, code, qty, note, ...(isApac({ name }) ? { apac: true } : {}) })),
      by: currentUserName(), createdAt: todayIso(),
      ...(apacItems.length ? { apac: { status: "aguardando", items: apacItems, number: "" } } : {}),
      ...extra,
    }
  }
  function finish(rec, message) {
    requests.push(rec)
    selectedId = rec.id
    renderHistory()
    markDirty()
    showSummary(message)
    draft = []; touched = false; resetForm(); renderDraft()
  }
  const apacText = (rec) => (rec.apac ? ` ${rec.apac.items.length === 1 ? "1 exame de alto custo aguarda" : `${rec.apac.items.length} exames de alto custo aguardam`} a autorização da APAC pela regulação.` : "")

  // Via AGHU: o pedido vai pela API para o laboratório do HU, que devolve o número do pedido.
  let sending = false
  $("sx-save-aghu").addEventListener("click", async () => {
    if (sending || showError(validate())) return
    sending = true
    const button = $("sx-save-aghu")
    button.disabled = true
    button.textContent = "Enviando ao AGHU..."
    try {
      const rec = buildRecord({ dest: "aghu" })
      const answer = await window.HuNefroAGHU.enviarSolicitacaoExames(rec)
      if (!answer?.ok) throw new Error("AGHU")
      rec.protocol = answer.protocol
      rec.sentAt = answer.sentAt
      finish(rec, `Pedido enviado ao AGHU: nº ${rec.protocol}, ${rec.items.length} exames.${apacText(rec)}${rec.apac ? " Imprima o Laudo APAC pelo histórico se a regulação pedir o laudo assinado." : ""}`)
    } catch {
      nextId -= 1
      showError(["Não foi possível enviar ao AGHU agora. Tente de novo ou peça em outro laboratório.", button])
    } finally {
      sending = false
      button.disabled = false
      button.textContent = "Pedir exames via AGHU"
    }
  })

  // Outro laboratório: registra qual e imprime a solicitação (e o Laudo APAC, se houver alto custo).
  const labDialog = $("sx-lab-dialog")
  const closeLab = () => { if (labDialog.open) labDialog.close(); $("sx-save-other").focus() }
  $("sx-save-other").addEventListener("click", () => {
    if (showError(validate())) return
    $("sx-lab-form").reset()
    $("sx-lab-error").hidden = true
    labDialog.showModal()
    $("sx-lab-name").focus()
  })
  $("sx-lab-close").addEventListener("click", closeLab)
  $("sx-lab-cancel").addEventListener("click", closeLab)
  labDialog.addEventListener("cancel", (e) => { e.preventDefault(); closeLab() })
  $("sx-lab-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const lab = $("sx-lab-name").value.trim()
    if (lab.length < 3) { $("sx-lab-error").textContent = "Informe o laboratório."; $("sx-lab-error").hidden = false; $("sx-lab-name").focus(); return }
    const rec = buildRecord({ dest: "externo", lab, labReason: $("sx-lab-reason").value })
    const model = $("sx-model").value
    closeLab()
    finish(rec, `Solicitação gravada para ${lab}, ${rec.items.length} exames.${apacText(rec)}`)
    printRequest(rec, model)
  })

  // ---------- Histórico (Ver solicitações) ----------
  const sortedRequests = () => [...requests].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const selected = () => requests.find((x) => x.id === selectedId) || null
  // Resultado lançado na aba Exames depois da solicitação (o exame pedido conta como realizado).
  const RESULT_NAMES = { "Hemograma completo": ["Hemácias", "Leucócitos", "Plaquetas"], "Proteínas totais e frações": ["Proteínas totais", "Albumina"] }
  function resultOf(item, rec, all) {
    const names = RESULT_NAMES[item.name] || [item.name]
    return all.filter((x) => names.includes(x.name) && x.date >= rec.date).sort((a, b) => a.date.localeCompare(b.date))[0] || null
  }
  const destText = (r) => (r.dest === "aghu" ? `AGHU${r.protocol ? ` nº ${r.protocol}` : ""}` : r.dest === "externo" ? r.lab || DEST_LABEL.externo : "-")
  // Autorização da APAC: o número (13 dígitos) é dado pelo autorizador do gestor e registrado aqui.
  function apacBox(sel) {
    if (!sel.apac) return null
    const a = sel.apac
    if (a.status === "autorizada") return el("p", { class: "hn-alert hn-alert-info sx-apac-detail" }, el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "✓" }),
      el("span", { text: `APAC nº ${a.number} autorizada${a.authorizedAt ? ` em ${formatDate(a.authorizedAt)}` : ""}: ${a.items.join(", ")}.` }))
    const input = el("input", { class: "form-control form-control-sm", id: "sx-apac-number", inputmode: "numeric", maxlength: "13", placeholder: "13 dígitos", autocomplete: "off", "data-no-dirty": true })
    const button = el("button", { class: "btn btn-outline-secondary btn-sm", type: "button", text: "Registrar autorização" })
    const error = el("p", { class: "hc-error", role: "alert", hidden: true })
    button.addEventListener("click", () => {
      const n = input.value.replace(/\D/g, "")
      if (n.length !== 13) { error.textContent = "O número da APAC tem 13 dígitos."; error.hidden = false; input.focus(); return }
      a.status = "autorizada"; a.number = n; a.authorizedAt = todayIso(); a.by = currentUserName()
      markDirty(); renderHistory()
    })
    return el("div", { class: "hn-alert hn-alert-warn sx-apac-detail" }, el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }),
      el("div", {}, el("strong", { text: "APAC aguardando autorização da regulação" }), el("span", { text: a.items.join(", ") }),
        el("div", { class: "sx-apac-form" }, el("label", { class: "field-label", for: "sx-apac-number", text: "Nº da APAC" }), input, button), error))
  }
  function renderHistory() {
    const all = window.HuNefroExames?.getData() || []
    const rows = sortedRequests()
    $("sx-tbody").replaceChildren(...rows.map((r) => {
      const done = r.items.filter((x) => resultOf(x, r, all)).length
      return el("tr", { tabindex: "0", "data-id": r.id, class: r.id === selectedId ? "is-selected" : "", "aria-selected": String(r.id === selectedId) },
        el("td", { text: formatDate(r.date) }), el("td", { text: RX.professional(r.author)?.name || "-" }),
        el("td", {}, document.createTextNode(destText(r)), ...(r.apac ? [el("span", { class: `hn-badge hn-badge-${r.apac.status === "autorizada" ? "ok" : "warn"} sx-apac-badge`, text: r.apac.status === "autorizada" ? "APAC autorizada" : "APAC pendente" })] : [])),
        el("td", { text: String(r.items.length) }), el("td", { text: `${done} de ${r.items.length}` }))
    }))
    $("sx-empty").hidden = rows.length > 0
    const sel = selected()
    ;["sx-h-copy", "sx-h-print", "sx-h-delete"].forEach((id) => { $(id).disabled = !sel })
    if (!sel) { $("sx-detail").replaceChildren(el("p", { class: "ph-notes", text: "Selecione uma solicitação para ver os exames." })); return }
    $("sx-detail").replaceChildren(
      el("p", { class: "sx-detail-meta", text: `${formatDate(sel.date)} · ${destText(sel)}${sel.labReason ? ` (${sel.labReason})` : ""} · CID ${sel.cid}${sel.notes ? ` · ${sel.notes}` : ""}` }),
      apacBox(sel) || "",
      ...GROUPS.map(([key, label]) => {
        const list = sel.items.filter((x) => x.group === key)
        if (!list.length) return null
        return el("div", {}, el("strong", { class: "sx-detail-group", text: label }),
          el("ul", { class: "sx-detail-list" }, ...list.map((x) => {
            const res = resultOf(x, sel, all)
            // Exame com vários resultados (hemograma, proteínas) mostra só a data em que foi realizado.
            const text = !res ? "sem resultado" : RESULT_NAMES[x.name] ? `realizado em ${formatDate(res.date)}` : `${res.result} (${formatDate(res.date)})`
            return el("li", {}, el("span", { text: x.name }), el("small", { class: res ? "is-done" : "", text: isApac(x) && sel.apac?.status !== "autorizada" && !res ? "aguarda APAC" : text }))
          })))
      }).filter(Boolean))
  }
  $("sx-tbody").addEventListener("click", (e) => { const r = e.target.closest("tr[data-id]"); if (r) { selectedId = Number(r.dataset.id); renderHistory() } })
  $("sx-tbody").addEventListener("keydown", (e) => {
    const r = e.target.closest("tr[data-id]")
    if (!r) return
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectedId = Number(r.dataset.id); renderHistory(); $("sx-tbody").querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus() }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus() }
  })
  $("sx-h-copy").addEventListener("click", () => { const r = selected(); if (r) copyRequest(r) })
  $("sx-h-print").addEventListener("click", () => { const r = selected(); if (r) printRequest(r, $("sx-model").value) })
  $("sx-h-delete").addEventListener("click", () => {
    const r = selected(); if (!r) return
    // Confirmação no próprio botão (sem confirm() do navegador): o segundo clique exclui.
    const b = $("sx-h-delete")
    if (b.dataset.confirm !== String(r.id)) { b.dataset.confirm = String(r.id); b.textContent = "Confirmar exclusão"; return }
    requests = requests.filter((x) => x.id !== r.id); selectedId = null
    delete b.dataset.confirm; b.textContent = "Excluir"
    renderHistory(); markDirty()
  })
  $("sx-tbody").addEventListener("click", () => { const b = $("sx-h-delete"); delete b.dataset.confirm; b.textContent = "Excluir" })

  // ---------- Impressão ----------
  const codesOn = () => $("sx-codes").checked

  // Cada grupo sai em tabela de duas colunas de exames (cabe a rotina completa em uma página).
  // Acima de PAGE_ROWS linhas, a solicitação continua em outra folha, com a assinatura na última.
  function requestPages(rec, ctx) {
    const prescriber = RX.professional(rec.author)
    const withCodes = codesOn()
    const blocks = GROUPS.map(([key, label]) => [label, rec.items.filter((x) => x.group === key)]).filter(([, list]) => list.length)
    const head = () => el("tr", {}, ...[0, 1].flatMap((k) => [
      el("th", { class: `pr-ex-n${k ? " pr-ex-split" : ""}`, text: "Nº" }), el("th", { text: "Exame" }),
      ...(withCodes ? [el("th", { class: "pr-ex-code", text: "Código SIGTAP" })] : []), el("th", { class: "pr-ex-qty", text: "Qtde." })]))
    const cells = (x, n, split) => x
      ? [el("td", { class: `pr-ex-n${split ? " pr-ex-split" : ""}`, text: String(n) }), el("td", {}, x.name, ...(x.note ? [el("small", { class: "pr-ex-note", text: ` (${x.note})` })] : [])),
        ...(withCodes ? [el("td", { class: "pr-ex-code", text: x.code || "-" })] : []), el("td", { class: "pr-ex-qty", text: String(x.qty || 1) })]
      : [el("td", { class: `pr-ex-n${split ? " pr-ex-split" : ""}` }), el("td"), ...(withCodes ? [el("td")] : []), el("td")]
    // Linhas: [rótulo do grupo, itens do par, número do primeiro]
    const lines = blocks.flatMap(([label, list]) => {
      const half = Math.ceil(list.length / 2)
      return Array.from({ length: half }, (_, i) => [label, list[i], i + 1, list[i + half], i + half + 1])
    })
    const pages = []
    for (let i = 0; i < lines.length; i += PAGE_ROWS) pages.push(lines.slice(i, i + PAGE_ROWS))
    return pages.map((chunk, p) => {
      const body = []
      let tbody = null, current = p ? pages[p - 1].at(-1)[0] : ""
      chunk.forEach(([label, a, na, b, nb]) => {
        if (label !== current || !tbody) {
          body.push(el("h3", { class: "pr-rx-route", text: `${label}${label === current ? " (continuação)" : ""}`.toUpperCase() }))
          tbody = el("tbody")
          body.push(el("table", { class: "pr-table pr-ex-table" }, el("thead", {}, head()), tbody))
          current = label
        }
        tbody.append(el("tr", {}, ...cells(a, na, false), ...cells(b, nb, true)))
      })
      const last = p === pages.length - 1
      return RX.page("pr-exames",
        RX.letterhead(),
        el("h2", { class: "pr-title", text: "SOLICITAÇÃO DE EXAMES" }),
        RX.patientBox(ctx, { withSexAge: true }),
        el("section", { class: "pr-patient pr-ex-clinical" }, RX.field("Indicação clínica", rec.indication), RX.field("CID-10", rec.cid)),
        el("div", { class: "pr-body" }, ...body,
          ...(last && rec.notes ? [el("p", { class: "pr-note", text: `Observações: ${rec.notes}` })] : [])),
        ...(last ? [RX.signature(prescriber, rec.date)] : []),
        RX.footer(`Solicitação de exames - ${rec.items.length} ${rec.items.length === 1 ? "exame" : "exames"}${pages.length > 1 ? ` · Página ${p + 1} de ${pages.length}` : ""}`),
      )
    })
  }

  // Laudo para Solicitação de APAC: um laudo por exame de alto custo (procedimento principal), com a
  // justificativa (indicação clínica) e o CID. Os campos de autorização ficam para o gestor.
  function guiaPages(rec, ctx) {
    const prescriber = RX.professional(rec.author)
    const base = RX.apacAuto(ctx)
    return rec.items.filter(isApac).flatMap((x) => RX.apacDocument({
      ...base, proc: { code: x.code || byName(x.name)?.code || "", name: byName(x.name)?.sigtap || x.name.toUpperCase() }, qty: Number(x.qty) || 1, secondary: [],
      diagnosis: `Doença renal crônica estádio 5 em hemodiálise${ctx.etiology ? `. Etiologia: ${ctx.etiology}` : ""}`,
      cidMain: rec.cid, notes: [rec.indication, rec.notes].filter(Boolean).join(" "),
    }, ctx, prescriber, rec.date))
  }

  function printRequest(rec, model) {
    const ctx = RX.patientContext()
    const docs = []
    const apacItems = rec.items.filter(isApac)
    if (model !== "guia") docs.push({ pages: () => requestPages(rec, ctx) })
    if (model !== "solicitacao" && apacItems.length) docs.push({ pages: () => guiaPages(rec, ctx) })
    if (model === "guia" && !apacItems.length) showSummary("Esta solicitação não tem exame de alto custo: não há Laudo APAC para imprimir.")
    else if (model === "solicitacao" && apacItems.length) showSummary(`Atenção: ${apacItems.map((x) => x.name).join(", ")} só ${apacItems.length === 1 ? "é realizado" : "são realizados"} com o Laudo APAC autorizado. Imprima também o Laudo APAC.`)
    if (docs.length) RX.print(docs)
  }

  // ---------- Abertura da aba ----------
  // Ao abrir a Solicitação, uma solicitação nova (sem edição) já vem com a sugestão pela periodicidade.
  document.addEventListener("hunefro:solicitacao-exames", () => {
    if (!touched) applySuggestion()
    renderHistory()
  })

  resetForm(); renderDraft(); renderHistory()

  window.HuNefroSolicitacaoExames = {
    getData: () => JSON.parse(JSON.stringify(requests)),
    setData(list) {
      // Registros sem grupo ou código recebem os do catálogo.
      requests = (Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []).map((r) => ({
        ...r, items: (r.items || []).map((x) => ({ qty: 1, group: byName(x.name)?.group || "outros", code: byName(x.name)?.code || "", note: byName(x.name)?.note || "", ...x })),
      }))
      nextId = requests.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      selectedId = null; draft = []; touched = false
      resetForm(); showSummary(""); renderDraft(); renderHistory()
    },
    validate: () => ({ valid: true, errors: [] }),
    suggestion,
    print: printRequest,
  }
})()
