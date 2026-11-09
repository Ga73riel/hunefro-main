// Salvamento automático do sistema (a cada 60 s).
// - Prontuário: js/prontuario.js salva sozinho as abas em até 60 s depois da primeira alteração.
// - Formulários em janela (<dialog>) de todas as telas e formulários marcados com data-hn-draft:
//   enquanto estão abertos, os campos são guardados como rascunho a cada 60 s. Se a página fechar,
//   travar ou a sessão cair com o formulário aberto, ao abri-lo de novo aparece "Recuperar rascunho".
//   O rascunho some quando o formulário é concluído ou fechado pelo usuário.
// PROVISÓRIO: rascunhos ficam no localStorage (huNefroRascunhos:v1) até existir a API.
// Campos com data-no-draft (e buscas) ficam de fora; janelas com data-no-draft também.
;(() => {
  "use strict"

  const INTERVAL_MS = 60000
  const KEY = "huNefroRascunhos:v1"
  const MAX_AGE_MS = 7 * 24 * 3600 * 1000
  const MATCH = 0.8 // fração de campos iguais na abertura para considerar o mesmo formulário

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {} } catch { return {} } }
  const write = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* sem armazenamento */ } }
  // Remove rascunhos com mais de 7 dias.
  ;(() => { const all = read(); const now = Date.now(); Object.keys(all).forEach((k) => { if (now - (all[k].savedAt || 0) > MAX_AGE_MS) delete all[k] }); write(all) })()

  const pad = (n) => String(n).padStart(2, "0")
  const when = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())} de ${pad(d.getDate())}/${pad(d.getMonth() + 1)}` }

  function fields(box) {
    const seen = {}
    return [...box.querySelectorAll("input, select, textarea")].filter((f) =>
      !f.disabled && !f.hasAttribute("data-no-draft") && !["button", "submit", "reset", "file", "password", "search", "hidden"].includes(f.type))
      .map((f) => {
        let id = f.id
        if (!id) { const base = `${f.tagName}:${f.name || ""}`; seen[base] = (seen[base] || 0) + 1; id = `${base}#${seen[base]}` }
        return [id, f]
      })
  }
  const valueOf = (f) => (f.type === "checkbox" || f.type === "radio" ? f.checked : f.value)
  const snapshot = (box) => Object.fromEntries(fields(box).map(([id, f]) => [id, valueOf(f)]))
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  function similarity(a, b) {
    const keys = Object.keys(a)
    if (!keys.length) return 0
    return keys.filter((k) => k in b && b[k] === a[k]).length / keys.length
  }

  function titleOf(box) {
    const label = box.getAttribute("aria-labelledby")
    return (label && document.getElementById(label)?.textContent.trim()) || box.querySelector("h1, h2, h3")?.textContent.trim() || ""
  }
  function keyOf(box) {
    const page = location.pathname.split("/").pop() || "index"
    const params = new URLSearchParams(location.search)
    return [page, params.get("patient") || "", params.get("section") || "", box.id || box.dataset.hnDraft || "", titleOf(box)].join("|")
  }

  // ---------- Estado de cada formulário aberto ----------
  const open = new Map() // box -> { key, initial, last, timer, status }

  function statusLine(box) {
    let line = box.querySelector(".hn-draft-status")
    if (!line) {
      line = document.createElement("p")
      line.className = "hn-draft-status"
      line.setAttribute("aria-live", "polite")
      const footer = box.querySelector(".ev-dialog-footer, .modal-footer, .adm-form-actions")
      if (footer) footer.prepend(line)
      else box.append(line)
    }
    return line
  }

  function saveDraft(box, force = false) {
    const st = open.get(box)
    if (!st || !box.isConnected) return
    const values = snapshot(box)
    if (same(values, st.initial)) return // nada mudou desde a abertura
    if (!force && same(values, st.last)) return
    const all = read()
    all[st.key] = { savedAt: Date.now(), title: titleOf(box), initial: st.initial, values }
    write(all)
    st.last = values
    statusLine(box).textContent = `Rascunho salvo automaticamente às ${when(Date.now()).slice(0, 5)}`
  }

  function discard(box) {
    const st = open.get(box)
    if (!st) return
    clearInterval(st.timer)
    const all = read()
    delete all[st.key]
    write(all)
    open.delete(box)
    box.querySelector(".hn-draft-status")?.remove()
    box.querySelector(".hn-draft-banner")?.remove()
  }

  function restore(box, values) {
    // Aplica duas vezes: um campo pode depender de outro (ex.: lista que aparece depois de escolher o tipo).
    for (let pass = 0; pass < 2; pass += 1) {
      fields(box).forEach(([id, f]) => {
        if (!(id in values)) return
        const v = values[id]
        if (valueOf(f) === v) return
        if (f.type === "checkbox" || f.type === "radio") f.checked = Boolean(v)
        else f.value = v
        f.dispatchEvent(new Event("input", { bubbles: true }))
        f.dispatchEvent(new Event("change", { bubbles: true }))
      })
    }
  }

  function offer(box, draft) {
    const banner = document.createElement("div")
    banner.className = "hn-alert hn-alert-info hn-draft-banner"
    banner.setAttribute("role", "status")
    const text = document.createElement("div")
    text.innerHTML = "<strong>Rascunho não concluído</strong>"
    text.append(document.createTextNode(`Este formulário foi salvo automaticamente às ${when(draft.savedAt)} e não chegou a ser concluído.`))
    const actions = document.createElement("div")
    actions.className = "hn-draft-actions"
    const yes = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-primary btn-sm", textContent: "Recuperar rascunho" })
    const no = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-outline-secondary btn-sm", textContent: "Descartar" })
    yes.addEventListener("click", () => {
      restore(box, draft.values)
      banner.remove()
      const st = open.get(box)
      if (st) st.last = snapshot(box)
      statusLine(box).textContent = "Rascunho recuperado. Confira os campos antes de concluir."
    })
    no.addEventListener("click", () => {
      const all = read(); const st = open.get(box)
      if (st) { delete all[st.key]; write(all) }
      banner.remove()
    })
    actions.append(yes, no)
    banner.append(Object.assign(document.createElement("span"), { className: "hn-alert-icon", textContent: "i", ariaHidden: "true" }), text, actions)
    const body = box.querySelector(".ev-dialog-body, .modal-body, .adm-dialog-body") || box.querySelector("form") || box
    body.prepend(banner)
  }

  function start(box) {
    if (open.has(box) || box.hasAttribute("data-no-draft")) return
    // Espera o script da tela preencher o formulário antes de tirar a "foto" inicial.
    setTimeout(() => {
      if (open.has(box) || !box.isConnected || (box.tagName === "DIALOG" && !box.open)) return
      if (!fields(box).length) return
      const st = { key: keyOf(box), initial: snapshot(box), last: null, timer: null }
      open.set(box, st)
      st.timer = setInterval(() => saveDraft(box), INTERVAL_MS)
      const draft = read()[st.key]
      if (draft && !same(draft.values, st.initial) && similarity(st.initial, draft.initial || {}) >= MATCH) offer(box, draft)
    }, 120)
  }

  // Janelas: começa ao abrir; o rascunho é apagado ao fechar (concluído ou cancelado).
  function watchDialog(dialog) {
    if (dialog.dataset.hnDraftBound) return
    dialog.dataset.hnDraftBound = "1"
    dialog.addEventListener("close", () => discard(dialog))
    if (dialog.open) start(dialog)
  }
  // Formulários na página com data-hn-draft (ex.: Dados da unidade): o rascunho é apagado ao gravar.
  function watchForm(form) {
    if (form.dataset.hnDraftBound) return
    form.dataset.hnDraftBound = "1"
    form.addEventListener("submit", () => setTimeout(() => { if (!form.querySelector(".ev-dialog-error:not([hidden]), [role=alert]:not([hidden]):not(:empty)")) discard(form) }, 0))
    start(form)
  }

  function scan(root = document) {
    root.querySelectorAll?.("dialog").forEach(watchDialog)
    root.querySelectorAll?.("form[data-hn-draft]").forEach(watchForm)
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === "attributes" && m.target.tagName === "DIALOG") {
        watchDialog(m.target)
        if (m.target.open) start(m.target)
      }
      m.addedNodes?.forEach((n) => {
        if (n.nodeType !== 1) return
        if (n.matches?.("dialog")) watchDialog(n)
        if (n.matches?.("form[data-hn-draft]")) watchForm(n)
        scan(n)
      })
    })
  })

  function init() {
    scan()
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] })
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init)
  else init()

  // Se a página for fechada ou escondida com um formulário aberto, guarda o rascunho na hora.
  const flush = () => open.forEach((_, box) => saveDraft(box, true))
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush() })

  window.HuNefroAutoSave = { INTERVAL_MS, flush, drafts: read }
})()
