// Cadastros da Gestão: dados da unidade, salas e cadeiras, turnos, máquinas, dialisadores, usuários,
// permissões dos perfis, programas de tratamento, procedimentos, tipos de evento, padrões de texto da evolução,
// modelos de laudo e o histórico de alterações.
// PROVISÓRIO: fica no navegador (localStorage) até existir a API. Carregar logo depois de js/catalogos.js:
// este arquivo acrescenta os itens cadastrados às listas do sistema e tira os que o administrador desativou.
// js/sessao.js (permissões) e js/dados-mock.js (salas e cadeiras) leem a mesma chave direto do localStorage.
(() => {
  "use strict"

  const KEY = "huNefroAdmin:v1"
  const C = window.HuNefroCatalogos || {}
  const BLANK = "[preencher]"
  const LOG_MAX = 400
  const pad2 = (n) => String(n).padStart(2, "0")

  // Categorias de tipos de evento e a lista do catálogo que cada uma alimenta.
  const EVENT_KINDS = [
    ["tiposProblema", "Problema / Diagnóstico"], ["tiposInternacao", "Internação"], ["tiposInfeccao", "Infecção"],
    ["tiposTransfusao", "Transfusão sanguínea"], ["tiposAlergia", "Alergia"],
  ]
  // Programas que já existem na tela (o sistema usa estes nomes nas regras, por isso não podem ser desativados).
  const BUILTIN_PROGRAMS = ["Em branco", "Abandono", "Alta", "Hemodiálise", "Hemodiálise Pediátrica", "Óbito"]

  // ---------- Usuários, categorias e perfis ----------
  // Categoria profissional (define o conselho e o grupo que recebe as Comunicações).
  const CATEGORIES = [
    ["medico", "Médico(a)", "CRM"], ["enfermagem", "Enfermeiro(a)", "COREN"], ["tec-enfermagem", "Técnico(a) de enfermagem", "COREN"],
    ["nutricao", "Nutricionista", "CRN"], ["servico-social", "Assistente social", "CRESS"], ["psicologia", "Psicólogo(a)", "CRP"],
    ["farmacia", "Farmacêutico(a)", "CRF"], ["recepcao", "Recepção", ""], ["administrativo", "Administrativo", ""],
  ]
  // Perfil de acesso sugerido para cada categoria (o administrador pode trocar).
  const CATEGORY_PROFILE = { medico: "medico", enfermagem: "enfermeiro", "tec-enfermagem": "tecnico", nutricao: "nutricionista", "servico-social": "assistente-social", psicologia: "psicologo", farmacia: "tecnico", recepcao: "recepcao", administrativo: "administrador" }
  const PROFILE_DESCRIPTIONS = {
    recepcao: "Inclui o paciente pela busca do CPF no AGHU, atualiza telefone e e-mail e mantém o Programa de Tratamento.",
    medico: "Prescreve, evolui, emite receitas, laudos e solicitações de exames.",
    enfermeiro: "Coordena as sessões do dia, remarca sessões e repõe faltas.",
    tecnico: "Inicia e conclui sessões e registra faltas.",
    nutricionista: "Registra a ficha de nutrição e as avaliações nutricionais.",
    "assistente-social": "Acompanha o paciente e registra a evolução do Serviço Social.",
    psicologo: "Acompanha o paciente e registra a evolução da Psicologia.",
    administrador: "Mantém os cadastros da unidade, os usuários e as permissões.",
  }
  // Permissões que o sistema confere hoje (js/sessao.js). "adm-acesso" do Administrador(a) não pode ser tirada,
  // para que a unidade nunca fique sem quem cuide dos usuários.
  const PERMISSIONS = [
    { id: "incluir-paciente", group: "Cadastro do paciente", name: "Incluir paciente pela busca do CPF no AGHU", defaults: ["recepcao"] },
    { id: "editar-programa", group: "Cadastro do paciente", name: "Editar o Programa de Tratamento (programa, dias, turno, sala e movimentações)", defaults: ["recepcao"] },
    { id: "remarcar-sessao", group: "Sessões do dia", name: "Remarcar sessões e repor faltas", defaults: ["enfermeiro"] },
    { id: "turno-extra", group: "Sessões do dia", name: "Abrir sessão extra (orientação médica)", defaults: ["enfermeiro", "medico"] },
    { id: "sala-q", group: "Sessões do dia", name: "Sala Q: HD de internados, inclusive os ainda sem cadastro na Nefrologia", defaults: ["enfermeiro", "medico"] },
    { id: "adm-unidade", group: "Gestão", name: "Unidade: dados, salas, turnos, máquinas e dialisadores", defaults: ["administrador"] },
    { id: "adm-cadastros", group: "Gestão", name: "Cadastros clínicos: programas, procedimentos e tipos de evento", defaults: ["administrador"] },
    { id: "adm-modelos", group: "Gestão", name: "Modelos de texto: padrões da evolução e modelos de laudo", defaults: ["administrador"] },
    { id: "adm-acesso", group: "Gestão", name: "Usuários, perfis e permissões", defaults: ["administrador"], locked: "administrador" },
  ]

  // Campos que os padrões e modelos cadastrados podem usar. O texto troca {campo} pelo dado do prontuário.
  const listOr = (items, empty) => (items && items.length ? items.join("; ") : empty)
  const TOKENS = [
    ["paciente", "Nome do paciente", (c) => c.name],
    ["idade", "Idade", (c) => (c.age !== null && c.age !== undefined ? `${c.age} anos` : "")],
    ["sexo", "Sexo", (c) => c.sex],
    ["cpf", "CPF", (c) => c.cpf],
    ["cns", "Cartão SUS (CNS)", (c) => c.cns],
    ["codigo", "Código do prontuário", (c) => c.code],
    ["mae", "Nome da mãe", (c) => c.mother],
    ["data", "Data do registro", (c) => c.dateBr],
    ["programa", "Programa de tratamento", (c) => c.program],
    ["acesso", "Acesso vascular ativo", (c) => (c.activeAccess ? [c.activeAccess.type, c.activeAccess.loc && c.activeAccess.loc.toLowerCase(), c.activeAccess.dateBr && `desde ${c.activeAccess.dateBr}`].filter(Boolean).join(", ") : "sem acesso vascular ativo registrado")],
    ["peso_seco", "Peso seco", (c) => c.weightText && `${c.weightText} kg`],
    ["alergias", "Alergias", (c) => listOr(c.allergies, "sem alergias registradas")],
    ["diagnosticos", "Problemas / diagnósticos", (c) => listOr(c.problems, "sem problemas registrados")],
    ["medicacoes", "Medicações em uso", (c) => listOr(c.meds, "sem medicações em uso registradas")],
    ["profissional", "Profissional que assina", (c) => c.authorName],
    ["unidade", "Nome da unidade", () => (C.INSTITUICAO || {}).nome],
    ["preencher", "Campo para completar", () => BLANK],
  ]
  function fill(template, ctx = {}) {
    return String(template || "").replace(/\{([a-z_]+)\}/g, (match, key) => {
      const token = TOKENS.find(([k]) => k === key)
      if (!token) return match
      const value = token[2](ctx)
      return value === undefined || value === null || value === "" ? BLANK : String(value)
    })
  }

  // ---------- Valores iniciais (dados do HU-UFMA já informados e exemplos fictícios) ----------
  const BASE_INSTITUTION = { ...(C.INSTITUICAO || {}) }
  const UNIT_FIELDS = ["nome", "sigla", "unidade", "cnes", "cnpj", "cnpjMantenedora", "cnpjEbserh", "endereco", "cidade", "uf", "cep", "telefone", "email", "responsavelTecnico", "responsavelEnfermagem"]
  const defaultUnit = () => Object.fromEntries(UNIT_FIELDS.map((k) => [k, BASE_INSTITUTION[k] || ""]))
  // Salas e cadeiras do HU-UFMA (Elias, 04/11/2026). A Sala Q é da internação e fica sempre disponível.
  const defaultRooms = () => [
    { id: 1, name: "Sala A", fixed: 12, extra: 1, inpatient: false, builtin: true, note: "" },
    { id: 2, name: "Sala B", fixed: 10, extra: 1, inpatient: false, builtin: true, note: "" },
    { id: 3, name: "Sala Q", fixed: 4, extra: 0, inpatient: true, builtin: true, note: "Reservada para pacientes internados, sempre disponível." },
  ]
  // 3 turnos do Programa de Tratamento, horários informados pela enfermagem (06/11/2026).
  const SHIFTS_REV = 2
  const defaultShifts = () => [
    ["1º Turno", "07:00", "11:00"], ["2º Turno", "12:00", "16:00"], ["3º Turno", "17:00", "21:00"],
  ].map(([name, start, end], i) => ({ id: i + 1, name, start, end, active: true, note: "" }))
  // Uma máquina por cadeira (fixas e extra). Nomes iguais aos da escala (Máquina 01, 02...).
  function machinesFor(rooms) {
    const list = []
    rooms.forEach((r) => {
      for (let n = 1; n <= r.fixed + r.extra; n += 1) {
        list.push({ id: list.length + 1, room: r.name, name: `Máquina ${pad2(n)}`, extraChair: n > r.fixed, serial: "", model: "", status: "ativa", use: "geral", lastMaintenance: "", note: "" })
      }
    })
    // Exemplo: a máquina da cadeira extra da Sala A em manutenção.
    const sample = list.find((m) => m.room === "Sala A" && m.extraChair)
    if (sample) Object.assign(sample, { status: "manutencao", note: "Exemplo: aguardando a assistência técnica." })
    return list
  }
  // Modelos de dialisador que já aparecem nas telas de sessão e de prescrição.
  const DIALYZER_NAMES = ["B-14H Alto Fluxo", "B-16H Alto Fluxo", "B-18 H ALTO FLUXO", "B-18HF", "B-20H Alto Fluxo", "Elisio 150 HR", "F10 HPS", "F40S", "F50S", "F60S", "F6-HPS", "F7", "Fx 100", "FX40", "FX60", "FX80", "FxPaed", "Platinum H1", "Platinum H4"]
  const defaultDialyzers = () => DIALYZER_NAMES.map((name, i) => ({
    id: i + 1, name, maker: "", surface: "", flux: /alto fluxo|hf$/i.test(name) ? "alto" : "", audience: /paed/i.test(name) ? "pediatrico" : "adulto", active: true, builtin: true,
  }))
  // Usuários de exemplo (fictícios). Os profissionais do catálogo ficam ligados pelo professionalId.
  function defaultUsers() {
    const fromCatalog = (C.PROFESSIONALS || []).map((p, i) => ({
      id: i + 1, professionalId: p.id, name: p.name, login: `prof${pad2(i + 1)}`, email: "", category: p.category,
      specialty: p.specialty || "", council: p.council || (CATEGORIES.find(([k]) => k === p.category) || [])[2] || "", councilNumber: p.councilNumber || "",
      councilUf: p.councilUf || (p.council ? "MA" : ""), rqe: p.rqe || "", cns: p.cns || "", profile: CATEGORY_PROFILE[p.category] || "tecnico", active: true, lastAccess: "",
    }))
    const extra = [
      { name: "Técnico Exemplo 01", login: "tec01", category: "tec-enfermagem", specialty: "Técnico de enfermagem" },
      { name: "Técnico Exemplo 02", login: "tec02", category: "tec-enfermagem", specialty: "Técnico de enfermagem" },
      { name: "Recepção Exemplo 01", login: "recep01", category: "recepcao", specialty: "Recepção da Nefrologia" },
      { name: "Administrador do Sistema", login: "admin", category: "administrativo", specialty: "Administração" },
    ].map((u, i) => ({ id: fromCatalog.length + i + 1, professionalId: "", email: "", council: u.category === "tec-enfermagem" ? "COREN" : "", councilNumber: "", councilUf: u.category === "tec-enfermagem" ? "MA" : "", profile: CATEGORY_PROFILE[u.category], active: true, lastAccess: "", ...u }))
    return [...fromCatalog, ...extra]
  }

  const empty = () => ({
    programs: [], procedures: [], eventTypes: [], hiddenEventTypes: [], patterns: [], laudoModels: [],
    unit: null, rooms: null, shifts: null, machines: null, dialyzers: null, users: null, permissions: null, log: [],
  })
  let data
  let migrated = false
  function ensureDefaults() {
    if (!data.unit) data.unit = defaultUnit()
    if (!data.rooms) data.rooms = defaultRooms()
    // Versões anteriores tinham 5 turnos com horários propostos: passam a valer os 3 turnos informados pela enfermagem.
    if (!data.shifts || (data.shiftsRev || 0) < SHIFTS_REV) { data.shifts = defaultShifts(); data.shiftsRev = SHIFTS_REV; migrated = true }
    data.shifts.sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10))
    if (!data.machines) data.machines = machinesFor(data.rooms)
    if (!data.dialyzers) data.dialyzers = defaultDialyzers()
    if (!data.users) data.users = defaultUsers()
    // Versão anterior não guardava RQE nem CNS no usuário: copia do catálogo para os profissionais ligados a ele.
    data.users.forEach((u) => {
      const base = u.professionalId && (C.PROFESSIONALS || []).find((p) => p.id === u.professionalId)
      if (!("rqe" in u)) u.rqe = base?.rqe || ""
      if (!("cns" in u)) u.cns = base?.cns || ""
    })
    if (!data.permissions) data.permissions = Object.fromEntries(PERMISSIONS.map((p) => [p.id, [...p.defaults]]))
    PERMISSIONS.forEach((p) => {
      if (!Array.isArray(data.permissions[p.id])) data.permissions[p.id] = [...p.defaults]
      if (p.locked && !data.permissions[p.id].includes(p.locked)) data.permissions[p.id].push(p.locked)
    })
    if (!Array.isArray(data.log)) data.log = []
  }
  function read() {
    try { data = { ...empty(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) } } catch { data = empty() }
    ensureDefaults()
    if (migrated) { migrated = false; save() }
    return data
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* armazenamento bloqueado */ }
  }
  read()
  const nextId = (list) => list.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1

  // ---------- Histórico de alterações ----------
  const AREA_LABELS = {
    unit: "Dados da unidade", rooms: "Salas e cadeiras", shifts: "Turnos", machines: "Máquinas", dialyzers: "Dialisadores",
    users: "Usuários", permissions: "Perfis e permissões", programs: "Programas", procedures: "Procedimentos", eventTypes: "Tipos de evento",
    patterns: "Padrões da evolução", laudoModels: "Modelos de laudo", config: "Configuração",
  }
  function log(area, action, item, detail = "") {
    let user = "Usuário"
    let profile = ""
    try { user = sessionStorage.getItem("huNefroUsername") || user; profile = window.HuNefroSessao?.profileLabel?.() || "" } catch { /* sem sessão */ }
    data.log.unshift({ at: new Date().toISOString(), user, profile, area, action, item: String(item || ""), detail })
    data.log.length = Math.min(data.log.length, LOG_MAX)
  }

  // ---------- Listas do sistema com os cadastros aplicados ----------
  // Dados da unidade usados nas impressões (receitas, LME, APAC, laudos, solicitações).
  function applyUnit() {
    if (!C.INSTITUICAO) return
    const unit = Object.fromEntries(Object.entries(data.unit).filter(([, v]) => v !== "" && v != null))
    C.INSTITUICAO = Object.freeze({ ...BASE_INSTITUTION, ...unit })
  }
  // Profissionais do catálogo (listas de responsável, prescritor e assinatura): nome e conselho vêm do usuário;
  // usuários novos de categoria assistencial entram na lista; usuários desativados saem.
  const CLINICAL = ["medico", "enfermagem", "tec-enfermagem", "nutricao", "servico-social", "psicologia", "farmacia"]
  const BASE_PROFESSIONALS = (C.PROFESSIONALS || []).map((p) => ({ ...p }))
  // Id do usuário nas listas de profissionais (prescritor, autor, assinatura).
  const professionalIdOf = (u) => u.professionalId || `u-${u.id}`
  // Todo médico com especialidade precisa do RQE para citá-la (Resolução CFM nº 2.336/2023); na Nefrologia é obrigatório.
  const needsRqe = (u) => u?.category === "medico" && /nefrolog/i.test(String(u.specialty || ""))
  function applyProfessionals() {
    if (!Array.isArray(C.PROFESSIONALS)) return
    const list = BASE_PROFESSIONALS.map((p) => ({ ...p }))
    data.users.forEach((u) => {
      const linked = u.professionalId && list.find((p) => p.id === u.professionalId)
      const info = { name: u.name, specialty: u.specialty || (CATEGORIES.find(([k]) => k === u.category) || [])[1] || "", council: u.council || undefined, councilNumber: u.councilNumber || undefined, councilUf: u.councilUf || undefined, rqe: u.rqe || undefined, cns: u.cns || undefined }
      if (linked) {
        Object.assign(linked, info, { inactive: u.active === false })
        // RQE e CNS apagados no cadastro também somem do profissional.
        if ("rqe" in u && !u.rqe) delete linked.rqe
        if ("cns" in u && !u.cns) delete linked.cns
        return
      }
      if (CLINICAL.includes(u.category)) list.push({ id: professionalIdOf(u), category: u.category === "tec-enfermagem" ? "enfermagem" : u.category, ...info, inactive: u.active === false })
    })
    const active = list.filter((p) => !p.inactive).map(({ inactive, ...p }) => ({ ...p, label: `${p.name} - ${p.specialty}` }))
    C.PROFESSIONALS.splice(0, C.PROFESSIONALS.length, ...active)
  }
  // Itens do catálogo como vieram do código (antes de aplicar os cadastros).
  const BASE_EVENT_TYPES = Object.fromEntries(EVENT_KINDS.map(([k]) => [k, (C[k] || []).map(([v]) => v)]))
  const isOther = (label) => /^outr[oa]$/i.test(label)
  function applyEventTypes() {
    EVENT_KINDS.forEach(([kind]) => {
      if (!C[kind]) return
      const base = BASE_EVENT_TYPES[kind].filter((v) => !data.hiddenEventTypes.includes(`${kind}:${v}`))
      const added = data.eventTypes.filter((t) => t.kind === kind && t.active !== false).map((t) => t.name)
      const others = base.filter(isOther)
      C[kind] = [...base.filter((v) => !isOther(v)), ...added, ...others].map((v) => [v, v])
    })
  }
  function applyAll() {
    applyUnit()
    applyProfessionals()
    applyEventTypes()
  }
  applyAll()

  const programNames = () => [...BUILTIN_PROGRAMS.filter((p) => p !== "Óbito"), ...data.programs.filter((p) => p.active !== false).map((p) => p.name), "Óbito"]
  // Acrescenta os programas cadastrados aos campos de programa da página (ex.: Programa de tratamento atual)
  // e as salas novas ao campo Sala do Programa de Tratamento.
  function applyPrograms(root = document) {
    root.querySelectorAll("select[data-admin-programs], #programa-atual").forEach((select) => {
      data.programs.filter((p) => p.active !== false).forEach((p) => {
        if ([...select.options].some((o) => (o.value || o.textContent) === p.name)) return
        const before = [...select.options].find((o) => o.textContent === "Óbito")
        select.insertBefore(new Option(p.name, p.name), before || null)
      })
    })
    const roomSelect = root.querySelector("#sala")
    if (roomSelect) {
      data.rooms.filter((r) => r.active !== false && !r.builtin).forEach((r) => {
        const value = r.name.replace(/^Sala\s+/i, "")
        if ([...roomSelect.options].some((o) => o.value === value)) return
        roomSelect.append(new Option(r.inpatient ? `${r.name} (internação)` : r.name, value))
      })
    }
  }
  if (document.readyState !== "loading") applyPrograms()
  else document.addEventListener("DOMContentLoaded", () => applyPrograms())

  // Padrões da evolução e modelos de laudo cadastrados, no formato das listas de evolucao-modelos.js e laudos-modelos.js.
  const customPatterns = () => data.patterns.filter((p) => p.active !== false).map((p) => ({
    id: `adm-${p.id}`, name: p.name, hint: p.hint || "Padrão cadastrado pelo administrador", custom: true, build: (ctx) => fill(p.text, ctx),
  }))
  const customLaudoModels = () => data.laudoModels.filter((m) => m.active !== false).map((m) => ({
    id: `adm-${m.id}`, name: m.name, hint: m.hint || "Modelo cadastrado pelo administrador", title: (m.title || m.name).toUpperCase(),
    layout: m.layout || "padrao", custom: true, build: (ctx) => fill(m.text, ctx),
  }))

  // ---------- Gravação (tela Gestão) ----------
  const LISTS = ["programs", "procedures", "eventTypes", "patterns", "laudoModels", "rooms", "shifts", "machines", "dialyzers", "users"]
  function upsert(list, item, action) {
    if (!LISTS.includes(list)) return null
    const rows = data[list]
    const found = item.id && rows.find((r) => r.id === item.id)
    const record = found ? Object.assign(found, item, { updatedAt: new Date().toISOString() }) : { active: true, ...item, id: nextId(rows), createdAt: new Date().toISOString() }
    if (!found) rows.push(record)
    const label = record.room && list === "machines" ? `${record.room} - ${record.name}` : record.name || record.code
    log(list, action || (found ? (Object.keys(item).length === 2 && "active" in item ? (list === "users" ? (item.active ? "Desbloqueou" : "Bloqueou") : item.active ? "Ativou" : "Desativou") : "Alterou") : "Incluiu"), label)
    save()
    applyAll()
    return record
  }
  function remove(list, id) {
    if (!LISTS.includes(list)) return
    const row = data[list].find((r) => r.id === id)
    data[list] = data[list].filter((r) => r.id !== id)
    if (row) log(list, "Excluiu", row.room && list === "machines" ? `${row.room} - ${row.name}` : row.name || row.code)
    save()
    applyAll()
  }
  function toggleBuiltinEventType(kind, name) {
    const key = `${kind}:${name}`
    const hide = !data.hiddenEventTypes.includes(key)
    data.hiddenEventTypes = hide ? [...data.hiddenEventTypes, key] : data.hiddenEventTypes.filter((k) => k !== key)
    log("eventTypes", hide ? "Desativou" : "Ativou", name)
    save()
    applyEventTypes()
  }
  function saveUnit(values) {
    const changed = UNIT_FIELDS.filter((k) => (values[k] ?? "") !== (data.unit[k] ?? ""))
    if (!changed.length) return 0
    data.unit = { ...data.unit, ...Object.fromEntries(UNIT_FIELDS.map((k) => [k, values[k] ?? ""])) }
    log("unit", "Alterou", "Dados da unidade", `${changed.length} ${changed.length === 1 ? "campo" : "campos"}`)
    save()
    applyUnit()
    return changed.length
  }
  function setPermission(permission, profile, allowed) {
    const def = PERMISSIONS.find((p) => p.id === permission)
    if (!def || (def.locked === profile && !allowed)) return
    const list = data.permissions[permission]
    data.permissions[permission] = allowed ? [...new Set([...list, profile])] : list.filter((p) => p !== profile)
    const label = window.HuNefroSessao?.profileLabel?.(profile) || profile
    log("permissions", allowed ? "Concedeu" : "Retirou", `${def.name} (${label})`)
    save()
  }
  // Cria as máquinas que faltam quando a sala ganha cadeiras (as que sobram ficam, para não perder o histórico).
  function syncMachines(room) {
    const have = data.machines.filter((m) => m.room === room.name)
    for (let n = 1; n <= room.fixed + room.extra; n += 1) {
      const name = `Máquina ${pad2(n)}`
      const found = have.find((m) => m.name === name)
      if (found) { found.extraChair = n > room.fixed; continue }
      data.machines.push({ id: nextId(data.machines), room: room.name, name, extraChair: n > room.fixed, serial: "", model: "", status: "ativa", use: "geral", lastMaintenance: "", note: "" })
    }
    save()
  }
  function renameRoomMachines(from, to) {
    if (from === to) return
    data.machines.forEach((m) => { if (m.room === from) m.room = to })
    save()
  }
  function recordLogin(login) {
    const u = findUser(login)
    if (!u) return
    u.lastAccess = new Date().toISOString()
    save()
  }
  // O login da tela de entrada é o e-mail institucional: vale o e-mail cadastrado ou o login antes do "@".
  const sameText = (a, b) => String(a || "").trim().localeCompare(String(b || "").trim(), "pt-BR", { sensitivity: "base" }) === 0
  const findUser = (login) => {
    const typed = String(login || "").trim()
    return data.users.find((u) => (u.email && sameText(u.email, typed)) || sameText(u.login, typed) || sameText(u.login, typed.split("@")[0]))
  }

  // Usuário logado (o login do protótipo é o e-mail ou a parte antes do @) e o profissional correspondente.
  function currentUser() {
    let typed = ""
    try { typed = sessionStorage.getItem("huNefroUsername") || "" } catch { /* sem sessão */ }
    return typed ? findUser(typed) || null : null
  }
  function currentProfessional() {
    const u = currentUser()
    if (!u || u.active === false) return null
    return (C.PROFESSIONALS || []).find((p) => p.id === professionalIdOf(u)) || null
  }

  // ---------- Exportar e importar a configuração ----------
  function exportJson() {
    return JSON.stringify({ sistema: "Hu-Nefro", tipo: "configuracao-gestao", versao: 1, exportadoEm: new Date().toISOString(), dados: data }, null, 2)
  }
  function importJson(text) {
    let parsed
    try { parsed = JSON.parse(text) } catch { return "O arquivo não é um JSON válido." }
    const incoming = parsed?.dados
    if (!["configuracao-gestao", "configuracao-administracao"].includes(parsed?.tipo) || !incoming || typeof incoming !== "object") return "O arquivo não é uma configuração exportada pelo Hu-Nefro."
    const keep = data.log
    data = { ...empty(), ...incoming }
    ensureDefaults()
    data.log = keep
    log("config", "Importou", "Configuração completa")
    save()
    applyAll()
    return ""
  }
  function resetAll() {
    const keep = data.log
    data = { ...empty(), log: keep }
    ensureDefaults()
    log("config", "Restaurou", "Configuração inicial")
    save()
    applyAll()
  }

  // ---------- Consultas para as outras telas ----------
  const MACHINE_STATUS = [["ativa", "Em uso"], ["manutencao", "Em manutenção"], ["inativa", "Desativada"]]
  const MACHINE_USE = [["geral", "Uso geral"], ["hbv", "Exclusiva hepatite B (HBsAg+)"], ["hbv-desconhecida", "Exclusiva hepatite B desconhecida"]]
  const machine = (room, name) => {
    const n = String(name || "").replace(/\D/g, "")
    return data.machines.find((m) => m.room === room && m.name.replace(/\D/g, "").replace(/^0+/, "") === n.replace(/^0+/, ""))
  }
  // Aviso para Iniciar sessão: máquina em manutenção, desativada ou exclusiva (RDC ANVISA 11/2014, art. 16 e 17).
  function machineNotice(room, name) {
    const m = machine(room, name)
    if (!m) return null
    if (m.status === "manutencao") return ["danger", `${m.name} da ${m.room} está em manutenção${m.note ? ` (${m.note.replace(/\.$/, "")})` : ""}. Escolha outra máquina.`]
    if (m.status === "inativa") return ["danger", `${m.name} da ${m.room} está desativada no cadastro. Escolha outra máquina.`]
    if (m.use !== "geral") return ["warn", `${m.name} da ${m.room} é ${MACHINE_USE.find(([k]) => k === m.use)[1].toLowerCase()}: confira a sorologia do paciente.`]
    return null
  }

  window.HuNefroAdmin = {
    KEY, EVENT_KINDS, BUILTIN_PROGRAMS, BASE_EVENT_TYPES, TOKENS, BLANK, fill,
    CATEGORIES, CATEGORY_PROFILE, PROFILE_DESCRIPTIONS, PERMISSIONS, AREA_LABELS, UNIT_FIELDS, MACHINE_STATUS, MACHINE_USE, DIALYZER_NAMES,
    data: () => data, read, upsert, currentUser, currentProfessional, needsRqe, professionalIdOf, remove, toggleBuiltinEventType, saveUnit, setPermission, syncMachines, renameRoomMachines,
    isHiddenEventType: (kind, name) => data.hiddenEventTypes.includes(`${kind}:${name}`),
    programNames, applyPrograms, customPatterns, customLaudoModels,
    procedures: () => data.procedures.filter((p) => p.active !== false),
    dialyzerNames: () => data.dialyzers.filter((d) => d.active !== false).map((d) => d.name),
    machine, machineNotice, findUser, recordLogin,
    exportJson, importJson, resetAll,
  }
})()
