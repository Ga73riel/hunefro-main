// Tela Comunicações: caixas Para mim / Enviadas / Todas, nova comunicação e detalhe com respostas.
// Os dados e as regras ficam em js/comunicacoes-store.js (HuNefroComunicacoes).
(() => {
  "use strict"

  const S = window.HuNefroComunicacoes
  const { el, normalize, formatDate, todayIso } = window.HuNefroUI
  const $ = (id) => document.getElementById(id)
  const patients = (window.HuNefroMock?.patients || []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const patientOf = (id) => patients.find((p) => p.id === id)

  const BOX_KEY = "huNefroComunicacoesCaixa"
  const params = new URLSearchParams(location.search)
  let patientFilter = Number(params.get("patient")) || null
  let box = (() => { try { return sessionStorage.getItem(BOX_KEY) || "recebidas" } catch { return "recebidas" } })()
  if (patientFilter) box = "todas"

  const TYPE_ICON = { avaliacao: "A", aviso: "!", tarefa: "✓" }
  const PRIORITY_TONE = { urgente: "hn-badge-danger", prioritaria: "hn-badge-warn" }
  const PRIORITY_RANK = { urgente: 0, prioritaria: 1, rotina: 2 }

  function when(isoDateTime) {
    const d = new Date(isoDateTime)
    const today = todayIso()
    const dayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    return dayIso === today ? `hoje, ${time}` : `${formatDate(dayIso)}, ${time}`
  }
  const recipientsText = (item) => item.recipients.map((r) => r.label).join(", ")

  // ---------- Filtros e lista ----------
  $("cm-type").append(...S.TYPES.map(([v, l]) => el("option", { value: v, text: l })))

  function inBox(item) {
    if (patientFilter && item.patientId !== patientFilter) return false
    if (box === "recebidas") return S.isForMe(item)
    if (box === "enviadas") return S.isMine(item)
    return true
  }
  function matches(item) {
    const type = $("cm-type").value
    const status = $("cm-status").value
    if (type && item.type !== type) return false
    if (status === "abertas" && item.status === "concluida") return false
    if (status === "concluidas" && item.status !== "concluida") return false
    if (status === "vencidas" && !S.isOverdue(item)) return false
    if (status === "nao-lidas" && (S.isRead(item) || item.status === "concluida")) return false
    const q = normalize($("cm-search").value.trim())
    if (!q) return true
    const patient = patientOf(item.patientId)
    return normalize([item.title, item.text, item.author, recipientsText(item), patient?.name, patient?.code].join(" ")).includes(q)
  }
  const sortKey = (item) => [S.isRead(item) ? 1 : 0, item.status === "concluida" ? 1 : 0, S.isOverdue(item) ? 0 : 1, PRIORITY_RANK[item.priority] ?? 2]
  function compare(a, b) {
    const ka = sortKey(a), kb = sortKey(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]
    return b.createdAt.localeCompare(a.createdAt)
  }

  function badges(item) {
    const list = [el("span", { class: `cm-type cm-type-${item.type}`, text: S.labelOf(S.TYPES, item.type) })]
    if (PRIORITY_TONE[item.priority]) list.push(el("span", { class: `hn-badge ${PRIORITY_TONE[item.priority]}`, text: S.labelOf(S.PRIORITIES, item.priority) }))
    if (item.status === "concluida") list.push(el("span", { class: "hn-badge hn-badge-ok", text: "Concluída" }))
    else if (S.isOverdue(item)) list.push(el("span", { class: "hn-badge hn-badge-danger", text: "Vencida" }))
    if (!S.isRead(item)) list.push(el("span", { class: "cm-unread", text: "Não lida" }))
    return list
  }

  function card(item) {
    const patient = patientOf(item.patientId)
    const meta = [
      el("span", {}, el("strong", { text: "Para: " }), recipientsText(item)),
      patient && el("span", {}, el("strong", { text: "Paciente: " }), `${patient.name} (${patient.code})`),
      S.hasDue(item.type) && item.due && el("span", { class: S.isOverdue(item) ? "is-late" : "" }, el("strong", { text: "Prazo: " }), formatDate(item.due)),
      el("span", {}, el("strong", { text: "De: " }), `${item.author} · ${when(item.createdAt)}`),
      item.replies.length && el("span", {}, `${item.replies.length} ${item.replies.length === 1 ? "resposta" : "respostas"}`),
    ].filter(Boolean)
    const button = el("button", { type: "button", class: `cm-card cm-card-${item.type}${S.isRead(item) ? "" : " is-unread"}${item.status === "concluida" ? " is-done" : ""}`, "data-id": item.id },
      el("span", { class: "cm-icon", "aria-hidden": "true", text: TYPE_ICON[item.type] }),
      el("span", { class: "cm-card-main" },
        el("span", { class: "cm-badges" }, ...badges(item)),
        el("span", { class: "cm-title", text: item.title }),
        el("span", { class: "cm-text", text: item.text }),
        el("span", { class: "cm-meta" }, ...meta)))
    return el("li", {}, button)
  }

  function renderSummary() {
    const mine = S.all().filter((i) => S.isForMe(i))
    const stats = [
      ["nao-lidas", "", "Não lidas para mim", S.unreadCount(), "info"],
      ["abertas", "tarefa", "Tarefas em aberto", mine.filter((i) => i.type === "tarefa" && i.status !== "concluida").length, "warn"],
      ["abertas", "avaliacao", "Avaliações pendentes", mine.filter((i) => i.type === "avaliacao" && i.status !== "concluida").length, "warn"],
      ["vencidas", "", "Vencidas", mine.filter((i) => S.isOverdue(i)).length, "danger"],
    ]
    $("cm-summary").replaceChildren(...stats.map(([status, type, label, n, tone]) => el("li", {},
      el("button", { type: "button", class: `cm-count${n ? ` cm-count-${tone}` : ""}`, "data-status": status, "data-type": type, title: "Mostrar na caixa Para mim" },
        el("strong", { text: String(n) }), el("span", { text: label })))))
    const unread = S.unreadCount()
    $("cm-badge-recebidas").textContent = String(unread)
    $("cm-badge-recebidas").hidden = !unread
  }

  function render() {
    document.querySelectorAll("[data-box]").forEach((tab) => {
      const on = tab.dataset.box === box
      tab.setAttribute("aria-selected", String(on))
      tab.tabIndex = on ? 0 : -1
      if (on) $("cm-panel").setAttribute("aria-labelledby", tab.id)
    })
    const patient = patientOf(patientFilter)
    $("cm-patient-filter").hidden = !patient
    if (patient) {
      $("cm-patient-filter").replaceChildren(`Mostrando só as comunicações de ${patient.name} (${patient.code}). `,
        el("button", { type: "button", class: "btn btn-link btn-sm p-0", id: "cm-clear-patient", text: "Ver todas" }))
    }
    const list = S.all().filter(inBox).filter(matches).sort(compare)
    $("cm-list").replaceChildren(...list.map(card))
    const empty = { recebidas: "Nenhuma comunicação para você com esses filtros.", enviadas: "Você ainda não enviou comunicações com esses filtros.", todas: "Nenhuma comunicação com esses filtros." }
    $("cm-empty").hidden = list.length > 0
    $("cm-empty").textContent = empty[box]
    renderSummary()
  }

  function setBox(value) {
    box = value
    try { sessionStorage.setItem(BOX_KEY, box) } catch { /* sem armazenamento */ }
    render()
  }
  document.querySelector(".md-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-box]")
    if (tab) setBox(tab.dataset.box)
  })
  document.querySelector(".md-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return
    const tabs = [...document.querySelectorAll("[data-box]")]
    const i = tabs.findIndex((t) => t.dataset.box === box)
    const next = tabs[(i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]
    setBox(next.dataset.box)
    next.focus()
  })
  $("cm-summary").addEventListener("click", (event) => {
    const b = event.target.closest("[data-status]")
    if (!b) return
    $("cm-status").value = b.dataset.status
    $("cm-type").value = b.dataset.type
    setBox("recebidas")
  })
  ;["cm-type", "cm-status"].forEach((id) => $(id).addEventListener("change", render))
  $("cm-search").addEventListener("input", render)
  $("cm-patient-filter").addEventListener("click", (event) => {
    if (event.target.id !== "cm-clear-patient") return
    patientFilter = null
    history.replaceState(null, "", location.pathname)
    render()
  })
  $("cm-list").addEventListener("click", (event) => {
    const b = event.target.closest("[data-id]")
    if (b) openDetail(Number(b.dataset.id))
  })
  document.addEventListener("hunefro:comunicacoes", () => { if (!dialog.open) render() })
  document.addEventListener("hunefro:perfil", render)

  // ---------- Diálogo ----------
  const dialog = $("cm-dialog")
  let onSubmit = null
  let returnFocus = null
  function showError(message) {
    $("cm-dialog-error").textContent = message
    $("cm-dialog-error").hidden = !message
  }
  function openDialog({ title, sub = "", body, confirm, submit, extra = [] }) {
    returnFocus = document.activeElement
    $("cm-dialog-title").textContent = title
    $("cm-dialog-sub").textContent = sub
    $("cm-dialog-body").replaceChildren(body)
    $("cm-dialog-confirm").textContent = confirm || ""
    $("cm-dialog-confirm").hidden = !submit
    $("cm-dialog-cancel").textContent = submit ? "Cancelar" : "Fechar"
    $("cm-dialog-footer").querySelectorAll(".cm-extra").forEach((b) => b.remove())
    $("cm-dialog-cancel").before(...extra)
    onSubmit = submit
    showError("")
    if (!dialog.open) dialog.showModal()
    body.querySelector("input, select, textarea")?.focus()
  }
  function closeDialog() {
    dialog.close()
    render()
    returnFocus?.focus?.()
  }
  $("cm-dialog-close").addEventListener("click", closeDialog)
  $("cm-dialog-cancel").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog() })
  $("cm-dialog-form").addEventListener("submit", (event) => {
    event.preventDefault()
    if (!onSubmit) return
    const error = onSubmit()
    if (error) showError(error)
  })

  const field = (control, label, cls = "") => el("div", { class: `field-block ${cls}` }, el("label", { class: "field-label", for: control.id, text: label }), control)
  const select = (id, options, empty) => el("select", { class: "form-select", id },
    ...(empty ? [el("option", { value: "", text: empty })] : []), ...options.map(([v, l]) => el("option", { value: v, text: l })))

  // ---------- Nova comunicação ----------
  function recipientOptions(kind) {
    if (kind === "grupo") return S.GROUPS
    if (kind === "perfil") return S.PROFILES
    return (window.HuNefroCatalogos?.PROFESSIONALS || []).map((p) => [p.id, p.label])
  }

  function openNew() {
    const recipients = []
    const type = el("div", { class: "cm-type-pick", role: "radiogroup", "aria-label": "Tipo" },
      ...S.TYPES.map(([v, l], i) => el("label", { class: "cm-type-option" },
        el("input", { type: "radio", name: "cm-n-type", value: v, ...(i === 0 ? { checked: true } : {}) }), el("span", { text: l }))))
    const title = el("input", { class: "form-control", id: "cm-n-title", autocomplete: "off", maxlength: "120" })
    const text = el("textarea", { class: "form-control", id: "cm-n-text", rows: "4" })
    const priority = select("cm-n-priority", S.PRIORITIES)
    const due = el("input", { class: "form-control", id: "cm-n-due", type: "date", min: todayIso() })
    const dueBlock = field(due, "Prazo *")
    const patient = select("cm-n-patient", patients.map((p) => [String(p.id), `${p.name} (${p.code})`]), "Nenhum (comunicação geral)")
    if (patientFilter) patient.value = String(patientFilter)
    const kind = select("cm-n-kind", S.RECIPIENT_KINDS)
    const who = select("cm-n-who", [], "Selecione")
    const fillWho = () => who.replaceChildren(el("option", { value: "", text: "Selecione" }), ...recipientOptions(kind.value).map(([v, l]) => el("option", { value: v, text: l })))
    fillWho()
    kind.addEventListener("change", fillWho)
    const chips = el("ul", { class: "cm-chips", id: "cm-n-chips", "aria-label": "Destinatários escolhidos" })
    const renderChips = () => chips.replaceChildren(...(recipients.length ? recipients.map((r, i) => el("li", { class: "cm-chip" },
      el("span", { class: "cm-chip-kind", text: S.labelOf(S.RECIPIENT_KINDS, r.kind) }), el("span", { text: r.label }),
      el("button", { type: "button", "aria-label": `Remover ${r.label}`, "data-remove": i, text: "×" }))) : [el("li", { class: "cm-chips-empty", text: "Nenhum destinatário ainda." })]))
    renderChips()
    const addBtn = el("button", { type: "button", class: "btn btn-outline-primary", id: "cm-n-add", text: "Adicionar" })
    addBtn.addEventListener("click", () => {
      if (!who.value) { showError("Escolha o destinatário para adicionar."); who.focus(); return }
      if (!recipients.some((r) => r.kind === kind.value && r.value === who.value)) {
        recipients.push({ kind: kind.value, value: who.value, label: who.selectedOptions[0].textContent })
      }
      showError("")
      who.value = ""
      renderChips()
    })
    chips.addEventListener("click", (event) => {
      const b = event.target.closest("[data-remove]")
      if (!b) return
      recipients.splice(Number(b.dataset.remove), 1)
      renderChips()
    })
    const currentType = () => type.querySelector("input:checked").value
    const syncType = () => {
      dueBlock.hidden = !S.hasDue(currentType())
      title.placeholder = { avaliacao: "Ex.: avaliação do acesso vascular", aviso: "Ex.: manutenção das máquinas", tarefa: "Ex.: conferir estoque de dialisadores" }[currentType()]
    }
    type.addEventListener("change", syncType)
    syncType()

    const body = el("div", { class: "cm-form" },
      el("div", { class: "field-block cm-wide" }, el("span", { class: "field-label", text: "Tipo *" }), type),
      field(title, "Título *", "cm-wide"),
      field(text, "Mensagem *", "cm-wide"),
      field(priority, "Prioridade"),
      dueBlock,
      field(patient, "Paciente", "cm-wide"),
      el("fieldset", { class: "cm-recipients cm-wide" },
        el("legend", { class: "field-label", text: "Destinatários *" }),
        el("p", { class: "form-text", text: "Some quantos quiser: grupos profissionais, perfis e usuários. Quem estiver em qualquer um deles recebe." }),
        el("div", { class: "cm-recipient-row" }, field(kind, "Enviar para"), field(who, "Destinatário"), addBtn),
        chips))

    openDialog({
      title: "Nova comunicação", body, confirm: "Enviar",
      submit() {
        const t = currentType()
        if (!title.value.trim()) { title.focus(); return "Informe o título." }
        if (!text.value.trim()) { text.focus(); return "Escreva a mensagem." }
        if (S.hasDue(t) && !due.value) { due.focus(); return "Informe o prazo." }
        if (S.hasDue(t) && due.value < todayIso()) { due.focus(); return "O prazo não pode ser anterior a hoje." }
        if (who.value && !recipients.length) addBtn.click()
        if (!recipients.length) { kind.focus(); return "Adicione pelo menos um destinatário." }
        S.add({ type: t, title: title.value.trim(), text: text.value.trim(), priority: priority.value, due: due.value || undefined,
          patientId: patient.value ? Number(patient.value) : undefined, recipients })
        if (box === "recebidas") box = "enviadas"
        closeDialog()
        return ""
      },
    })
  }
  $("cm-new").addEventListener("click", openNew)

  // ---------- Detalhe, respostas e conclusão ----------
  function openDetail(id) {
    const item = S.find(id)
    if (!item) return
    S.markRead(id)
    const patient = patientOf(item.patientId)
    const row = (label, ...value) => [el("dt", { text: label }), el("dd", {}, ...value)]
    const patientLink = patient && el("a", { href: `prontuario.html?patient=${patient.id}`, target: `hunefro-prontuario-${patient.id}`, text: `${patient.name} (${patient.code})` })
    const reply = el("textarea", { class: "form-control", id: "cm-reply", rows: "3", placeholder: "Escreva uma resposta para o autor e os destinatários" })
    const canClose = S.hasDue(item.type) && (S.isForMe(item) || S.isMine(item))
    const body = el("div", { class: "cm-detail" },
      el("div", { class: "cm-badges" }, ...badges(S.find(id))),
      el("p", { class: "cm-detail-text", text: item.text }),
      el("dl", { class: "cm-detail-grid" },
        ...row("Para", recipientsText(item)),
        ...(patient ? row("Paciente", patientLink) : []),
        ...row("Prioridade", S.labelOf(S.PRIORITIES, item.priority)),
        ...(S.hasDue(item.type) ? row("Prazo", item.due ? formatDate(item.due) : "-") : []),
        ...(S.hasDue(item.type) ? row("Situação", item.status === "concluida" ? `Concluída por ${item.doneBy} em ${when(item.doneAt)}` : "Em aberto") : []),
        ...row("Lida por", item.readBy.length ? item.readBy.join(", ") : "Ninguém ainda"),
        ...(item.source === "evolucao" ? row("Origem", "Solicitar avaliação, na evolução do prontuário") : [])),
      el("h4", { class: "cm-replies-title", text: item.replies.length ? `Respostas (${item.replies.length})` : "Respostas" }),
      item.replies.length
        ? el("ol", { class: "cm-replies" }, ...item.replies.map((r) => el("li", {}, el("p", { class: "cm-reply-meta", text: `${r.by} · ${when(r.at)}` }), el("p", { text: r.text }))))
        : el("p", { class: "cm-muted", text: "Ainda sem respostas." }),
      field(reply, "Responder"))
    const extra = []
    if (canClose) {
      const done = item.status === "concluida"
      const toggle = el("button", { type: "button", class: `btn ${done ? "btn-outline-secondary" : "btn-success"} cm-extra me-auto`, id: "cm-toggle-done", text: done ? "Reabrir" : (item.type === "tarefa" ? "Concluir tarefa" : "Marcar como avaliada") })
      toggle.addEventListener("click", () => {
        if (reply.value.trim()) S.reply(id, reply.value)
        S.setDone(id, !done)
        openDetail(id)
      })
      extra.push(toggle)
    }
    openDialog({
      title: item.title,
      sub: `${S.labelOf(S.TYPES, item.type)} · de ${item.author}, ${when(item.createdAt)}`,
      body, confirm: "Enviar resposta", extra,
      submit() {
        if (!reply.value.trim()) { reply.focus(); return "Escreva a resposta." }
        S.reply(id, reply.value)
        openDetail(id)
        return ""
      },
    })
    reply.blur()
    $("cm-dialog-body").scrollTop = 0
  }

  // Abre direto um item (ex.: link vindo do prontuário).
  render()
  const openId = Number(params.get("item"))
  if (openId && S.find(openId)) openDetail(openId)
})()
