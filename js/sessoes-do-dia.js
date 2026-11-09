// Tela Sessões do dia: pacientes previstos na data, separados por turno e sala.
// Cada paciente tem a sua sessão, que é iniciada (chegada, peso e PA iniciais) e depois concluída
// (fim, peso final, UF e PA final). As sessões gravadas aparecem no prontuário (Sessões de Diálise).
// Com até 22 pacientes por turno nas cadeiras fixas (mais uma extra na Sala A e outra na Sala B), o quadro tem duas visões: "Por sala" (colunas compactas, uma por sala)
// e "Tabela" (uma linha por paciente com todas as ações).
// Faltas: o técnico registra a falta; a remarcação (reposição, adiantamento ou adiamento) é da enfermeira
// (perfil simulado em js/sessao.js, HuNefroSessao.can("remarcar-sessao")).
// Depende de js/catalogos.js, js/componentes.js e js/dados-mock.js (escala e sessões provisórias até existir a API).
(() => {
  "use strict"

  const { el, formatDate, todayIso, currentUserName, createSelectWithOther, parseNumber, normalize, isCatheterAccess } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const M = window.HuNefroMock
  const store = window.HuNefroSessoesStore
  const faltas = window.HuNefroFaltasStore
  const extraStore = window.HuNefroTurnosExtrasStore
  const internStore = window.HuNefroInternadosStore
  const sessao = window.HuNefroSessao
  const $ = (id) => document.getElementById(id)

  const METHODS = [["Hemodiálise", "Hemodiálise"], ["Hemodiálise Pediátrica", "Hemodiálise Pediátrica"]]
  // PROVISÓRIA: mesma lista da Prescrição de HD.
  const DIALYZERS = (window.HuNefroAdmin?.dialyzerNames?.() || ["B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR", "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4"]).map((v) => [v, v])
  const SALINE = [["300", "300 mL"], ["500", "500 mL"]]
  const MAX = store.MAX_DIALYZER_USES
  const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]
  const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
  const STATUS = {
    aguardando: ["Aguardando", "off"],
    prevista: ["Prevista", "off"],
    "sem-registro": ["Sem registro", "warn"],
    "em-andamento": ["Em andamento", "warn"],
    concluida: ["Concluída", "ok"],
    "a-remarcar": ["Falta - a remarcar", "danger"],
    falta: ["Falta", "danger"],
    remarcada: ["Remarcada", "info"],
  }
  // PROVISÓRIOS: motivos de falta e de remarcação, turnos e salas da unidade (Programa de Tratamento).
  const ABSENCE_REASONS = ["Não compareceu sem aviso", "Internação", "Problema de transporte", "Doença / mal-estar", "Viagem", "Outro motivo"].map((v) => [v, v])
  const MOVE_REASONS = ["Solicitação do paciente", "Viagem", "Consulta ou exame no mesmo horário", "Feriado", "Problema de transporte", "Manutenção de máquina", "Outro motivo"].map((v) => [v, v])
  const SHIFTS = M.SHIFTS.map((v) => [v, v])
  // A Sala Q é da internação, mas a enfermeira pode remarcar para lá quando houver vaga.
  const INPATIENT = M.INPATIENT_ROOMS || {}
  const ROOMS = [...Object.keys(M.ROOMS).map((v) => [v, v]), ...Object.keys(INPATIENT).map((v) => [v, `${v} (internação, se houver vaga)`])]
  const chairsOf = (room) => ({ fixed: M.ROOMS[room] || INPATIENT[room] || 0, extra: M.EXTRA_CHAIRS?.[room] || 0, inpatient: Boolean(INPATIENT[room]) })
  const chairsText = ({ fixed, extra, inpatient }) =>
    `${fixed} ${fixed === 1 ? "cadeira" : "cadeiras"}${inpatient ? " (sob demanda)" : fixed === 1 ? " fixa" : " fixas"}${extra ? ` + ${extra} extra` : ""}`
  const MAX_MOVE_DAYS = 7 // remarcação em até 7 dias antes ou depois da data prevista
  const MEASURE_FIELDS = [
    { key: "time", label: "Hora (hh:mm)", kind: "time", req: true },
    { key: "pa", label: "PA (mmHg)", kind: "pa" },
    { key: "fc", label: "FC (bpm)", kind: "number", min: 20, max: 300 },
    { key: "tax", label: "T.Ax. (°C)", kind: "number", min: 30, max: 45 },
    { key: "hep", label: "Hep. (UI)", kind: "number", min: 0, max: 50000 },
    { key: "flow", label: "Fluxo (mL/min)", kind: "number", min: 0, max: 600 },
    { key: "pArt", label: "P.Art (mmHg)", kind: "number", min: -500, max: 500 },
    { key: "pVen", label: "P.Ven (mmHg)", kind: "number", min: -500, max: 500 },
  ]
  // Soro fisiológico da devolução: uma única vez, ao final da HD, para lavar o circuito e devolver o sangue
  // ao paciente (Elias, 04/11/2026). Não há soro por aferição. Entra no peso a perder (mL convertido em kg).
  const SALINE_LABEL = "Soro da devolução ao final (mL)"
  const SALINE_NOTE = "Soro fisiológico usado uma única vez, ao final da diálise, para lavar o circuito e devolver o sangue ao paciente. Entra no cálculo do peso a perder."

  const dec = (v) => String(v).replace(".", ",")
  const hasNum = (v) => v !== "" && v != null && Number.isFinite(parseNumber(v))
  const minutes = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null }
  const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
  const normTime = (v) => (/^\d:\d{2}$/.test(v) ? `0${v}` : v)
  const fmtKg = (n) => (n == null ? "-" : `${dec(Math.round(n * 100) / 100)} kg`)
  const fmtDur = (m) => (m == null ? "-" : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`)
  const profName = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const EXTRA_PREFIX = "Sessão extra"
  // "Turno extra" era o nome antigo (dados gravados antes de 06/11/2026).
  const isExtraShift = (s) => String(s || "").startsWith(EXTRA_PREFIX) || String(s || "").startsWith("Turno extra")
  // Turnos fixos pelo número; sessões extras depois deles, pelo horário.
  const shiftOrder = (s) => parseInt(s, 10) || (isExtraShift(s) ? 10 + (minutes(String(s).slice(-5)) || 0) / 1440 : 99)
  const machineOrder = (m) => parseInt(String(m || "").replace(/\D/g, ""), 10) || 999
  const machineShort = (m) => (m ? String(m).replace(/^Máquina\s*/i, "") : "-")
  const parsePa = (v) => { const p = String(v).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/); return p && +p[1] >= 40 && +p[1] <= 300 && +p[2] >= 20 && +p[2] <= 200 && +p[2] < +p[1] ? `${p[1]}/${p[2]}` : null }
  const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
  const canReschedule = () => Boolean(sessao?.can("remarcar-sessao"))
  // Sessão extra (por orientação médica): enfermeira ou médico.
  const canExtra = () => Boolean(sessao?.can("turno-extra"))
  // Sala Q (internados): enfermeira ou médico. Incluir o internado como paciente do setor: também a Recepção.
  const canInpatient = () => Boolean(sessao?.can("sala-q"))
  const canInclude = () => Boolean(sessao?.can("sala-q") || sessao?.can("incluir-paciente"))
  const weekdaysText = (days) => (days || []).map((d) => WEEKDAYS_SHORT[d]).join(", ")
  // Regras de sorologia (RDC ANVISA nº 11/2014) do paciente: uso único do dialisador e profissional exclusivo.
  const serology = (patientId) => M.serologyOf(patientId)
  function serologyTag(patientId) {
    const r = serology(patientId)
    if (!r.tags.length) return null
    const text = [...r.tags, r.singleUse ? "Dialisador de uso único" : "", r.exclusiveProfessional ? "Profissional exclusivo" : ""].filter(Boolean).join(" · ")
    return el("span", { class: `sdd-sero sdd-sero-${r.tone}`, title: r.rules.join(" "), text: `⚠ ${text}` })
  }
  const isMove = (a) => a?.kind === "remarcacao"
  const storage = {
    get(key) { try { return localStorage.getItem(key) } catch { return null } },
    set(key, value) { try { localStorage.setItem(key, value) } catch { /* sem armazenamento: só nesta visita */ } },
  }

  let day = todayIso()
  let sessions = store.all()
  let absences = faltas.all()
  let extras = extraStore.all()
  let internados = internStore.all()
  let shiftFilter = ""
  let statusFilter = ""
  let view = storage.get("huNefroSddView") === "tabela" ? "tabela" : "sala"
  const initialArea = ["board", "moves", "extras", "internados"].includes(storage.get("huNefroSddArea")) ? storage.get("huNefroSddArea") : "board"
  const reload = () => { sessions = store.all(); absences = faltas.all(); extras = extraStore.all(); internados = internStore.all() }

  // ---------- Dados do dia ----------
  // Previstos pela escala + reposições e remarcações para a data + quem já tem sessão gravada (ex.: sessão extra).
  // Cada entrada é um horário (paciente + turno); o mesmo paciente pode ter dois no dia (falta no 1º turno e
  // reposição no 3º, por exemplo).
  function entries(date = day) {
    const list = M.scheduledOn(date).map((sch) => ({ sch, makeupOf: null }))
    const has = (pid, shift) => list.some((e) => e.sch.patientId === pid && e.sch.shift === shift)
    absences.filter((a) => a.makeup?.date === date && !has(a.patientId, a.makeup.shift))
      .forEach((a) => list.push({ sch: { ...(M.scheduleOf(a.patientId) || {}), patientId: a.patientId, shift: a.makeup.shift, room: a.makeup.room, machine: "" }, makeupOf: a }))
    // Sessões extras: pacientes incluídos pela enfermeira (as faltas repostas na sessão extra já entraram acima).
    extras.filter((x) => x.date === date).forEach((x) => x.patientIds.filter((pid) => !has(pid, x.shift))
      .forEach((pid) => list.push({ sch: { ...(M.scheduleOf(pid) || {}), patientId: pid, shift: x.shift, room: x.room, machine: "" }, makeupOf: null, extra: x })))
    // Internados (Sala Q, sob demanda): pacientes do setor ou ainda sem cadastro na Nefrologia (id provisório).
    internados.forEach((r) => r.slots.forEach((s, i) => {
      const pid = internStore.patientIdOf(r)
      if (s.date !== date || has(pid, s.shift)) return
      const base = M.scheduleOf(pid) || {}
      list.push({ sch: { ...base, method: base.method || "Hemodiálise", access: r.access || base.access || "", patientId: pid, shift: s.shift, room: s.room, machine: "" }, makeupOf: null, inpatient: r, inpatientIndex: i })
    }))
    const count = (pid) => list.filter((e) => e.sch.patientId === pid).length
    const used = new Set()
    const matched = list.map((e) => {
      const pid = e.sch.patientId
      const mine = sessions.filter((s) => s.patientId === pid && s.date === date && !used.has(s.id))
      const session = mine.find((s) => s.shift === e.sch.shift) || (count(pid) === 1 ? mine[0] : null) || null
      if (session) used.add(session.id)
      const absence = absences.find((a) => a.patientId === pid && a.date === date && a.shift === e.sch.shift) ||
        (count(pid) === 1 ? absences.find((a) => a.patientId === pid && a.date === date) : null) || null
      return { ...e, session, absence }
    })
    sessions.filter((s) => s.date === date && !used.has(s.id))
      .forEach((s) => matched.push({ sch: { ...(M.scheduleOf(s.patientId) || {}), patientId: s.patientId, shift: s.shift || "Sem turno", room: s.room || "Sem sala", machine: s.machine || "" }, makeupOf: null, session: s, absence: null }))
    return matched.map((e) => ({ ...e, date, patient: M.patient(e.sch.patientId), state: stateOf(e.session, e.absence, date) })).filter((e) => e.patient)
  }
  function stateOf(session, absence, date) {
    if (session) return session.state === "em-andamento" ? "em-andamento" : "concluida"
    if (absence) return isMove(absence) ? "remarcada" : absence.makeup ? "falta" : "a-remarcar"
    if (date === todayIso()) return "aguardando"
    return date > todayIso() ? "prevista" : "sem-registro"
  }
  const isActive = (e) => !["falta", "a-remarcar", "remarcada"].includes(e.state)
  const history = (patientId) => sessions.filter((s) => s.patientId === patientId)
  // Última sessão concluída antes do dia (para sugerir dialisador, acesso, peso seco e calcular o ganho interdialítico).
  const lastBefore = (patientId) => history(patientId).filter((s) => s.date < day && s.state !== "em-andamento").sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""))[0] || null

  // Texto do deslocamento: "adiantada 1 dia", "adiada 2 dias" ou "mesmo dia, outro turno".
  function direction(fromDate, toDate) {
    const n = daysBetween(fromDate, toDate)
    if (n === 0) return { kind: "mesmo-dia", label: "Mesmo dia, outro horário", short: "Outro turno" }
    const d = Math.abs(n)
    const days = `${d} ${d === 1 ? "dia" : "dias"}`
    return n < 0 ? { kind: "adiantamento", label: `Adiantamento: ${days} antes`, short: "Adiantada" } : { kind: "adiamento", label: `Adiamento: ${days} depois`, short: "Adiada" }
  }
  const slotText = (m) => `${formatDate(m.date)} (${WEEKDAYS_SHORT[M.weekday(m.date)]}), ${m.shift}, ${m.room}`
  const shortSlot = (m) => `${formatDate(m.date).slice(0, 5)} ${WEEKDAYS_SHORT[M.weekday(m.date)]}, ${parseInt(m.shift, 10) ? `${parseInt(m.shift, 10)}º T` : m.shift}, ${m.room}`

  // Situação exibida (rótulo, tom, detalhe e marcador de origem) de cada entrada.
  function describe(e) {
    let [label, tone] = STATUS[e.state]
    let detail = ""
    const { session, absence } = e
    if (session) detail = e.state === "em-andamento" ? `Início ${session.start} · ${fmtDur(Math.max(0, minutes(nowTime()) - minutes(session.start)))}` : `${session.start} - ${session.end}`
    else if (e.state === "falta") detail = `Reposição ${shortSlot(absence.makeup)}`
    else if (e.state === "a-remarcar") detail = "Aguardando a enfermeira remarcar"
    else if (e.state === "remarcada") { label = absence.swapPair ? "Trocou de turno" : direction(absence.date, absence.makeup.date).short; detail = `Para ${shortSlot(absence.makeup)}` }
    let origin = ""
    if (e.makeupOf) {
      const a = e.makeupOf
      origin = a.swapPair ? `Troca de turno com ${M.patient(a.swapWith)?.name || "outro paciente"}` : isMove(a) ? `${direction(a.date, a.makeup.date).short} de ${shortSlot(a)}` : `Reposição da falta de ${shortSlot(a)}`
    }
    if (e.inpatient) origin = e.patient.provisional ? `Internado sem cadastro: ${e.inpatient.bed}` : `Internado: ${e.inpatient.bed}`
    let originTitle = origin
    if (e.extra) {
      origin = "Sessão extra"
      originTitle = e.extra.doctorName ? `${origin}, orientação de ${e.extra.doctorName}${e.extra.reason ? ` (${e.extra.reason})` : ""}` : origin
    }
    return { label, tone, detail, origin, originTitle }
  }

  // ---------- Ações de cada paciente (dependem da situação e do perfil) ----------
  function actionsFor(e) {
    const nurse = canReschedule()
    const list = []
    const add = (label, short, run, opts = {}) => list.push({ label, short, run, ...opts })
    const parent = e.makeupOf
    const parentOpen = parent && !e.session && !e.absence
    const swapOption = () => { if (nurse && swappable(e)) add("Trocar de turno com outro paciente", "Trocar", () => openSwap(e)) }
    const alterParent = () => (parent.swapPair ? undoSwap(parent) : parent.makeup?.extraId ? openExtra(extras.find((x) => x.id === parent.makeup.extraId)) : openReschedule(parent))
    const alterLabel = () => (parent?.swapPair ? "Desfazer troca de turno" : "Alterar remarcação")
    // Paciente da sessão extra ou internado da Sala Q: muda-se o própria sessão extra ou a HD do internado, não a escala.
    const move = (opts = {}) => {
      if (e.extra) { if (canExtra()) add("Alterar sessão extra", "Alterar", () => openExtra(e.extra), opts); return }
      if (e.inpatient) { if (canInpatient()) add("Alterar HD do internado", "Alterar", () => openInpatient(e.inpatient), opts); return }
      if (nurse) add(parentOpen ? alterLabel() : "Remarcar sessão", "Remarcar", () => (parentOpen ? alterParent() : openMove(e)), opts)
    }
    switch (e.state) {
      case "aguardando":
        add("Iniciar sessão", "Iniciar", () => openStart(e), { primary: true })
        add("Registrar falta", "Falta", () => openAbsence(e), { danger: true })
        move()
        swapOption()
        break
      case "prevista":
        move({ primary: true })
        swapOption()
        add("Registrar falta", "Falta", () => openAbsence(e), { danger: true })
        break
      case "sem-registro":
        add("Registrar falta", "Falta", () => openAbsence(e), { danger: true, primary: true })
        break
      case "em-andamento":
        add("Concluir sessão", "Concluir", () => openFinish(e), { primary: true })
        add("Registrar aferição", "Aferição", () => openMeasure(e))
        break
      case "concluida":
        add("Ver sessão", "Ver", () => openView(e), { primary: true })
        break
      case "a-remarcar":
        if (nurse) add("Remarcar reposição", "Remarcar", () => openReschedule(e.absence), { primary: true })
        add("Ver falta", "Ver falta", () => openAbsenceView(e.absence), { primary: !nurse })
        break
      case "falta":
        add("Ver falta", "Ver falta", () => openAbsenceView(e.absence), { primary: true })
        if (nurse && !makeupLocked(e.absence)) add("Alterar reposição", "Alterar", () => openReschedule(e.absence))
        break
      case "remarcada":
        add("Ver remarcação", "Ver", () => openAbsenceView(e.absence), { primary: true })
        if (nurse && !makeupLocked(e.absence)) add(e.absence.swapPair ? "Desfazer troca de turno" : "Alterar remarcação", "Alterar", () => (e.absence.swapPair ? undoSwap(e.absence) : openReschedule(e.absence)))
        break
      default:
    }
    if (e.patient.provisional) {
      add("Ver internação", "Internação", () => openInpatientView(e.inpatient), { menuOnly: true })
      if (canInclude()) add("Incluir como paciente do setor", "Incluir", () => openInclude(e.inpatient), { menuOnly: true })
    } else add("Abrir prontuário", "Prontuário", () => openRecord(e.patient.id), { menuOnly: true })
    return list
  }

  // ---------- Quadro ----------
  function fillSelect(select, values) {
    const current = select.value
    select.replaceChildren(select.options[0], ...values.map((v) => el("option", { value: v, text: v })))
    select.value = values.includes(current) ? current : ""
  }
  const matchesStatus = (e, s) => !s || (s === "faltas" ? ["falta", "a-remarcar"].includes(e.state) : s === "recebidas" ? Boolean(e.makeupOf) : e.state === s)
  // Turno em curso pelo horário (só para abrir o quadro no turno certo).
  function currentShift() {
    const t = minutes(nowTime())
    // Horários cadastrados em Gestão > Turnos: o turno em curso (ou o próximo a começar).
    const timed = (window.HuNefroAdmin?.data?.().shifts || []).filter((x) => x.active !== false && x.start && x.end)
    // Turno que passa da meia-noite (ex.: 21:00 - 01:00): o fim conta no dia seguinte.
    const within = (x) => { const a = minutes(x.start); const b = minutes(x.end) + 30; return b > a ? t >= a && t < b : t >= a || t < b - 1440 || t < b % 1440 }
    const inside = timed.find(within)
    const next = timed.filter((x) => minutes(x.start) > t).sort((a, b) => minutes(a.start) - minutes(b.start))[0]
    if (inside || next) return (inside || next).name
    return t < 11 * 60 + 30 ? "1º Turno" : t < 16 * 60 + 30 ? "2º Turno" : "3º Turno"
  }

  function render() {
    closeMenu()
    const all = entries()
    const isToday = day === todayIso()
    const weekdayName = WEEKDAYS[M.weekday(day)]
    $("sdd-day-label").textContent = `${weekdayName[0].toUpperCase()}${weekdayName.slice(1)}, ${formatDate(day)}${isToday ? " (hoje)" : ""}`
    renderProfileNote()
    renderPending()
    renderMoves()
    renderExtras()
    renderInternados()
    renderSummary(all, isToday)

    // Os 3 turnos da unidade aparecem sempre (mesmo sem paciente), mais os sessões extras do dia.
    const regular = (window.HuNefroAdmin?.data?.().shifts || []).filter((x) => x.active !== false).map((x) => x.name)
    const shifts = [...new Set([...(regular.length ? regular : M.SHIFTS), ...all.map((e) => e.sch.shift)])].sort((a, b) => shiftOrder(a) - shiftOrder(b))
    if (shiftFilter && !shifts.includes(shiftFilter)) shiftFilter = ""
    renderShiftTabs(all, shifts)
    fillSelect($("sdd-room"), [...new Set([...all.map((e) => e.sch.room), ...Object.keys(INPATIENT)])].sort())
    $("sdd-status").value = statusFilter
    document.querySelectorAll("[data-sdd-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sddView === view)))

    const q = normalize($("sdd-search").value.trim())
    const shown = all.filter((e) =>
      (!shiftFilter || e.sch.shift === shiftFilter) &&
      (!$("sdd-room").value || e.sch.room === $("sdd-room").value) &&
      matchesStatus(e, statusFilter) &&
      (!q || normalize(`${e.patient.name} ${e.patient.code} ${e.sch.machine || ""}`).includes(q)))

    const board = $("sdd-board")
    board.dataset.view = view
    // A Sala Q aparece sempre na visão por sala (sob demanda), mesmo vazia, quando não há filtro de paciente ou situação.
    const roomSel = $("sdd-room").value
    const showQ = view === "sala" && !q && !statusFilter && (!roomSel || INPATIENT[roomSel])
    const qRooms = Object.keys(INPATIENT).filter((r) => !roomSel || r === roomSel)
    if (!all.length && !showQ) { board.replaceChildren(el("div", { class: "sdd-empty" }, el("strong", { text: "Nenhum paciente previsto para este dia." }), el("p", { text: "A escala vem do Programa de Tratamento de cada paciente (sala, turno e dias)." }))); return }
    if (!shown.length && !showQ) { board.replaceChildren(el("div", { class: "sdd-empty" }, el("strong", { text: shiftFilter && !all.some((e) => e.sch.shift === shiftFilter) ? `Nenhum paciente previsto no ${shiftFilter} neste dia.` : "Nenhum paciente com esses filtros." }))); return }

    const shownShifts = [...new Set([...shown.map((e) => e.sch.shift), ...(showQ ? shifts.filter((s) => !shiftFilter || s === shiftFilter) : [])])].sort((a, b) => shiftOrder(a) - shiftOrder(b))
    board.replaceChildren(...shownShifts.map((shift) => {
      const inShift = shown.filter((e) => e.sch.shift === shift)
      const fullShift = all.filter((e) => e.sch.shift === shift)
      const headingId = `sdd-shift-${shiftOrder(shift)}`
      const rooms = [...new Set([...inShift.map((e) => e.sch.room), ...(showQ ? qRooms : [])])].sort()
      const sortRoom = (list) => list.sort((a, b) => machineOrder(a.sch.machine) - machineOrder(b.sch.machine) || a.patient.name.localeCompare(b.patient.name))
      const extra = isExtraShift(shift) ? extras.find((x) => x.date === day && x.shift === shift) : null
      let editExtra = null
      if (extra && canExtra()) {
        editExtra = el("button", { type: "button", class: "btn btn-sm btn-outline-secondary", text: "Editar sessão extra" })
        editExtra.addEventListener("click", () => openExtra(extra))
      }
      return el("section", { class: "sdd-shift", "aria-labelledby": headingId },
        el("header", { class: "sdd-shift-head" },
          el("h2", { id: headingId }, document.createTextNode(shift), el("span", { text: `${inShift.length} ${inShift.length === 1 ? "paciente" : "pacientes"}${inShift.length !== fullShift.length ? ` de ${fullShift.length}` : ""}${extra ? ` · ${extra.room}` : ""}` })),
          ...(extra?.doctorName ? [el("span", { class: "sdd-extra-note", text: `Orientação médica: ${extra.doctorName}${extra.reason ? ` · ${extra.reason}` : ""}` })] : []),
          ...(extra?.note ? [el("span", { class: "sdd-extra-note", text: extra.note })] : []),
          shiftStats(fullShift), ...(editExtra ? [editExtra] : [])),
        view === "tabela"
          ? tableView(rooms.flatMap((room) => sortRoom(inShift.filter((e) => e.sch.room === room))))
          : el("div", { class: "sdd-rooms" }, ...rooms.map((room) => roomColumn(room, sortRoom(inShift.filter((e) => e.sch.room === room)), fullShift.filter((e) => e.sch.room === room), shift))))
    }))
  }

  function renderProfileNote() {
    const nurse = canReschedule()
    const note = $("sdd-profile-note")
    note.className = `sdd-profile-note ${nurse ? "is-nurse" : ""}`
    note.replaceChildren(
      el("strong", { text: `Perfil: ${sessao?.profileLabel() || "-"}` }),
      el("span", { text: nurse ? "Pode registrar faltas e remarcar sessões (adiantar, adiar ou repor faltas)." : "Registra faltas. A remarcação da sessão é feita pela enfermeira." }))
  }

  function renderSummary(all, isToday) {
    const count = (fn) => all.filter(fn).length
    const items = [
      ["Previstos", count(isActive), "", ""],
      ...(isToday ? [["Aguardando", count((e) => e.state === "aguardando"), "off", "aguardando"]] : []),
      ["Em andamento", count((e) => e.state === "em-andamento"), "warn", "em-andamento"],
      ["Concluídas", count((e) => e.state === "concluida"), "ok", "concluida"],
      ["Faltas", count((e) => ["falta", "a-remarcar"].includes(e.state)), "danger", "faltas"],
      ["Remarcadas", count((e) => e.state === "remarcada"), "info", "remarcada"],
      ["Reposições recebidas", count((e) => Boolean(e.makeupOf)), "info", "recebidas"],
    ]
    $("sdd-summary").replaceChildren(...items.map(([label, n, tone, filter]) => {
      const content = [el("strong", { text: String(n) }), el("span", { text: label })]
      const node = filter
        ? el("button", { type: "button", class: "sdd-count-btn", "aria-pressed": String(statusFilter === filter), title: `Filtrar: ${label}` }, ...content)
        : el("div", { class: "sdd-count-btn is-static" }, ...content)
      if (filter) node.addEventListener("click", () => { statusFilter = statusFilter === filter ? "" : filter; render() })
      return el("li", { class: `sdd-count ${tone ? `sdd-count-${tone}` : ""}` }, node)
    }))
  }

  function renderShiftTabs(all, shifts) {
    const tab = (value, label, list) => {
      const done = list.filter((e) => e.state === "concluida").length
      const active = list.filter(isActive).length
      const b = el("button", { type: "button", class: "sdd-tab", "aria-pressed": String(shiftFilter === value) },
        el("span", { class: "sdd-tab-label", text: label }),
        el("span", { class: "sdd-tab-count", text: `${active} ${active === 1 ? "paciente" : "pacientes"}` }),
        el("span", { class: "sdd-progress", role: "img", "aria-label": `${done} de ${active} concluídas` }, el("span", { style: `width: ${active ? Math.round((done / active) * 100) : 0}%` })))
      b.addEventListener("click", () => { shiftFilter = value; render() })
      return b
    }
    $("sdd-shift-tabs").replaceChildren(tab("", "Todos os turnos", all), ...shifts.map((s) => tab(s, s, all.filter((e) => e.sch.shift === s))))
  }

  function shiftStats(list) {
    const parts = [["aguardando", "aguardando"], ["em-andamento", "em andamento"], ["concluida", "concluídas"], ["faltas", "faltas"], ["remarcada", "remarcadas"]]
      .map(([s, label]) => [list.filter((e) => matchesStatus(e, s)).length, label, s])
      .filter(([n]) => n > 0)
    const sero = list.filter((e) => isActive(e) && serology(e.patient.id).tags.length).length
    return el("ul", { class: "sdd-shift-stats", "aria-label": "Situação do turno" }, ...parts.map(([n, label, s]) => el("li", { class: `sdd-dot-${s}` }, el("strong", { text: String(n) }), document.createTextNode(` ${label}`))),
      ...(sero ? [el("li", { class: "sdd-dot-sero", title: "Pacientes com sorologia positiva ou desconhecida (RDC 11/2014)" }, el("strong", { text: String(sero) }), document.createTextNode(" com regra de sorologia"))] : []))
  }

  // Visão "Por sala": uma coluna por sala, uma linha compacta por máquina/paciente.
  function roomColumn(room, list, fullRoom, shift) {
    const chairs = chairsOf(room)
    // Sala Q: sob demanda (internados e sessões extras), com o botão para incluir um internado neste turno.
    let qTools = []
    if (chairs.inpatient) {
      const add = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: "Incluir internado" })
      add.addEventListener("click", () => openInpatient(null, { date: day, shift, room }))
      qTools = [
        ...(list.length ? [] : [el("p", { class: "sdd-hint sdd-q-empty", text: "Sob demanda: internados (do setor ou ainda sem cadastro na Nefrologia) e sessões extras." })]),
        ...(canInpatient() && day >= todayIso() ? [el("div", { class: "sdd-q-tools" }, add)] : []),
      ]
    }
    const capacity = chairs.fixed
    const occupied = fullRoom.filter(isActive).length
    const done = fullRoom.filter((e) => e.state === "concluida").length
    const tone = occupied > capacity + chairs.extra ? "is-over" : occupied > capacity ? "is-full" : ""
    const usingExtra = occupied > capacity ? ` (${occupied - capacity} na cadeira extra)` : ""
    return el("article", { class: "sdd-room" },
      el("header", {},
        el("h3", { text: room }),
        el("span", { text: `${done}/${occupied} concluídas` }),
        ...(capacity ? [el("span", { class: `sdd-capacity ${tone}`, title: `Pacientes previstos / ${chairsText(chairs)}${usingExtra}`, text: `${occupied}/${capacity}${chairs.extra ? ` +${chairs.extra}` : ""} cad.` })] : [])),
      ...(list.length ? [el("ul", { class: "sdd-cards" }, ...list.map(patientCard))] : []), ...qTools)
  }

  // Card do paciente na visão "Por sala": máquina e situação no topo, nome, dados da sessão e a ação principal.
  const SESSION_MINUTES = 240 // referência para a barra de tempo da sessão em andamento (4 horas)
  function patientCard(e) {
    const d = describe(e)
    const acts = actionsFor(e)
    const primary = acts.find((a) => a.primary && !a.menuOnly)
    const rest = acts.filter((a) => a !== primary)
    const s = e.session
    // O uso do dialisador só aparece quando está perto do limite (o aviso que importa).
    const usage = s?.usage && !s.singleUse && e.state === "em-andamento" && MAX - Number(s.usage) <= 3 ? usageBadge(s.usage) : null
    const access = s?.access || e.sch.access || ""
    const facts = [
      access ? (isCatheterAccess(access) ? "Cateter" : "FAV") : "",
      s?.dialyzer || e.sch.dialyzer || "",
      e.sch.method === "Hemodiálise Pediátrica" ? "HD pediátrica" : "",
    ].filter(Boolean)
    let progress = null
    if (e.state === "em-andamento" && minutes(s?.start) != null) {
      const done = Math.max(0, minutes(nowTime()) - minutes(s.start))
      const pct = Math.min(100, Math.round((done / SESSION_MINUTES) * 100))
      progress = el("div", { class: "sdd-card-progress", role: "img", "aria-label": `Sessão em andamento há ${fmtDur(done)}` }, el("span", { style: `width: ${pct}%` }))
    }
    return el("li", { class: `sdd-card sdd-${e.state}` },
      el("div", { class: "sdd-card-top" },
        el("span", { class: "sdd-card-machine", title: e.sch.machine || "Máquina a definir", text: e.sch.machine ? `Máq. ${machineShort(e.sch.machine)}` : "Máq. -" }),
        el("span", { class: `hn-badge hn-badge-${d.tone}`, text: d.label })),
      el("div", { class: "sdd-card-body" },
        nameLink(e),
        el("span", { class: "sdd-card-sub", text: `Cód. ${e.patient.code}${facts.length ? ` · ${facts.join(" · ")}` : ""}` }),
        ...[serologyTag(e.patient.id)].filter(Boolean),
        ...(d.detail ? [el("span", { class: "sdd-card-detail", text: d.detail })] : []),
        ...(progress ? [progress] : []),
        ...(d.origin ? [el("span", { class: "sdd-makeup", title: d.originTitle, text: d.origin })] : []),
        ...(usage ? [el("span", { class: "sdd-card-usage" }, usage)] : [])),
      el("div", { class: "sdd-card-actions" },
        ...(primary ? [actionButton(primary, e, true)] : []),
        ...(rest.length ? [menuButton(rest, e)] : [])))
  }

  // Visão "Tabela": todas as colunas e ações visíveis.
  function tableView(list) {
    return el("div", { class: "history-table-wrap sdd-table-wrap" },
      el("table", { class: "table table-sm ev-table sdd-table" },
        el("thead", {}, el("tr", {}, ...["Sala", "Máq.", "Paciente", "Situação", "Horário / detalhe", "Dialisador", "Ações"].map((h) => el("th", { scope: "col", text: h })))),
        el("tbody", {}, ...list.map((e) => {
          const d = describe(e)
          const usage = e.session?.usage ? usageBadge(e.session.usage) : null
          return el("tr", { class: `sdd-tr sdd-${e.state}` },
            el("td", { text: e.sch.room }),
            el("td", { class: "sdd-td-machine", text: machineShort(e.sch.machine) }),
            el("td", {}, el("div", { class: "sdd-row-main" }, nameLink(e), el("span", { class: "sdd-row-sub", text: `Cód. ${e.patient.code}` }), ...[serologyTag(e.patient.id)].filter(Boolean), ...(d.origin ? [el("span", { class: "sdd-makeup", title: d.originTitle, text: d.origin })] : []))),
            el("td", {}, el("span", { class: `hn-badge hn-badge-${d.tone}`, text: d.label })),
            el("td", { class: "sdd-td-detail", text: d.detail || "-" }),
            el("td", {}, ...(usage ? [usage] : [document.createTextNode(e.session?.dialyzer || e.sch.dialyzer || "-")])),
            el("td", { class: "sdd-td-actions" }, el("div", { class: "sdd-actions" }, ...actionsFor(e).filter((a) => !a.menuOnly).map((a) => actionButton(a, e, false)))))
        }))))
  }

  function nameLink(e) {
    if (e.patient.provisional) {
      const b = el("button", { type: "button", class: "sdd-name sdd-name-btn", text: e.patient.name, title: "Internado sem cadastro na Nefrologia: ver internação" })
      b.addEventListener("click", () => openInpatientView(e.inpatient || internados.find((r) => r.id === e.patient.internacaoId)))
      return b
    }
    const a = el("a", { class: "sdd-name", href: `prontuario.html?patient=${e.patient.id}&section=sessoes-dialise`, text: e.patient.name, title: `${e.patient.name} - abrir prontuário em nova aba` })
    a.addEventListener("click", (ev) => { ev.preventDefault(); openRecord(e.patient.id) })
    return a
  }

  function actionButton(action, e, compact) {
    const cls = action.primary ? (action.danger ? "btn-outline-danger" : "btn-primary") : action.danger ? "btn-outline-danger" : "btn-outline-secondary"
    const b = el("button", { class: `btn btn-sm ${cls}`, type: "button", text: compact ? action.short : action.label, "aria-label": `${action.label}: ${e.patient.name}` })
    b.addEventListener("click", action.run)
    return b
  }

  // Menu "mais ações" das linhas compactas.
  let openMenuEl = null
  function closeMenu() {
    if (!openMenuEl) return
    openMenuEl.menu.remove()
    openMenuEl.button.setAttribute("aria-expanded", "false")
    openMenuEl = null
  }
  function menuButton(actions, e) {
    const b = el("button", { class: "btn btn-sm btn-outline-secondary sdd-more", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": `Mais ações: ${e.patient.name}`, title: "Mais ações", text: "⋯" })
    b.addEventListener("click", (ev) => {
      ev.stopPropagation()
      const same = openMenuEl?.button === b
      closeMenu()
      if (same) return
      const menu = el("div", { class: "sdd-menu", role: "menu" }, ...actions.map((a) => {
        const item = el("button", { type: "button", role: "menuitem", class: a.danger ? "is-danger" : "", text: a.label })
        item.addEventListener("click", () => { closeMenu(); a.run() })
        return item
      }))
      document.body.append(menu)
      const r = b.getBoundingClientRect()
      const width = menu.offsetWidth
      menu.style.top = `${r.bottom + window.scrollY + 4}px`
      menu.style.left = `${Math.max(8, Math.min(r.right + window.scrollX - width, window.scrollX + document.documentElement.clientWidth - width - 8))}px`
      b.setAttribute("aria-expanded", "true")
      openMenuEl = { menu, button: b }
      menu.querySelector("button")?.focus()
      menu.addEventListener("keydown", (k) => {
        const items = [...menu.querySelectorAll("button")]
        const i = items.indexOf(document.activeElement)
        if (k.key === "Escape") { k.preventDefault(); closeMenu(); b.focus() }
        if (k.key === "ArrowDown") { k.preventDefault(); items[(i + 1) % items.length].focus() }
        if (k.key === "ArrowUp") { k.preventDefault(); items[(i - 1 + items.length) % items.length].focus() }
      })
    })
    return b
  }
  document.addEventListener("click", (ev) => { if (openMenuEl && !openMenuEl.menu.contains(ev.target)) closeMenu() })
  window.addEventListener("resize", closeMenu)

  // Faltas sem remarcação, de qualquer data (pendência da enfermagem).
  function renderPending() {
    const list = absences.filter((a) => !isMove(a) && !a.makeup).sort((a, b) => a.date.localeCompare(b.date) || shiftOrder(a.shift) - shiftOrder(b.shift))
    const box = $("sdd-pending")
    const badge = $("sdd-moves-badge")
    badge.hidden = !list.length
    badge.textContent = String(list.length)
    badge.title = `${list.length} ${list.length === 1 ? "falta aguardando" : "faltas aguardando"} remarcação`
    const note = $("sdd-pending-note")
    note.hidden = !list.length
    if (list.length) {
      const go = el("button", { type: "button", class: "btn btn-link btn-sm p-0", text: "Ver em Faltas e remarcações" })
      go.addEventListener("click", () => setArea("moves"))
      note.replaceChildren(el("strong", { text: `${list.length} ${list.length === 1 ? "falta aguarda" : "faltas aguardam"} remarcação.` }), document.createTextNode(" "), go)
    }
    if (!list.length) {
      box.replaceChildren(el("header", {}, el("h2", { id: "sdd-pending-title", text: "Faltas a remarcar" })), el("p", { class: "sdd-hint", text: "Nenhuma falta aguardando remarcação." }))
      return
    }
    const nurse = canReschedule()
    box.replaceChildren(
      el("header", {},
        el("h2", { id: "sdd-pending-title" }, document.createTextNode("Faltas a remarcar"), el("span", { class: "hn-badge hn-badge-danger", text: String(list.length) })),
        el("p", { text: nurse ? "Defina a reposição de cada falta: em outro dia ou em outro turno do mesmo dia." : "Faltas registradas que ainda aguardam a remarcação pela enfermeira." })),
      el("div", { class: "history-table-wrap hn-scroll-table sdd-pending-wrap", tabindex: "0", "aria-label": "Faltas a remarcar, com rolagem" },
        el("table", { class: "table table-sm ev-table", "aria-labelledby": "sdd-pending-title" },
          el("thead", {}, el("tr", {}, ...["Data da falta", "Paciente", "Turno / Sala", "Motivo", "Registrada por", ""].map((h) => el("th", { scope: "col", text: h })))),
          el("tbody", {}, ...list.map((a) => {
            const p = M.patient(a.patientId)
            const go = el("button", { type: "button", class: "btn btn-link btn-sm p-0", text: slotText(a).split(",")[0], title: "Ir para o dia" })
            go.addEventListener("click", () => setDay(a.date))
            const acts = el("div", { class: "sdd-actions" })
            if (nurse) {
              const b = el("button", { type: "button", class: "btn btn-sm btn-primary", text: "Remarcar", "aria-label": `Remarcar reposição: ${p?.name || ""}` })
              b.addEventListener("click", () => openReschedule(a))
              acts.append(b)
            }
            const v = el("button", { type: "button", class: "btn btn-sm btn-outline-secondary", text: "Ver", "aria-label": `Ver falta: ${p?.name || ""}` })
            v.addEventListener("click", () => openAbsenceView(a))
            acts.append(v)
            return el("tr", {}, el("td", {}, go), el("td", { text: p ? `${p.name} (${p.code})` : "-" }), el("td", { text: `${a.shift} - ${a.room}` }), el("td", { text: a.reason || "-" }), el("td", { text: a.by || "-" }), el("td", {}, acts))
          })))))
  }

  // ---------- Aba "Faltas e remarcações": o que já está programado ----------
  // Reposições, adiantamentos, adiamentos, trocas de turno e reposições em sessão extra de hoje em diante.
  function moveKind(a) {
    if (a.swapPair) return "Troca de turno"
    if (a.makeup?.extraId) return "Reposição em sessão extra"
    if (!isMove(a)) return "Reposição de falta"
    return direction(a.date, a.makeup.date).short === "Outro turno" ? "Outro turno no mesmo dia" : direction(a.date, a.makeup.date).short === "Adiantada" ? "Adiantamento" : "Adiamento"
  }
  function renderMoves() {
    const box = $("sdd-moves")
    const nurse = canReschedule()
    const list = absences.filter((a) => a.makeup && a.makeup.date >= todayIso())
      .sort((a, b) => a.makeup.date.localeCompare(b.makeup.date) || shiftOrder(a.makeup.shift) - shiftOrder(b.makeup.shift))
    const head = el("header", {},
      el("h2", { id: "sdd-moves-title" }, document.createTextNode("Remarcações programadas"), el("span", { class: "hn-badge hn-badge-info", text: String(list.length) })),
      el("p", { text: "De hoje em diante: reposições de faltas, adiantamentos, adiamentos e trocas de turno." }))
    if (!list.length) { box.replaceChildren(head, el("p", { class: "sdd-hint", text: "Nenhuma remarcação programada." })); return }
    box.replaceChildren(head,
      el("div", { class: "history-table-wrap hn-scroll-table", tabindex: "0", "aria-label": "Remarcações programadas, com rolagem" },
        el("table", { class: "table table-sm ev-table", "aria-labelledby": "sdd-moves-title" },
          el("thead", {}, el("tr", {}, ...["Nova data", "Paciente", "Tipo", "De", "Para", "Motivo", "Por", ""].map((h) => el("th", { scope: "col", text: h })))),
          el("tbody", {}, ...list.map((a) => {
            const p = M.patient(a.patientId)
            const go = el("button", { type: "button", class: "btn btn-link btn-sm p-0", text: slotText(a.makeup).split(",")[0], title: "Ver no quadro do dia" })
            go.addEventListener("click", () => { setDay(a.makeup.date); setArea("board") })
            const acts = el("div", { class: "sdd-actions" })
            const v = el("button", { type: "button", class: "btn btn-sm btn-outline-secondary", text: "Ver", "aria-label": `Ver: ${p?.name || ""}` })
            v.addEventListener("click", () => openAbsenceView(a))
            acts.append(v)
            if (nurse && !makeupLocked(a)) {
              const b = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: a.swapPair ? "Desfazer troca" : "Alterar" })
              b.addEventListener("click", () => (a.swapPair ? undoSwap(a) : a.makeup.extraId ? openExtra(extras.find((x) => x.id === a.makeup.extraId)) : openReschedule(a)))
              acts.append(b)
            }
            return el("tr", {}, el("td", {}, go), el("td", { text: p ? `${p.name} (${p.code})` : "-" }), el("td", { text: moveKind(a) }),
              el("td", { text: shortSlot(a) }), el("td", { text: shortSlot(a.makeup) }), el("td", { class: "sdd-td-wrap", text: a.reason || "-" }), el("td", { text: a.makeup.by || a.by || "-" }), el("td", {}, acts))
          })))))
  }

  // ---------- Aba "Sessões extras" ----------
  function renderExtras() {
    const box = $("sdd-extras")
    const nurse = canExtra()
    const list = extras.filter((x) => x.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date) || shiftOrder(a.shift) - shiftOrder(b.shift))
    const badge = $("sdd-extras-badge")
    badge.hidden = !list.length
    badge.textContent = String(list.length)
    const open = el("button", { type: "button", class: "btn btn-sm btn-primary", id: "sdd-open-extra", text: "Abrir sessão extra" })
    open.addEventListener("click", () => openExtra())
    const head = el("header", {},
      el("h2", { id: "sdd-extras-title" }, document.createTextNode("Sessões extras"), el("span", { class: "hn-badge hn-badge-info", text: String(list.length) })),
      el("p", { text: "Sessão extra por orientação médica. Escolha o dia, o horário, a sala, o médico que orientou e os pacientes." }),
      ...(nurse ? [open] : []))
    if (!list.length) { box.replaceChildren(head, el("p", { class: "sdd-hint", text: "Nenhuma sessão extra programado." })); return }
    box.replaceChildren(head,
      el("div", { class: "history-table-wrap hn-scroll-table", tabindex: "0", "aria-label": "Sessões extras, com rolagem" },
        el("table", { class: "table table-sm ev-table", "aria-labelledby": "sdd-extras-title" },
          el("thead", {}, el("tr", {}, ...["Dia", "Horário", "Sala", "Pacientes", "Orientação médica", "Observações", "Aberto por", ""].map((h) => el("th", { scope: "col", text: h })))),
          el("tbody", {}, ...list.map((x) => {
            const ids = [...absences.filter((a) => a.makeup?.extraId === x.id).map((a) => a.patientId), ...x.patientIds]
            const names = ids.map((id) => M.patient(id)?.name).filter(Boolean)
            const go = el("button", { type: "button", class: "btn btn-sm btn-outline-secondary", text: "Ver no quadro" })
            go.addEventListener("click", () => { shiftFilter = x.shift; setDay(x.date); setArea("board") })
            const acts = el("div", { class: "sdd-actions" }, go)
            if (nurse) {
              const b = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: "Editar" })
              b.addEventListener("click", () => openExtra(x))
              acts.append(b)
            }
            return el("tr", {}, el("td", { text: `${formatDate(x.date)} (${WEEKDAYS_SHORT[M.weekday(x.date)]})` }), el("td", { text: x.start }), el("td", { text: x.room }),
              el("td", { class: "sdd-td-wrap", text: `${ids.length}: ${names.join(", ")}` }),
              el("td", { class: "sdd-td-wrap", text: x.doctorName ? `${x.doctorName}${x.reason ? ` · ${x.reason}` : ""}` : "-" }), el("td", { class: "sdd-td-wrap", text: x.note || "-" }), el("td", { text: x.by || "-" }), el("td", {}, acts))
          })))))
  }

  // ---------- Áreas da tela (abas no estilo da Nutrição) ----------
  const AREAS = ["board", "moves", "extras", "internados"]
  function setArea(area) {
    AREAS.forEach((a) => {
      const tab = $(`sdd-area-${a}`)
      const on = a === area
      tab.setAttribute("aria-selected", String(on))
      tab.tabIndex = on ? 0 : -1
      $(`sdd-panel-${a}`).hidden = !on
    })
    storage.set("huNefroSddArea", area)
  }
  AREAS.forEach((a, i) => {
    const tab = $(`sdd-area-${a}`)
    tab.addEventListener("click", () => setArea(a))
    tab.addEventListener("keydown", (ev) => {
      if (!["ArrowRight", "ArrowLeft"].includes(ev.key)) return
      const next = AREAS[(i + (ev.key === "ArrowRight" ? 1 : AREAS.length - 1)) % AREAS.length]
      setArea(next)
      $(`sdd-area-${next}`).focus()
    })
  })

  // ---------- Troca de turno entre dois pacientes do mesmo dia (enfermeira) ----------
  const swappable = (x) => ["aguardando", "prevista"].includes(x.state) && !x.makeupOf && !x.session && !x.absence && !x.extra && !isExtraShift(x.sch.shift)
  function openSwap(e) {
    if (!canReschedule()) return
    const candidates = entries().filter((x) => swappable(x) && x.sch.shift !== e.sch.shift && x.patient.id !== e.patient.id)
      .sort((a, b) => shiftOrder(a.sch.shift) - shiftOrder(b.sch.shift) || a.sch.room.localeCompare(b.sch.room) || a.patient.name.localeCompare(b.patient.name))
    const fields = [{ key: "note", label: "Observações", kind: "textarea", cls: "ph-f12" }]
    const body = form([["Observações", fields]])
    let chosen = null
    const search = el("input", { class: "form-control form-control-sm", id: "sdd-sw-search", type: "search", autocomplete: "off", placeholder: "Nome, código, turno ou sala" })
    const listBox = el("ul", { class: "sdd-extra-list", "aria-label": "Pacientes do mesmo dia em outros turnos" })
    const renderList = () => {
      const q = normalize(search.value.trim())
      const shown = candidates.filter((x) => !q || normalize(`${x.patient.name} ${x.patient.code} ${x.sch.shift} ${x.sch.room}`).includes(q))
      listBox.replaceChildren(...shown.map((x) => {
        const id = `sdd-sw-${x.patient.id}-${shiftOrder(x.sch.shift)}`
        const radio = el("input", { type: "radio", name: "sdd-sw", id })
        radio.checked = chosen === x
        radio.addEventListener("change", () => { chosen = x; showError("") })
        return el("li", {}, el("label", { class: "sdd-extra-item", for: id }, radio,
          el("span", {}, el("strong", { text: x.patient.name }), el("small", { text: ` Cód. ${x.patient.code} · ${x.sch.shift} · ${x.sch.room}${x.sch.machine ? ` · ${x.sch.machine}` : ""}` }))))
      }))
      if (!shown.length) listBox.append(el("li", { class: "sdd-hint", text: "Nenhum paciente disponível para troca." }))
    }
    search.addEventListener("input", (ev) => { ev.stopPropagation(); renderList() })
    body.prepend(
      el("h4", { text: "Trocar com" }),
      el("p", { class: "sdd-hint ph-f12", text: `Os dois pacientes trocam de turno e sala em ${formatDate(day)}. Só aparecem pacientes que ainda não iniciaram a sessão.` }),
      el("div", { class: "field-block ph-f12" }, el("label", { class: "field-label", for: "sdd-sw-search", text: "Buscar paciente" }), search),
      el("div", { class: "ph-f12 sdd-extra-box" }, listBox))
    renderList()
    openDialog(e, `Trocar de turno em ${formatDate(day)}`, "Trocar de turno", body, () => {
      if (!chosen) return ["Escolha o paciente para a troca.", search]
      const [values] = read(fields)
      const s = stamp()
      const pair = `${Date.now()}`
      const move = (from, to, other) => faltas.save({
        kind: "remarcacao", patientId: from.patient.id, date: day, shift: from.sch.shift, room: from.sch.room, makeupOf: null,
        reason: `Troca de turno com ${other.patient.name}`, note: values.note, swapPair: pair, swapWith: other.patient.id,
        makeup: { date: day, shift: to.sch.shift, room: to.sch.room, ...s }, ...s,
      })
      move(e, chosen, chosen)
      move(chosen, e, e)
      return null
    })
  }
  function undoSwap(a) {
    if (!canReschedule()) return
    absences.filter((x) => x.swapPair === a.swapPair).forEach((x) => faltas.remove(x.id))
    reload()
    render()
  }

  function usageBadge(uses) {
    const n = Number(uses)
    const tone = n >= MAX ? "danger" : MAX - n <= 3 ? "warn" : "off"
    return el("span", { class: `hn-badge hn-badge-${tone}`, title: `Uso do dialisador: ${n} de ${MAX}`, text: `dialisador ${n}/${MAX}` })
  }

  function openRecord(patientId) {
    const url = `prontuario.html?patient=${patientId}&section=sessoes-dialise`
    const tab = window.open(url, `hunefro-prontuario-${patientId}`)
    if (tab) tab.focus()
    else window.location.assign(url)
  }

  // ---------- Diálogo ----------
  const dialog = $("sdd-dialog")
  let controls = {}, onSubmit = null, returnFocus = null, refreshCalc = null
  const showError = (m) => { $("sdd-dialog-error").textContent = m; $("sdd-dialog-error").hidden = !m }
  function closeDialog() { if (dialog.open) dialog.close(); refreshCalc = null; returnFocus?.isConnected && returnFocus.focus() }
  $("sdd-dialog-cancel").addEventListener("click", closeDialog)
  $("sdd-dialog-close").addEventListener("click", closeDialog)
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); closeDialog() })
  $("sdd-dialog-form").addEventListener("submit", (ev) => {
    ev.preventDefault()
    const error = onSubmit?.()
    if (error) { showError(error[0]); error[1]?.focus(); return }
    closeDialog()
    reload()
    render()
  })
  $("sdd-dialog-body").addEventListener("input", () => { showError(""); refreshCalc?.() })
  $("sdd-dialog-body").addEventListener("change", () => refreshCalc?.())

  function openDialog(e, title, confirmText, body, submit, calc) {
    returnFocus = document.activeElement
    $("sdd-dialog-title").textContent = title
    $("sdd-dialog-sub").textContent = e.sub ?? `${e.patient.name} · Cód. ${e.patient.code} · ${e.sch.shift} · ${e.sch.room}`
    $("sdd-dialog-body").replaceChildren(body)
    $("sdd-dialog-confirm").textContent = confirmText
    $("sdd-dialog-confirm").hidden = !submit
    $("sdd-dialog-cancel").textContent = submit ? "Cancelar" : "Fechar"
    onSubmit = submit
    refreshCalc = calc || null
    showError("")
    dialog.showModal()
    refreshCalc?.()
    body.querySelector("input:not([readonly]), select")?.focus()
  }

  // field: { key, label, kind, req, cls, options, value, min, max, unit, empty }
  function field(f) {
    const id = `sdd-f-${f.key}`
    let control
    if (f.kind === "other") {
      const built = createSelectWithOther({ id, options: f.options, otherLabel: f.other, placeholder: f.placeholder || "Informe o dialisador", value: f.value ?? "" })
      controls[f.key] = built.control
      return el("div", { class: `field-block ${f.cls || "ph-f3"}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), built.root)
    }
    if (f.kind === "check") {
      control = el("input", { type: "checkbox", id })
      control.checked = Boolean(f.value)
      controls[f.key] = control
      return el("label", { class: `md-check ${f.cls || "ph-f3"}` }, control, el("span", { text: f.label }))
    }
    if (f.kind === "select") control = el("select", { class: "form-select", id }, el("option", { value: "", text: f.empty || "Selecione" }), ...f.options.map(([v, l]) => el("option", { value: v, text: l })))
    else if (f.kind === "textarea") control = el("textarea", { class: "form-control", id, rows: "2" })
    else if (f.kind === "date") control = el("input", { class: "form-control", id, type: "date" })
    else control = el("input", { class: `form-control${f.kind === "auto" ? " derived-field" : ""}`, id, type: "text", autocomplete: "off", readonly: f.kind === "auto", tabindex: f.kind === "auto" ? "-1" : false, inputmode: f.kind === "number" ? "decimal" : f.kind === "time" ? "numeric" : false, placeholder: f.kind === "time" ? "hh:mm" : f.kind === "pa" ? "120/80" : "" })
    control.value = f.kind === "number" && f.value ? dec(f.value) : f.value ?? ""
    controls[f.key] = control
    return el("div", { class: `field-block ${f.cls || "ph-f3"}` }, el("label", { class: "field-label", for: id, text: f.req ? `${f.label} *` : f.label }), control)
  }

  // Lê e valida os campos; devolve [valores] ou [null, [mensagem, campo]].
  function read(fields) {
    const out = {}
    for (const f of fields) {
      const c = controls[f.key]
      if (f.kind === "auto") continue
      if (f.kind === "check") { out[f.key] = c.checked; continue }
      if (c.missingOther) return [null, [f.missingText || "Informe qual é o outro dialisador.", c]]
      const v = c.value.trim()
      const name = f.label.replace(/ \(.*\)/, "")
      if (f.req && !v) return [null, [`Informe o campo "${name}" (obrigatório).`, c]]
      out[f.key] = v
      if (!v) continue
      if (f.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return [null, [`${name}: data inválida.`, c]]
      if (f.kind === "time") {
        const t = normTime(v)
        if (minutes(t) == null || minutes(t) > 1439) return [null, [`${name}: use hh:mm (00:00 a 23:59).`, c]]
        out[f.key] = t
      }
      if (f.kind === "pa") {
        const pa = parsePa(v)
        if (!pa) return [null, [`${name} inválida. Use sistólica/diastólica, ex.: 120/80.`, c]]
        out[f.key] = pa
      }
      if (f.kind === "number") {
        const n = parseNumber(v)
        if (!Number.isFinite(n) || n < f.min || n > f.max) return [null, [`${name} deve estar entre ${f.min} e ${f.max}${f.unit ? ` ${f.unit}` : ""}.`, c]]
        out[f.key] = String(n)
      }
    }
    return [out]
  }

  function form(groups) {
    controls = {}
    const box = el("div", { class: "ph-form" })
    groups.forEach(([title, fields, extra = []]) => box.append(el("h4", { text: title }), ...fields.map(field), ...extra))
    return box
  }

  // ---------- Iniciar sessão ----------
  function openStart(e) {
    const last = lastBefore(e.patient.id)
    const sero = serology(e.patient.id)
    const base = { ...e.sch, ...(last ? { dialyzer: last.dialyzer, access: last.access || e.sch.access, dryWeight: last.dryWeight || e.sch.dryWeight, heparin: last.heparin || e.sch.heparin, bloodFlow: last.bloodFlow || e.sch.bloodFlow, machine: e.makeupOf ? "" : e.sch.machine || last.machine } : {}) }
    const fields = [
      ["Chegada do paciente", [
        { key: "start", label: "Início (hh:mm)", kind: "time", req: true, value: nowTime() },
        { key: "machine", label: "Máquina", kind: "text", value: base.machine },
        { key: "responsible", label: sero.exclusiveProfessional ? "Responsável (exclusivo)" : "Responsável", kind: "select", options: C.professionalOptions(), req: sero.exclusiveProfessional, cls: "ph-f6" },
      ], (sero.rules.length ? [el("div", { class: `hn-alert hn-alert-${sero.tone === "danger" ? "danger" : "warn"} ph-f12`, role: "alert" },
        el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }),
        el("div", {}, el("strong", { text: `${sero.tags.join(", ")}: regras da RDC ANVISA nº 11/2014` }),
          el("ul", { class: "sdd-sero-rules" }, ...sero.rules.map((r) => el("li", { text: r })))))] : []).concat(
        // Situação da máquina no cadastro da Gestão (manutenção, desativada ou exclusiva).
        el("div", { class: "hn-alert ph-f12", id: "sdd-machine-alert", role: "status", hidden: true })),
      ],
      ["Dialisador e acesso", [
        { key: "method", label: "Método de tratamento", kind: "select", options: METHODS, value: base.method || "Hemodiálise" },
        { key: "dialyzer", label: "Dialisador", kind: "other", options: DIALYZERS, other: "Outro dialisador", value: base.dialyzer },
        { key: "newDialyzer", label: "Dialisador novo nesta sessão", kind: "check" },
        { key: "usage", label: "Uso do dialisador (automático)", kind: "auto" },
        { key: "access", label: "Acesso", kind: "text", value: base.access, cls: "ph-f6" },
        { key: "needle", label: "Agulha (FAV ou enxerto)", kind: "text" },
        { key: "heparin", label: "Heparina (UI)", kind: "number", min: 0, max: 50000, unit: "UI", value: base.heparin },
        { key: "bloodFlow", label: "Fluxo de sangue (mL/min)", kind: "number", min: 0, max: 600, unit: "mL/min", value: base.bloodFlow },
      ], [
        el("p", { class: "sdd-needle-note ph-f6", id: "sdd-needle-note", hidden: true, text: "Acesso por cateter: sem punção, a agulha não se aplica." }),
        el("div", { class: "hn-alert sd-usage-info", id: "sdd-usage-alert", role: "status", hidden: true }),
      ]],
      ["Peso e PA iniciais", [
        { key: "dryWeight", label: "Peso seco (kg)", kind: "number", min: 1, max: 400, unit: "kg", value: base.dryWeight },
        { key: "weightStart", label: "Peso inicial (kg)", kind: "number", min: 1, max: 400, unit: "kg", req: true },
        { key: "pa", label: "PA inicial (mmHg)", kind: "pa", req: true },
        { key: "extra", label: `${SALINE_LABEL}, previsto`, kind: "select", options: SALINE, empty: "Nenhum", value: base.extra || "" },
      ], [el("p", { class: "form-text ph-f12 sdd-saline-note", text: SALINE_NOTE }), el("div", { class: "sd-calc", id: "sdd-calc", "aria-live": "polite" })]],
    ]
    const flat = fields.flatMap(([, f]) => f)
    const draft = () => ({ id: -1, patientId: e.patient.id, date: day, start: normTime(controls.start.value.trim()), dialyzer: controls.dialyzer.value, newDialyzer: sero.singleUse || controls.newDialyzer.checked, singleUse: sero.singleUse })
    const calc = () => {
      if (sero.singleUse) {
        // Uso único: não há contagem de reuso nem a opção "Dialisador novo".
        controls.newDialyzer.closest(".md-check").hidden = true
        controls.usage.value = "Uso único"
        $("sdd-usage-alert").hidden = true
      }
      const machineNotice = window.HuNefroAdmin?.machineNotice?.(e.sch.room, controls.machine.value)
      const machineAlert = $("sdd-machine-alert")
      machineAlert.hidden = !machineNotice
      if (machineNotice) {
        machineAlert.className = `hn-alert hn-alert-${machineNotice[0]} ph-f12`
        machineAlert.replaceChildren(el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }), el("span", { text: machineNotice[1] }))
      }
      // Cateter: sem punção, então o campo Agulha some e fica vazio.
      const catheter = isCatheterAccess(controls.access.value)
      controls.needle.closest(".field-block").hidden = catheter
      if (catheter) controls.needle.value = ""
      $("sdd-needle-note").hidden = !catheter
      const rec = draft()
      const uses = sero.singleUse ? null : store.dialyzerUse(history(e.patient.id), rec)
      if (!sero.singleUse) controls.usage.value = uses == null ? "" : `${uses} de ${MAX}`
      const notice = useNotice(uses)
      const alert = $("sdd-usage-alert")
      alert.hidden = !notice
      if (notice) {
        alert.className = `hn-alert ${notice[0] === "info" ? "sd-usage-info" : `hn-alert-${notice[0]}`}`
        alert.replaceChildren(el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: notice[0] === "info" ? "i" : "!" }), el("span", { text: notice[1] }))
      }
      const ws = hasNum(controls.weightStart.value) ? parseNumber(controls.weightStart.value) : null
      const dw = hasNum(controls.dryWeight.value) ? parseNumber(controls.dryWeight.value) : null
      const extra = hasNum(controls.extra.value) ? parseNumber(controls.extra.value) / 1000 : 0
      const prevEnd = last && hasNum(last.weightEnd) ? parseNumber(last.weightEnd) : null
      $("sdd-calc").replaceChildren(
        el("span", { text: `Peso a perder: ${ws != null && dw != null ? fmtKg(ws - dw + extra) : "-"}` }),
        el("span", { text: `Ganho interdialítico: ${ws != null && prevEnd != null ? fmtKg(ws - prevEnd) : "-"}` }),
        el("span", { text: `Sobrepeso: ${ws != null && dw ? `${dec(Math.round(((ws - dw) / dw) * 10000) / 100)} %` : "-"}` }),
        el("span", { text: `Última sessão: ${last ? `${formatDate(last.date)}, peso final ${hasNum(last.weightEnd) ? fmtKg(parseNumber(last.weightEnd)) : "-"}` : "nenhuma"}` }),
      )
    }
    openDialog(e, "Iniciar sessão de hemodiálise", "Iniciar sessão", form(fields), () => {
      const [values, error] = read(flat)
      if (error) return error
      if (values.dryWeight && parseNumber(values.weightStart) < parseNumber(values.dryWeight) - 5) return ["O peso inicial está muito abaixo do peso seco. Confira os valores (kg).", controls.weightStart]
      const { pa, ...fieldsOnly } = values
      if (isCatheterAccess(fieldsOnly.access)) fieldsOnly.needle = ""
      const rec = { ...draft(), ...fieldsOnly, newDialyzer: sero.singleUse || fieldsOnly.newDialyzer, singleUse: sero.singleUse }
      if (sero.exclusiveProfessional || values.responsible) {
        // Profissional exclusivo (arts. 15 e 16): não pode atender outro paciente ao mesmo tempo, nos dois sentidos.
        const busy = sessions.filter((x) => x.date === day && x.state === "em-andamento" && x.responsible === values.responsible && x.patientId !== e.patient.id)
        if (values.responsible && busy.length && (sero.exclusiveProfessional || busy.some((x) => serology(x.patientId).exclusiveProfessional))) {
          const other = M.patient(busy[0].patientId)?.name || "outro paciente"
          return [sero.exclusiveProfessional
            ? `Este paciente exige profissional exclusivo (RDC 11/2014), e ${profName(values.responsible)} já atende ${other}. Escolha outro responsável.`
            : `${profName(values.responsible)} é o profissional exclusivo de ${other} (sorologia, RDC 11/2014). Escolha outro responsável.`, controls.responsible]
        }
      }
      const uses = store.dialyzerUse(history(e.patient.id), rec)
      if (uses != null && uses > MAX) return [`O dialisador passaria do limite de ${MAX} usos. Troque o dialisador e marque "Dialisador novo nesta sessão".`, controls.newDialyzer]
      const number = String(store.sessionNumber(history(e.patient.id), rec))
      delete rec.id
      store.save({
        ...rec, state: "em-andamento", room: e.sch.room, shift: e.sch.shift,
        end: "", weightEnd: "", uf: "", complications: "", notes: "", solution: e.sch.solution || "",
        number, usage: uses == null ? "" : String(uses), usageMax: String(MAX),
        measures: [{ time: values.start, pa, fc: "", tax: "", hep: "", flow: values.bloodFlow || "", pArt: "", pVen: "" }],
        by: currentUserName(),
      })
      return null
    }, calc)
  }

  function useNotice(uses) {
    if (uses == null) return null
    const left = MAX - uses
    if (uses > MAX) return ["danger", `Dialisador no ${uses}º uso: o limite é de ${MAX} usos. Troque o dialisador e marque "Dialisador novo nesta sessão".`]
    if (left === 0) return ["danger", `Último uso permitido do dialisador (${uses} de ${MAX}). Descarte após esta sessão.`]
    if (left <= 3) return ["warn", `Dialisador no ${uses}º uso de ${MAX}: restam ${left} ${left === 1 ? "uso" : "usos"}.`]
    return ["info", `Dialisador no ${uses}º uso de ${MAX} (restam ${left}).`]
  }

  // ---------- Aferição durante a sessão ----------
  function openMeasure(e) {
    const s = e.session
    const fields = MEASURE_FIELDS.map((f) => ({ ...f, cls: "ph-f3", value: f.key === "time" ? nowTime() : "" }))
    const list = s.measures?.length ? measuresTable(s.measures) : el("p", { class: "ev-empty", text: "Nenhuma aferição registrada." })
    openDialog(e, "Registrar aferição", "Gravar aferição", form([["Nova aferição", fields], ["Aferições desta sessão", [], [el("div", { class: "ph-f12" }, list)]]]), () => {
      const [values, error] = read(fields)
      if (error) return error
      if (MEASURE_FIELDS.slice(1).every((f) => !values[f.key])) return ["Preencha pelo menos um valor além da hora.", controls.pa]
      if (minutes(values.time) < minutes(s.start)) return ["A hora da aferição não pode ser anterior ao início da sessão.", controls.time]
      const measures = [...(s.measures || []), values].sort((a, b) => a.time.localeCompare(b.time))
      store.save({ ...s, measures })
      return null
    })
  }

  function measuresTable(measures) {
    return el("div", { class: "sd-measure-wrap" }, el("table", { class: "table table-sm sd-measures" },
      el("thead", {}, el("tr", {}, ...MEASURE_FIELDS.map((f) => el("th", { scope: "col", text: f.label.replace(/ \(.*\)/, "") })))),
      el("tbody", {}, ...measures.map((m) => el("tr", {}, ...MEASURE_FIELDS.map((f) => el("td", { text: m[f.key] ? (f.kind === "number" ? dec(m[f.key]) : m[f.key]) : "-" })))))))
  }

  // ---------- Concluir sessão ----------
  function openFinish(e) {
    const s = e.session
    const fields = [
      ["Fim da sessão", [
        { key: "end", label: "Fim (hh:mm)", kind: "time", req: true, value: nowTime() },
        { key: "weightEnd", label: "Peso final (kg)", kind: "number", min: 1, max: 400, unit: "kg", req: true },
        { key: "uf", label: "UF (mL)", kind: "number", min: 0, max: 10000, unit: "mL", req: true },
        { key: "pa", label: "PA final (mmHg)", kind: "pa", req: true },
        { key: "extra", label: SALINE_LABEL, kind: "select", options: SALINE, empty: "Nenhum", value: s.extra || "" },
      ], [el("p", { class: "form-text ph-f12 sdd-saline-note", text: SALINE_NOTE }), el("div", { class: "sd-calc", id: "sdd-calc", "aria-live": "polite" })]],
      ["Complicações e observações", [
        { key: "complications", label: "Complicações / medicações", kind: "text", cls: "ph-f12" },
        { key: "notes", label: "Observações", kind: "textarea", cls: "ph-f12" },
      ]],
    ]
    const flat = fields.flatMap(([, f]) => f)
    let ufTouched = false
    const calc = () => {
      const ws = parseNumber(s.weightStart)
      const we = hasNum(controls.weightEnd.value) ? parseNumber(controls.weightEnd.value) : null
      // Sugere a UF pelo peso perdido enquanto o usuário não digitar o valor da máquina.
      if (!ufTouched && we != null && we <= ws) controls.uf.value = String(Math.round((ws - we) * 1000))
      const end = minutes(normTime(controls.end.value.trim()))
      $("sdd-calc").replaceChildren(
        el("span", { text: `Peso inicial: ${fmtKg(ws)}` }),
        el("span", { text: `Peso perdido: ${we != null ? fmtKg(ws - we) : "-"}` }),
        el("span", { text: `Peso a perder: ${hasNum(s.dryWeight) ? fmtKg(ws - parseNumber(s.dryWeight) + (hasNum(controls.extra.value) ? parseNumber(controls.extra.value) / 1000 : 0)) : "-"}` }),
        el("span", { text: `Duração: ${end != null && end > minutes(s.start) ? fmtDur(end - minutes(s.start)) : "-"}` }),
      )
    }
    openDialog(e, "Concluir sessão de hemodiálise", "Concluir sessão", form(fields), () => {
      const [values, error] = read(flat)
      if (error) return error
      if (minutes(values.end) <= minutes(s.start)) return [`O fim da sessão deve ser posterior ao início (${s.start}).`, controls.end]
      if (parseNumber(values.weightEnd) > parseNumber(s.weightStart) + 2) return ["O peso final está bem acima do peso inicial. Confira os valores (kg).", controls.weightEnd]
      const { pa, ...rest } = values
      const measures = [...(s.measures || []), { time: values.end, pa, fc: "", tax: "", hep: "", flow: "", pArt: "", pVen: "" }].sort((a, b) => a.time.localeCompare(b.time))
      store.save({ ...s, ...rest, measures, state: "concluida", closedBy: currentUserName() })
      return null
    }, calc)
    controls.uf.addEventListener("input", () => (ufTouched = true))
  }

  // ---------- Falta e remarcação ----------
  // O técnico registra a falta (motivo e observações). A enfermeira define a reposição ou remarca uma sessão
  // que ainda não aconteceu, para antes (adiantamento) ou depois (adiamento) da data prevista.
  const pseudoEntry = (a) => ({ patient: M.patient(a.patientId), sch: { patientId: a.patientId, shift: a.shift, room: a.room } })
  // A reposição/remarcação já aconteceu (sessão gravada ou nova falta nela): não pode mais ser alterada.
  function makeupLocked(a) {
    if (!a?.makeup) return false
    return sessions.some((s) => s.patientId === a.patientId && s.date === a.makeup.date && (!s.shift || s.shift === a.makeup.shift)) ||
      absences.some((x) => x.makeupOf === a.id)
  }

  // Sugestão de reposição: primeiro dia depois da data em que o paciente não tem HD na escala (não domingo, não passado).
  function suggestMakeupDate(orig, sch) {
    for (let n = 1; n <= MAX_MOVE_DAYS; n += 1) {
      const d = M.addDays(orig.date, n)
      if (d >= todayIso() && M.weekday(d) !== 0 && !(sch?.days || []).includes(M.weekday(d))) return d
    }
    const next = M.addDays(orig.date, 1)
    return next >= todayIso() ? next : todayIso()
  }
  const lastAllowed = (orig) => M.addDays(orig.date > todayIso() ? orig.date : todayIso(), MAX_MOVE_DAYS)

  // Campos do novo horário (data, turno e sala) com atalhos de data e o resumo do horário escolhido.
  // Turno para o atalho "Mesmo dia": o seguinte ao original; numa remarcação (antes de a sessão acontecer) também
  // pode ser um anterior. Reposição de falta no mesmo dia só em turno posterior.
  function sameDayShift(orig, isFalta) {
    const names = SHIFTS.map(([v]) => v)
    return names.find((s) => shiftOrder(s) > shiftOrder(orig.shift)) || (isFalta ? "" : names.find((s) => s !== orig.shift) || "")
  }
  function slotFields(orig, initial, isFalta) {
    const chips = el("div", { class: "sdd-chips ph-f12", role: "group", "aria-label": "Atalhos de data" })
    ;[[-2, "2 dias antes"], [-1, "1 dia antes"], [0, "Mesmo dia"], [1, "1 dia depois"], [2, "2 dias depois"]].forEach(([n, label]) => {
      const d = M.addDays(orig.date, n)
      const sameShift = n === 0 ? sameDayShift(orig, isFalta) : ""
      const b = el("button", { type: "button", class: "sdd-chip", text: `${label} (${formatDate(d).slice(0, 5)} ${WEEKDAYS_SHORT[M.weekday(d)]})`, disabled: d < todayIso() || (n === 0 && !sameShift) })
      b.addEventListener("click", () => {
        controls.date.value = d
        if (n === 0 && controls.shift.value === orig.shift) controls.shift.value = sameShift
        controls.date.dispatchEvent(new Event("input", { bubbles: true }))
      })
      chips.append(b)
    })
    return {
      fields: [
        { key: "date", label: "Nova data", kind: "date", req: true, value: initial.date, cls: "ph-f4" },
        { key: "shift", label: "Turno", kind: "select", options: SHIFTS, req: true, value: initial.shift, cls: "ph-f4" },
        { key: "room", label: "Sala", kind: "select", options: ROOMS, req: true, value: initial.room, cls: "ph-f4" },
      ],
      extra: [chips, el("div", { class: "sd-calc sdd-slot-calc", id: "sdd-calc", "aria-live": "polite" })],
    }
  }

  // Problema que impede o novo horário ("" quando está tudo certo).
  function slotProblem(orig, target, patientId, absenceId, isFalta) {
    if (!target.date || !target.shift || !target.room) return ""
    if (target.date === orig.date && target.shift === orig.shift) return "Escolha outra data ou outro turno: este é o horário original."
    if (isFalta && target.date === orig.date && shiftOrder(target.shift) < shiftOrder(orig.shift)) return `Reposição no mesmo dia da falta só em turno posterior ao ${orig.shift}.`
    if (target.date < todayIso()) return "A nova data não pode ser anterior a hoje."
    if (daysBetween(orig.date, target.date) < -MAX_MOVE_DAYS) return `O adiantamento pode ser de no máximo ${MAX_MOVE_DAYS} dias antes de ${formatDate(orig.date)}.`
    if (target.date > lastAllowed(orig)) return `A remarcação pode ser até ${formatDate(lastAllowed(orig))} (${MAX_MOVE_DAYS} dias).`
    const other = entries(target.date).find((x) => x.patient.id === patientId && isActive(x) &&
      !(x.date === orig.date && x.sch.shift === orig.shift) && !(absenceId && x.makeupOf?.id === absenceId))
    if (other) return `O paciente já tem hemodiálise em ${formatDate(target.date)} (${other.sch.shift}, ${other.sch.room}).`
    return ""
  }

  function renderSlotCalc(orig, patientId, absenceId, isFalta) {
    const target = { date: controls.date.value, shift: controls.shift.value, room: controls.room.value }
    const box = $("sdd-calc")
    if (!target.date || !target.shift || !target.room) { box.replaceChildren(el("span", { text: "Escolha a data, o turno e a sala." })); return }
    const dir = direction(orig.date, target.date)
    const busy = entries(target.date).filter((x) => x.sch.shift === target.shift && x.sch.room === target.room && x.patient.id !== patientId && isActive(x)).length
    const chairs = chairsOf(target.room)
    const capacity = chairs.fixed
    const problem = slotProblem(orig, target, patientId, absenceId, isFalta)
    const warns = []
    if (M.weekday(target.date) === 0) warns.push("Domingo: confirme se a unidade vai funcionar.")
    if (capacity && busy >= capacity + chairs.extra) warns.push(`Sala sem cadeira livre neste turno, nem a extra (${busy} de ${chairsText(chairs)}). Confirme com a equipe.`)
    if (INPATIENT[target.room]) warns.push(`${target.room} é reservada para pacientes internados: confirme com a equipe que há vaga neste turno.`)
    else if (capacity && busy >= capacity) warns.push(`As cadeiras fixas estão ocupadas: o paciente vai para a cadeira extra da ${target.room}.`)
    box.replaceChildren(
      el("span", { class: `sdd-dir sdd-dir-${dir.kind}`, text: dir.label }),
      el("span", { text: `Novo horário: ${slotText(target)}` }),
      el("span", { text: `${target.room}, ${target.shift}: ${busy} ${busy === 1 ? "paciente previsto" : "pacientes previstos"}${capacity ? ` para ${chairsText(chairs)}` : ""}` }),
      ...warns.map((w) => el("span", { class: "sdd-calc-note", text: w })),
      ...(problem ? [el("span", { class: "sdd-calc-warn", text: problem })] : []),
    )
  }

  const stamp = () => ({ by: currentUserName(), byProfile: sessao?.profileLabel() || "", at: new Date().toISOString() })

  // Registrar falta: qualquer perfil. A enfermeira pode já remarcar a reposição (ou deixar para depois).
  function openAbsence(e) {
    const nurse = canReschedule()
    const orig = { date: day, shift: e.sch.shift, room: e.sch.room }
    const absenceFields = [
      { key: "reason", label: "Motivo", kind: "other", options: ABSENCE_REASONS, other: "Outro motivo", placeholder: "Informe o motivo", missingText: "Informe o motivo da falta.", req: true, cls: "ph-f6" },
      { key: "note", label: "Observações", kind: "textarea", cls: "ph-f12" },
    ]
    const groups = [["Falta", absenceFields]]
    let slot = null
    if (nurse) {
      slot = slotFields(orig, { date: suggestMakeupDate(orig, e.sch), shift: e.sch.shift, room: e.sch.room }, true)
      groups.push(["Reposição da sessão", [{ key: "later", label: "Remarcar a reposição depois", kind: "check", cls: "ph-f12" }, ...slot.fields], slot.extra])
    } else {
      groups.push(["Reposição da sessão", [], [el("div", { class: "hn-alert sd-usage-info ph-f12", role: "note" },
        el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "i" }),
        el("span", { text: "A remarcação é feita pela enfermeira. A falta fica na lista \"Faltas a remarcar\" até ela definir a reposição." }))]])
    }
    const body = form(groups)
    const calc = nurse ? () => {
      const later = controls.later.checked
      ;["date", "shift", "room"].forEach((k) => { controls[k].disabled = later })
      body.querySelectorAll(".sdd-chip").forEach((c) => { c.disabled = later || c.dataset.past === "1" })
      $("sdd-calc").hidden = later
      if (!later) renderSlotCalc(orig, e.patient.id, null, true)
    } : null
    body.querySelectorAll(".sdd-chip").forEach((c) => { if (c.disabled) c.dataset.past = "1" })
    openDialog(e, `Registrar falta de ${formatDate(day)}`, "Registrar falta", body, () => {
      const [values, error] = read(absenceFields)
      if (error) return error
      let makeup = null
      if (nurse && !controls.later.checked) {
        const [slotValues, slotError] = read(slot.fields)
        if (slotError) return slotError
        const problem = slotProblem(orig, slotValues, e.patient.id, null, true)
        if (problem) return [problem, controls.date]
        makeup = { date: slotValues.date, shift: slotValues.shift, room: slotValues.room, ...stamp() }
      }
      faltas.save({
        kind: "falta", patientId: e.patient.id, date: day, shift: e.sch.shift, room: e.sch.room, makeupOf: e.makeupOf?.id || null,
        reason: values.reason, note: values.note, makeup, ...stamp(),
      })
      return null
    }, calc)
  }

  // Remarcar uma sessão que ainda não aconteceu (enfermeira): adiantar, adiar ou trocar de turno.
  function openMove(e) {
    if (!canReschedule()) return
    const orig = { date: day, shift: e.sch.shift, room: e.sch.room }
    const first = M.addDays(day, 1) >= todayIso() ? M.addDays(day, 1) : todayIso()
    const slot = slotFields(orig, { date: first, shift: e.sch.shift, room: e.sch.room })
    const reasonFields = [
      { key: "reason", label: "Motivo", kind: "other", options: MOVE_REASONS, other: "Outro motivo", placeholder: "Informe o motivo", missingText: "Informe o motivo da remarcação.", req: true, cls: "ph-f6" },
      { key: "note", label: "Observações", kind: "textarea", cls: "ph-f12" },
    ]
    const body = form([["Novo horário", slot.fields, slot.extra], ["Motivo", reasonFields]])
    openDialog(e, `Remarcar sessão de ${formatDate(day)}`, "Remarcar sessão", body, () => {
      const [values, error] = read([...slot.fields, ...reasonFields])
      if (error) return error
      const problem = slotProblem(orig, values, e.patient.id, null)
      if (problem) return [problem, controls.date]
      const s = stamp()
      faltas.save({
        kind: "remarcacao", patientId: e.patient.id, date: day, shift: e.sch.shift, room: e.sch.room, makeupOf: e.makeupOf?.id || null,
        reason: values.reason, note: values.note, makeup: { date: values.date, shift: values.shift, room: values.room, ...s }, ...s,
      })
      return null
    }, () => renderSlotCalc(orig, e.patient.id, null))
  }

  // Definir ou alterar a reposição de uma falta, ou alterar uma remarcação (enfermeira).
  function openReschedule(a) {
    if (!canReschedule() || makeupLocked(a)) return
    const e = pseudoEntry(a)
    const move = isMove(a)
    const orig = { date: a.date, shift: a.shift, room: a.room }
    const slot = slotFields(orig, a.makeup || { date: suggestMakeupDate(orig, M.scheduleOf(a.patientId)), shift: a.shift, room: a.room }, !move)
    const info = el("dl", { class: "ph-dl ph-f12" }, ...[
      [move ? "Sessão original" : "Falta", slotText(a)],
      ["Motivo", a.reason || "-"],
      [move ? "Remarcada por" : "Registrada por", `${a.by || "-"}${a.byProfile ? ` (${a.byProfile})` : ""}`],
    ].map(([l, v]) => el("div", {}, el("dt", { text: l }), el("dd", { text: v }))))
    const reasonFields = move ? [
      { key: "reason", label: "Motivo", kind: "other", options: MOVE_REASONS, other: "Outro motivo", placeholder: "Informe o motivo", missingText: "Informe o motivo da remarcação.", req: true, value: a.reason, cls: "ph-f6" },
    ] : []
    const body = form([[move ? "Remarcação" : "Falta registrada", [], [info]], [move ? "Novo horário" : "Reposição da sessão", slot.fields, slot.extra], ...(move ? [["Motivo", reasonFields]] : [])])
    const title = move ? `Alterar remarcação da sessão de ${formatDate(a.date)}` : `${a.makeup ? "Alterar reposição" : "Remarcar reposição"} da falta de ${formatDate(a.date)}`
    openDialog(e, title, a.makeup ? "Gravar alteração" : "Remarcar reposição", body, () => {
      const [values, error] = read([...slot.fields, ...reasonFields])
      if (error) return error
      const problem = slotProblem(orig, values, a.patientId, a.id, !move)
      if (problem) return [problem, controls.date]
      faltas.save({ ...a, ...(move ? { reason: values.reason } : {}), makeup: { date: values.date, shift: values.shift, room: values.room, ...stamp() } })
      return null
    }, () => renderSlotCalc(orig, a.patientId, a.id, !move))
  }

  function openAbsenceView(a) {
    const e = pseudoEntry(a)
    const move = isMove(a)
    const nurse = canReschedule()
    const makeupSession = a.makeup && sessions.find((s) => s.patientId === a.patientId && s.date === a.makeup.date && (!s.shift || s.shift === a.makeup.shift))
    const makeupAbsence = absences.find((x) => x.makeupOf === a.id)
    const locked = Boolean(makeupSession || makeupAbsence)
    const situation = !a.makeup ? "Aguardando remarcação pela enfermeira" : makeupSession ? (makeupSession.state === "em-andamento" ? "Em andamento" : "Realizada") : makeupAbsence ? "Paciente faltou também" : a.makeup.date < todayIso() ? "Não realizada" : "Agendada"
    const items = [
      ["Tipo", move ? `Remarcação - ${direction(a.date, a.makeup.date).label.toLowerCase()}` : "Falta"],
      [move ? "Sessão original" : "Data da falta", slotText(a)],
      ["Motivo", a.reason || "-"],
      [move ? "Remarcada por" : "Falta registrada por", `${a.by || "-"}${a.byProfile ? ` (${a.byProfile})` : ""}`],
      [move ? "Novo horário" : "Reposição", a.makeup ? `${slotText(a.makeup)}${move ? "" : ` - ${direction(a.date, a.makeup.date).label.toLowerCase()}`}` : "-"],
      ...(!move && a.makeup ? [["Reposição remarcada por", `${a.makeup.by || "-"}${a.makeup.byProfile ? ` (${a.makeup.byProfile})` : ""}`]] : []),
      ["Situação", situation],
      ["Observações", a.note || "-"],
    ]
    // Desfazer: falta sem reposição, qualquer perfil; falta remarcada ou remarcação, só a enfermeira.
    const canUndo = !locked && (move || a.makeup ? nurse : true)
    const hint = locked
      ? `${move ? "A sessão remarcada" : "A reposição"} já foi registrada, então não pode mais ser desfeita.`
      : !canUndo
        ? "Só a enfermeira pode alterar ou desfazer uma remarcação."
        : move
          ? "Desfazer a remarcação devolve a sessão para o horário original."
          : a.makeup
            ? "Se o paciente chegou depois, desfaça a falta: a reposição é cancelada e a sessão volta a ficar disponível no dia."
            : "Se o paciente chegou depois, desfaça a falta e a sessão volta a ficar disponível no dia."
    const body = el("div", {},
      el("dl", { class: "ph-dl" }, ...items.map(([l, v]) => el("div", {}, el("dt", { text: l }), el("dd", { text: v })))),
      el("p", { class: "sdd-hint", text: hint }))
    openDialog(e, move ? `Remarcação da sessão de ${formatDate(a.date)}` : `Falta de ${formatDate(a.date)}`, move ? "Desfazer remarcação" : "Desfazer falta", body, canUndo ? () => { faltas.remove(a.id); return null } : null)
  }


  // ---------- Sessão concluída (somente leitura) ----------
  function openView(e) {
    const s = e.session
    const dur = minutes(s.end) != null && minutes(s.start) != null ? minutes(s.end) - minutes(s.start) : null
    const items = [
      ["Horário", `${s.start} - ${s.end}`], ["Duração", fmtDur(dur)], ["Máquina", s.machine || "-"], ["Responsável", profName(s.responsible) || "-"],
      ["Dialisador", s.dialyzer ? `${s.dialyzer} (${s.singleUse ? "uso único" : `uso ${s.usage}/${MAX}`})` : "-"], ["Acesso", s.access || "-"], ["Peso seco", hasNum(s.dryWeight) ? fmtKg(parseNumber(s.dryWeight)) : "-"], ["Peso inicial / final", `${fmtKg(parseNumber(s.weightStart))} / ${fmtKg(parseNumber(s.weightEnd))}`],
      ["UF", hasNum(s.uf) ? `${s.uf} mL` : "-"], ["Nº da diálise", s.number || "-"], ["Complicações", s.complications || "Nenhuma"], ["Observações", s.notes || "-"],
    ]
    const body = el("div", {},
      el("dl", { class: "ph-dl" }, ...items.map(([l, v]) => el("div", {}, el("dt", { text: l }), el("dd", { text: v })))),
      el("h4", { class: "ph-group-title", text: "Aferições" }),
      s.measures?.length ? measuresTable(s.measures) : el("p", { class: "ev-empty", text: "Nenhuma aferição registrada." }),
      el("p", { class: "sdd-hint", text: "Correções desta sessão são feitas no prontuário, em Sessões de Diálise." }))
    openDialog(e, `Sessão de ${formatDate(s.date)}`, "", body, null)
  }


  // ---------- Sessão extra (orientação médica) ----------
  // Elias, 06/11/2026: sessão extra é por orientação médica e qualquer paciente pode fazer; a quantidade na semana é
  // decisão do médico, sem limite fixo. A enfermeira (ou o médico) escolhe o dia, o horário, a sala, o médico que
  // orientou e os pacientes pela busca.
  const EXTRA_REASONS = ["Hipervolemia / congestão", "Ganho de peso interdialítico elevado", "Hipercalemia", "Acidose metabólica", "Diálise inadequada (Kt/V baixo)", "Sintomas urêmicos", "Preparo para cirurgia ou procedimento"].map((v) => [v, v])
  function openExtra(x = null) {
    if (!canExtra()) return
    const chosen = new Set(x?.patientIds || [])
    const started = x ? sessions.filter((s) => s.date === x.date && s.shift === x.shift) : []
    const startedIds = new Set(started.map((s) => s.patientId))
    const roomOptions = [...Object.keys(M.ROOMS), ...Object.keys(INPATIENT)].map((r) => [r, INPATIENT[r] ? `${r} (sob demanda)` : r])
    const fields = [
      { key: "date", label: "Dia", kind: "date", req: true, value: x?.date || (day >= todayIso() ? day : todayIso()), cls: "ph-f4" },
      { key: "start", label: "Horário de início", kind: "time", req: true, value: x?.start || "", cls: "ph-f4" },
      { key: "room", label: "Sala", kind: "select", options: roomOptions, req: true, value: x?.room || "", cls: "ph-f4" },
      { key: "doctor", label: "Médico(a) que orientou", kind: "select", options: C.PROFESSIONALS.filter((p) => p.category === "medico").map((p) => [p.id, p.name]), req: true, value: x?.doctorId || "", cls: "ph-f6" },
      { key: "reason", label: "Indicação", kind: "other", options: EXTRA_REASONS, other: "Outra indicação", placeholder: "Informe a indicação", missingText: "Informe a indicação da sessão extra.", req: true, value: x?.reason || "", cls: "ph-f6" },
      { key: "note", label: "Observações", kind: "textarea", value: x?.note || "", cls: "ph-f12" },
    ]
    const body = form([["Sessão extra", fields]])
    const counter = el("p", { class: "sdd-extra-count", "aria-live": "polite" })

    // Escala do paciente, só como referência (a quantidade de sessões extras é livre).
    function scheduleText(pid) {
      const sch = M.scheduleOf(pid)
      const date = controls.date?.value
      if (!sch) return " · sem escala no Programa de Tratamento"
      return ` · escala: ${weekdaysText(sch.days)}, ${sch.shift}${date && sch.days.includes(M.weekday(date)) ? " · já faz HD neste dia pela escala" : ""}`
    }

    // Busca dos pacientes da sessão extra
    const search = el("input", { class: "form-control form-control-sm", id: "sdd-x-search", type: "search", autocomplete: "off", placeholder: "Nome ou código do paciente" })
    const results = el("ul", { class: "sdd-extra-list", "aria-label": "Resultado da busca" })
    const chosenList = el("ul", { class: "sdd-extra-list", "aria-label": "Pacientes da sessão extra" })
    const hdPatients = M.patients.filter((p) => /hemodi/i.test(p.program || ""))
    function renderSearch() {
      const q = normalize(search.value.trim())
      const found = q ? hdPatients.filter((p) => !chosen.has(p.id) && normalize(`${p.name} ${p.code}`).includes(q)).slice(0, 8) : []
      results.replaceChildren(...found.map((p) => {
        const b = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: "Incluir", "aria-label": `Incluir ${p.name}` })
        b.addEventListener("click", () => { chosen.add(p.id); search.value = ""; renderSearch(); update(); search.focus() })
        return el("li", { class: "sdd-extra-item" }, el("span", {}, el("strong", { text: p.name }), el("small", { text: ` Cód. ${p.code}` })), b)
      }))
      if (q && !found.length) results.append(el("li", { class: "sdd-hint", text: "Nenhum paciente encontrado." }))
      renderChosen()
    }
    function renderChosen() {
      chosenList.replaceChildren(...[...chosen].map((pid) => {
        const p = M.patient(pid)
        const locked = startedIds.has(pid)
        const b = el("button", { type: "button", class: "btn btn-sm btn-outline-danger", text: "Retirar", disabled: locked, "aria-label": `Retirar ${p?.name || ""}` })
        b.addEventListener("click", () => { chosen.delete(pid); renderSearch(); update() })
        return el("li", { class: "sdd-extra-item" }, el("span", {}, el("strong", { text: p?.name || `Paciente ${pid}` }), el("small", { text: ` Cód. ${p?.code || "-"}${scheduleText(pid)}${locked ? " · sessão já iniciada" : ""}` })), b)
      }))
      if (!chosen.size) chosenList.append(el("li", { class: "sdd-hint", text: "Nenhum paciente incluído." }))
    }
    search.addEventListener("input", (ev) => { ev.stopPropagation(); renderSearch() })
    search.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); results.querySelector("button")?.click() } })

    function update() {
      renderChosen()
      const total = chosen.size
      const room = controls.room.value
      const chairs = room ? chairsOf(room) : null
      const over = chairs && total > chairs.fixed + chairs.extra
      counter.className = `sdd-extra-count${over ? " sdd-calc-warn" : ""}`
      counter.textContent = `${total} ${total === 1 ? "paciente selecionado" : "pacientes selecionados"}` +
        (chairs ? `. ${room}: ${chairsText(chairs)}${over ? ", há mais pacientes que cadeiras" : ""}.` : ".")
    }

    body.append(
      el("h4", { text: "Pacientes" }),
      el("div", { class: "field-block ph-f12" }, el("label", { class: "field-label", for: "sdd-x-search", text: "Buscar paciente" }), search),
      el("div", { class: "ph-f12 sdd-extra-box" }, results),
      el("div", { class: "ph-f12 sdd-extra-box" }, chosenList),
      el("div", { class: "ph-f12" }, counter))
    if (x && !started.length) {
      const cancel = el("button", { type: "button", class: "btn btn-sm btn-outline-danger", text: "Cancelar esta sessão extra" })
      cancel.addEventListener("click", () => {
        // Reposições de falta ligadas a sessões extras antigas voltam a aguardar remarcação.
        absences.filter((a) => a.makeup?.extraId === x.id).forEach((a) => faltas.save({ ...a, makeup: null }))
        extraStore.remove(x.id)
        closeDialog(); reload(); render()
      })
      body.append(el("div", { class: "ph-f12" }, cancel))
    }
    renderSearch()
    const sub = x ? `${x.shift} · ${formatDate(x.date)} · ${x.room}` : "Escolha o dia, o horário, a sala, a orientação médica e os pacientes"
    openDialog({ sub }, x ? "Editar sessão extra" : "Abrir sessão extra", x ? "Gravar sessão extra" : "Abrir sessão extra", body, () => {
      const [values, error] = read(fields)
      if (error) return error
      if (values.date < todayIso()) return ["A sessão extra não pode ser em data anterior a hoje.", controls.date]
      const shift = `${EXTRA_PREFIX} ${values.start}`
      if (extras.some((o) => o.id !== x?.id && o.date === values.date && o.shift === shift)) return [`Já existe uma sessão extra às ${values.start} em ${formatDate(values.date)}.`, controls.start]
      if (started.length && (values.date !== x.date || shift !== x.shift)) return ["Já há sessão iniciada nesta sessão extra: o dia e o horário não podem mudar.", controls.date]
      if (!chosen.size && !absences.some((a) => x && a.makeup?.extraId === x.id)) return ["Escolha pelo menos um paciente.", search]
      const s = stamp()
      const doctor = C.PROFESSIONALS.find((p) => p.id === values.doctor)
      extraStore.save({ ...(x || {}), date: values.date, start: values.start, shift, room: values.room, note: values.note,
        doctorId: values.doctor, doctorName: doctor?.name || "", reason: values.reason,
        patientIds: [...chosen], ...(x ? { editedBy: s.by, editedAt: s.at } : s) })
      if (values.date !== day) day = values.date, $("sdd-date").value = day
      shiftFilter = shift
      return null
    }, update)
  }

  // ---------- Internados (Sala Q, sob demanda) ----------
  // Elias, 06/11/2026: internados que ainda não são pacientes da Nefrologia precisam aparecer sem entrar na lista de
  // pacientes; a enfermeira registra o internado e a HD, e depois ele pode ser incluído como paciente oficial do setor.
  const INPATIENT_INDICATIONS = ["Lesão renal aguda", "Hipercalemia", "Hipervolemia / edema agudo de pulmão", "Acidose metabólica", "Uremia", "DRC dialítica internada no HU"].map((v) => [v, v])
  const SEROLOGY = [["negativo", "Negativo"], ["positivo", "Positivo"], ["nao-informado", "Não informado"]]
  const internName = (r) => M.patient(internStore.patientIdOf(r))?.name || r.person?.name || "-"
  const internSituation = (r) => (r.includedPatientId ? `Incluído no setor em ${formatDate(r.includedAt.slice(0, 10))}` : r.patientId ? "Paciente do setor" : "Sem cadastro na Nefrologia")
  const internSlots = (r) => [...r.slots].sort((a, b) => a.date.localeCompare(b.date) || shiftOrder(a.shift) - shiftOrder(b.shift))

  function renderInternados() {
    const box = $("sdd-internados")
    const can = canInpatient()
    const list = internados.filter((r) => r.status !== "alta" || r.slots.some((x) => x.date >= todayIso()))
      .sort((a, b) => (internSlots(b).at(-1)?.date || "").localeCompare(internSlots(a).at(-1)?.date || ""))
    const badge = $("sdd-internados-badge")
    badge.hidden = !list.length
    badge.textContent = String(list.length)
    const open = el("button", { type: "button", class: "btn btn-sm btn-primary", id: "sdd-open-internado", text: "Incluir internado" })
    open.addEventListener("click", () => openInpatient(null, { date: day >= todayIso() ? day : todayIso(), room: Object.keys(INPATIENT)[0] || "" }))
    const head = el("header", {},
      el("h2", { id: "sdd-internados-title" }, document.createTextNode("Internados na Sala Q"), el("span", { class: "hn-badge hn-badge-info", text: String(list.length) })),
      el("p", { text: "A Sala Q é sob demanda: recebe os internados do HU (pacientes do setor ou ainda sem cadastro na Nefrologia) e sessões extras. O internado sem cadastro não entra na lista de pacientes; depois pode ser incluído como paciente do setor." }),
      ...(can ? [open] : []))
    if (!list.length) { box.replaceChildren(head, el("p", { class: "sdd-hint", text: "Nenhum internado em acompanhamento." })); return }
    box.replaceChildren(head,
      el("div", { class: "history-table-wrap hn-scroll-table", tabindex: "0", "aria-label": "Internados, com rolagem" },
        el("table", { class: "table table-sm ev-table", "aria-labelledby": "sdd-internados-title" },
          el("thead", {}, el("tr", {}, ...["Paciente", "Cadastro", "Leito", "Indicação", "HD", "Situação", ""].map((h) => el("th", { scope: "col", text: h })))),
          el("tbody", {}, ...list.map((r) => {
            const acts = el("div", { class: "sdd-actions" })
            const btn = (text, run, cls = "btn-outline-secondary") => { const b = el("button", { type: "button", class: `btn btn-sm ${cls}`, text }); b.addEventListener("click", run); acts.append(b) }
            btn("Ver", () => openInpatientView(r))
            if (can && r.status !== "alta") btn("Alterar", () => openInpatient(r), "btn-outline-primary")
            if (can && r.status !== "alta") btn("Nova HD", () => openInpatient(r, { addSlot: true }), "btn-outline-primary")
            if (canInclude() && !r.patientId && !r.includedPatientId) btn("Incluir no setor", () => openInclude(r), "btn-outline-success")
            if (can && r.status !== "alta") btn("Alta", () => dischargeInpatient(r), "btn-outline-danger")
            return el("tr", {},
              el("td", { text: internName(r) }), el("td", { class: "sdd-td-wrap", text: internSituation(r) }), el("td", { class: "sdd-td-wrap", text: r.bed }),
              el("td", { class: "sdd-td-wrap", text: r.indication }),
              el("td", { class: "sdd-td-wrap", text: internSlots(r).map((x) => `${formatDate(x.date).slice(0, 5)} ${WEEKDAYS_SHORT[M.weekday(x.date)]}, ${parseInt(x.shift, 10)}º T, ${x.room}`).join("; ") || "-" }),
              el("td", { text: r.status === "alta" ? `Alta ${r.dischargeAt ? formatDate(r.dischargeAt.slice(0, 10)) : ""}` : "Internado" }), el("td", {}, acts))
          })))))
  }

  // Alta da internação: tira as HD futuras que ainda não começaram.
  function dischargeInpatient(r) {
    const pid = internStore.patientIdOf(r)
    const started = (x) => sessions.some((t) => t.patientId === pid && t.date === x.date && t.shift === x.shift)
    internStore.save({ ...r, status: "alta", dischargeAt: new Date().toISOString(), slots: r.slots.filter((x) => x.date < todayIso() || started(x)) })
    reload(); render()
  }

  // Incluir internado / alterar / nova HD. preset: { date, shift, room, addSlot }.
  function openInpatient(r = null, preset = {}) {
    if (!canInpatient()) return
    const addSlot = Boolean(r && preset.addSlot)
    const pid0 = r ? internStore.patientIdOf(r) : null
    const slotIndex = r && !addSlot ? r.slots.findIndex((x) => x.date >= todayIso()) : -1
    const editing = r && !addSlot ? r.slots[slotIndex >= 0 ? slotIndex : r.slots.length - 1] : null
    const slotStarted = editing && sessions.some((t) => t.patientId === pid0 && t.date === editing.date && t.shift === editing.shift)
    let mode = r ? (r.patientId ? "setor" : "avulso") : "avulso"
    let patientId = r?.patientId || null
    const doctors = C.PROFESSIONALS.filter((p) => p.category === "medico").map((p) => [p.id, p.name])
    const shiftOpts = (window.HuNefroAdmin?.data?.().shifts || []).filter((x) => x.active !== false).map((x) => [x.name, x.start ? `${x.name} (${x.start} - ${x.end})` : x.name])
    const shifts = shiftOpts.length ? shiftOpts : M.SHIFTS.map((v) => [v, v])
    const roomOptions = [...Object.keys(INPATIENT), ...Object.keys(M.ROOMS)].map((x) => [x, INPATIENT[x] ? `${x} (internados, sob demanda)` : x])
    const person = r?.person || {}
    const modeField = { key: "mode", label: "Quem é o internado", kind: "select", options: [["avulso", "Internado ainda sem cadastro na Nefrologia"], ["setor", "Paciente do setor (já cadastrado)"]], req: true, value: mode, cls: "ph-f12" }
    const personFields = [
      { key: "pname", label: "Nome completo", kind: "text", req: true, value: person.name || "", cls: "ph-f6" },
      { key: "precord", label: "Prontuário do HU (AGHU)", kind: "text", req: true, value: person.hospitalRecord || "", cls: "ph-f3" },
      { key: "pbirth", label: "Nascimento", kind: "date", value: person.birthDate || "", cls: "ph-f3" },
      { key: "psex", label: "Sexo", kind: "select", options: [["Feminino", "Feminino"], ["Masculino", "Masculino"]], value: person.sex || "", cls: "ph-f3" },
      { key: "pcpf", label: "CPF", kind: "text", value: person.cpf || "", cls: "ph-f3" },
      { key: "pcns", label: "CNS", kind: "text", value: person.cns || "", cls: "ph-f6" },
      { key: "hbv", label: "HBsAg", kind: "select", options: SEROLOGY, value: person.serology?.hepatiteB || "", cls: "ph-f4" },
      { key: "hcv", label: "Anti-HCV", kind: "select", options: SEROLOGY, value: person.serology?.hepatiteC || "", cls: "ph-f4" },
      { key: "hiv", label: "Anti-HIV", kind: "select", options: SEROLOGY, value: person.serology?.hiv || "", cls: "ph-f4" },
    ]
    const stayFields = [
      { key: "bed", label: "Enfermaria / leito", kind: "text", req: true, value: r?.bed || "", cls: "ph-f6" },
      { key: "clinic", label: "Clínica de origem", kind: "text", value: r?.clinic || "", cls: "ph-f6" },
      { key: "doctor", label: "Médico(a) que solicitou", kind: "select", options: doctors, req: true, value: r?.doctorId || "", cls: "ph-f6" },
      { key: "indication", label: "Indicação", kind: "other", options: INPATIENT_INDICATIONS, other: "Outra indicação", placeholder: "Informe a indicação", missingText: "Informe a indicação da HD.", req: true, value: r?.indication || "", cls: "ph-f6" },
      { key: "access", label: "Acesso vascular", kind: "text", value: r?.access || "", cls: "ph-f6" },
      { key: "note", label: "Observações", kind: "textarea", value: r?.note || "", cls: "ph-f12" },
    ]
    const slotFields = [
      { key: "date", label: "Dia", kind: "date", req: true, value: editing?.date || preset.date || "", cls: "ph-f4" },
      { key: "shift", label: "Turno", kind: "select", options: shifts, req: true, value: editing?.shift || preset.shift || "", cls: "ph-f4" },
      { key: "room", label: "Sala", kind: "select", options: roomOptions, req: true, value: editing?.room || preset.room || Object.keys(INPATIENT)[0] || "", cls: "ph-f4" },
    ]
    const summary = el("div", { class: "sd-calc sdd-slot-calc", "aria-live": "polite" })
    const groups = addSlot ? [["Nova HD", slotFields]] : [["Internado", [modeField]], ["Dados do internado (sem cadastro na Nefrologia)", personFields], ["Internação", stayFields], [r ? "HD" : "1ª HD", slotFields]]
    const body = form(groups)

    // Paciente do setor: busca.
    const search = el("input", { class: "form-control form-control-sm", id: "sdd-i-search", type: "search", autocomplete: "off", placeholder: "Nome ou código do paciente" })
    const results = el("ul", { class: "sdd-extra-list", "aria-label": "Resultado da busca" })
    const chosenBox = el("div", { class: "sdd-extra-item ph-f12", "aria-live": "polite" })
    const setorBlock = el("div", { class: "ph-f12 sdd-i-setor" },
      el("div", { class: "field-block" }, el("label", { class: "field-label", for: "sdd-i-search", text: "Buscar paciente do setor *" }), search),
      el("div", { class: "sdd-extra-box" }, results), chosenBox)
    function renderChosen() {
      const p = patientId ? M.patient(patientId) : null
      chosenBox.replaceChildren(p ? el("span", {}, el("strong", { text: p.name }), el("small", { text: ` Cód. ${p.code} · ${p.program || ""}` })) : el("span", { class: "sdd-hint", text: "Nenhum paciente escolhido." }))
    }
    search.addEventListener("input", (ev) => {
      ev.stopPropagation()
      const qq = normalize(search.value.trim())
      const found = qq ? M.patients.filter((p) => normalize(`${p.name} ${p.code}`).includes(qq)).slice(0, 8) : []
      results.replaceChildren(...found.map((p) => {
        const b = el("button", { type: "button", class: "btn btn-sm btn-outline-primary", text: "Escolher" })
        b.addEventListener("click", () => { patientId = p.id; search.value = ""; results.replaceChildren(); renderChosen(); refreshCalc?.() })
        return el("li", { class: "sdd-extra-item" }, el("span", {}, el("strong", { text: p.name }), el("small", { text: ` Cód. ${p.code}` })), b)
      }))
      if (qq && !found.length) results.append(el("li", { class: "sdd-hint", text: "Nenhum paciente encontrado. Se ainda não é do setor, escolha \"Internado ainda sem cadastro\"." }))
    })
    if (!addSlot) {
      controls.mode.closest(".field-block").after(setorBlock)
      if (r) controls.mode.disabled = true
      renderChosen()
    }
    if (slotStarted) slotFields.forEach((f) => { controls[f.key].disabled = true })
    body.append(el("div", { class: "ph-f12" }, summary))
    if (r && !addSlot && !slotStarted && editing && editing.date >= todayIso()) {
      const cancel = el("button", { type: "button", class: "btn btn-sm btn-outline-danger", text: "Cancelar esta HD" })
      cancel.addEventListener("click", () => {
        const slots = r.slots.filter((x) => x !== editing && !(x.date === editing.date && x.shift === editing.shift))
        if (slots.length || r.patientId) internStore.save({ ...r, slots })
        else internStore.save({ ...r, slots, status: "alta", dischargeAt: new Date().toISOString() })
        closeDialog(); reload(); render()
      })
      body.append(el("div", { class: "ph-f12" }, cancel))
    }

    const currentPid = () => (mode === "setor" ? patientId : pid0)
    function slotProblems() {
      const errs = []
      const warns = []
      const date = controls.date.value
      const shift = controls.shift.value
      const room = controls.room.value
      if (!date) return { errs, warns }
      if (date < todayIso() && !slotStarted) errs.push("A HD não pode ser em data anterior a hoje.")
      const pid = currentPid()
      const same = (e) => !(editing && e.inpatient?.id === r?.id && e.sch.shift === editing.shift && e.sch.patientId === pid)
      if (pid && shift && entries(date).some((e) => e.sch.patientId === pid && e.sch.shift === shift && isActive(e) && same(e))) errs.push("O paciente já tem HD neste dia e turno.")
      else if (pid && entries(date).some((e) => e.sch.patientId === pid && isActive(e) && same(e))) warns.push("O paciente já tem outra HD neste dia.")
      if (shift && room) {
        const chairs = chairsOf(room)
        const busy = entries(date).filter((e) => e.sch.shift === shift && e.sch.room === room && isActive(e) && same(e)).length
        if (chairs.fixed && busy >= chairs.fixed + chairs.extra) warns.push(`${room} sem cadeira livre no ${shift} (${busy} de ${chairsText(chairs)}). Confirme com a equipe.`)
      }
      return { errs, warns }
    }
    function update() {
      if (!addSlot) {
        mode = controls.mode.value || "avulso"
        setorBlock.hidden = mode !== "setor"
        const personTitle = [...body.querySelectorAll("h4")].find((h) => h.textContent.startsWith("Dados do internado"))
        if (personTitle) personTitle.hidden = mode !== "avulso"
        personFields.forEach((f) => { controls[f.key].closest(".field-block").hidden = mode !== "avulso" })
      }
      const { errs, warns } = slotProblems()
      const lines = [...errs, ...warns].map((t) => el("span", { class: "sdd-calc-warn", text: t }))
      if (!addSlot && mode === "avulso") lines.unshift(el("span", { text: "Sem cadastro na Nefrologia: não entra na lista de pacientes. Sorologia em branco conta como desconhecida (RDC 11/2014)." }))
      summary.replaceChildren(...lines.flatMap((l, i) => (i ? [el("br"), l] : [l])))
      summary.hidden = !lines.length
    }

    const title = addSlot ? "Nova HD do internado" : r ? "Alterar internado" : "Incluir internado"
    const sub = r ? `${internName(r)} · ${r.bed}` : "HD sob demanda na Sala Q"
    openDialog({ sub }, title, addSlot ? "Programar HD" : r ? "Gravar" : "Incluir internado", body, () => {
      const [slot, slotError] = read(slotFields)
      if (slotError) return slotError
      if (addSlot) {
        const { errs } = slotProblems()
        if (errs.length) return [errs[0], controls.date]
        internStore.save({ ...r, slots: [...r.slots, { date: slot.date, shift: slot.shift, room: slot.room }] })
      } else {
        if (mode === "setor" && !patientId) return ["Escolha o paciente do setor.", search]
        let personData = null
        if (mode === "avulso") {
          const [pv, pErr] = read(personFields)
          if (pErr) return pErr
          if (!pv.pname) return ["Informe o nome completo do internado.", controls.pname]
          if (!pv.precord) return ["Informe o número do prontuário do HU (AGHU), para identificar o internado.", controls.precord]
          const sero = (v) => (v === "nao-informado" ? "" : v)
          personData = { name: pv.pname, hospitalRecord: pv.precord, birthDate: pv.pbirth, sex: pv.psex, cpf: pv.pcpf, cns: pv.pcns, serology: { hepatiteB: sero(pv.hbv), hepatiteC: sero(pv.hcv), hiv: sero(pv.hiv) } }
        }
        const [stay, stayErr] = read(stayFields)
        if (stayErr) return stayErr
        const { errs } = slotProblems()
        if (errs.length) return [errs[0], controls.date]
        const doctor = C.PROFESSIONALS.find((p) => p.id === stay.doctor)
        const newSlot = { date: slot.date, shift: slot.shift, room: slot.room }
        const slots = r ? (editing ? r.slots.map((x) => (x === editing ? newSlot : x)) : [...r.slots, newSlot]) : [newSlot]
        const st = stamp()
        internStore.save({ ...(r || { status: "internado" }), patientId: mode === "setor" ? patientId : null, person: personData, bed: stay.bed, clinic: stay.clinic,
          doctorId: stay.doctor, doctorName: doctor?.name || "", indication: stay.indication, access: stay.access, note: stay.note, slots,
          ...(r ? { editedBy: st.by, editedAt: st.at } : st) })
      }
      if (slot.date !== day) day = slot.date, $("sdd-date").value = day
      shiftFilter = slot.shift
      return null
    }, update)
  }

  function openInpatientView(r) {
    if (!r) return
    const pid = internStore.patientIdOf(r)
    const p = M.patient(pid)
    const sero = r.person ? M.serologyOf(pid) : null
    const rows = [
      ["Paciente", p?.name || r.person?.name || "-"], ["Cadastro", internSituation(r)],
      ...(r.person ? [["Prontuário do HU", r.person.hospitalRecord || "-"], ["Nascimento", r.person.birthDate ? formatDate(r.person.birthDate) : "-"], ["Sexo", r.person.sex || "-"],
        ["CPF", r.person.cpf || "-"], ["CNS", r.person.cns || "-"], ["Sorologia", sero?.tags.join(", ") || "Negativa"]] : []),
      ["Enfermaria / leito", r.bed], ["Clínica de origem", r.clinic || "-"], ["Médico(a) que solicitou", r.doctorName || "-"], ["Indicação", r.indication],
      ["Acesso vascular", r.access || "-"], ["Observações", r.note || "-"],
      ["HD", internSlots(r).map((x) => `${formatDate(x.date)} (${WEEKDAYS_SHORT[M.weekday(x.date)]}), ${x.shift}, ${x.room}`).join("; ") || "-"],
      ["Situação", r.status === "alta" ? "Alta" : "Internado"], ["Registrado por", `${r.by || "-"}${r.at ? ` em ${formatDate(r.at.slice(0, 10))}` : ""}`],
    ]
    const body = el("div", {}, el("dl", { class: "ph-dl" }, ...rows.map(([k, v]) => el("div", {}, el("dt", { text: k }), el("dd", { text: v })))))
    if (canInclude() && !r.patientId && !r.includedPatientId) {
      const inc = el("button", { type: "button", class: "btn btn-sm btn-outline-success", text: "Incluir como paciente do setor" })
      inc.addEventListener("click", () => { closeDialog(); openInclude(r) })
      body.append(el("div", {}, inc))
    }
    openDialog({ sub: r.bed }, "Internação", "", body, null)
  }

  // Inclusão do internado como paciente oficial do setor: cria o prontuário e passa as sessões para ele.
  function openInclude(r) {
    if (!canInclude() || !r?.person) return
    const age = r.person.birthDate ? Math.floor((Date.now() - Date.parse(`${r.person.birthDate}T12:00:00`)) / 31557600000) : null
    const program = age != null && age < 18 ? "Hemodiálise Pediátrica" : "Hemodiálise"
    const fields = [
      { key: "program", label: "Programa", kind: "select", options: METHODS, req: true, value: program, cls: "ph-f6" },
    ]
    const body = form([["Paciente do setor", fields]])
    body.prepend(el("p", { class: "sdd-hint ph-f12", text: `${r.person.name} · prontuário do HU ${r.person.hospitalRecord || "-"}${r.person.cpf ? ` · CPF ${r.person.cpf}` : ""}. O internado passa a ser paciente da Nefrologia: ganha código e prontuário, e as HD já feitas vão para o prontuário dele. Depois complete o Programa de Tratamento (dias, turno e sala).` }))
    openDialog({ sub: r.person.name }, "Incluir como paciente do setor", "Incluir paciente", body, () => {
      const [v, err] = read(fields)
      if (err) return err
      const [y, m, d] = String(r.person.birthDate || "").split("-")
      const created = M.addPatient({ name: r.person.name, birthDate: y ? `${d}/${m}/${y}` : "", sex: r.person.sex, cpf: r.person.cpf, cns: r.person.cns, program: v.program,
        hospitalRecord: r.person.hospitalRecord, fromInternacao: r.id, createdBy: currentUserName() })
      internStore.include(r.id, created.id, currentUserName())
      window.setTimeout(() => window.open(`prontuario.html?patient=${created.id}&section=programa`, `hunefro-prontuario-${created.id}`), 0)
      return null
    })
  }

  // ---------- Data, turno, visão e filtros ----------
  function setDay(iso) {
    day = iso || todayIso()
    $("sdd-date").value = day
    render()
  }
  $("sdd-date").addEventListener("change", () => setDay($("sdd-date").value))
  $("sdd-prev").addEventListener("click", () => setDay(M.addDays(day, -1)))
  $("sdd-next").addEventListener("click", () => setDay(M.addDays(day, 1)))
  $("sdd-today").addEventListener("click", () => setDay(todayIso()))
  $("sdd-filters").addEventListener("submit", (ev) => ev.preventDefault())
  ;["sdd-search", "sdd-room"].forEach((id) => $(id).addEventListener("input", render))
  $("sdd-status").addEventListener("input", () => { statusFilter = $("sdd-status").value; render() })
  $("sdd-clear").addEventListener("click", () => { $("sdd-search").value = ""; $("sdd-room").value = ""; statusFilter = ""; shiftFilter = ""; render() })
  document.querySelectorAll("[data-sdd-view]").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.sddView
    storage.set("huNefroSddView", view)
    render()
  }))
  // Troca do perfil simulado no cabeçalho: as ações disponíveis mudam na hora.
  document.addEventListener("hunefro:perfil", () => { if (dialog.open) closeDialog(); render() })

  // Correções feitas no prontuário (outra aba) e o tempo de sessão em andamento atualizam o quadro.
  store.subscribe(() => { reload(); if (!dialog.open) render() })
  window.setInterval(() => { if (!dialog.open && !openMenuEl) render() }, 60000)

  // Hoje, o quadro abre no turno em curso (as abas mostram os outros turnos).
  if (entries(todayIso()).some((e) => e.sch.shift === currentShift())) shiftFilter = currentShift()
  setDay(todayIso())
  setArea(initialArea)
})()
