// Tela Gestão: painel de gestão e cadastros do setor, com menu lateral por área.
// Os dados e a aplicação nas outras telas ficam em js/gestao-store.js (HuNefroAdmin); o painel, em js/gestao-painel.js.
(() => {
  "use strict"

  const A = window.HuNefroAdmin
  const C = window.HuNefroCatalogos
  const SS = window.HuNefroSessao
  const { el, todayIso, formatDate, normalize } = window.HuNefroUI
  const EM = window.HuNefroEvolucaoModelos
  const LM = window.HuNefroLaudosModelos
  const $ = (id) => document.getElementById(id)
  const AREA_KEY = "huNefroAdminArea"
  const PROFILES = SS?.PROFILES || {}

  // ---------- Menu ----------
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
  const ICONS = {
    painel: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', historico: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    unit: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5M9 10h.01M15 10h.01"/>', rooms: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18M12 4v16"/>',
    shifts: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/>', machines: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M12 15v2"/>',
    dialyzers: '<rect x="9" y="2" width="6" height="20" rx="3"/><path d="M9 7h6M9 17h6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    perfis: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>', programs: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    procedures: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', eventTypes: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    patterns: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>', laudoModels: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>',
  }
  const MENU = [
    ["Gestão", [["painel", "Painel de gestão"], ["historico", "Histórico de alterações"]]],
    ["Unidade", [["unit", "Dados da unidade"], ["rooms", "Salas e cadeiras"], ["shifts", "Turnos"], ["machines", "Máquinas"], ["dialyzers", "Dialisadores"]]],
    ["Cadastros clínicos", [["programs", "Programas de tratamento"], ["procedures", "Procedimentos SIGTAP"], ["eventTypes", "Tipos de evento"]]],
    ["Modelos de texto", [["patterns", "Padrões da evolução"], ["laudoModels", "Modelos de laudo"]]],
  ]
  // Permissão que libera a edição de cada área (o painel e o histórico são só leitura).
  const AREA_PERMISSION = {
    unit: "adm-unidade", rooms: "adm-unidade", shifts: "adm-unidade", machines: "adm-unidade", dialyzers: "adm-unidade",
    programs: "adm-cadastros", procedures: "adm-cadastros", eventTypes: "adm-cadastros",
    patterns: "adm-modelos", laudoModels: "adm-modelos",
  }
  const canEdit = (a = area) => Boolean(AREA_PERMISSION[a] && SS?.can(AREA_PERMISSION[a]))
  const ALL_AREAS = MENU.flatMap(([, items]) => items.map(([k]) => k))
  let area = (() => {
    const fromUrl = new URLSearchParams(location.search).get("section")
    if (ALL_AREAS.includes(fromUrl)) return fromUrl
    try { const saved = sessionStorage.getItem(AREA_KEY); return ALL_AREAS.includes(saved) ? saved : "painel" } catch { return "painel" }
  })()
  let eventKind = A.EVENT_KINDS[0][0]
  const filters = { machines: { q: "", room: "", status: "" }, dialyzers: { q: "" }, historico: { q: "", area: "" } }

  // Paciente de exemplo para a prévia dos padrões e modelos (dados fictícios).
  const SAMPLE = (() => {
    const p = window.HuNefroMock?.patients?.[0] || { name: "Paciente Exemplo", code: "000000", program: "Hemodiálise" }
    return {
      name: p.name.toUpperCase(), age: 59, sex: "Feminino", cpf: "000.000.000-00", cns: "700 0000 0000 0000", code: p.code, mother: "MÃE DO PACIENTE",
      dateBr: formatDate(todayIso()), program: p.program, weightText: "62,5",
      activeAccess: { type: "Fístula arteriovenosa (FAV)", loc: "Radiocefálica esquerda", dateBr: "10/03/2021" },
      allergies: ["Dipirona"], problems: ["Hipertensão arterial", "Anemia da doença renal crônica"],
      meds: ["Alfaepoetina 4.000 UI: 3 vezes por semana (na sessão de hemodiálise)", "Carbonato de cálcio 500 mg: 1 comprimido nas refeições"],
      authorName: "Profissional Exemplo 01",
    }
  })()

  // ---------- Avisos ----------
  let toastTimer
  function toast(text) {
    const t = $("adm-toast")
    t.textContent = text
    t.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { t.hidden = true }, 3200)
  }

  // ---------- Diálogo ----------
  const dialog = $("adm-dialog")
  let onSubmit = null
  let returnFocus = null
  const showError = (message) => { $("adm-dialog-error").textContent = message; $("adm-dialog-error").hidden = !message }
  function openDialog(title, body, submit, confirmText = "Gravar", danger = false) {
    returnFocus = document.activeElement
    $("adm-dialog-title").textContent = title
    $("adm-dialog-body").replaceChildren(body)
    $("adm-dialog-confirm").textContent = confirmText
    $("adm-dialog-confirm").className = `btn ${danger ? "btn-danger" : "btn-primary"}`
    onSubmit = submit
    showError("")
    dialog.showModal()
    body.querySelector("input:not([type=checkbox]):not([disabled]), select, textarea")?.focus()
  }
  const closeDialog = () => { dialog.close(); returnFocus?.focus?.() }
  $("adm-dialog-close").addEventListener("click", closeDialog)
  $("adm-dialog-cancel").addEventListener("click", closeDialog)
  $("adm-dialog-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const result = onSubmit?.()
    if (result && result !== true) { showError(result); return }
    closeDialog()
    render()
  })
  const confirmBox = (title, text, action, label = "Excluir") => openDialog(title, el("p", { text }), () => { action(); return "" }, label, true)

  // ---------- Campos ----------
  const input = (id, value = "", extra = {}) => { const i = el("input", { class: "form-control", id, autocomplete: "off", ...extra }); i.value = value ?? ""; return i }
  const select = (id, options, value = "", extra = {}) => { const s = el("select", { class: "form-select", id, ...extra }, ...options.map(([v, l]) => el("option", { value: v, text: l }))); s.value = value ?? ""; return s }
  const field = (control, label, cls = "", help = "") => el("div", { class: `field-block ${cls}` }, el("label", { class: "field-label", for: control.id, text: label }), control, help ? el("p", { class: "form-text", text: help }) : "")
  const check = (id, label, value, cls = "adm-wide") => {
    const box = el("input", { type: "checkbox", id })
    box.checked = Boolean(value)
    return el("label", { class: `md-check ${cls}` }, box, el("span", { text: label }))
  }
  const activeCheck = (value, label = "Ativo (aparece nas telas do prontuário)") => check("adm-f-active", label, value !== false)
  const same = (a, b) => String(a || "").localeCompare(String(b || ""), "pt-BR", { sensitivity: "base" }) === 0
  const sameName = (list, name, id) => list.some((r) => same(r.name, name) && r.id !== id)
  const searchBox = (id, placeholder, value, onInput) => {
    const s = input(id, value, { type: "search", placeholder })
    s.addEventListener("input", () => onInput(s.value))
    return s
  }
  const dateTime = (iso) => (iso ? `${formatDate(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "-")

  // ---------- Tabelas ----------
  const btn = (text, data, tone = "outline-primary") => el("button", { type: "button", class: `btn btn-sm btn-${tone}`, ...data, text })
  const rowActions = (row, { remove = true, toggle = true, extra = [] } = {}) => canEdit() ? el("div", { class: "adm-actions" },
    btn("Editar", { "data-edit": row.id }),
    toggle ? btn(row.active === false ? "Ativar" : "Desativar", { "data-toggle": row.id }, "outline-secondary") : "",
    ...extra,
    remove ? btn("Excluir", { "data-remove": row.id }, "outline-danger") : "") : ""
  const status = (active, builtin) => el("span", { class: `hn-badge ${active === false ? "hn-badge-off" : "hn-badge-ok"}`, text: active === false ? "Inativo" : builtin ? "Do sistema" : "Ativo" })
  const badge = (tone, text) => el("span", { class: `hn-badge hn-badge-${tone}`, text })
  function table(headers, rows, { scroll = false, label = "" } = {}) {
    const t = el("table", { class: "table adm-table align-middle" },
      el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, ...(rows.length ? rows.map((cells) => el("tr", { class: cells.inactive ? "is-inactive" : "" }, ...cells.map((c) => el("td", {}, c))))
        : [el("tr", {}, el("td", { colspan: String(headers.length), class: "adm-empty-cell", text: "Nenhum item encontrado." }))])))
    return el("div", { class: `table-responsive adm-table-wrap ${scroll ? "hn-scroll-table" : ""}`, ...(scroll ? { tabindex: "0", "aria-label": `${label}, com rolagem` } : {}) }, t)
  }
  const withFlag = (cells, inactive) => Object.assign(cells, { inactive })
  const card = (title, sub, ...body) => el("section", { class: "adm-card" },
    el("header", { class: "adm-card-head" }, el("div", {}, el("h3", { text: title }), sub ? el("p", { text: sub }) : "")),
    el("div", { class: "adm-card-body" }, ...body))
  const summary = (items) => el("div", { class: "adm-summary" }, ...items.map(([label, value, tone = ""]) => el("div", { class: `adm-summary-item ${tone}` }, el("strong", { text: String(value) }), el("span", { text: label }))))
  const toolbar = (...items) => el("div", { class: "adm-toolbar" }, ...items)
  const filterSelect = (id, label, options, value, onChange) => {
    const s = select(id, options, value, { "aria-label": label })
    s.classList.add("form-select-sm")
    s.addEventListener("change", () => onChange(s.value))
    return s
  }

  // ---------- Validações ----------
  const digits = (v) => String(v || "").replace(/\D/g, "")
  function cnpjValid(v) {
    const d = digits(v)
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
    const calc = (len) => { const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = w.reduce((n, x, i) => n + x * +d[i], 0) % 11; return s < 2 ? 0 : 11 - s }
    return calc(12) === +d[12] && calc(13) === +d[13]
  }
  const formatCnpj = (v) => { const d = digits(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v }
  const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
  // Duração do turno; fim menor que o início = termina depois da meia-noite.
  const shiftLength = (s) => (toMin(s.end) - toMin(s.start) + 1440) % 1440
  const overnight = (s) => toMin(s.end) < toMin(s.start)

  // ---------- Áreas ----------
  const AREAS = {
    // Painel de gestão (js/gestao-painel.js).
    painel: {
      eyebrow: "Gestão", title: "Painel de gestão",
      intro: "Indicadores do setor, dos pacientes e da equipe para decidir com base nos dados: sessões, faltas, ocupação das cadeiras, acessos, sorologias, qualidade da sessão, carga de trabalho e recursos.",
      view() { const box = el("div", { class: "adm-painel" }); window.HuNefroAdminPainel?.render(box); return box },
    },
    historico: {
      eyebrow: "Gestão", title: "Histórico de alterações",
      intro: "Quem alterou o quê na Gestão, e quando. Fica guardado para auditoria (no protótipo, os últimos 400 registros deste navegador).",
      view() {
        const f = filters.historico
        const all = A.data().log
        const list = all.filter((r) => (!f.area || r.area === f.area) && (!f.q || normalize(`${r.user} ${r.item} ${r.action} ${r.detail}`).includes(normalize(f.q))))
        const exportBtn = btn("Exportar (CSV)", { id: "adm-log-export" }, "outline-primary")
        exportBtn.addEventListener("click", () => {
          const rows = [["Data e hora", "Usuário", "Perfil", "Área", "Ação", "Item", "Detalhe"], ...list.map((r) => [dateTime(r.at), r.user, r.profile, A.AREA_LABELS[r.area] || r.area, r.action, r.item, r.detail])]
          const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n")
          const a = el("a", { href: URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })), download: `hunefro-historico-gestao-${todayIso()}.csv` })
          document.body.append(a); a.click(); a.remove()
        })
        const areas = [...new Set(all.map((r) => r.area))]
        return el("div", { class: "adm-stackv" },
          toolbar(searchBox("adm-log-q", "Buscar por usuário ou item", f.q, (v) => { f.q = v; rerenderList() }),
            filterSelect("adm-log-area", "Área", [["", "Todas as áreas"], ...areas.map((a) => [a, A.AREA_LABELS[a] || a])], f.area, (v) => { f.area = v; render() }),
            el("span", { class: "adm-toolbar-spacer" }), exportBtn),
          el("div", { "data-list": "" }, table(["Data e hora", "Usuário", "Área", "Ação", "Item"], list.map((r) => [
            dateTime(r.at), el("span", {}, el("strong", { text: r.user }), r.profile ? el("small", { class: "adm-muted d-block", text: r.profile }) : ""),
            A.AREA_LABELS[r.area] || r.area, badge(r.action === "Excluiu" || r.action === "Retirou" ? "warn" : r.action === "Incluiu" || r.action === "Concedeu" ? "ok" : "info", r.action),
            el("span", {}, r.item, r.detail ? el("small", { class: "adm-muted d-block", text: r.detail }) : ""),
          ]), { scroll: true, label: "Histórico de alterações" })),
          all.length ? "" : el("p", { class: "ev-empty", text: "Ainda não há alterações registradas. Tudo o que for gravado na Gestão aparece aqui." }))
      },
    },

    // ----- Unidade -----
    unit: {
      eyebrow: "Unidade", title: "Dados da unidade",
      intro: "Identificação do estabelecimento usada nos cabeçalhos das receitas, LME, APAC, laudos e solicitações de exames.",
      view() {
        const u = A.data().unit
        const ro = !canEdit()
        const f = (key, label, cls = "", extra = {}, help = "") => field(input(`adm-u-${key}`, u[key], { disabled: ro, ...extra }), label, cls, help)
        const form = el("form", { class: "adm-stackv", id: "adm-unit-form", novalidate: true, "data-hn-draft": "unidade" },
          card("Identificação", "", el("div", { class: "adm-form adm-form-3" },
            f("nome", "Nome do estabelecimento *", "adm-span-2", { maxlength: "160" }), f("sigla", "Sigla", "", { maxlength: "40" }),
            f("unidade", "Unidade / serviço", "adm-wide", { maxlength: "160" }, "Ex.: Serviço de Nefrologia - Terapia Renal Substitutiva"))),
          card("Documentos", "CNES com 7 dígitos e CNPJ com dígitos verificadores conferidos.", el("div", { class: "adm-form adm-form-4" },
            f("cnes", "CNES *", "", { inputmode: "numeric", maxlength: "7" }), f("cnpj", "CNPJ da unidade *", "", { inputmode: "numeric", maxlength: "18" }),
            f("cnpjMantenedora", "CNPJ da mantenedora", "", { inputmode: "numeric", maxlength: "18" }, "UFMA"), f("cnpjEbserh", "CNPJ da filial Ebserh", "", { inputmode: "numeric", maxlength: "18" }))),
          card("Endereço e contato", "", el("div", { class: "adm-form adm-form-4" },
            f("endereco", "Endereço", "adm-span-2", { maxlength: "160" }), f("cidade", "Cidade", "", { maxlength: "80" }), f("uf", "UF", "", { maxlength: "2" }),
            f("cep", "CEP", "", { inputmode: "numeric", maxlength: "9" }), f("telefone", "Telefones", "adm-span-2", { maxlength: "120" }), f("email", "E-mail do setor", "", { type: "email", maxlength: "120" }))),
          card("Responsáveis", "Aparecem nos relatórios do setor.", el("div", { class: "adm-form" },
            f("responsavelTecnico", "Responsável técnico (médico)", "", { maxlength: "120" }), f("responsavelEnfermagem", "Responsável de enfermagem", "", { maxlength: "120" }))),
          card("Prévia do cabeçalho das impressões", "", el("div", { class: "adm-print-preview", id: "adm-unit-preview" })),
          ro ? "" : el("div", { class: "adm-form-actions" }, el("p", { class: "ev-dialog-error", id: "adm-unit-error", role: "alert", hidden: true }),
            btn("Descartar alterações", { id: "adm-unit-reset" }, "outline-secondary"), el("button", { type: "submit", class: "btn btn-primary", text: "Gravar dados da unidade" })))
        const value = (k) => form.querySelector(`#adm-u-${k}`).value.trim()
        const preview = () => {
          const box = form.querySelector("#adm-unit-preview")
          box.replaceChildren(
            el("div", { class: "adm-pp-logos" }, ...["logo-hu-brasil.png", "logo-hu.png", "logo-ufma.png"].map((src) => el("img", { src: `assets/impressao/${src}`, alt: "", height: "34" }))),
            el("div", { class: "adm-pp-text" }, el("strong", { text: value("nome") || "-" }), el("span", { text: value("unidade") || "" }),
              el("span", { text: `CNES ${value("cnes") || "-"} · CNPJ ${value("cnpj") || "-"}` }),
              el("span", { text: [value("endereco"), value("cidade") && `${value("cidade")} - ${value("uf")}`, value("cep") && `CEP ${value("cep")}`].filter(Boolean).join(" · ") }),
              el("span", { text: value("telefone") || "" })))
        }
        form.addEventListener("input", preview)
        preview()
        form.querySelector("#adm-unit-reset")?.addEventListener("click", () => render())
        form.addEventListener("submit", (e) => {
          e.preventDefault()
          const err = form.querySelector("#adm-unit-error")
          ;["cnpj", "cnpjMantenedora", "cnpjEbserh"].forEach((k) => { const i = form.querySelector(`#adm-u-${k}`); i.value = formatCnpj(i.value.trim()) })
          const problems = []
          if (!value("nome")) problems.push(["nome", "Informe o nome do estabelecimento."])
          if (!/^\d{7}$/.test(value("cnes"))) problems.push(["cnes", "O CNES tem 7 dígitos."])
          ;[["cnpj", "da unidade"], ["cnpjMantenedora", "da mantenedora"], ["cnpjEbserh", "da filial Ebserh"]].forEach(([k, l]) => {
            if ((k === "cnpj" || value(k)) && !cnpjValid(value(k))) problems.push([k, `O CNPJ ${l} não é válido.`])
          })
          if (value("uf") && !/^[A-Za-z]{2}$/.test(value("uf"))) problems.push(["uf", "A UF tem 2 letras."])
          if (value("cep") && digits(value("cep")).length !== 8) problems.push(["cep", "O CEP tem 8 dígitos."])
          form.querySelectorAll("[aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"))
          if (problems.length) {
            problems.forEach(([k]) => form.querySelector(`#adm-u-${k}`).setAttribute("aria-invalid", "true"))
            err.textContent = problems.map(([, m]) => m).join(" ")
            err.hidden = false
            form.querySelector(`#adm-u-${problems[0][0]}`).focus()
            return
          }
          err.hidden = true
          const values = Object.fromEntries(A.UNIT_FIELDS.map((k) => [k, k === "uf" ? value(k).toUpperCase() : k === "cep" && digits(value(k)).length === 8 ? digits(value(k)).replace(/^(\d{5})(\d{3})$/, "$1-$2") : value(k)]))
          const n = A.saveUnit(values)
          toast(n ? "Dados da unidade gravados. As próximas impressões já saem com eles." : "Nada foi alterado.")
          render()
        })
        return form
      },
    },
    rooms: {
      eyebrow: "Unidade", title: "Salas e cadeiras",
      intro: "Cadeiras fixas de cada sala (a escala dos turnos), cadeira extra para reposição e encaixe, e as salas de internação. A escala de Sessões do dia usa estes números.",
      add: "Nova sala",
      view() {
        const rooms = A.data().rooms
        const active = rooms.filter((r) => r.active !== false)
        const amb = active.filter((r) => !r.inpatient)
        const fixed = amb.reduce((n, r) => n + r.fixed, 0)
        const extra = amb.reduce((n, r) => n + r.extra, 0)
        const inpatient = active.filter((r) => r.inpatient).reduce((n, r) => n + r.fixed, 0)
        const shifts = A.data().shifts.filter((s) => s.active !== false).length
        return el("div", { class: "adm-stackv" },
          summary([["cadeiras fixas por turno", fixed], ["cadeiras extras", extra], ["cadeiras da internação", inpatient], ["turnos ativos", shifts], ["vagas fixas por semana (2 grupos de dias)", fixed * shifts * 2]]),
          el("div", { class: "adm-rooms" }, ...rooms.map((r) => el("article", { class: `adm-room ${r.active === false ? "is-inactive" : ""} ${r.inpatient ? "is-inpatient" : ""}` },
            el("header", {}, el("div", {}, el("h3", { text: r.name }), el("p", { text: r.inpatient ? "Internação" : "Ambulatorial" })),
              r.active === false ? badge("off", "Inativa") : r.inpatient ? badge("info", "Sempre disponível") : badge("ok", "Na escala")),
            el("div", { class: "adm-chairs", role: "img", "aria-label": `${r.fixed} cadeiras ${r.inpatient ? "da internação" : "fixas"}${r.extra ? ` e ${r.extra} extra` : ""}` },
              ...Array.from({ length: r.fixed }, (_, i) => el("span", { class: "adm-chair", title: `Cadeira ${i + 1}`, text: String(i + 1) })),
              ...Array.from({ length: r.extra }, (_, i) => el("span", { class: "adm-chair is-extra", title: "Cadeira extra", text: `+${i + 1}` }))),
            el("p", { class: "adm-room-meta", text: `${r.fixed} ${r.inpatient ? "da internação" : "fixas"}${r.extra ? ` + ${r.extra} extra` : ""} · ${A.data().machines.filter((m) => m.room === r.name).length} máquinas${r.note ? ` · ${r.note}` : ""}` }),
            rowActions(r, { remove: !r.builtin, toggle: !r.builtin }))),
          ),
          el("p", { class: "form-text", text: "Mudar o número de cadeiras cria as máquinas que faltam em Máquinas. As salas originais (A, B e Q) não podem ser excluídas nem renomeadas, porque a escala usa esses nomes." }))
      },
      form(row = {}) {
        const name = input("adm-f-name", row.name, { maxlength: "30", disabled: row.builtin, placeholder: "Ex.: Sala C" })
        const fixed = input("adm-f-fixed", row.fixed ?? 10, { type: "number", min: "1", max: "40" })
        const extra = input("adm-f-extra", row.extra ?? 0, { type: "number", min: "0", max: "5" })
        const note = input("adm-f-note", row.note, { maxlength: "120" })
        return [el("div", { class: "adm-form" }, field(name, "Nome da sala *", "adm-wide"), field(fixed, "Cadeiras fixas *"), field(extra, "Cadeiras extras"),
          check("adm-f-inpatient", "Sala da internação (fora da escala ambulatorial, sempre disponível)", row.inpatient), field(note, "Observação", "adm-wide"), activeCheck(row.active, "Ativa")), () => {
          const n = row.builtin ? row.name : name.value.trim().replace(/^sala\s+/i, "Sala ")
          if (!n) return "Informe o nome da sala."
          if (sameName(A.data().rooms, n, row.id)) return "Já existe uma sala com esse nome."
          const fx = Number(fixed.value); const ex = Number(extra.value || 0)
          if (!Number.isInteger(fx) || fx < 1 || fx > 40) return "As cadeiras fixas vão de 1 a 40."
          if (!Number.isInteger(ex) || ex < 0 || ex > 5) return "As cadeiras extras vão de 0 a 5."
          if (row.name && row.name !== n) A.renameRoomMachines(row.name, n)
          const saved = A.upsert("rooms", { id: row.id, name: n, fixed: fx, extra: ex, inpatient: $("adm-f-inpatient").checked, note: note.value.trim(), active: $("adm-f-active").checked })
          A.syncMachines(saved)
          toast("Sala gravada. Recarregue Sessões do dia para ver a nova capacidade.")
          return ""
        }]
      },
    },
    shifts: {
      eyebrow: "Unidade", title: "Turnos",
      intro: "Os 3 turnos do Programa de Tratamento (1º 07:00-11:00, 2º 12:00-16:00, 3º 17:00-21:00), que aparecem em Sessões do dia, na remarcação, na sessão extra (orientação médica) e no painel. O horário define qual turno Sessões do dia abre primeiro; turno inativo sai das abas e do painel de ocupação.",
      view() {
        const list = A.data().shifts
        const timed = list.filter((s) => s.active !== false && s.start && s.end)
        // Intervalos em minutos a partir das 06:00, para o turno da madrugada ficar no fim do dia de escala.
        const span = (x) => { const a = (toMin(x.start) - 360 + 1440) % 1440; return [a, a + shiftLength(x)] }
        const overlaps = timed.filter((a) => timed.some((b) => { if (b === a) return false; const [a1, a2] = span(a); const [b1, b2] = span(b); return a1 < b2 && b1 < a2 }))
        return el("div", { class: "adm-stackv" },
          overlaps.length ? el("div", { class: "hn-alert hn-alert-warn", role: "status" }, el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }), el("div", {}, el("strong", { text: "Horários sobrepostos" }), `${overlaps.map((s) => s.name).join(", ")} se sobrepõem.`)) : "",
          el("div", { class: "adm-timeline", "aria-hidden": "true" }, ...timed.map((s) => {
            const a = (toMin(s.start) - 360 + 1440) % 1440
            return el("span", { class: "adm-timeline-bar", style: `left:${(a / 1440) * 100}%;width:${(shiftLength(s) / 1440) * 100}%`, title: `${s.name}: ${s.start} - ${s.end}`, text: s.name.replace(" Turno", "") })
          }), ...[6, 9, 12, 15, 18, 21, 24, 27, 30].map((h) => el("span", { class: "adm-timeline-tick", style: `left:${Math.min(97, Math.max(2, ((h * 60 - 360) / 1440) * 100))}%`, text: `${String(h % 24).padStart(2, "0")}h` }))),
          table(["Turno", "Início", "Fim", "Duração", "Observação", "Situação", ""], list.map((s) => {
            const dur = s.start && s.end ? shiftLength(s) : null
            return withFlag([el("strong", { text: s.name }), s.start || "-", s.end ? `${s.end}${overnight(s) ? " (dia seguinte)" : ""}` : "-", dur ? `${Math.floor(dur / 60)}h${String(dur % 60).padStart(2, "0")}` : "-", s.note || (s.start ? "-" : "Horário a definir"),
              status(s.active, false), rowActions(s, { remove: false })], s.active === false)
          })))
      },
      form(row) {
        const start = input("adm-f-start", row.start, { type: "time" })
        const end = input("adm-f-end", row.end, { type: "time" })
        const note = input("adm-f-note", row.note, { maxlength: "120" })
        return [el("div", { class: "adm-form" }, field(start, "Início"), field(end, "Fim", "", "Se o turno passa da meia-noite, o fim fica antes do início (ex.: 21:00 - 01:00)."), field(note, "Observação", "adm-wide"), activeCheck(row.active, "Ativo (o turno recebe pacientes)")), () => {
          if (Boolean(start.value) !== Boolean(end.value)) return "Informe o início e o fim, ou deixe os dois em branco."
          if (start.value && (!timeOk(start.value) || !timeOk(end.value))) return "Use horas no formato hh:mm."
          if (start.value && start.value === end.value) return "O fim precisa ser diferente do início."
          if (start.value && shiftLength({ start: start.value, end: end.value }) > 8 * 60) return "O turno tem no máximo 8 horas. Fim antes do início quer dizer que o turno passa da meia-noite."
          A.upsert("shifts", { id: row.id, start: start.value, end: end.value, note: note.value.trim(), active: $("adm-f-active").checked })
          return ""
        }]
      },
    },
    machines: {
      eyebrow: "Unidade", title: "Máquinas de hemodiálise",
      intro: "Uma máquina por cadeira. Máquina em manutenção ou desativada gera aviso ao iniciar a sessão; a máquina exclusiva para hepatite B (RDC ANVISA 11/2014, art. 16 e 17) avisa para conferir a sorologia.",
      add: "Nova máquina",
      view() {
        const f = filters.machines
        const all = A.data().machines
        const list = all.filter((m) => (!f.room || m.room === f.room) && (!f.status || m.status === f.status) && (!f.q || normalize(`${m.name} ${m.serial} ${m.model}`).includes(normalize(f.q))))
          .sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }))
        const label = (list, k) => (list.find(([v]) => v === k) || [, k])[1]
        return el("div", { class: "adm-stackv" },
          summary([["máquinas", all.length], ["em uso", all.filter((m) => m.status === "ativa").length, "is-ok"], ["em manutenção", all.filter((m) => m.status === "manutencao").length, "is-warn"],
            ["desativadas", all.filter((m) => m.status === "inativa").length], ["exclusivas", all.filter((m) => m.use !== "geral").length, "is-info"]]),
          toolbar(searchBox("adm-m-q", "Buscar máquina, nº de série ou modelo", f.q, (v) => { f.q = v; rerenderList() }),
            filterSelect("adm-m-room", "Sala", [["", "Todas as salas"], ...A.data().rooms.map((r) => [r.name, r.name])], f.room, (v) => { f.room = v; render() }),
            filterSelect("adm-m-status", "Situação", [["", "Todas as situações"], ...A.MACHINE_STATUS], f.status, (v) => { f.status = v; render() })),
          el("div", { "data-list": "" }, table(["Máquina", "Sala", "Nº de série", "Modelo", "Uso", "Última manutenção", "Situação", ""], list.map((m) => withFlag([
            el("span", {}, el("strong", { text: m.name }), m.extraChair ? el("small", { class: "adm-muted d-block", text: "Cadeira extra" }) : ""), m.room, m.serial || "-", m.model || "-",
            m.use === "geral" ? "Uso geral" : badge("info", label(A.MACHINE_USE, m.use)), m.lastMaintenance ? formatDate(m.lastMaintenance) : "-",
            el("span", {}, badge(m.status === "ativa" ? "ok" : m.status === "manutencao" ? "warn" : "off", label(A.MACHINE_STATUS, m.status)), m.note ? el("small", { class: "adm-muted d-block", text: m.note }) : ""),
            rowActions(m, { toggle: false }),
          ], m.status === "inativa")), { scroll: true, label: "Máquinas" })))
      },
      form(row = {}) {
        const room = select("adm-f-room", A.data().rooms.map((r) => [r.name, r.name]), row.room || filters.machines.room || A.data().rooms[0]?.name)
        const name = input("adm-f-name", row.name, { maxlength: "30", placeholder: "Ex.: Máquina 14" })
        const serial = input("adm-f-serial", row.serial, { maxlength: "40" })
        const model = input("adm-f-model", row.model, { maxlength: "60", placeholder: "Fabricante e modelo" })
        const st = select("adm-f-status", A.MACHINE_STATUS, row.status || "ativa")
        const use = select("adm-f-use", A.MACHINE_USE, row.use || "geral")
        const last = input("adm-f-last", row.lastMaintenance, { type: "date", max: todayIso() })
        const note = input("adm-f-note", row.note, { maxlength: "120" })
        return [el("div", { class: "adm-form" }, field(name, "Identificação *"), field(room, "Sala *"), field(serial, "Nº de série"), field(model, "Modelo"),
          field(st, "Situação *"), field(use, "Uso", "", "Exclusiva: só para pacientes com essa sorologia."), field(last, "Última manutenção"), field(note, "Observação"),), () => {
          let n = name.value.trim()
          if (/^\d+$/.test(n)) n = `Máquina ${n.padStart(2, "0")}`
          if (!n) return "Informe a identificação da máquina."
          if (A.data().machines.some((m) => m.id !== row.id && m.room === room.value && same(m.name, n))) return "Essa sala já tem uma máquina com esse nome."
          if (last.value && last.value > todayIso()) return "A última manutenção não pode ser no futuro."
          A.upsert("machines", { id: row.id, name: n, room: room.value, serial: serial.value.trim(), model: model.value.trim(), status: st.value, use: use.value, lastMaintenance: last.value, note: note.value.trim() })
          return ""
        }]
      },
    },
    dialyzers: {
      eyebrow: "Unidade", title: "Dialisadores",
      intro: "Modelos que aparecem na Prescrição de HD, em Sessões do dia e em Sessões de Diálise. O reúso vai até 20 vezes por dialisador; com sorologia positiva ou desconhecida, o dialisador é de uso único (RDC ANVISA 11/2014, art. 27).",
      add: "Novo dialisador",
      view() {
        const f = filters.dialyzers
        const all = A.data().dialyzers
        const list = all.filter((d) => !f.q || normalize(`${d.name} ${d.maker}`).includes(normalize(f.q)))
        const flux = { alto: "Alto fluxo", baixo: "Baixo fluxo" }
        return el("div", { class: "adm-stackv" },
          summary([["modelos ativos", all.filter((d) => d.active !== false).length, "is-ok"], ["alto fluxo", all.filter((d) => d.flux === "alto").length], ["pediátricos", all.filter((d) => d.audience === "pediatrico").length], ["limite de reúso", 20, "is-info"]]),
          toolbar(searchBox("adm-d-q", "Buscar modelo ou fabricante", f.q, (v) => { f.q = v; rerenderList() })),
          el("div", { "data-list": "" }, table(["Modelo", "Fabricante", "Superfície", "Fluxo", "Indicação", "Situação", ""], list.map((d) => withFlag([
            el("strong", { text: d.name }), d.maker || "-", d.surface ? `${String(d.surface).replace(".", ",")} m²` : "-", flux[d.flux] || "-",
            d.audience === "pediatrico" ? badge("info", "Pediátrico") : "Adulto", status(d.active, d.builtin), rowActions(d, { remove: !d.builtin }),
          ], d.active === false)), { scroll: true, label: "Dialisadores" })))
      },
      form(row = {}) {
        const name = input("adm-f-name", row.name, { maxlength: "40" })
        const maker = input("adm-f-maker", row.maker, { maxlength: "60" })
        const surface = input("adm-f-surface", row.surface ? String(row.surface).replace(".", ",") : "", { inputmode: "decimal", maxlength: "4", placeholder: "Ex.: 1,8" })
        const flux = select("adm-f-flux", [["", "Não informado"], ["alto", "Alto fluxo"], ["baixo", "Baixo fluxo"]], row.flux || "")
        const audience = select("adm-f-audience", [["adulto", "Adulto"], ["pediatrico", "Pediátrico"]], row.audience || "adulto")
        return [el("div", { class: "adm-form" }, field(name, "Modelo *"), field(maker, "Fabricante"), field(surface, "Superfície (m²)"), field(flux, "Fluxo"), field(audience, "Indicação"), activeCheck(row.active, "Ativo (aparece nas listas de dialisador)")), () => {
          const n = name.value.trim()
          if (!n) return "Informe o modelo."
          if (sameName(A.data().dialyzers, n, row.id)) return "Esse modelo já está cadastrado."
          const s = surface.value.trim().replace(",", ".")
          if (s && !(Number(s) >= 0.1 && Number(s) <= 3)) return "A superfície vai de 0,1 a 3 m²."
          A.upsert("dialyzers", { id: row.id, name: n, maker: maker.value.trim(), surface: s, flux: flux.value, audience: audience.value, active: $("adm-f-active").checked })
          return ""
        }]
      },
    },

    // ----- Cadastros clínicos -----
    programs: {
      eyebrow: "Cadastros clínicos", title: "Programas de tratamento",
      intro: "Os programas do sistema são usados nas regras (HD, HD Pediátrica, Alta, Óbito...) e não podem ser alterados. Os cadastrados aqui aparecem no campo Programa de tratamento atual.",
      add: "Novo programa",
      view() {
        const count = (name) => (window.HuNefroMock?.patients || []).filter((p) => p.program === name).length
        const builtins = A.BUILTIN_PROGRAMS.map((name) => [el("strong", { text: name }), "-", String(count(name)), status(true, true), ""])
        const custom = A.data().programs.map((p) => withFlag([el("strong", { text: p.name }), p.description || "-", String(count(p.name)), status(p.active), rowActions(p)], p.active === false))
        return table(["Programa", "Descrição", "Pacientes", "Situação", ""], [...builtins, ...custom])
      },
      form(row = {}) {
        const name = input("adm-f-name", row.name, { maxlength: "60" })
        const description = input("adm-f-description", row.description, { maxlength: "160" })
        return [el("div", { class: "adm-form" }, field(name, "Nome do programa *", "adm-wide"), field(description, "Descrição", "adm-wide"), activeCheck(row.active)), () => {
          const n = name.value.trim()
          if (!n) return "Informe o nome do programa."
          if (A.BUILTIN_PROGRAMS.some((b) => same(b, n)) || sameName(A.data().programs, n, row.id)) return "Já existe um programa com esse nome."
          A.upsert("programs", { id: row.id, name: n, description: description.value.trim(), active: $("adm-f-active").checked })
          return ""
        }]
      },
    },
    procedures: {
      eyebrow: "Cadastros clínicos", title: "Procedimentos SIGTAP",
      intro: "Procedimentos da unidade. Os três de hemodiálise vêm do sistema e são escolhidos automaticamente na APAC, conforme a idade e a sorologia do paciente.",
      add: "Novo procedimento",
      view() {
        const builtins = Object.values(C.SIGTAP_HD).map((p) => [el("code", { text: p.code }), p.name, String(p.maxPerWeek), status(true, true), ""])
        const custom = A.data().procedures.map((p) => withFlag([el("code", { text: p.code }), p.name, p.maxPerWeek ? String(p.maxPerWeek) : "-", status(p.active), rowActions(p)], p.active === false))
        return table(["Código SIGTAP", "Procedimento", "Máx. por semana", "Situação", ""], [...builtins, ...custom])
      },
      form(row = {}) {
        const code = input("adm-f-code", row.code, { placeholder: "00.00.00.000-0", inputmode: "numeric", maxlength: "14" })
        const name = input("adm-f-name", row.name, { maxlength: "200" })
        const max = input("adm-f-max", row.maxPerWeek, { inputmode: "numeric", maxlength: "2" })
        code.addEventListener("blur", () => { const d = digits(code.value); if (d.length === 10) code.value = d.replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d)$/, "$1.$2.$3.$4-$5") })
        return [el("div", { class: "adm-form" }, field(code, "Código SIGTAP *"), field(max, "Máximo de sessões por semana"), field(name, "Nome do procedimento *", "adm-wide"), activeCheck(row.active)), () => {
          code.dispatchEvent(new Event("blur"))
          if (!/^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(code.value)) return "O código SIGTAP tem 10 dígitos (00.00.00.000-0)."
          if (!name.value.trim()) return "Informe o nome do procedimento."
          if (max.value && !(Number(max.value) >= 1 && Number(max.value) <= 7)) return "O máximo por semana vai de 1 a 7."
          const taken = [...Object.values(C.SIGTAP_HD), ...A.data().procedures.filter((p) => p.id !== row.id)].some((p) => p.code === code.value)
          if (taken) return "Já existe um procedimento com esse código."
          A.upsert("procedures", { id: row.id, code: code.value, name: name.value.trim().toUpperCase(), maxPerWeek: max.value ? Number(max.value) : null, active: $("adm-f-active").checked })
          return ""
        }]
      },
    },
    eventTypes: {
      eyebrow: "Cadastros clínicos", title: "Tipos de evento",
      intro: "Tipos que aparecem em Eventos e Diagnósticos. Os do sistema podem ser desativados, mas não excluídos. \"Outro\" fica sempre por último.",
      add: "Novo tipo",
      view() {
        const tabs = el("div", { class: "md-tabs adm-subtabs", role: "tablist", "aria-label": "Categoria do evento" }, ...A.EVENT_KINDS.map(([k, l]) => el("button", {
          type: "button", class: "md-tab", role: "tab", "aria-selected": String(k === eventKind), tabindex: k === eventKind ? "0" : "-1", "data-kind": k, text: l,
        })))
        tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (b) { eventKind = b.dataset.kind; render() } })
        const builtins = A.BASE_EVENT_TYPES[eventKind].map((name) => {
          const hidden = A.isHiddenEventType(eventKind, name)
          const toggle = canEdit() && !/^outr[oa]$/i.test(name) ? el("div", { class: "adm-actions" }, btn(hidden ? "Ativar" : "Desativar", { "data-builtin": name }, "outline-secondary")) : ""
          return withFlag([el("strong", { text: name }), status(!hidden, true), toggle], hidden)
        })
        const custom = A.data().eventTypes.filter((t) => t.kind === eventKind).map((t) => withFlag([el("strong", { text: t.name }), status(t.active), rowActions(t)], t.active === false))
        return el("div", { class: "adm-stackv" }, tabs, table(["Tipo", "Situação", ""], [...builtins, ...custom], { scroll: true, label: "Tipos de evento" }))
      },
      form(row = {}) {
        const kind = select("adm-f-kind", A.EVENT_KINDS, row.kind || eventKind)
        const name = input("adm-f-name", row.name, { maxlength: "80" })
        return [el("div", { class: "adm-form" }, field(kind, "Categoria *"), field(name, "Nome do tipo *"), activeCheck(row.active)), () => {
          const n = name.value.trim()
          if (!n) return "Informe o nome do tipo."
          const exists = A.BASE_EVENT_TYPES[kind.value].some((b) => same(b, n)) || sameName(A.data().eventTypes.filter((t) => t.kind === kind.value), n, row.id)
          if (exists) return "Esse tipo já existe nessa categoria."
          A.upsert("eventTypes", { id: row.id, kind: kind.value, name: n, active: $("adm-f-active").checked })
          eventKind = kind.value
          return ""
        }]
      },
    },

    // ----- Modelos de texto -----
    patterns: {
      eyebrow: "Modelos de texto", title: "Padrões de texto da evolução",
      intro: "Botões de Padrões do Novo registro da evolução. O texto pode usar campos entre chaves, como {paciente}, que são trocados pelos dados do prontuário. O que faltar sai como [preencher].",
      add: "Novo padrão",
      view() {
        const builtins = (EM?.PATTERNS || []).filter((p) => !p.custom).map((p) => [el("strong", { text: p.name }), p.hint || "-", status(true, true), ""])
        const custom = A.data().patterns.map((p) => withFlag([el("strong", { text: p.name }), p.hint || "-", status(p.active), rowActions(p, { extra: [btn("Duplicar", { "data-copy": p.id }, "outline-secondary")] })], p.active === false))
        return table(["Padrão", "Descrição", "Situação", ""], [...builtins, ...custom])
      },
      form: (row = {}) => textForm("patterns", row),
    },
    laudoModels: {
      eyebrow: "Modelos de texto", title: "Modelos de laudo",
      intro: "Modelos de preenchimento rápido da aba Laudos. Linha curta terminada em \":\" vira título de seção, e linha iniciada por \"- \" vira item de lista. Os campos entre chaves são trocados pelos dados do prontuário.",
      add: "Novo modelo",
      view() {
        const layoutName = (id) => (LM?.LAYOUTS.find((l) => l.id === id) || {}).name || "-"
        const builtins = (LM?.MODELS || []).filter((m) => !m.custom).map((m) => [el("strong", { text: m.name }), m.hint || "-", layoutName(m.layout), status(true, true), ""])
        const custom = A.data().laudoModels.map((m) => withFlag([el("strong", { text: m.name }), m.hint || "-", layoutName(m.layout), status(m.active), rowActions(m, { extra: [btn("Duplicar", { "data-copy": m.id }, "outline-secondary")] })], m.active === false))
        return table(["Modelo", "Descrição", "Cabeçalho", "Situação", ""], [...builtins, ...custom])
      },
      form: (row = {}) => textForm("laudoModels", row),
    },
  }

  // Formulário dos padrões da evolução e dos modelos de laudo: texto com campos e prévia.
  function textForm(list, row) {
    const isLaudo = list === "laudoModels"
    const name = input("adm-f-name", row.name, { maxlength: "40" })
    const hint = input("adm-f-hint", row.hint, { maxlength: "120" })
    const title = isLaudo && input("adm-f-title", row.title, { maxlength: "80", placeholder: "Ex.: DECLARAÇÃO DE COMPARECIMENTO" })
    const layout = isLaudo && select("adm-f-layout", (LM?.LAYOUTS || []).map((l) => [l.id, `${l.name} (${l.hint})`]), row.layout || "padrao")
    const text = el("textarea", { class: "form-control adm-text", id: "adm-f-text", rows: "9" })
    text.value = row.text || ""
    const preview = el("pre", { class: "adm-preview", id: "adm-preview", "aria-live": "polite" })
    const refresh = () => { preview.textContent = A.fill(text.value, SAMPLE) || "A prévia aparece aqui." }
    text.addEventListener("input", refresh)
    refresh()
    const tokens = el("div", { class: "adm-tokens", role: "group", "aria-label": "Inserir campo do prontuário" },
      ...A.TOKENS.map(([key, label]) => el("button", { type: "button", class: "adm-token", "data-token": key, title: label, text: `{${key}}` })))
    tokens.addEventListener("click", (event) => {
      const b = event.target.closest("[data-token]")
      if (!b) return
      const insert = `{${b.dataset.token}}`
      const start = text.selectionStart ?? text.value.length
      text.setRangeText(insert, start, text.selectionEnd ?? start, "end")
      text.focus()
      refresh()
    })
    const body = el("div", { class: "adm-form" },
      field(name, isLaudo ? "Nome do modelo *" : "Nome do botão *"),
      field(hint, "Descrição"),
      ...(isLaudo ? [field(title, "Título impresso"), field(layout, "Cabeçalho")] : []),
      el("div", { class: "field-block adm-wide" }, el("span", { class: "field-label", text: "Campos do prontuário (clique para inserir)" }), tokens),
      field(text, "Texto *", "adm-wide"),
      el("div", { class: "field-block adm-wide" }, el("span", { class: "field-label", text: "Prévia com um paciente fictício" }), preview),
      activeCheck(row.active))
    return [body, () => {
      const n = name.value.trim()
      if (!n) return "Informe o nome."
      if (!text.value.trim()) return "Escreva o texto."
      const builtinNames = isLaudo ? (LM?.MODELS || []).filter((m) => !m.custom).map((m) => m.name) : (EM?.PATTERNS || []).filter((p) => !p.custom).map((p) => p.name)
      if (builtinNames.some((b) => same(b, n)) || sameName(A.data()[list], n, row.id)) return "Já existe um item com esse nome."
      const unknown = [...text.value.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => !A.TOKENS.some(([t]) => t === k))
      if (unknown.length) return `Campo desconhecido: {${unknown[0]}}. Use os campos da lista.`
      A.upsert(list, { id: row.id, name: n, hint: hint.value.trim(), text: text.value.replace(/\s+$/, ""), active: $("adm-f-active").checked,
        ...(isLaudo ? { title: title.value.trim(), layout: layout.value } : {}) })
      return ""
    }]
  }

  // ---------- Render ----------
  function renderMenu() {
    const menu = $("adm-menu")
    menu.replaceChildren(...MENU.map(([group, items]) => el("div", { class: "adm-menu-section" },
      el("span", { class: "adm-menu-group", text: group }),
      ...items.map(([k, label]) => {
        const b = el("button", { type: "button", class: `adm-nav-item ${k === area ? "active" : ""}`, "data-area": k, ...(k === area ? { "aria-current": "page" } : {}) })
        const i = el("span", { class: "adm-nav-icon", "aria-hidden": "true" })
        i.innerHTML = icon(ICONS[k] || "") // ícone fixo do código, sem dados do usuário
        b.append(i, el("span", { text: label }))
        if (AREA_PERMISSION[k] && !canEdit(k)) b.append(el("span", { class: "adm-nav-lock", title: "Somente leitura para o seu perfil", text: "leitura" }))
        return b
      }))))
    const admin = SS?.can("adm-acesso")
    $("adm-side-tools").hidden = !admin
  }
  function render() {
    const cfg = AREAS[area]
    renderMenu()
    const editable = canEdit()
    $("adm-heading").replaceChildren(
      el("div", {}, el("span", { class: "eyebrow", text: cfg.eyebrow }), el("h1", { text: cfg.title }), el("p", { text: cfg.intro })),
      editable && cfg.add ? el("button", { type: "button", class: "btn btn-primary", id: "adm-add", text: `+ ${cfg.add}` }) : "")
    const needs = AREA_PERMISSION[area]
    $("adm-readonly").hidden = !needs || editable
    if (needs && !editable) {
      const who = Object.entries(PROFILES).filter(([k]) => (SS?.permissions?.()[needs] || []).includes(k)).map(([, l]) => l).join(", ")
      $("adm-readonly-text").textContent = `Seu perfil, ${SS?.profileLabel?.() || "-"}, só consulta esta área. Podem alterar: ${who || "ninguém"}. Para testar, troque o perfil no cabeçalho.`
    }
    $("adm-view").replaceChildren(cfg.view())
    document.title = `${cfg.title} | Gestão | Hu-Nefro`
  }
  // Busca: refaz só a lista, para não tirar o foco do campo.
  function rerenderList() {
    const fresh = AREAS[area].view().querySelector("[data-list]")
    const current = $("adm-view").querySelector("[data-list]")
    if (fresh && current) current.replaceWith(fresh)
  }
  function setArea(value, focus = true) {
    if (!AREAS[value]) return
    area = value
    try { sessionStorage.setItem(AREA_KEY, area) } catch { /* sem armazenamento */ }
    const url = new URL(location.href)
    url.searchParams.set("section", area)
    history.replaceState(null, "", url)
    render()
    if (focus) $("adm-content").focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }
  $("adm-menu").addEventListener("click", (event) => { const b = event.target.closest("[data-area]"); if (b) setArea(b.dataset.area) })
  document.addEventListener("hunefro:adm-section", (e) => setArea(e.detail))

  // Ações das tabelas e do cabeçalho.
  document.querySelector(".adm-main").addEventListener("click", (event) => {
    const cfg = AREAS[area]
    const b = event.target.closest("button")
    if (!b || !canEdit()) return
    if (b.id === "adm-add" && cfg.form) { const [body, submit] = cfg.form(); openDialog(cfg.add, body, submit); return }
    if (b.dataset.builtin) { A.toggleBuiltinEventType(eventKind, b.dataset.builtin); render(); return }
    const rows = A.data()[area]
    const id = Number(b.dataset.edit || b.dataset.toggle || b.dataset.remove || b.dataset.copy)
    const row = Array.isArray(rows) ? rows.find((r) => r.id === id) : null
    if (!row) return
    const label = row.room && area === "machines" ? `${row.room} - ${row.name}` : row.name
    if (b.dataset.edit) { const [body, submit] = cfg.form({ ...row }); openDialog(`Editar: ${label}`, body, submit) }
    else if (b.dataset.copy) { const [body, submit] = cfg.form({ ...row, id: undefined, name: `${row.name} (cópia)`.slice(0, 40) }); openDialog(`Duplicar: ${row.name}`, body, submit) }
    else if (b.dataset.toggle) {
      A.upsert(area, { id, active: row.active === false })
      render()
    } else if (b.dataset.remove) {
      confirmBox("Excluir cadastro", `Excluir "${label}"? Os registros antigos do prontuário que usam este item continuam com o texto gravado. Para só esconder das listas, use Desativar.`, () => A.remove(area, id))
    }
  })

  // ---------- Configuração: exportar, importar e restaurar ----------
  $("adm-export").addEventListener("click", () => {
    const a = el("a", { href: URL.createObjectURL(new Blob([A.exportJson()], { type: "application/json" })), download: `hunefro-configuracao-${todayIso()}.json` })
    document.body.append(a); a.click(); a.remove()
    toast("Configuração exportada.")
  })
  $("adm-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const error = A.importJson(await file.text())
    toast(error || "Configuração importada.")
    render()
  })
  $("adm-reset").addEventListener("click", () => confirmBox("Restaurar configuração inicial",
    "Voltar todos os cadastros da Gestão ao padrão inicial? Programas, procedimentos, padrões e modelos cadastrados serão apagados. O histórico de alterações é mantido. Exporte a configuração antes, se quiser guardar uma cópia.",
    () => { A.resetAll(); toast("Configuração inicial restaurada.") }, "Restaurar"))

  document.addEventListener("hunefro:perfil", render)
  if (new URLSearchParams(location.search).get("section") !== area) {
    const url = new URL(location.href); url.searchParams.set("section", area); history.replaceState(null, "", url)
  }
  render()
})()
