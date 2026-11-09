// Painel de gestão da Gestão: indicadores do setor, dos pacientes, da equipe e dos recursos,
// calculados com as sessões, faltas, escala, prontuários e cadastros guardados no navegador.
// PROVISÓRIO: quando a API existir, os mesmos números virão de consultas no backend.
(() => {
  "use strict"

  const A = window.HuNefroAdmin
  const C = window.HuNefroCatalogos
  const M = window.HuNefroMock
  const S = window.HuNefroSessoesStore
  const F = window.HuNefroFaltasStore
  const X = window.HuNefroTurnosExtrasStore
  const CM = window.HuNefroComunicacoes
  const { el, todayIso, formatDate, addDays, normalize } = window.HuNefroUI
  if (!A || !M || !S) return

  const UF_RATE_LIMIT = 13 // mL/kg/h: taxa de ultrafiltração usada como alerta nas diretrizes de HD
  const REUSE_ALERT = 17 // aviso quando o dialisador chega perto do limite de 20 usos
  const PERIODS = [[7, "Últimos 7 dias"], [14, "Últimos 14 dias"], [30, "Últimos 30 dias"], [90, "Últimos 90 dias"]]
  const TABS = [["geral", "Visão geral"], ["sessoes", "Sessões e faltas"], ["pacientes", "Pacientes"], ["equipe", "Equipe"], ["recursos", "Máquinas e dialisadores"]]
  const WEEK_GROUPS = [["seg-qua-sex", "Seg, Qua, Sex", [1, 3, 5]], ["ter-qui-sab", "Ter, Qui, Sáb", [2, 4, 6]]]

  const state = { period: 14, shift: "", room: "", tab: "geral" }
  try { Object.assign(state, JSON.parse(sessionStorage.getItem("huNefroAdminPainel") || "{}")) } catch { /* sem armazenamento */ }
  const keep = () => { try { sessionStorage.setItem("huNefroAdminPainel", JSON.stringify(state)) } catch { /* sem armazenamento */ } }

  // ---------- Números ----------
  const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null }
  const fmt = (n, digits = 0) => (n == null || !Number.isFinite(n) ? "-" : n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }))
  const pct = (part, total, digits = 1) => (total ? `${fmt((part / total) * 100, digits)}%` : "-")
  const minutesOf = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null }
  const duration = (s) => { const a = minutesOf(s.start); const b = minutesOf(s.end); return a == null || b == null ? null : (b - a + 1440) % 1440 }
  const ufRate = (s) => { const uf = num(s.uf); const w = num(s.dryWeight); const d = duration(s); return uf && w && d ? uf / w / (d / 60) : null }
  const daysOf = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out }

  function compute() {
    const today = todayIso()
    const from = addDays(today, -(state.period - 1))
    const days = daysOf(from, today)
    const inRange = (d) => d >= from && d <= today
    const matchPlace = (x) => (!state.shift || x.shift === state.shift) && (!state.room || x.room === state.room)
    const sessions = S.all()
    const absences = F ? F.all() : []
    const done = sessions.filter((s) => inRange(s.date) && s.state === "concluida" && matchPlace(s))
    const running = sessions.filter((s) => s.date === today && s.state === "em-andamento" && matchPlace(s))
    const faltas = absences.filter((a) => a.kind === "falta" && inRange(a.date) && matchPlace(a))
    const remarcacoes = absences.filter((a) => a.kind === "remarcacao" && inRange(a.date) && matchPlace(a))
    // Previstas pela escala do Programa de Tratamento (sem domingos), até ontem; hoje conta só o que já terminou ou faltou.
    const expected = days.filter((d) => d < today).reduce((n, d) => n + M.scheduledOn(d).filter(matchPlace).length, 0)
    const doneBeforeToday = done.filter((s) => s.date < today).length
    const faltasBeforeToday = faltas.filter((a) => a.date < today).length
    const withComplication = done.filter((s) => String(s.complications || "").trim())
    const hypotension = done.filter((s) => /hipotens/i.test(s.complications || ""))
    const rates = done.map(ufRate).filter((r) => r != null)
    const highUf = rates.filter((r) => r > UF_RATE_LIMIT)
    const durations = done.map(duration).filter((d) => d != null)
    const ufs = done.map((s) => num(s.uf)).filter((v) => v != null)
    const extras = X ? X.all().filter((x) => inRange(x.date)) : []

    // Sessões por dia.
    const perDay = days.map((d) => ({
      date: d, done: done.filter((s) => s.date === d).length + running.filter((s) => s.date === d).length,
      faltas: faltas.filter((a) => a.date === d).length, expected: M.scheduledOn(d).filter(matchPlace).length,
    }))

    // Faltas por motivo e por turno.
    const countBy = (list, key) => Object.entries(list.reduce((acc, item) => { const k = key(item) || "Não informado"; acc[k] = (acc[k] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])
    const faltasByReason = countBy(faltas, (a) => a.reason)
    const faltasByShift = countBy(faltas, (a) => a.shift)
    const pendingMakeup = absences.filter((a) => a.kind === "falta" && !a.makeup && a.date <= today && (!state.shift || a.shift === state.shift) && (!state.room || a.room === state.room))

    // Ocupação das cadeiras: pacientes na escala / cadeiras fixas, por turno, sala e grupo de dias.
    const rooms = A.data().rooms.filter((r) => r.active !== false && !r.inpatient)
    const shifts = A.data().shifts.filter((s) => s.active !== false).map((s) => s.name)
    const occupancy = shifts.map((shift) => ({
      shift, cells: rooms.flatMap((r) => WEEK_GROUPS.map(([g, label, wd]) => {
        const used = M.schedule.filter((p) => p.shift === shift && p.room === r.name && wd.every((d) => p.days.includes(d))).length
        return { room: r.name, group: label, used, fixed: r.fixed, extra: r.extra }
      })),
    }))
    const capacity = rooms.reduce((n, r) => n + r.fixed, 0) * shifts.length * WEEK_GROUPS.length
    const scheduledSlots = M.schedule.filter((p) => rooms.some((r) => r.name === p.room) && shifts.includes(p.shift)).length

    // Pacientes.
    const scheduled = M.schedule.filter((p) => (!state.shift || p.shift === state.shift) && (!state.room || p.room === state.room))
    const patientIds = [...new Set(scheduled.map((p) => p.patientId))]
    const patients = patientIds.map((id) => M.patient(id)).filter(Boolean)
    const sero = Object.fromEntries(patientIds.map((id) => [id, M.serologyOf(id)]))
    const seroCount = (marker) => patientIds.filter((id) => sero[id].positive.includes(marker)).length
    const seroUnknown = patientIds.filter((id) => sero[id].unknown.length).length
    const byAccess = { fav: 0, cateter: 0, outro: 0 }
    scheduled.forEach((p) => { byAccess[p.accessKind === "fav" ? "fav" : p.accessKind === "cateter" ? "cateter" : "outro"] += 1 })
    const temporaryCatheter = scheduled.filter((p) => /tempor/i.test(p.accessType || ""))
    const pediatric = scheduled.filter((p) => /pedi/i.test(p.method || ""))
    const programs = countBy(M.patients, (p) => p.program)
    const newPatients = M.patients.filter((p) => p.createdAt && p.createdAt.slice(0, 10) >= from)

    // Último uso do dialisador de cada paciente.
    const lastSession = {}
    sessions.forEach((s) => { const prev = lastSession[s.patientId]; if (!prev || s.date > prev.date || (s.date === prev.date && (s.start || "") > (prev.start || ""))) lastSession[s.patientId] = s })
    const nearLimit = patientIds.filter((id) => { const s = lastSession[id]; return s && !s.singleUse && num(s.usage) >= REUSE_ALERT })

    // Pacientes que pedem atenção: cada motivo é um sinal objetivo do período.
    const attention = patientIds.map((id) => {
      const p = M.patient(id)
      const sch = M.scheduleOf(id) || {}
      const mine = done.filter((s) => s.patientId === id)
      const myFaltas = faltas.filter((a) => a.patientId === id)
      const reasons = []
      if (myFaltas.length) reasons.push(["warn", `${myFaltas.length} ${myFaltas.length === 1 ? "falta" : "faltas"} no período`])
      if (pendingMakeup.some((a) => a.patientId === id)) reasons.push(["danger", "Falta sem reposição marcada"])
      if (/tempor/i.test(sch.accessType || "")) reasons.push(["danger", "Cateter temporário"])
      else if (sch.accessKind === "cateter") reasons.push(["warn", "Cateter de longa permanência"])
      if (sero[id].unknown.length) reasons.push(["warn", "Sorologia desconhecida"])
      const comp = mine.filter((s) => String(s.complications || "").trim()).length
      if (comp >= 2) reasons.push(["warn", `${comp} intercorrências`])
      const high = mine.filter((s) => (ufRate(s) || 0) > UF_RATE_LIMIT).length
      if (high >= 2) reasons.push(["warn", `UF acima de ${UF_RATE_LIMIT} mL/kg/h em ${high} sessões`])
      if (nearLimit.includes(id)) reasons.push(["info", `Dialisador no ${lastSession[id].usage}º uso de 20`])
      const score = reasons.reduce((n, [tone]) => n + (tone === "danger" ? 3 : tone === "warn" ? 2 : 1), 0)
      return { id, patient: p, sch, reasons, score }
    }).filter((r) => r.reasons.length && r.patient).sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name))

    // Equipe.
    const users = A.data().users
    const activeUsers = users.filter((u) => u.active !== false)
    const profiles = window.HuNefroSessao?.PROFILES || {}
    const usersByProfile = Object.entries(profiles).map(([k, label]) => [label, activeUsers.filter((u) => u.profile === k).length])
    const neverAccess = activeUsers.filter((u) => !u.lastAccess)
    const staleAccess = activeUsers.filter((u) => u.lastAccess && u.lastAccess.slice(0, 10) < addDays(today, -30))
    const profName = (id) => (C.PROFESSIONALS.find((p) => p.id === id) || {}).name || id || "Não informado"
    const byResponsible = countBy(done, (s) => profName(s.responsible))
    const perShiftDay = shifts.map((shift) => {
      const list = done.filter((s) => s.shift === shift)
      const daysWith = new Set(list.map((s) => s.date)).size
      const staff = new Set(list.map((s) => `${s.date}|${s.responsible}`)).size
      return { shift, perDay: daysWith ? list.length / daysWith : 0, perStaff: staff ? list.length / staff : 0 }
    }).filter((r) => r.perDay)
    const comms = CM ? CM.all() : []
    const openComms = comms.filter((c) => c.status !== "concluida")
    const overdue = comms.filter((c) => CM.isOverdue?.(c))
    const openEvaluations = comms.filter((c) => c.type === "avaliacao" && c.status !== "concluida")

    // Recursos.
    const machines = A.data().machines
    const machineStatus = A.MACHINE_STATUS.map(([k, label]) => [label, machines.filter((m) => m.status === k).length, k])
    const maintenance = machines.filter((m) => m.status === "manutencao")
    const dialyzerUse = countBy(done, (s) => s.dialyzer)
    const singleUse = done.filter((s) => s.singleUse).length
    const newDialyzers = done.filter((s) => s.newDialyzer && !s.singleUse).length

    return {
      today, from, days, done, running, faltas, remarcacoes, expected, doneBeforeToday, faltasBeforeToday, withComplication, hypotension, rates, highUf, durations, ufs, extras,
      perDay, faltasByReason, faltasByShift, pendingMakeup, occupancy, capacity, scheduledSlots, rooms, shifts,
      scheduled, patientIds, patients, seroCount, seroUnknown, byAccess, temporaryCatheter, pediatric, programs, newPatients, nearLimit, attention,
      users, activeUsers, usersByProfile, neverAccess, staleAccess, byResponsible, perShiftDay, openComms, overdue, openEvaluations,
      machines, machineStatus, maintenance, dialyzerUse, singleUse, newDialyzers,
    }
  }

  // ---------- Peças visuais ----------
  const tipEl = () => document.getElementById("adm-tip")
  function bindTips(root) {
    const show = (event) => {
      const t = event.target.closest("[data-tip]")
      const tip = tipEl()
      if (!t || !tip) return
      tip.textContent = t.dataset.tip
      tip.hidden = false
      const r = t.getBoundingClientRect()
      const x = event.clientX || r.left + r.width / 2
      const y = event.clientY || r.top
      tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, x + 12))}px`
      tip.style.top = `${Math.max(8, y - tip.offsetHeight - 12)}px`
    }
    const hide = () => { const tip = tipEl(); if (tip) tip.hidden = true }
    root.addEventListener("mousemove", show)
    root.addEventListener("focusin", show)
    root.addEventListener("mouseleave", hide)
    root.addEventListener("focusout", hide)
  }
  function kpi(label, value, detail, tone = "", help = "") {
    return el("article", { class: `adm-kpi ${tone ? `is-${tone}` : ""}`, ...(help ? { "data-tip": help, tabindex: "0" } : {}) },
      el("span", { class: "adm-kpi-label", text: label }),
      el("strong", { class: "adm-kpi-value", text: value }),
      el("span", { class: "adm-kpi-detail", text: detail || "" }))
  }
  const card = (title, sub, ...body) => el("section", { class: "adm-card" },
    el("header", { class: "adm-card-head" }, el("h3", { text: title }), sub ? el("p", { text: sub }) : ""),
    el("div", { class: "adm-card-body" }, ...body))
  const emptyNote = (text) => el("p", { class: "ev-empty", text })
  // Barras horizontais (uma série): rótulo, barra e valor, com dica ao passar o mouse.
  function hbars(rows, { unit = "", max, tone = "", total } = {}) {
    if (!rows.length) return emptyNote("Sem dados no período.")
    const top = max || Math.max(...rows.map(([, v]) => v), 1)
    return el("div", { class: "adm-hbars", role: "list" }, ...rows.map(([label, value]) => {
      const share = total ? ` (${pct(value, total)})` : ""
      return el("div", { class: "adm-hbar", role: "listitem", tabindex: "0", "data-tip": `${label}: ${fmt(value)}${unit}${share}` },
        el("span", { class: "adm-hbar-label", text: label }),
        el("span", { class: "adm-hbar-track", "aria-hidden": "true" }, el("span", { class: `adm-hbar-fill ${tone}`, style: `width:${Math.max(2, (value / top) * 100)}%` })),
        el("span", { class: "adm-hbar-value", text: `${fmt(value)}${unit}${share}` }))
    }))
  }
  // Colunas por dia: sessões realizadas (barra) e faltas (marcador laranja com o número).
  function dayColumns(perDay) {
    const top = Math.max(...perDay.map((d) => Math.max(d.done, d.expected)), 1)
    const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    const showEvery = perDay.length > 31 ? 7 : perDay.length > 14 ? 2 : 1
    return el("div", { class: "adm-chart" },
      el("div", { class: "adm-legend", "aria-hidden": "true" },
        el("span", { class: "adm-key is-done", text: "Sessões realizadas" }), el("span", { class: "adm-key is-expected", text: "Previstas na escala" }), el("span", { class: "adm-key is-miss", text: "Faltas" })),
      el("div", { class: "adm-cols", style: `--n:${perDay.length}`, role: "img", "aria-label": `Sessões por dia: ${perDay.map((d) => `${formatDate(d.date)} ${d.done} realizadas, ${d.faltas} faltas`).join("; ")}` },
        ...perDay.map((d, i) => {
          const w = M.weekday(d.date)
          return el("div", { class: `adm-col ${w === 0 ? "is-sunday" : ""}`, tabindex: "0", "data-tip": `${wd[w]} ${formatDate(d.date)}: ${d.done} realizadas de ${d.expected} previstas, ${d.faltas} ${d.faltas === 1 ? "falta" : "faltas"}` },
            el("span", { class: "adm-col-plot" },
              d.expected ? el("span", { class: "adm-col-expected", style: `height:${(d.expected / top) * 100}%` }) : "",
              el("span", { class: "adm-col-bar", style: `height:${(d.done / top) * 100}%` }),
              d.faltas ? el("span", { class: "adm-col-miss", style: `bottom:calc(${(d.done / top) * 100}% + 4px)`, text: String(d.faltas) }) : ""),
            el("span", { class: "adm-col-label", text: i % showEvery === 0 ? `${d.date.slice(8)}/${d.date.slice(5, 7)}` : "" }))
        })))
  }
  // Ocupação: tabela de calor (um tom, do claro ao escuro) com pacientes / cadeiras fixas.
  function occupancyTable(occ) {
    if (!occ.length || !occ[0].cells.length) return emptyNote("Cadastre salas e turnos ativos para ver a ocupação.")
    const head = occ[0].cells
    return el("div", { class: "table-responsive adm-heat-wrap" }, el("table", { class: "table adm-heat" },
      el("thead", {},
        el("tr", {}, el("th", { scope: "col", rowspan: "2", text: "Turno" }), ...[...new Set(head.map((c) => c.room))].map((r) => el("th", { scope: "colgroup", colspan: String(WEEK_GROUPS.length), text: r }))),
        el("tr", {}, ...head.map((c) => el("th", { scope: "col", text: c.group })))),
      el("tbody", {}, ...occ.map((row) => el("tr", {}, el("th", { scope: "row", text: row.shift }),
        ...row.cells.map((c) => {
          const ratio = c.fixed ? c.used / c.fixed : 0
          const level = c.used > c.fixed ? "over" : String(Math.min(5, Math.ceil(ratio * 5)))
          return el("td", { class: `adm-heat-cell lv-${level}`, tabindex: "0", "data-tip": `${row.shift}, ${c.room}, ${c.group}: ${c.used} pacientes para ${c.fixed} cadeiras fixas (${pct(c.used, c.fixed, 0)})${c.used > c.fixed ? `, usando ${c.used - c.fixed} extra` : ""}` },
            el("strong", { text: `${c.used}/${c.fixed}` }), el("small", { text: pct(c.used, c.fixed, 0) }))
        }))))))
  }
  // Barra empilhada de partes de um todo (até 3 partes, cada uma com rótulo e valor à vista).
  function stack(parts) {
    const total = parts.reduce((n, [, v]) => n + v, 0)
    if (!total) return emptyNote("Sem dados.")
    return el("div", { class: "adm-stack-wrap" },
      el("div", { class: "adm-stack", role: "img", "aria-label": parts.map(([l, v]) => `${l}: ${v}`).join(", ") },
        ...parts.filter(([, v]) => v).map(([label, value, tone]) => el("span", { class: `adm-stack-part ${tone}`, style: `flex:${value}`, tabindex: "0", "data-tip": `${label}: ${value} (${pct(value, total)})` }))),
      el("ul", { class: "adm-stack-legend" }, ...parts.map(([label, value, tone]) => el("li", {}, el("span", { class: `adm-dot ${tone}`, "aria-hidden": "true" }), el("span", { text: label }), el("strong", { text: `${value} (${pct(value, total, 0)})` })))))
  }
  const chips = (reasons) => el("span", { class: "adm-chips" }, ...reasons.map(([tone, text]) => el("span", { class: `hn-badge hn-badge-${tone === "danger" ? "danger" : tone === "warn" ? "warn" : "info"}`, text })))
  const patientLink = (p) => el("a", { href: `prontuario.html?patient=${p.id}`, target: "_blank", rel: "noopener", text: p.name })

  function attentionTable(rows, limit) {
    if (!rows.length) return emptyNote("Nenhum paciente com sinal de atenção no período e nos filtros escolhidos.")
    const list = limit ? rows.slice(0, limit) : rows
    const compact = Boolean(limit)
    const headers = compact ? ["Paciente", "Motivos"] : ["Paciente", "Turno e sala", "Acesso", "Motivos"]
    return el("div", { class: "table-responsive adm-table-wrap hn-scroll-table", tabindex: "0", "aria-label": "Pacientes que pedem atenção, com rolagem" },
      el("table", { class: `table adm-table adm-attention align-middle ${compact ? "is-compact" : ""}` },
        el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", { scope: "col", text: h })))),
        el("tbody", {}, ...list.map((r) => el("tr", {},
          el("td", {}, patientLink(r.patient), el("small", { class: "adm-muted d-block", text: compact ? `Cód. ${r.patient.code} · ${r.sch.shift || "-"} · ${r.sch.room || "-"}` : `Cód. ${r.patient.code}` })),
          ...(compact ? [] : [el("td", { text: `${r.sch.shift || "-"} · ${r.sch.room || "-"}` }), el("td", { text: r.sch.accessType || "-" })]),
          el("td", {}, chips(r.reasons)))))))
  }

  // ---------- Exportar CSV ----------
  function downloadCsv(name, rows) {
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n")
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
    const a = el("a", { href: URL.createObjectURL(blob), download: name })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  function exportIndicators(d) {
    const period = `${formatDate(d.from)} a ${formatDate(d.today)}`
    const rows = [
      ["Indicador", "Valor", "Período", "Filtro"],
      ["Sessões realizadas", d.done.length, period, filterText()],
      ["Sessões previstas na escala (até ontem)", d.expected, period, filterText()],
      ["Taxa de faltas", pct(d.faltasBeforeToday, d.expected), period, filterText()],
      ["Faltas", d.faltas.length, period, filterText()],
      ["Faltas sem reposição marcada", d.pendingMakeup.length, "até hoje", filterText()],
      ["Remarcações", d.remarcacoes.length, period, filterText()],
      ["Sessões com intercorrência", pct(d.withComplication.length, d.done.length), period, filterText()],
      ["Hipotensão intradialítica", pct(d.hypotension.length, d.done.length), period, filterText()],
      [`Sessões com UF > ${UF_RATE_LIMIT} mL/kg/h`, pct(d.highUf.length, d.rates.length), period, filterText()],
      ["Ocupação das cadeiras fixas", pct(d.scheduledSlots, d.capacity), "escala atual", "todas as salas"],
      ["Pacientes em HD na escala", d.patientIds.length, "escala atual", filterText()],
      ["Pacientes com cateter", pct(d.byAccess.cateter, d.scheduled.length), "escala atual", filterText()],
      ["Pacientes com sorologia desconhecida", d.seroUnknown, "escala atual", filterText()],
      ["Máquinas em manutenção", d.maintenance.length, "cadastro", ""],
      [],
      ["Paciente", "Código", "Turno", "Sala", "Motivos"],
      ...d.attention.map((r) => [r.patient.name, r.patient.code, r.sch.shift, r.sch.room, r.reasons.map(([, t]) => t).join(" | ")]),
    ]
    downloadCsv(`hunefro-indicadores-${d.today}.csv`, rows)
  }
  const filterText = () => [state.shift || "todos os turnos", state.room || "todas as salas"].join(", ")

  // ---------- Abas do painel ----------
  function viewGeral(d) {
    const missRate = d.expected ? d.faltasBeforeToday / d.expected : 0
    const catheterRate = d.scheduled.length ? d.byAccess.cateter / d.scheduled.length : 0
    const occRate = d.capacity ? d.scheduledSlots / d.capacity : 0
    const decisions = []
    if (d.pendingMakeup.length) decisions.push(["danger", `${d.pendingMakeup.length} ${d.pendingMakeup.length === 1 ? "falta está" : "faltas estão"} sem reposição marcada.`, "sessoes-do-dia.html", "Abrir Sessões do dia"])
    if (d.maintenance.length) decisions.push(["warn", `${d.maintenance.length} ${d.maintenance.length === 1 ? "máquina em manutenção" : "máquinas em manutenção"}: ${d.maintenance.map((m) => `${m.room} ${m.name}`).join(", ")}.`, "?section=machines", "Ver máquinas"])
    if (d.temporaryCatheter.length) decisions.push(["danger", `${d.temporaryCatheter.length} ${d.temporaryCatheter.length === 1 ? "paciente dialisa" : "pacientes dialisam"} por cateter temporário: avaliar o encaminhamento para acesso definitivo.`, "#adm-attention", "Ver pacientes"])
    if (d.seroUnknown) decisions.push(["warn", `${d.seroUnknown} ${d.seroUnknown === 1 ? "paciente tem" : "pacientes têm"} sorologia desconhecida: profissional exclusivo e dialisador de uso único até o resultado.`, "#adm-attention", "Ver pacientes"])
    if (d.nearLimit.length) decisions.push(["info", `${d.nearLimit.length} ${d.nearLimit.length === 1 ? "paciente está" : "pacientes estão"} com o dialisador a partir do ${REUSE_ALERT}º uso de 20: prever a troca.`, "#adm-attention", "Ver pacientes"])
    if (d.overdue.length) decisions.push(["warn", `${d.overdue.length} ${d.overdue.length === 1 ? "tarefa ou solicitação está atrasada" : "tarefas ou solicitações estão atrasadas"} nas Comunicações.`, "comunicacoes.html", "Abrir Comunicações"])
    const emptyShifts = A.data().shifts.filter((s) => s.active !== false && (!s.start || !s.end))
    if (emptyShifts.length) decisions.push(["info", `${emptyShifts.map((s) => s.name).join(", ")} sem horário cadastrado.`, "?section=shifts", "Ver turnos"])

    return el("div", { class: "adm-stackv" },
      el("div", { class: "adm-kpis" },
        kpi("Sessões realizadas", fmt(d.done.length), `${fmt(d.running.length)} em andamento hoje · ${fmt(d.extras.length)} sessões extras`, "", "Sessões concluídas no período e nos filtros escolhidos."),
        kpi("Taxa de faltas", pct(d.faltasBeforeToday, d.expected), `${d.faltas.length} faltas · ${d.pendingMakeup.length} sem reposição`, missRate > 0.05 ? "warn" : "ok", "Faltas dividido pelas sessões previstas na escala até ontem."),
        kpi("Ocupação das cadeiras", pct(d.scheduledSlots, d.capacity, 0), `${d.scheduledSlots} de ${d.capacity} vagas fixas na semana`, occRate > 0.95 ? "warn" : "", "Pacientes na escala divididos pelas cadeiras fixas das salas ambulatoriais, em todos os turnos ativos e nos dois grupos de dias."),
        kpi("Pacientes em HD", fmt(d.patientIds.length), `${d.pediatric.length} pediátricos · ${d.newPatients.length} novos no período`, "", "Pacientes na escala de HD (Programa de Tratamento) com os filtros escolhidos."),
        kpi("Pacientes com cateter", pct(d.byAccess.cateter, d.scheduled.length, 0), `${d.byAccess.cateter} com cateter · ${d.temporaryCatheter.length} temporário`, catheterRate > 0.25 ? "warn" : "", "Pacientes da escala que dialisam por cateter (os demais por fístula)."),
        kpi("Intercorrências", pct(d.withComplication.length, d.done.length), `${d.hypotension.length} hipotensões · UF > ${UF_RATE_LIMIT} em ${pct(d.highUf.length, d.rates.length, 0)}`, "", "Sessões com intercorrência registrada, dividido pelas sessões realizadas."),
      ),
      el("div", { class: "adm-grid-2" },
        card("O que pede decisão", "Situações do setor que precisam de ação, a partir dos dados do período.",
          decisions.length ? el("ul", { class: "adm-decisions" }, ...decisions.map(([tone, text, href, label]) => el("li", { class: `is-${tone}` },
            el("span", { class: "adm-decision-icon", "aria-hidden": "true", text: tone === "info" ? "i" : "!" }),
            el("span", { text }),
            el("a", { href, class: "btn btn-sm btn-outline-primary", "data-jump": href.startsWith("?section=") ? href.slice(9) : href.startsWith("#") ? href : "", text: label })))) : emptyNote("Nada pendente no período.")),
        card("Sessões por dia", "Realizadas, previstas na escala e faltas.", dayColumns(d.perDay))),
      el("div", { class: "adm-grid-2" },
        card("Ocupação das cadeiras por turno", "Pacientes na escala / cadeiras fixas. A cadeira extra fica para reposição e encaixe; a Sala Q é da internação.", occupancyTable(d.occupancy)),
        card("Pacientes que pedem atenção", `${d.attention.length} pacientes. Os 8 primeiros; a lista completa está na aba Pacientes.`, el("div", { id: "adm-attention" }, attentionTable(d.attention, 8)))),
    )
  }
  function viewSessoes(d) {
    const avgDur = d.durations.length ? d.durations.reduce((a, b) => a + b, 0) / d.durations.length : null
    const avgUf = d.ufs.length ? d.ufs.reduce((a, b) => a + b, 0) / d.ufs.length : null
    const avgRate = d.rates.length ? d.rates.reduce((a, b) => a + b, 0) / d.rates.length : null
    return el("div", { class: "adm-stackv" },
      el("div", { class: "adm-kpis" },
        kpi("Previstas na escala", fmt(d.expected), "até ontem, sem domingos"),
        kpi("Realizadas", fmt(d.done.length), `${pct(d.doneBeforeToday, d.expected)} das previstas até ontem`),
        kpi("Faltas", fmt(d.faltas.length), `${pct(d.faltasBeforeToday, d.expected)} das previstas`, d.faltas.length ? "warn" : "ok"),
        kpi("Remarcações", fmt(d.remarcacoes.length), "adiantamentos e adiamentos (não contam como falta)"),
        kpi("Duração média", avgDur == null ? "-" : `${Math.floor(avgDur / 60)}h${String(Math.round(avgDur % 60)).padStart(2, "0")}`, "sessões concluídas"),
        kpi("UF média", avgUf == null ? "-" : `${fmt(avgUf / 1000, 2)} L`, `taxa média ${fmt(avgRate, 1)} mL/kg/h`, "", `Ultrafiltração por sessão. Acima de ${UF_RATE_LIMIT} mL/kg/h é sinal de alerta.`),
      ),
      card("Sessões por dia", "Passe o mouse sobre cada dia para ver os números.", dayColumns(d.perDay)),
      el("div", { class: "adm-grid-3" },
        card("Faltas por motivo", "", hbars(d.faltasByReason, { tone: "is-warn", total: d.faltas.length })),
        card("Faltas por turno", "", hbars(d.faltasByShift, { tone: "is-warn", total: d.faltas.length })),
        card("Qualidade da sessão", "Proporção das sessões realizadas.", hbars([
          ["Com intercorrência", d.withComplication.length], ["Hipotensão intradialítica", d.hypotension.length], [`UF > ${UF_RATE_LIMIT} mL/kg/h`, d.highUf.length],
        ], { total: d.done.length, max: Math.max(d.done.length, 1) }))),
      card("Faltas sem reposição marcada", "A enfermeira define a reposição em Sessões do dia.",
        d.pendingMakeup.length ? el("ul", { class: "adm-list" }, ...d.pendingMakeup.map((a) => { const p = M.patient(a.patientId); return el("li", {}, p ? patientLink(p) : el("span", { text: `Paciente ${a.patientId}` }), el("span", { class: "adm-muted", text: ` · ${formatDate(a.date)} · ${a.shift} · ${a.room} · ${a.reason || "sem motivo"}` })) })) : emptyNote("Todas as faltas têm reposição marcada.")),
    )
  }
  function viewPacientes(d) {
    const progTotal = d.programs.reduce((n, [, v]) => n + v, 0)
    return el("div", { class: "adm-stackv" },
      el("div", { class: "adm-kpis" },
        kpi("Pacientes em HD", fmt(d.patientIds.length), "na escala com os filtros"),
        kpi("Pediátricos", fmt(d.pediatric.length), "Hemodiálise Pediátrica"),
        kpi("Novos no período", fmt(d.newPatients.length), "incluídos pela Recepção"),
        kpi("Sorologia positiva", fmt(d.seroCount("hepatiteB") + d.seroCount("hepatiteC") + d.seroCount("hiv")), `HBsAg+ ${d.seroCount("hepatiteB")} · HCV+ ${d.seroCount("hepatiteC")} · HIV+ ${d.seroCount("hiv")}`, "", "Dialisador de uso único; HBsAg+ exige profissional exclusivo e sala própria (RDC ANVISA 11/2014)."),
        kpi("Sorologia desconhecida", fmt(d.seroUnknown), "coletada sem resultado ou não informada", d.seroUnknown ? "warn" : "ok"),
        kpi("Dialisador perto do limite", fmt(d.nearLimit.length), `a partir do ${REUSE_ALERT}º uso de 20`, d.nearLimit.length ? "info" : ""),
      ),
      el("div", { class: "adm-grid-3" },
        card("Acesso vascular", "Pacientes da escala.", stack([["Fístula", d.byAccess.fav, "is-primary"], ["Cateter", d.byAccess.cateter, "is-warn"], ["Outro", d.byAccess.outro, "is-info"]])),
        card("Pacientes por programa", "Todos os prontuários.", hbars(d.programs, { total: progTotal })),
        card("Pacientes por turno", "Pacientes da escala.", hbars(d.shifts.map((s) => [s, d.scheduled.filter((p) => p.shift === s).length]).filter(([, v]) => v), { total: d.scheduled.length }))),
      card("Pacientes que pedem atenção", "Faltas, falta sem reposição, cateter, sorologia desconhecida, intercorrências repetidas, UF alta repetida e dialisador perto do limite.", attentionTable(d.attention)),
    )
  }
  function viewEquipe(d) {
    const responsibleTotal = d.byResponsible.reduce((n, [, v]) => n + v, 0)
    return el("div", { class: "adm-stackv" },
      el("div", { class: "adm-kpis" },
        kpi("Usuários ativos", fmt(d.activeUsers.length), `${d.users.length - d.activeUsers.length} bloqueados`),
        kpi("Sem acesso há 30 dias", fmt(d.staleAccess.length), `${d.neverAccess.length} nunca entraram`, d.staleAccess.length ? "warn" : ""),
        kpi("Comunicações abertas", fmt(d.openComms.length), `${d.openEvaluations.length} solicitações de avaliação`),
        kpi("Atrasadas", fmt(d.overdue.length), "tarefas e solicitações com prazo vencido", d.overdue.length ? "warn" : "ok"),
        kpi("Sessões por profissional", d.perShiftDay.length ? fmt(d.perShiftDay.reduce((n, r) => n + r.perStaff, 0) / d.perShiftDay.length, 1) : "-", "média por responsável em cada turno"),
      ),
      el("div", { class: "adm-grid-2" },
        card("Sessões por responsável", "Carga de trabalho no período (responsável registrado na sessão).", hbars(d.byResponsible, { total: responsibleTotal })),
        card("Usuários ativos por perfil", "", hbars(d.usersByProfile.filter(([, v]) => v), { total: d.activeUsers.length }))),
      el("div", { class: "adm-grid-2" },
        card("Média por turno", "Sessões por dia e por responsável em cada turno.", d.perShiftDay.length ? el("div", { class: "table-responsive adm-table-wrap" }, el("table", { class: "table adm-table" },
          el("thead", {}, el("tr", {}, el("th", { text: "Turno" }), el("th", { text: "Sessões por dia" }), el("th", { text: "Sessões por responsável" }))),
          el("tbody", {}, ...d.perShiftDay.map((r) => el("tr", {}, el("td", { text: r.shift }), el("td", { text: fmt(r.perDay, 1) }), el("td", { text: fmt(r.perStaff, 1) })))))) : emptyNote("Sem sessões no período.")),
        card("Comunicações atrasadas", "", d.overdue.length ? el("ul", { class: "adm-list" }, ...d.overdue.map((c) => el("li", {}, el("a", { href: "comunicacoes.html", text: c.title }), el("span", { class: "adm-muted", text: ` · prazo ${formatDate(c.due)}` })))) : emptyNote("Nenhuma comunicação atrasada."))),
    )
  }
  function viewRecursos(d) {
    const dialTotal = d.dialyzerUse.reduce((n, [, v]) => n + v, 0)
    return el("div", { class: "adm-stackv" },
      el("div", { class: "adm-kpis" },
        kpi("Máquinas cadastradas", fmt(d.machines.length), `${d.machineStatus[0][1]} em uso`),
        kpi("Em manutenção", fmt(d.maintenance.length), d.maintenance.map((m) => `${m.room} ${m.name.replace("Máquina ", "")}`).join(", ") || "nenhuma", d.maintenance.length ? "warn" : "ok"),
        kpi("Dialisadores novos", fmt(d.newDialyzers), "trocas no período (reúso até 20)"),
        kpi("Uso único", fmt(d.singleUse), "sessões com sorologia positiva ou desconhecida"),
        kpi("Modelos em uso", fmt(d.dialyzerUse.length), `${A.data().dialyzers.filter((x) => x.active !== false).length} modelos ativos no cadastro`),
      ),
      el("div", { class: "adm-grid-2" },
        card("Máquinas por situação", "", stack(d.machineStatus.map(([label, v, k]) => [label, v, k === "ativa" ? "is-primary" : k === "manutencao" ? "is-warn" : "is-muted"]))),
        card("Dialisadores mais usados", "Sessões realizadas no período.", hbars(d.dialyzerUse.slice(0, 8), { total: dialTotal }))),
    )
  }

  // ---------- Montagem ----------
  function render(root) {
    const d = compute()
    const rooms = A.data().rooms.filter((r) => r.active !== false).map((r) => r.name)
    const shifts = A.data().shifts.map((s) => s.name)
    const sel = (id, label, options, value, key) => {
      const s = el("select", { class: "form-select form-select-sm", id }, ...options.map(([v, l]) => el("option", { value: v, text: l })))
      s.value = String(value)
      s.addEventListener("change", () => { state[key] = key === "period" ? Number(s.value) : s.value; keep(); render(root) })
      return el("div", { class: "adm-filter" }, el("label", { class: "field-label", for: id, text: label }), s)
    }
    const tabs = el("div", { class: "md-tabs adm-subtabs", role: "tablist", "aria-label": "Painéis" }, ...TABS.map(([k, label]) => el("button", {
      type: "button", class: "md-tab", role: "tab", "aria-selected": String(state.tab === k), tabindex: state.tab === k ? "0" : "-1", "data-ptab": k, text: label,
    })))
    tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-ptab]"); if (b) { state.tab = b.dataset.ptab; keep(); render(root); root.querySelector(`[data-ptab="${state.tab}"]`)?.focus() } })
    tabs.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return
      const i = TABS.findIndex(([k]) => k === state.tab)
      state.tab = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0]
      keep(); render(root); root.querySelector(`[data-ptab="${state.tab}"]`)?.focus()
    })
    const exportBtn = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: "Exportar indicadores (CSV)" })
    exportBtn.addEventListener("click", () => exportIndicators(d))
    const printBtn = el("button", { type: "button", class: "btn btn-sm btn-outline-secondary", text: "Imprimir" })
    printBtn.addEventListener("click", () => window.print())
    const views = { geral: viewGeral, sessoes: viewSessoes, pacientes: viewPacientes, equipe: viewEquipe, recursos: viewRecursos }
    const body = (views[state.tab] || viewGeral)(d)
    body.setAttribute("role", "tabpanel")
    body.addEventListener("click", (e) => {
      const a = e.target.closest("[data-jump]")
      if (!a || !a.dataset.jump) return
      e.preventDefault()
      if (a.dataset.jump.startsWith("#")) { state.tab = "pacientes"; keep(); render(root); root.querySelector(".adm-table-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" }) }
      else document.dispatchEvent(new CustomEvent("hunefro:adm-section", { detail: a.dataset.jump }))
    })
    root.replaceChildren(
      el("div", { class: "adm-filters" },
        sel("adm-p-period", "Período", PERIODS, state.period, "period"),
        sel("adm-p-shift", "Turno", [["", "Todos os turnos"], ...shifts.map((s) => [s, s])], state.shift, "shift"),
        sel("adm-p-room", "Sala", [["", "Todas as salas"], ...rooms.map((r) => [r, r])], state.room, "room"),
        el("p", { class: "adm-filter-note", text: `${formatDate(d.from)} a ${formatDate(d.today)} · dados do protótipo guardados neste navegador` }),
        el("div", { class: "adm-filter-actions" }, exportBtn, printBtn)),
      tabs, body)
    bindTips(body)
  }

  window.HuNefroAdminPainel = { render, compute, UF_RATE_LIMIT }
})()
