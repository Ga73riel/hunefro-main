// Aba Resultados / Laudos: modelos de preenchimento rápido, descrição, laudos anteriores e impressão em modelos diferentes.
//
// O modelo (js/laudos-modelos.js) monta o texto com os dados das outras abas; o médico revisa, grava e imprime.
// A impressão usa o padrão do HU-UFMA de js/receituarios.js e css/impressao.css (logos HU Brasil, HU e UFMA, sem SUS).
// Cada laudo cabe em uma folha: a pré-visualização reduz a fonte do texto até caber e, se não couber, a impressão
// é bloqueada com o aviso. Os laudos gravados ficam em memória e vão para o localStorage pelo Salvar do prontuário.
// Depende de js/catalogos.js, js/componentes.js, js/catalogo-medicamentos.js, js/receituarios.js e js/laudos-modelos.js.
(() => {
  "use strict"

  const { el, formatDate, todayIso, addDays, formatDecimal, markDirty, currentUserName } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const RX = window.HuNefroReceituarios
  const MED = window.HuNefroMedicamentos
  const LM = window.HuNefroLaudosModelos
  const $ = (id) => document.getElementById(id)
  const view = $("view-laudos")
  if (!view || !RX || !LM) return

  const INST = C.INSTITUICAO
  const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
  // Exames citados nos laudos (último resultado de cada um).
  const EXAMS = [
    ["Hemoglobina", "g/dL"], ["Ferritina", "ng/mL"], ["Saturação da transferrina", "%"], ["Potássio", "mEq/L"], ["Cálcio", "mg/dL"],
    ["Fósforo", "mg/dL"], ["PTH", "pg/mL"], ["Albumina", "g/dL"], ["Kt/V", ""], ["URR (%)", "%", "URR"],
  ]
  const FONT_SIZES = [11, 10.5, 10, 9.5, 9, 8.5] // pt; a pré-visualização escolhe a maior que cabe na folha
  const ACCESS_PROBLEM = /disfun|estenose|trombos|hematoma|infec|fluxo inadequado/i

  const num = (v) => String(v ?? "").replace(".", ",")
  const value = (id) => ($(id)?.value || "").trim()
  const count = (text, part) => text.split(part).length - 1

  // ---------- Contexto do paciente para os modelos (lido das outras abas pela API pública delas) ----------
  function durationText(hhmm) {
    const [h, m] = String(hhmm || "").split(":").map(Number)
    if (!h && !m) return ""
    return [h && `${h} ${h === 1 ? "hora" : "horas"}`, m && `${m} minutos`].filter(Boolean).join(" e ")
  }

  function interdialyticGain(sessions) {
    const gains = []
    for (let i = sessions.length - 1; i > 0 && gains.length < 12; i -= 1) {
      const [prev, cur] = [sessions[i - 1], sessions[i]]
      if (addDays(prev.date, 4) < cur.date) continue
      const gain = Number(cur.weightStart) - Number(prev.weightEnd)
      if (Number.isFinite(gain) && gain >= 0) gains.push(gain)
    }
    return gains.length ? `${formatDecimal(gains.reduce((a, b) => a + b, 0) / gains.length, 1)} kg` : ""
  }

  const birthplace = () => [value("naturalidade"), value("uf-naturalidade")].filter(Boolean).join(" - ")

  function context(date = todayIso(), authorId = "") {
    const base = RX.patientContext()
    const clinical = window.HuNefroDadosClinicos?.getData() || {}
    const events = window.HuNefroEventosDiagnosticos?.getData() || []
    const av = window.HuNefroAcessosVasculares?.getData() || { access: [], evolutions: [] }
    const hd = (window.HuNefroPrescricaoHD?.getData() || []).sort((a, b) => b.date.localeCompare(a.date))[0] || {}
    const sessions = (window.HuNefroSessoesDialise?.getData() || []).filter((s) => s.state === "concluida").sort((a, b) => a.date.localeCompare(b.date))
    const author = RX.professional(authorId)

    const accesses = [...(av.access || [])].sort((a, b) => b.date.localeCompare(a.date)).map((a) => ({ ...a, dateBr: formatDate(a.date) }))
    const activeAccess = accesses.find((a) => a.status === "active") || null
    const previousAccesses = accesses.filter((a) => a !== activeAccess).map((a) => [
      `${a.dateBr} - ${a.type}${a.loc ? `, ${a.loc.toLowerCase()}` : ""}`,
      a.closedAt && `, encerrado em ${formatDate(a.closedAt)}${a.closeReason ? ` (${a.closeReason.toLowerCase()})` : ""}`,
    ].filter(Boolean).join(""))
    const accessEvolutions = activeAccess
      ? (av.evolutions || []).filter((e) => e.accessId === activeAccess.id).sort((a, b) => b.date.localeCompare(a.date))
      : []

    // Problemas ativos, sem repetir a DRC e a doença de base (que os modelos já citam).
    const problems = events
      .filter((e) => ["problema", "outros"].includes(e.kind) && !e.end)
      .filter((e) => !/^N18/.test(e.data?.cid?.code || "") && e.data?.cid?.code !== base.baseCid)
      .map((e) => `${e.type === "Outro" ? e.data?.cid?.description || e.type : e.type}${e.data?.cid?.code ? ` (CID-10 ${e.data.cid.code})` : ""}`)
    const transfusions = events.filter((e) => e.kind === "transfusao").map((e) => e.start).sort().reverse().map(formatDate)
    // Internações e infecções dos últimos 12 meses (evolução clínica do relatório para o INSS).
    const EVENT_NAMES = { internacao: "internação", infeccao: "infecção" }
    const clinicalEvents = events
      .filter((e) => EVENT_NAMES[e.kind] && e.start >= addDays(date, -365))
      .sort((a, b) => b.start.localeCompare(a.start))
      .map((e) => `${formatDate(e.start)}: ${EVENT_NAMES[e.kind]} por ${e.type.toLowerCase()}${e.end ? `, até ${formatDate(e.end)}` : ", em andamento"}`)

    // Exames da coleta mais recente sem data repetida; os de outra data trazem a própria data.
    const lastExams = EXAMS.map(([name, unit, label]) => ({ unit, label: label || name, last: window.HuNefroExames?.latest(name) })).filter((x) => x.last)
    const examsDate = lastExams.map((x) => x.last.date).sort().at(-1) || ""
    const exams = lastExams.map(({ unit, label, last }) =>
      `${label} ${num(last.result)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}${last.date !== examsDate ? ` (${formatDate(last.date)})` : ""}`)
    const meds = (window.HuNefroMedicacoes?.inUse?.() || []).map((m) => {
      const name = [MED?.find(m.drug)?.dcb || m.drug, m.complement].filter(Boolean).join(" ")
      const text = `${name}: ${m.posology}${m.hd && !/HD|hemodi/i.test(m.posology) ? " (na sessão de hemodiálise)" : ""}`
      return MED ? MED.spelledOut(text) : text
    })
    const recentComplications = sessions
      .filter((s) => s.complications && s.date >= addDays(date, -30))
      .reverse().slice(0, 5).map((s) => `${formatDate(s.date)}: ${s.complications}`)

    return {
      ...base,
      date, dateBr: formatDate(date),
      female: base.sex === "Feminino",
      birthplace: birthplace(),
      weightText: num(base.weight),
      abo: clinical.abo_rh || "",
      diuresis: clinical.diurese || "",
      pregnancies: clinical.gestacoes?.quantidade ?? null,
      lastPregnancy: clinical.gestacoes?.data ? formatDate(clinical.gestacoes.data) : "",
      markers: clinical.marcadores_virais || {},
      perWeek: base.hdDays.length || 3,
      hdDayNames: base.hdDays.map((d) => WEEKDAY_NAMES[d]),
      hd: { ...hd, durationText: durationText(hd.duration) },
      gid: interdialyticGain(sessions),
      activeAccess, previousAccesses,
      accessEvents: accessEvolutions.slice(0, 3).map((e) => `${formatDate(e.date)}: ${e.event}${e.obs ? `. ${e.obs}` : ""}`),
      accessProblem: accessEvolutions.some((e) => e.date >= addDays(date, -90) && ACCESS_PROBLEM.test(e.event)),
      problems, transfusions, clinicalEvents, exams, examsDate: examsDate ? formatDate(examsDate) : "", meds, recentComplications,
      authorName: author?.name || "",
      institution: INST.nome,
    }
  }

  // Texto de um modelo para o paciente aberto (também usado pelos dados de teste).
  function compose(modelId, { date = todayIso(), author = "" } = {}) {
    const model = LM.find(modelId)
    return model ? model.build(context(date, author)) : ""
  }

  // ---------- Folha de impressão ----------
  // Texto -> parágrafos, títulos (linha curta terminada em ":") e listas (linhas iniciadas por "- ").
  function inline(text) {
    const parts = text.split(LM.BLANK)
    return parts.flatMap((part, i) => (i ? [el("span", { class: "pr-blank" }), part] : [part]))
  }

  // split: cada item de lista vira um bloco próprio, para a paginação poder quebrar a lista entre páginas.
  function textNodes(text, { split = false } = {}) {
    const nodes = []
    let list = null
    String(text || "").split("\n").forEach((raw) => {
      const line = raw.trimEnd()
      if (/^\s*-\s+/.test(line)) {
        if (!list || split) nodes.push((list = el("ul", { class: "pr-laudo-list" })))
        list.append(el("li", {}, ...inline(line.replace(/^\s*-\s+/, ""))))
        return
      }
      list = null
      if (!line.trim()) nodes.push(el("div", { class: "pr-laudo-gap" }))
      else if (line.endsWith(":") && line.length <= 60) nodes.push(el("h3", { class: "pr-laudo-h", text: line.slice(0, -1) }))
      else nodes.push(el("p", { class: "pr-laudo-p" }, ...inline(line)))
    })
    return nodes
  }

  function patientBlock(layout, ctx) {
    const f = RX.field
    const birth = ctx.birth ? `${formatDate(ctx.birth)}${ctx.age !== null ? ` (${ctx.age} anos)` : ""}` : ""
    if (layout === "compacto") {
      return el("section", { class: "pr-patient pr-patient-compact" },
        f("Paciente", ctx.name, "pr-span-2"), f("Prontuário", ctx.code), f("Nascimento", birth), f("Cartão SUS", ctx.cns))
    }
    if (layout === "completo") {
      return el("section", { class: "pr-patient pr-patient-full" },
        f("Paciente", ctx.name, "pr-span-2"), f("Prontuário", ctx.code), f("Nascimento", birth),
        f("Sexo", ctx.sex), f("Cartão SUS", ctx.cns), f("CPF", ctx.cpf), f("Telefone", ctx.phone),
        f("Nome da mãe", ctx.mother, "pr-span-2"), f("Naturalidade", birthplace()), f("Residente em", [ctx.city, ctx.uf].filter(Boolean).join(" - ")),
        f("Endereço", ctx.fullAddress, "pr-span-full"))
    }
    return el("section", { class: "pr-patient" },
      f("Paciente", ctx.name, "pr-span-2"), f("Prontuário", ctx.code), f("Nascimento", birth), f("Cartão SUS", ctx.cns), f("CPF", ctx.cpf))
  }

  const footNote = (rec, ctx, page = 0, total = 0) =>
    [rec.description, ctx.code && `Prontuário ${ctx.code}`, total > 1 && `Página ${page} de ${total}`].filter(Boolean).join(" · ")

  function laudoPage(rec, font) {
    const ctx = RX.patientContext()
    const model = LM.find(rec.model)
    const title = (model?.title || rec.description || "LAUDO MÉDICO").toUpperCase()
    return RX.page(`pr-laudo pr-laudo-${rec.layout}`,
      rec.layout === "compacto" ? RX.compactHead() : RX.letterhead(),
      el("h2", { class: "pr-title", text: title }),
      patientBlock(rec.layout, ctx),
      el("div", { class: "pr-laudo-body", style: `--pr-laudo-font: ${font}pt` }, ...textNodes(rec.text)),
      RX.signature(RX.professional(rec.author), rec.date || todayIso()),
      RX.footer(footNote(rec, ctx)),
    )
  }

  // Laudo de várias páginas (modelos com multiPage, como o Relatório para o INSS): a 1ª folha tem o cabeçalho completo,
  // as seguintes o cabeçalho reduzido e a identificação do paciente, e a assinatura fica na última.
  // Precisa de um contêiner visível para medir (a pré-visualização).
  function paginate(rec, container) {
    const ctx = RX.patientContext()
    const body = () => el("div", { class: "pr-laudo-body", style: `--pr-laudo-font: ${FONT_SIZES[0]}pt` })
    const first = laudoPage({ ...rec, text: "" }, FONT_SIZES[0])
    first.querySelector(".pr-sign").remove()
    const continuation = () => RX.page(`pr-laudo pr-laudo-${rec.layout} pr-laudo-cont`,
      RX.compactHead(),
      el("p", { class: "pr-laudo-cont-id", text: `${(LM.find(rec.model)?.title || rec.description).toUpperCase()} (continuação) · ${ctx.name} · Prontuário ${ctx.code || "-"}` }),
      body(),
      RX.footer(""),
    )
    const paper = (page) => el("div", { class: "ld-paper" }, page)
    const overflows = (page) => { const b = page.querySelector(".pr-laudo-body"); return b.scrollHeight > b.clientHeight + 1 }
    const pages = [first]
    container.replaceChildren(paper(first))
    let target = first.querySelector(".pr-laudo-body")
    const newPage = () => {
      const page = continuation()
      pages.push(page)
      container.append(paper(page))
      target = page.querySelector(".pr-laudo-body")
    }
    for (const node of textNodes(rec.text, { split: true })) {
      target.append(node)
      if (!overflows(pages.at(-1)) || target.childElementCount === 1) continue
      node.remove()
      // Título não fica sozinho no fim da página: desce junto com o primeiro item.
      const orphan = target.lastElementChild?.matches(".pr-laudo-h") ? target.lastElementChild : null
      newPage()
      if (orphan) target.append(orphan)
      target.append(node)
    }
    // Assinatura na última página; se não couber, os últimos blocos descem para uma página nova.
    const last = pages.at(-1)
    last.querySelector(".pr-foot").before(RX.signature(RX.professional(rec.author), rec.date || todayIso()))
    if (overflows(last)) {
      const moved = []
      while (overflows(last) && target.childElementCount > 1) {
        const node = target.lastElementChild
        node.remove()
        moved.unshift(node)
      }
      const sign = last.querySelector(".pr-sign")
      newPage()
      target.append(...moved)
      pages.at(-1).querySelector(".pr-foot").before(sign)
    }
    pages.forEach((page, i) => page.querySelector(".pr-foot span").textContent = footNote(rec, ctx, i + 1, pages.length))
    return pages
  }

  // ---------- Estado ----------
  let laudos = []
  let nextId = 1
  let current = null // laudo aberto no editor: { id (null se novo), model, layout, description, date, author, text }
  let pristine = "" // como estava ao abrir/gravar, para avisar antes de descartar alterações
  let fit = FONT_SIZES[0] // fonte que cabe na folha; null quando nem a menor cabe

  const authorName = (id) => RX.professional(id)?.name || "-"
  const snapshot = () => JSON.stringify([value("ld-description"), $("ld-text").value, $("ld-date").value, $("ld-layout").value, $("ld-author").value])
  const isEdited = () => Boolean(current) && snapshot() !== pristine

  function defaultAuthor() {
    const team = window.HuNefroDadosClinicos?.getData().equipe_vinculada || []
    return team.find((id) => RX.professional(id)?.category === "medico") || C.doctorOptions()[0]?.[0] || ""
  }

  // ---------- Listas: modelos e laudos anteriores ----------
  function renderModels() {
    $("ld-models").replaceChildren(...LM.MODELS.map((m) => el("li", {},
      el("button", { class: "ld-model", type: "button", "data-model": m.id, "aria-pressed": String(current?.model === m.id && !current?.id) },
        el("strong", { text: m.name }), el("span", { text: m.hint })),
    )))
  }

  function renderHistory() {
    const sorted = [...laudos].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    $("ld-history").replaceChildren(...sorted.map((l) => {
      const row = el("tr", { "data-id": String(l.id), tabindex: "0", class: current?.id === l.id ? "is-selected" : "", "aria-selected": String(current?.id === l.id) },
        el("td", { text: formatDate(l.date) }), el("td", { text: l.description }), el("td", { text: authorName(l.author) }))
      return row
    }))
    $("ld-history-empty").hidden = laudos.length > 0
  }

  // ---------- Editor ----------
  function fillEditor(rec) {
    current = { ...rec }
    $("ld-start").hidden = true
    $("ld-editor").hidden = false
    $("ld-date").value = rec.date
    $("ld-description").value = rec.description
    $("ld-layout").value = rec.layout
    $("ld-author").value = rec.author
    $("ld-text").value = rec.text
    pristine = snapshot()
    $("ld-refill").hidden = rec.model === "em-branco" || !LM.find(rec.model)
    $("ld-error").hidden = true
    $("ld-status").textContent = rec.id ? `Gravado por ${rec.by || "-"} em ${formatDate(rec.updatedAt || rec.date)}.` : ""
    renderAll()
  }

  function startFromModel(id) {
    const model = LM.find(id)
    const date = todayIso()
    const author = current?.author && !current.id ? current.author : defaultAuthor()
    fillEditor({ id: null, model: id, layout: model.layout, description: model.id === "em-branco" ? "LAUDO MÉDICO" : model.name.toUpperCase(), date, author, text: compose(id, { date, author }) })
    $(model.id === "em-branco" ? "ld-text" : "ld-description").focus()
  }

  function readEditor() {
    return { ...current, date: $("ld-date").value, description: value("ld-description").toUpperCase(), layout: $("ld-layout").value, author: $("ld-author").value, text: $("ld-text").value.replace(/\s+$/, "") }
  }

  function renderState() {
    const badge = $("ld-editor-state")
    badge.hidden = !current
    if (!current) { $("ld-editor-title").textContent = "Laudo"; return }
    const edited = isEdited()
    badge.textContent = !current.id ? "Novo, não gravado" : edited ? "Alterações não gravadas" : "Gravado"
    badge.className = `hn-badge ${current.id && !edited ? "hn-badge-ok" : "hn-badge-warn"}`
    $("ld-delete").hidden = !current.id
    $("ld-editor-title").textContent = current.id ? `Laudo de ${formatDate(current.date)}` : `Novo laudo - ${LM.find(current.model)?.name || "texto livre"}`
  }

  function renderWarnings() {
    const rec = readEditor()
    const warnings = []
    const blanks = count(rec.text, LM.BLANK)
    if (blanks) warnings.push(`${blanks} ${blanks === 1 ? "campo está" : "campos estão"} sem dado no prontuário e ${blanks === 1 ? "está marcado" : "estão marcados"} com [preencher]. Complete no texto, ou ${blanks === 1 ? "ele sai" : "eles saem"} em branco para preencher à mão.`)
    const author = RX.professional(rec.author)
    if (author && !author.council) warnings.push("O médico escolhido não tem registro no conselho cadastrado.")
    $("ld-warnings").replaceChildren(...warnings.map((w) => el("li", { class: "hn-alert hn-alert-warn", text: w })))
  }

  // ---------- Pré-visualização e ajuste a uma folha ----------
  const sheet = $("ld-sheet")
  const wrap = $("ld-preview-wrap")

  let previewPages = [] // folhas medidas na pré-visualização; a impressão usa cópias delas
  const isMultiPage = (rec) => Boolean(LM.find(rec.model)?.multiPage)

  function renderPreview() {
    if (!current || !wrap.offsetParent) return // aba oculta: não dá para medir
    sheet.style.zoom = "1"
    const rec = readEditor()
    const label = $("ld-fit")
    label.classList.remove("is-over")
    if (isMultiPage(rec)) {
      previewPages = paginate(rec, sheet)
      fit = FONT_SIZES[0]
      label.textContent = previewPages.length === 1 ? "1 página" : `${previewPages.length} páginas`
      zoomSheet()
      return
    }
    const page = laudoPage(rec, FONT_SIZES[0])
    sheet.replaceChildren(el("div", { class: "ld-paper" }, page))
    previewPages = [page]
    const body = page.querySelector(".pr-laudo-body")
    fit = null
    for (const size of FONT_SIZES) {
      body.style.setProperty("--pr-laudo-font", `${size}pt`)
      if (body.scrollHeight <= body.clientHeight + 1) { fit = size; break }
    }
    if (fit === null) body.style.setProperty("--pr-laudo-font", `${FONT_SIZES.at(-1)}pt`)
    label.textContent = fit === null ? "Não cabe em uma folha" : fit === FONT_SIZES[0] ? "Cabe em uma folha" : `Cabe em uma folha (fonte ajustada para ${num(fit)} pt)`
    label.classList.toggle("is-over", fit === null)
    page.classList.toggle("is-over", fit === null)
    zoomSheet()
  }

  function zoomSheet() {
    const padding = parseFloat(getComputedStyle(wrap).paddingLeft) * 2
    sheet.style.zoom = String(Math.min(1, (wrap.clientWidth - padding) / sheet.offsetWidth))
  }

  let timer = null
  function schedulePreview() {
    clearTimeout(timer)
    timer = setTimeout(renderPreview, 150)
  }
  if ("ResizeObserver" in window) new ResizeObserver(schedulePreview).observe(wrap)

  function renderAll() {
    renderModels()
    renderHistory()
    renderState()
    if (current) { renderWarnings(); renderPreview() }
  }

  // ---------- Gravar, excluir e imprimir ----------
  function validate(rec) {
    if (!rec.date) return ["ld-date", "Informe a data do laudo."]
    if (rec.date > todayIso()) return ["ld-date", "A data do laudo não pode ser futura."]
    if (!rec.description) return ["ld-description", "Informe a descrição do laudo."]
    if (!rec.author) return ["ld-author", "Escolha o médico responsável."]
    if (!rec.text.trim()) return ["ld-text", "Escreva o texto do laudo."]
    return null
  }

  function showError(error) {
    $("ld-error").hidden = !error
    if (!error) return false
    $("ld-error").textContent = error[1]
    $(error[0]).focus()
    return true
  }

  function save() {
    const rec = readEditor()
    if (showError(validate(rec))) return null
    const now = todayIso()
    if (rec.id) laudos = laudos.map((l) => (l.id === rec.id ? { ...rec, updatedAt: now, by: currentUserName() } : l))
    else laudos.push({ ...rec, id: nextId++, createdAt: now, updatedAt: now, by: currentUserName() })
    const saved = rec.id ? laudos.find((l) => l.id === rec.id) : laudos.at(-1)
    fillEditor(saved)
    $("ld-status").textContent = "Laudo gravado. Clique em Salvar, no rodapé, para guardar o prontuário."
    markDirty()
    return saved
  }

  $("ld-save").addEventListener("click", save)

  $("ld-print").addEventListener("click", () => {
    if (showError(validate(readEditor()))) return
    renderPreview()
    if (fit === null) {
      showError(["ld-text", "O laudo não cabe em uma folha, mesmo com a fonte reduzida. Encurte o texto ou escolha o modelo de impressão Compacto."])
      return
    }
    const rec = save()
    if (!rec) return
    renderPreview()
    RX.print([{ pages: () => previewPages.map((page) => page.cloneNode(true)) }])
  })

  // ---------- Diálogo de confirmação ----------
  const dialog = $("ld-dialog")
  let onConfirm = null
  function confirmAction({ title, text, confirmLabel, danger = false }, action) {
    $("ld-dialog-title").textContent = title
    $("ld-dialog-text").textContent = text
    const button = $("ld-dialog-confirm")
    button.textContent = confirmLabel
    button.className = `btn ${danger ? "btn-danger" : "btn-primary"}`
    onConfirm = action
    dialog.showModal()
  }
  const closeDialog = () => { if (dialog.open) dialog.close(); onConfirm = null }
  $("ld-dialog-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const action = onConfirm
    closeDialog()
    action?.()
  })
  $("ld-dialog-cancel").addEventListener("click", closeDialog)
  $("ld-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog() })

  // Troca de laudo: avisa antes de descartar o que não foi gravado.
  function guard(action) {
    if (!isEdited()) { action(); return }
    confirmAction({ title: "Descartar alterações?", text: "O laudo aberto tem alterações que ainda não foram gravadas.", confirmLabel: "Descartar e continuar", danger: true }, action)
  }

  $("ld-delete").addEventListener("click", () => {
    if (!current?.id) return
    confirmAction({ title: "Excluir laudo", text: `Excluir o laudo "${current.description}" de ${formatDate(current.date)}? Esta ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true }, () => {
      laudos = laudos.filter((l) => l.id !== current.id)
      current = null
      $("ld-editor").hidden = true
      $("ld-start").hidden = false
      markDirty()
      renderAll()
    })
  })

  $("ld-refill").addEventListener("click", () => {
    const run = () => {
      $("ld-text").value = compose(current.model, { date: $("ld-date").value || todayIso(), author: $("ld-author").value })
      $("ld-error").hidden = true
      renderState(); renderWarnings(); renderPreview()
    }
    if ($("ld-text").value.trim() === compose(current.model, { date: $("ld-date").value || todayIso(), author: $("ld-author").value }).trim()) return
    confirmAction({ title: "Atualizar com o prontuário", text: "O texto será montado de novo com os dados atuais do prontuário. O que foi escrito à mão neste laudo será perdido.", confirmLabel: "Atualizar texto" }, run)
  })

  // ---------- Eventos ----------
  $("ld-models").addEventListener("click", (event) => {
    const button = event.target.closest("[data-model]")
    if (button) guard(() => startFromModel(button.dataset.model))
  })

  function openSaved(id) {
    const rec = laudos.find((l) => l.id === id)
    if (rec && current?.id !== id) guard(() => fillEditor(rec))
  }
  $("ld-history").addEventListener("click", (event) => {
    const row = event.target.closest("[data-id]")
    if (row) openSaved(Number(row.dataset.id))
  })
  $("ld-history").addEventListener("keydown", (event) => {
    const row = event.target.closest("[data-id]")
    if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openSaved(Number(row.dataset.id)) }
  })

  ;["ld-date", "ld-description", "ld-layout", "ld-author", "ld-text"].forEach((id) => {
    $(id).addEventListener("input", () => { $("ld-status").textContent = ""; $("ld-error").hidden = true; renderState(); renderWarnings(); schedulePreview() })
  })

  // Campos fixos
  $("ld-layout").replaceChildren(...LM.LAYOUTS.map((l) => el("option", { value: l.id, text: `${l.name} - ${l.hint}` })))
  $("ld-author").replaceChildren(el("option", { value: "", text: "Selecione" }), ...C.doctorOptions().map(([id, name]) => el("option", { value: id, text: name })))
  $("ld-date").max = todayIso()

  // A aba pode ter ficado oculta: mede a folha de novo ao abrir.
  document.querySelector('[data-section="laudos"]')?.addEventListener("click", () => setTimeout(renderPreview))

  renderAll()

  window.HuNefroLaudos = {
    getData: () => JSON.parse(JSON.stringify(laudos)),
    setData(list) {
      laudos = Array.isArray(list) ? JSON.parse(JSON.stringify(list)) : []
      nextId = laudos.reduce((m, l) => Math.max(m, l.id || 0), 0) + 1
      current = null
      $("ld-editor").hidden = true
      $("ld-start").hidden = false
      renderAll()
    },
    validate: () => ({ valid: true, errors: [] }),
    compose,
    // Dados do paciente montados das outras abas (também usados pelos Padrões da evolução).
    context,
  }
})()
