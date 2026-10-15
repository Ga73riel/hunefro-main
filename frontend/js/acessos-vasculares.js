// Aba Prescrição e Tratamento / Acessos Vasculares.
// Três blocos: cadastro do acesso, evolução dos acessos e consulta com cirurgião vascular.
// Depende de js/catalogos.js e js/componentes.js. Dados em memória até existir a API.
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const $ = (id) => document.getElementById(id)
  if (!$("av-tbody")) return

  // Listas PROVISÓRIAS: o manual não traz as opções de acesso/tipo/localização/evento. Confirmar com a equipe.
  const KINDS = [["cateter", "Cateter"], ["fav", "Fístula Arteriovenosa (FAV)"], ["enxerto", "Enxerto"]]
  const TYPES = {
    cateter: ["Cateter temporário", "Cateter de longa permanência", "Cateter de Tenckhoff"],
    fav: ["Autógena Rádio-Cefálica", "Autógena Braquio-Cefálica", "Autógena Braquio-Basílica"],
    enxerto: ["Enxerto reto", "Enxerto em alça"],
  }
  const CATHETER_SITES = ["Jugular direita", "Jugular esquerda", "Subclávia direita", "Subclávia esquerda", "Femoral direita", "Femoral esquerda"]
  const LIMB_SITES = ["Membro Superior Direito (MSD)", "Membro Superior Esquerdo (MSE)", "Membro Inferior Direito (MID)", "Membro Inferior Esquerdo (MIE)"]
  // Localizações da FAV: lista transcrita da imagem do manual (p. 28).
  const FAV_SITES = [
    "Alça cefálica direita", "Alça cefálica esquerda", "Alça de basílica Direita", "Alça de basílica Esquerda",
    "Alça de Femoral Direita", "Alça de Femoral Esquerda", "Braquio basílica direita", "Braquio basílica esquerda",
    "Braquio cefálica direita", "Braquio cefálica esquerda", "Braquio Umeral direita", "Braquio Umeral esquerda",
    "Braquio-axilar com PTFE", "Braquio-axilar direita", "Braquio-axilar esquerda", "Distal Direita", "Distal Esquerda",
    "Membro Inferior Direita", "Membro Inferior Esquerda", "Outra", "Proximal Direita", "Proximal Esquerda",
    "Radio basílica direita", "Radio basílica esquerda", "Radio cefálica direita", "Radio cefálica esquerda",
    "Safeno femoral direita", "Safeno femoral esquerda", "Ulnar Direita", "Ulnar Esquerda",
  ]
  const SITES = { cateter: CATHETER_SITES, fav: FAV_SITES, enxerto: LIMB_SITES }
  const EVENTS = [
    "Avaliação de Frêmito / Sopro", "Punção sem Intercorrências", "Dificuldade de punção", "Infiltração", "Sangramento",
    "Trombose", "Estenose", "Sinais de infecção", "Disfunção do cateter",
  ]
  const kindLabel = (k) => (KINDS.find(([v]) => v === k) || [, k])[1]
  const doctorName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const markDirty = () => document.dispatchEvent(new CustomEvent("hunefro:dirty"))

  const state = { access: [], evolutions: [], consults: [] }
  let nextId = 1

  // ---------- Diálogo ----------
  const dialog = $("av-dialog")
  let onConfirm = null
  let returnFocus = null
  function confirmDialog({ title, body, label, danger, run }) {
    returnFocus = document.activeElement
    $("av-dialog-title").textContent = title
    $("av-dialog-body").replaceChildren(typeof body === "string" ? el("p", { class: "ev-confirm", text: body }) : body)
    const b = $("av-dialog-confirm")
    b.textContent = label
    b.classList.toggle("btn-danger", !!danger)
    b.classList.toggle("btn-primary", !danger)
    onConfirm = run
    dialog.showModal()
    ;($("av-dialog-body").querySelector("input, select") || b).focus()
  }
  function closeDialog() {
    if (dialog.open) dialog.close()
    onConfirm = null
    returnFocus?.focus?.()
  }
  $("av-dialog-form").addEventListener("submit", (e) => {
    e.preventDefault()
    const run = onConfirm
    // run() devolve texto de erro para manter o diálogo aberto
    const problem = run?.()
    if (problem) return
    closeDialog()
  })
  $("av-dialog-cancel").addEventListener("click", closeDialog)
  $("av-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog() })

  // ---------- Fábrica de blocos (formulário + tabela + Incluir/Alterar/Excluir) ----------
  function block({ prefix, list, fields, validate, build, columns, rowClass, onChange, describe }) {
    let selectedId = null
    let editingId = null
    const error = $(`${prefix}-error`)
    const items = () => (typeof list === "function" ? list() : state[list])

    function render() {
      const data = items()
      if (selectedId && !data.some((x) => x.id === selectedId)) selectedId = null
      $(`${prefix}-tbody`).replaceChildren(
        ...data.map((x) =>
          el("tr", { tabindex: "0", "data-id": x.id, class: `${x.id === selectedId ? "is-selected" : ""} ${rowClass?.(x) || ""}`, "aria-selected": String(x.id === selectedId) },
            ...columns(x).map((text) => el("td", { text }))),
        ),
      )
      $(`${prefix}-empty`).hidden = data.length > 0
      $(`${prefix}-edit`).disabled = !selectedId
      $(`${prefix}-delete`).disabled = !selectedId
      onChange?.(selectedId)
    }
    const select = (id) => { selectedId = id; render() }

    $(`${prefix}-tbody`).addEventListener("click", (e) => {
      const r = e.target.closest("tr[data-id]")
      if (r) select(Number(r.dataset.id))
    })
    $(`${prefix}-tbody`).addEventListener("keydown", (e) => {
      const r = e.target.closest("tr[data-id]")
      if (!r) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        select(Number(r.dataset.id))
        $(`${prefix}-tbody`).querySelector(`tr[data-id="${r.dataset.id}"]`)?.focus()
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        ;(e.key === "ArrowDown" ? r.nextElementSibling : r.previousElementSibling)?.focus()
      }
    })

    function reset() {
      editingId = null
      fields.reset()
      $(`${prefix}-save`).textContent = "Incluir"
      $(`${prefix}-cancel`).hidden = true
      error.hidden = true
    }

    $(`${prefix}-save`).addEventListener("click", () => {
      const problem = validate()
      if (problem) {
        error.textContent = problem[1]
        error.hidden = false
        problem[0]?.focus()
        return
      }
      const values = build()
      if (editingId) {
        Object.assign(items().find((x) => x.id === editingId), values)
        selectedId = editingId
      } else {
        const rec = { id: nextId++, ...values }
        state[typeof list === "string" ? list : "access"].push(rec)
        selectedId = rec.id
      }
      reset()
      render()
      markDirty()
    })
    $(`${prefix}-edit`).addEventListener("click", () => {
      const rec = items().find((x) => x.id === selectedId)
      if (!rec) return
      editingId = rec.id
      fields.load(rec)
      $(`${prefix}-save`).textContent = "Salvar alteração"
      $(`${prefix}-cancel`).hidden = false
      error.hidden = true
      fields.first().focus()
    })
    $(`${prefix}-cancel`).addEventListener("click", reset)
    $(`${prefix}-delete`).addEventListener("click", () => {
      const rec = items().find((x) => x.id === selectedId)
      if (!rec) return
      confirmDialog({
        title: "Excluir registro", label: "Excluir", danger: true,
        body: `Excluir ${describe(rec)}?${prefix === "av" ? " As evoluções ligadas a este acesso também serão removidas." : ""}`,
        run() {
          state[typeof list === "string" ? list : "access"] = state[typeof list === "string" ? list : "access"].filter((x) => x.id !== rec.id)
          if (prefix === "av") state.evolutions = state.evolutions.filter((x) => x.accessId !== rec.id)
          if (editingId === rec.id) reset()
          selectedId = null
          renderAll()
          markDirty()
        },
      })
    })
    return { render, reset, selected: () => selectedId, editing: () => editingId, get: () => items().find((x) => x.id === selectedId) }
  }

  // ---------- Bloco 1: acesso ----------
  const A = { date: $("av-date"), kind: $("av-kind"), type: $("av-type"), loc: $("av-loc"), obs: $("av-obs"), doctor: $("av-doctor"), billing: $("av-billing"), nobill: $("av-nobill") }
  const options = (select, list, first = "Selecione") =>
    select.replaceChildren(el("option", { value: "", text: first }), ...list.map((v) => (Array.isArray(v) ? el("option", { value: v[0], text: v[1] }) : el("option", { value: v, text: v }))))
  options(A.kind, KINDS)
  options(A.doctor, C.doctorOptions())
  A.date.max = todayIso()
  function refillDependent() {
    options(A.type, TYPES[A.kind.value] || [])
    options(A.loc, SITES[A.kind.value] || [])
  }
  refillDependent()
  A.kind.addEventListener("change", refillDependent)
  A.nobill.addEventListener("change", () => { A.billing.disabled = A.nobill.checked; if (A.nobill.checked) A.billing.value = "" })

  const accessBlock = block({
    prefix: "av",
    list: () => state.access.filter((a) => !$("av-only-active").checked || a.status === "active"),
    fields: {
      reset() { Object.values(A).forEach((f) => (f.type === "checkbox" ? (f.checked = false) : (f.value = ""))); A.date.value = todayIso(); A.billing.disabled = false; refillDependent() },
      load(a) { A.date.value = a.date; A.kind.value = a.kind; refillDependent(); A.type.value = a.type; A.loc.value = a.loc; A.obs.value = a.obs; A.doctor.value = a.doctor; A.nobill.checked = a.nobill; A.billing.disabled = a.nobill; A.billing.value = a.billing },
      first: () => A.date,
    },
    validate() {
      if (!A.date.value) return [A.date, "Informe a data do acesso."]
      if (A.date.value > todayIso()) return [A.date, "A data do acesso não pode ser futura."]
      if (!A.kind.value) return [A.kind, "Selecione o acesso."]
      if (!A.type.value) return [A.type, "Selecione o tipo do acesso."]
      if (!A.loc.value) return [A.loc, "Selecione a localização do acesso."]
      if (!A.doctor.value) return [A.doctor, "Selecione o médico responsável."]
      if (A.billing.value && A.billing.value < A.date.value) return [A.billing, "A data de cobrança não pode ser anterior à data do acesso."]
      return null
    },
    build() {
      const prev = accessBlock.editing() ? accessBlock.get() : null
      return { date: A.date.value, kind: A.kind.value, type: A.type.value, loc: A.loc.value, obs: A.obs.value.trim(), doctor: A.doctor.value, billing: A.billing.value, nobill: A.nobill.checked, status: prev?.status ?? "active", closedAt: prev?.closedAt ?? "" }
    },
    columns: (a) => [formatDate(a.date), kindLabel(a.kind), a.type, a.loc, doctorName(a.doctor), a.status === "active" ? "Ativo" : `Encerrado em ${formatDate(a.closedAt)}`],
    rowClass: (a) => (a.status === "active" ? "" : "is-inactive"),
    onChange: (id) => { const a = state.access.find((x) => x.id === id); $("av-close").disabled = !a || a.status !== "active" },
    describe: (a) => `o acesso ${kindLabel(a.kind)} de ${formatDate(a.date)}`,
  })
  $("av-only-active").addEventListener("change", () => accessBlock.render())
  $("av-close").addEventListener("click", () => {
    const a = accessBlock.get()
    if (!a) return
    const end = el("input", { class: "form-control", type: "date", id: "av-close-date", value: todayIso(), max: todayIso() })
    const err = el("div", { class: "hc-error", role: "alert", hidden: true })
    confirmDialog({
      title: "Encerrar acesso", label: "Encerrar",
      body: el("div", {}, el("p", { class: "ev-confirm", text: `Encerrar o acesso ${kindLabel(a.kind)} de ${formatDate(a.date)}? Ele passa a Inativo.` }),
        el("label", { class: "field-label", for: "av-close-date", text: "Data de encerramento *" }), end, err),
      run() {
        if (!end.value || end.value < a.date || end.value > todayIso()) {
          err.textContent = "Informe uma data entre a data do acesso e hoje."
          err.hidden = false
          return "erro"
        }
        a.status = "closed"; a.closedAt = end.value
        renderAll(); markDirty()
        return ""
      },
    })
  })

  // ---------- Bloco 2: evolução ----------
  const E = { date: $("ae-date"), event: $("ae-event"), obs: $("ae-obs") }
  options(E.event, EVENTS)
  E.date.max = todayIso()
  const evoBlock = block({
    prefix: "ae",
    list: "evolutions",
    fields: {
      reset() { E.date.value = todayIso(); E.event.value = ""; E.obs.value = "" },
      load(x) { E.date.value = x.date; E.event.value = x.event; E.obs.value = x.obs },
      first: () => E.date,
    },
    validate() {
      if (!E.date.value) return [E.date, "Informe a data."]
      if (E.date.value > todayIso()) return [E.date, "A data não pode ser futura."]
      if (!E.event.value) return [E.event, "Selecione o evento."]
      if (!evoBlock.editing() && !accessBlock.selected()) return [$("av-tbody"), "Selecione na lista o acesso a que esta evolução se refere."]
      return null
    },
    build() {
      const prev = evoBlock.editing() ? evoBlock.get() : null
      return { date: E.date.value, event: E.event.value, obs: E.obs.value.trim(), accessId: prev ? prev.accessId : accessBlock.selected(), by: prev?.by ?? currentUserName() }
    },
    columns: (x) => {
      const a = state.access.find((y) => y.id === x.accessId)
      return [formatDate(x.date), a ? `${kindLabel(a.kind)} (${formatDate(a.date)})` : "—", x.event, x.obs || "—", x.by]
    },
    describe: (x) => `a evolução de ${formatDate(x.date)} (${x.event})`,
  })

  // ---------- Bloco 3: consulta ----------
  const K = { date: $("ac-date"), obs: $("ac-obs") }
  K.date.max = todayIso()
  const consultBlock = block({
    prefix: "ac",
    list: "consults",
    fields: {
      reset() { K.date.value = todayIso(); K.obs.value = "" },
      load(x) { K.date.value = x.date; K.obs.value = x.obs },
      first: () => K.date,
    },
    validate() {
      if (!K.date.value) return [K.date, "Informe a data da consulta."]
      if (K.date.value > todayIso()) return [K.date, "A data não pode ser futura."]
      if (!K.obs.value.trim()) return [K.obs, "Escreva as observações da consulta."]
      return null
    },
    build() { const prev = consultBlock.editing() ? consultBlock.get() : null; return { date: K.date.value, obs: K.obs.value.trim(), by: prev?.by ?? currentUserName() } },
    columns: (x) => [formatDate(x.date), x.obs, x.by],
    describe: (x) => `a consulta de ${formatDate(x.date)}`,
  })

  function renderAll() {
    state.access.sort((a, b) => b.date.localeCompare(a.date))
    state.evolutions.sort((a, b) => b.date.localeCompare(a.date))
    state.consults.sort((a, b) => b.date.localeCompare(a.date))
    accessBlock.render(); evoBlock.render(); consultBlock.render()
  }
  accessBlock.reset(); evoBlock.reset(); consultBlock.reset()
  renderAll()

  window.HuNefroAcessosVasculares = {
    getData: () => JSON.parse(JSON.stringify(state)),
    setData(d) {
      state.access = Array.isArray(d?.access) ? d.access : []
      state.evolutions = Array.isArray(d?.evolutions) ? d.evolutions : []
      state.consults = Array.isArray(d?.consults) ? d.consults : []
      nextId = [...state.access, ...state.evolutions, ...state.consults].reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
      renderAll()
    },
    validate: () => ({ valid: true, errors: [] }),
    // Usado por alertas futuros: paciente sem acesso vascular ativo
    hasActiveAccess: () => state.access.some((a) => a.status === "active"),
  }
})()
