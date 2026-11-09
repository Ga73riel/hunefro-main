// Dados de demonstração compartilhados entre a lista de pacientes, a tela Sessões do dia e o prontuário.
//
// PROVISÓRIO (desenvolvimento): pacientes, escala de hemodiálise e sessões devem vir da API do backend.
// As sessões ficam no localStorage do navegador só para que a tela do dia e o prontuário (abertos em abas
// diferentes) enxerguem os mesmos registros. Nomes e documentos são fictícios.
(() => {
  "use strict"

  const basePatients = [
    { id: 1, name: "Ana Martins", code: "000184", birthDate: "18/04/1967", cpf: "***.***.***-12", cns: "*** **** **** 003", phone: "(98) 9****-3102", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 2, name: "Carlos Eduardo Lima", code: "000219", birthDate: "07/11/1981", cpf: "***.***.***-40", cns: "*** **** **** 118", phone: "(98) 9****-8821", program: "Transplantado", situation: "Clientes em pós TX" },
    { id: 3, name: "Joana Ribeiro", code: "000247", birthDate: "22/01/1974", cpf: "***.***.***-08", cns: "*** **** **** 542", phone: "(98) 9****-1450", program: "Em branco", situation: "Clientes consultório" },
    { id: 4, name: "Marcos Vinícius Silva", code: "000305", birthDate: "03/09/1990", cpf: "***.***.***-71", cns: "*** **** **** 729", phone: "(98) 9****-6714", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 5, name: "Rosa Maria Nunes", code: "000328", birthDate: "14/06/1959", cpf: "***.***.***-36", cns: "*** **** **** 884", phone: "(98) 9****-4208", program: "Transferido", situation: "Clientes em DP" },
    { id: 6, name: "Fernanda Sousa Alves", code: "000391", birthDate: "08/03/1985", cpf: "***.***.***-22", cns: "*** **** **** 471", phone: "(98) 9****-7340", program: "Em branco", situation: "Doadores em pré TX" },
    { id: 7, name: "Antônio Carlos Pereira", code: "000412", birthDate: "30/12/1955", cpf: "***.***.***-55", cns: "*** **** **** 207", phone: "(98) 9****-5531", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 8, name: "Benedita Costa", code: "000437", birthDate: "11/02/1962", cpf: "***.***.***-90", cns: "*** **** **** 618", phone: "(98) 9****-2276", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 9, name: "Francisco das Chagas Souza", code: "000458", birthDate: "25/07/1971", cpf: "***.***.***-17", cns: "*** **** **** 340", phone: "(98) 9****-9013", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 10, name: "Lucas Gabriel Mendes", code: "000473", birthDate: "05/05/2015", cpf: "***.***.***-63", cns: "*** **** **** 952", phone: "(98) 9****-4480", program: "Hemodiálise Pediátrica", situation: "Clientes em HD" },
    { id: 11, name: "Maria José Ferreira", code: "000489", birthDate: "19/10/1968", cpf: "***.***.***-48", cns: "*** **** **** 761", phone: "(98) 9****-6627", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 12, name: "Raimundo Nonato Silva", code: "000502", birthDate: "02/08/1958", cpf: "***.***.***-29", cns: "*** **** **** 185", phone: "(98) 9****-3348", program: "Hemodiálise", situation: "Clientes em HD" },
    { id: 13, name: "Teresa Cristina Lopes", code: "000516", birthDate: "13/03/1976", cpf: "***.***.***-84", cns: "*** **** **** 409", phone: "(98) 9****-1185", program: "Hemodiálise", situation: "Clientes em HD" },
  ]

  // Escala de HD (Programa de Tratamento: sala, turno e dias) e dados da prescrição usados para abrir a sessão.
  // days: dias da semana como em Date.getDay() (0 = domingo, 1 = segunda ... 6 = sábado).
  const SEG_QUA_SEX = [1, 3, 5]
  const TER_QUI_SAB = [2, 4, 6]
  const baseSchedule = [
    { patientId: 1, shift: "1º Turno", room: "Sala A", days: SEG_QUA_SEX, machine: "Máquina 01", method: "Hemodiálise", dialyzer: "F60S", accessKind: "fav", accessType: "Autógena Rádio-Cefálica", accessLoc: "Radio cefálica esquerda", access: "Autógena Rádio-Cefálica - Radio cefálica esquerda", dryWeight: "58.5", heparin: "5000", bloodFlow: "350", seedUses: 3 },
    { patientId: 4, shift: "1º Turno", room: "Sala A", days: SEG_QUA_SEX, machine: "Máquina 02", method: "Hemodiálise", dialyzer: "FX80", accessKind: "cateter", accessType: "Cateter de longa permanência", accessLoc: "Jugular direita", access: "Cateter de longa permanência - Jugular direita", dryWeight: "72", heparin: "5000", bloodFlow: "300", seedUses: 15 },
    { patientId: 7, shift: "1º Turno", room: "Sala B", days: SEG_QUA_SEX, machine: "Máquina 07", method: "Hemodiálise", dialyzer: "F7", accessKind: "fav", accessType: "Autógena Braquio-Cefálica", accessLoc: "Braquio cefálica direita", access: "Autógena Braquio-Cefálica - Braquio cefálica direita", dryWeight: "81", heparin: "5000", bloodFlow: "400", seedUses: 16 },
    { patientId: 12, shift: "1º Turno", room: "Sala B", days: TER_QUI_SAB, machine: "Máquina 07", method: "Hemodiálise", dialyzer: "F7", accessKind: "fav", accessType: "Autógena Rádio-Cefálica", accessLoc: "Radio cefálica esquerda", access: "Autógena Rádio-Cefálica - Radio cefálica esquerda", dryWeight: "77", heparin: "5000", bloodFlow: "350", seedUses: 4 },
    { patientId: 8, shift: "2º Turno", room: "Sala B", days: SEG_QUA_SEX, machine: "Máquina 08", method: "Hemodiálise", dialyzer: "F50S", accessKind: "fav", accessType: "Autógena Braquio-Cefálica", accessLoc: "Braquio cefálica esquerda", access: "Autógena Braquio-Cefálica - Braquio cefálica esquerda", dryWeight: "54", heparin: "4000", bloodFlow: "300", seedUses: 1 },
    { patientId: 10, shift: "2º Turno", room: "Sala A", days: SEG_QUA_SEX, machine: "Máquina 03", method: "Hemodiálise Pediátrica", dialyzer: "FxPaed", accessKind: "cateter", accessType: "Cateter de longa permanência", accessLoc: "Jugular direita", access: "Cateter de longa permanência - Jugular direita", dryWeight: "32", heparin: "1500", bloodFlow: "150", seedUses: 2 },
    { patientId: 9, shift: "2º Turno", room: "Sala B", days: SEG_QUA_SEX, machine: "Máquina 09", method: "Hemodiálise", dialyzer: "FX60", accessKind: "cateter", accessType: "Cateter temporário", accessLoc: "Femoral direita", access: "Cateter temporário - Femoral direita", dryWeight: "66", heparin: "5000", bloodFlow: "300", seedUses: 6 },
    { patientId: 11, shift: "3º Turno", room: "Sala A", days: SEG_QUA_SEX, machine: "Máquina 01", method: "Hemodiálise", dialyzer: "F60S", accessKind: "fav", accessType: "Autógena Braquio-Basílica", accessLoc: "Braquio basílica esquerda", access: "Autógena Braquio-Basílica - Braquio basílica esquerda", dryWeight: "61", heparin: "5000", bloodFlow: "350", seedUses: 9 },
    { patientId: 13, shift: "3º Turno", room: "Sala B", days: TER_QUI_SAB, machine: "Máquina 10", method: "Hemodiálise", dialyzer: "F60S", accessKind: "fav", accessType: "Autógena Rádio-Cefálica", accessLoc: "Radio cefálica direita", access: "Autógena Rádio-Cefálica - Radio cefálica direita", dryWeight: "59", heparin: "5000", bloodFlow: "350", seedUses: 5 },
  ]

  // Unidade de HD (PROVISÓRIO, virá do cadastro): turnos, salas e cadeiras de cada sala (dados do HU-UFMA, 04/11/2026).
  // ROOMS: cadeiras fixas da escala. EXTRA_CHAIRS: cadeira extra para reposição ou encaixe.
  // A Sala Q (4 cadeiras) é reservada para pacientes internados e fica sempre disponível: não entra na escala ambulatorial,
  // mas a enfermeira pode remarcar uma sessão para lá quando houver vaga.
  // 3 turnos (enfermagem, 06/11/2026): 1º 07h-11h, 2º 12h-16h, 3º 17h-21h. Os dados de teste enchem os 3.
  const SHIFTS = ["1º Turno", "2º Turno", "3º Turno"]
  const TEST_SHIFTS = SHIFTS
  // As salas cadastradas em Gestão > Salas e cadeiras (huNefroAdmin:v1, campo rooms) substituem os valores abaixo.
  const adminRooms = (() => {
    try { return (JSON.parse(localStorage.getItem("huNefroAdmin:v1") || "null")?.rooms || []).filter((r) => r.active !== false) } catch { return [] }
  })()
  const roomMap = (pick, fallback) => (adminRooms.length ? Object.freeze(Object.fromEntries(adminRooms.filter(pick[0]).map((r) => [r.name, r[pick[1]]]).filter(([, n]) => n > 0 || pick[1] === "fixed"))) : Object.freeze(fallback))
  const ROOMS = roomMap([(r) => !r.inpatient, "fixed"], { "Sala A": 12, "Sala B": 10 })
  const EXTRA_CHAIRS = roomMap([(r) => !r.inpatient, "extra"], { "Sala A": 1, "Sala B": 1 })
  // Os pacientes de teste são gerados sempre com as salas originais, para os ids não mudarem quando a sala muda no cadastro.
  const TEST_ROOMS = Object.freeze({ "Sala A": 12, "Sala B": 10 })
  const INPATIENT_ROOMS = roomMap([(r) => r.inpatient, "fixed"], { "Sala Q": 4 })

  // Pacientes de demonstração gerados para encher a escala (nomes fictícios e determinísticos).
  const FIRST = ["José", "Maria", "Antônio", "Francisca", "João", "Ana Lúcia", "Pedro", "Luzia", "Paulo", "Raimunda", "Manoel", "Sebastiana", "Luís Carlos", "Conceição", "Jorge", "Edna", "Domingos", "Socorro", "Sérgio", "Graça", "Ribamar", "Eliane", "Cícero", "Vera Lúcia", "Wellington", "Rita", "Osvaldo", "Iracema", "Valdir", "Celeste", "Gilberto", "Lourdes", "Nonato", "Helena", "Expedito", "Neide", "Benedito", "Zilda"]
  const LAST = ["Santos", "Oliveira", "Sousa", "Pereira", "Carvalho", "Almeida", "Gomes", "Rodrigues", "Araújo", "Barbosa", "Castro", "Moraes", "Rocha", "Dias", "Teixeira", "Cardoso", "Correia", "Pinheiro", "Freitas", "Nascimento", "Brito", "Campos", "Serra", "Viana", "Muniz", "Belfort", "Coelho", "Furtado", "Penha", "Reis"]
  const DIALYZERS = ["F60S", "FX60", "FX80", "F7", "F50S", "Elisio 150 HR"]
  const ACCESSES = [
    ["fav", "Autógena Rádio-Cefálica", "Radio cefálica esquerda"],
    ["fav", "Autógena Braquio-Cefálica", "Braquio cefálica esquerda"],
    ["cateter", "Cateter de longa permanência", "Jugular direita"],
    ["fav", "Autógena Rádio-Cefálica", "Radio cefálica direita"],
    ["fav", "Autógena Braquio-Basílica", "Braquio basílica esquerda"],
  ]
  const generatedPatients = []
  const generatedSchedule = []
  {
    let id = basePatients.length + 1
    const pad2 = (n) => String(n).padStart(2, "0")
    ;[SEG_QUA_SEX, TER_QUI_SAB].forEach((days) => TEST_SHIFTS.forEach((shift) => Object.entries(TEST_ROOMS).forEach(([room, machines]) => {
      const used = baseSchedule.filter((s) => s.days === days && s.shift === shift && s.room === room).map((s) => s.machine)
      let free = machines - used.length
      for (let m = 1; m <= machines && free > 0; m += 1) {
        const machine = `Máquina ${pad2(m)}`
        if (used.includes(machine)) continue
        free -= 1
        const k = id
        const name = `${FIRST[(k * 7) % FIRST.length]} ${LAST[(k * 11) % LAST.length]} ${LAST[(k * 5 + 3) % LAST.length]}`
        const [accessKind, accessType, accessLoc] = ACCESSES[k % ACCESSES.length]
        generatedPatients.push({
          id: k, name, code: String(500 + k * 3).padStart(6, "0"), birthDate: `${pad2((k % 28) + 1)}/${pad2((k % 12) + 1)}/${1950 + (k % 40)}`,
          cpf: `***.***.***-${pad2(k % 100)}`, cns: `*** **** **** ${String(k * 13 % 1000).padStart(3, "0")}`, phone: `(98) 9****-${String(1000 + k * 37 % 9000)}`,
          program: "Hemodiálise", situation: "Clientes em HD",
        })
        generatedSchedule.push({
          patientId: k, shift, room, days, machine, method: "Hemodiálise", dialyzer: DIALYZERS[k % DIALYZERS.length],
          accessKind, accessType, accessLoc, access: `${accessType} - ${accessLoc}`, dryWeight: String(48 + (k * 7) % 38), heparin: accessKind === "cateter" ? "3000" : "5000",
          bloodFlow: ["300", "350", "400"][k % 3], seedUses: k % 15, generated: true,
        })
        id += 1
      }
    })))
  }
  // Pacientes incluídos pela Recepção com a busca do CPF no AGHU (PROVISÓRIO: AGHU simulado em js/aghu-mock.js).
  const NEW_KEY = "huNefroNovosPacientes:v1"
  const readNew = () => { try { return JSON.parse(localStorage.getItem(NEW_KEY)) || [] } catch { return [] } }
  const patients = [...basePatients, ...generatedPatients, ...readNew()]
  const schedule = Object.freeze([...baseSchedule, ...generatedSchedule])

  // Início de cada turno, só para gerar o histórico de exemplo.
  const SHIFT_START = { "1º Turno": "07:00", "2º Turno": "12:00", "3º Turno": "17:00" }

  // ---------- Datas ----------
  const pad = (n) => String(n).padStart(2, "0")
  const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fromIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d) }
  const addDays = (iso, n) => { const d = fromIso(iso); d.setDate(d.getDate() + n); return toIso(d) }
  const weekday = (iso) => fromIso(iso).getDay()
  const addMinutes = (time, n) => { const [h, m] = time.split(":").map(Number); const t = h * 60 + m + n; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}` }

  // ---------- Regras de contagem (usadas pela tela do dia e pelo prontuário) ----------
  const MAX_DIALYZER_USES = 20
  const hasNum = (v) => v !== "" && v != null && Number.isFinite(Number(String(v).replace(",", ".")))
  const before = (a, b) => a.date < b.date || (a.date === b.date && (a.start || "") < (b.start || ""))
  const previousOf = (list, rec) => list.filter((s) => s.id !== rec.id && before(s, rec)).sort((a, b) => (before(a, b) ? 1 : -1))
  // Nº da diálise: posição da sessão na sequência do paciente.
  const sessionNumber = (list, rec) => previousOf(list, rec).length + 1
  // Uso do dialisador: sessões seguidas com o mesmo dialisador desde a última marcada como "dialisador novo".
  // Se uma sessão anterior já tem o uso gravado, a contagem parte dele.
  function dialyzerUse(list, rec) {
    if (!rec.dialyzer) return null
    if (rec.newDialyzer || rec.singleUse) return 1
    let uses = 1
    for (const s of previousOf(list, rec)) {
      if (s.dialyzer !== rec.dialyzer || s.singleUse) break // dialisador de uso único é descartado após a sessão
      if (s.newDialyzer) { uses += 1; break }
      if (hasNum(s.usage)) { uses += Number(s.usage); break }
      uses += 1
    }
    return uses
  }

  // ---------- Sorologias e regras da RDC ANVISA nº 11/2014 ----------
  // Marcadores virais de teste (os mesmos que dados-teste.js coloca em Dados Clínicos). Positivos de exemplo:
  // paciente 7 hepatite C, 12 hepatite B (HBsAg), 13 HIV; paciente 9 (recém-admitido) com hepatite B coletada, sem resultado.
  function testMarkers(id) {
    const m = { hepatiteC: "negativo", hepatiteB: "negativo", hiv: "negativo", antiHbs: id % 4 === 0 ? "negativo" : "positivo", cmvIgg: "positivo", chagasIgm: "nao-informado" }
    if (id === 7) m.hepatiteC = "positivo"
    if (id === 12) { m.hepatiteB = "positivo"; m.antiHbs = "negativo" }
    if (id === 13) m.hiv = "positivo"
    if (id === 9) m.hepatiteB = "coletado"
    return m
  }
  // Marcadores do prontuário salvo no navegador; sem prontuário salvo, os de teste.
  // Internados ainda sem cadastro na Nefrologia têm id provisório a partir daqui (ver HuNefroInternadosStore).
  const PROVISIONAL_BASE = 900000
  function markersOf(id) {
    if (Number(id) >= PROVISIONAL_BASE) return provisionalRecord(id)?.person?.serology || {}
    try {
      const saved = JSON.parse(localStorage.getItem(`huNefroProntuario:v2:${id}`) || "null")
      if (saved?.dadosClinicos?.marcadores_virais) return saved.dadosClinicos.marcadores_virais
    } catch { /* sem armazenamento */ }
    return testMarkers(Number(id))
  }
  const VIRAL = [["hepatiteB", "HBsAg", "hepatite B"], ["hepatiteC", "Anti-HCV", "hepatite C"], ["hiv", "Anti-HIV", "HIV"]]
  // Regras que valem para a sessão de HD conforme as sorologias de hepatite B, hepatite C e HIV.
  // "Coletado" e "Não informado" contam como sorologia desconhecida.
  function serologyRules(markers = {}) {
    const positive = VIRAL.filter(([id]) => markers[id] === "positivo")
    const unknown = VIRAL.filter(([id]) => markers[id] !== "positivo" && markers[id] !== "negativo")
    const hbvPositive = markers.hepatiteB === "positivo"
    const hbvUnknown = unknown.some(([id]) => id === "hepatiteB")
    const rules = []
    if (positive.length || unknown.length) rules.push("Dialisador de uso único: descartar após a sessão, sem reprocessamento (art. 27).")
    if (hbvPositive) rules.push("Profissional exclusivo durante toda a sessão, já vacinado e com soroconversão para hepatite B (art. 15).", "Sala própria para hepatite B ou serviço de referência (art. 17, XV e § 1º).")
    else if (hbvUnknown) rules.push("Sorologia para hepatite B desconhecida: profissional exclusivo durante toda a sessão, em máquina específica (art. 16).")
    const tags = [...positive.map(([, tag]) => `${tag}+`), ...(unknown.length ? [`Sorologia desconhecida: ${unknown.map(([, , name]) => name).join(", ")}`] : [])]
    return {
      positive: positive.map(([id]) => id), unknown: unknown.map(([id]) => id),
      singleUse: Boolean(positive.length || unknown.length),
      exclusiveProfessional: hbvPositive || hbvUnknown,
      tags, rules,
      tone: positive.length ? "danger" : unknown.length ? "warn" : "ok",
    }
  }

  // ---------- Armazenamento ----------
  const KEY = "huNefroSessoesHD:v8"
  // Versões anteriores (com o 4º e o 5º turno e os horários antigos).
  try { ["huNefroSessoesHD:v5", "huNefroFaltasHD:v5", "huNefroSessoesHD:v6", "huNefroFaltasHD:v6", "huNefroSessoesHD:v7", "huNefroFaltasHD:v7"].forEach((k) => localStorage.removeItem(k)) } catch { /* sem armazenamento */ }
  let memory = null // usado quando o navegador bloqueia o localStorage

  // Histórico de exemplo: sessões das últimas 13 semanas e duas faltas (uma reposta, outra não realizada).
  let seededAbsences = []
  function seed() {
    const today = toIso(new Date())
    const list = []
    const absences = []
    let id = 1
    const nurse = "Enfermeira Exemplo 01"
    const tech = "Técnico Exemplo 03"
    // Faltas e remarcações de exemplo nos pacientes gerados (ver o laço abaixo).
    const pendingIds = [generatedSchedule[4]?.patientId, generatedSchedule[40]?.patientId]
    const advancedId = generatedSchedule[12]?.patientId
    const postponedId = generatedSchedule[95]?.patientId
    schedule.forEach((p, i) => {
      const dates = []
      // Pacientes gerados: só as duas últimas semanas, para não lotar o armazenamento do navegador.
      for (let back = 1; back <= (p.generated ? 14 : 91); back += 1) {
        const date = addDays(today, -back)
        if (p.days.includes(weekday(date))) dates.unshift(date)
      }
      // Faltas de exemplo: paciente 8 (reposta no dia seguinte) e paciente 11 (internada; reposição não realizada).
      const missed = { 8: dates[dates.length - 9], 11: dates[dates.length - 6] }[p.patientId]
      // Remarcação futura de exemplo: próxima sessão adiada para o dia seguinte.
      if (p.patientId === postponedId) {
        let next = today
        while (!p.days.includes(weekday(next))) next = addDays(next, 1)
        if (next === today) next = addDays(today, 1)
        while (!p.days.includes(weekday(next))) next = addDays(next, 1)
        absences.push({ id: absences.length + 1, kind: "remarcacao", patientId: p.patientId, date: next, shift: p.shift, room: p.room, makeupOf: null,
          reason: "Solicitação do paciente", note: "Consulta no ambulatório no mesmo horário.", by: nurse, at: `${today}T08:00:00.000Z`,
          makeup: { date: addDays(next, 1), shift: p.shift, room: p.room, by: nurse, at: `${today}T08:00:00.000Z` } })
      }
      // Sessão de exemplo; "em-andamento" fica só com a aferição inicial (para a tela do dia de hoje).
      const pushSession = (date, k, start, room, shift, state = "concluida") => {
        const dry = Number(p.dryWeight)
        // Uso do dialisador: a última sessão de exemplo fica em seedUses + 3 (ciclos de até 20 usos).
        // Sorologia positiva ou desconhecida: dialisador de uso único (RDC 11/2014, art. 27).
        const singleUse = serologyRules(testMarkers(p.patientId)).singleUse
        const usage = singleUse ? 1 : ((((p.seedUses + 3 - (n - 1 - k)) - 1) % MAX_DIALYZER_USES) + MAX_DIALYZER_USES) % MAX_DIALYZER_USES + 1
        const weightStart = (dry + 1.2 + ((i * 3 + k) % 5) * 0.45).toFixed(1)
        const weightEnd = (dry + ((k + i) % 3) * 0.2).toFixed(1)
        const hypotension = (k + i) % 9 === 4
        list.push({
          id: id++, patientId: p.patientId, state, date, start, end: addMinutes(start, hypotension ? 225 : 240),
          number: "", room, shift, machine: p.machine, responsible: ["p-003", "p-004"][k % 2],
          method: p.method, dialyzer: p.dialyzer, newDialyzer: usage === 1, singleUse, usage: String(usage), usageMax: String(MAX_DIALYZER_USES),
          priming: "", solution: "Bicarbonato", access: p.access, needle: p.accessKind === "fav" ? "15G" : "", heparin: p.heparin, bloodFlow: p.bloodFlow, dialysateFlow: "500",
          bicarbonate: "35", bathTemp: "36.5", ufProfile: "", naBase: "138", naConc: "138", naProfile: "", naInitial: "",
          dryWeight: p.dryWeight, extra: "300", // soro da devolução, uma vez ao final weightStart, weightEnd, uf: String(Math.round((weightStart - weightEnd) * 1000)),
          complications: hypotension ? "Hipotensão intradialítica; UF reduzida e paciente em Trendelenburg" : "", notes: "",
          measures: [
            { time: start, pa: `${130 + ((i + k) % 3) * 10}/80`, fc: "78", tax: "36.4", hep: p.heparin, flow: p.bloodFlow, pArt: "-180", pVen: "160" },
            { time: addMinutes(start, 120), pa: hypotension ? "90/60" : "125/75", fc: hypotension ? "96" : "76", tax: "", hep: "", flow: p.bloodFlow, pArt: "-190", pVen: "170" },
            { time: addMinutes(start, hypotension ? 220 : 235), pa: "120/70", fc: "74", tax: "36.5", hep: "", flow: p.bloodFlow, pArt: "", pVen: "" },
          ],
          by: tech,
        })
        if (state === "em-andamento") Object.assign(list[list.length - 1], { end: "", weightEnd: "", uf: "", complications: "", measures: list[list.length - 1].measures.slice(0, 1) })
      }
      const n = dates.length
      dates.forEach((date, k) => {
        let start = SHIFT_START[p.shift]
        let [room, shift] = [p.room, p.shift]
        if (k === n - 1 && pendingIds.includes(p.patientId)) {
          // Falta registrada pelo técnico, ainda sem remarcação (aparece em "Faltas a remarcar").
          absences.push({ id: absences.length + 1, kind: "falta", patientId: p.patientId, date, shift: p.shift, room: p.room, makeupOf: null,
            reason: "Não compareceu sem aviso", note: "", makeup: null, by: tech, at: `${date}T09:00:00.000Z` })
          return
        }
        if (k === n - 2 && p.patientId === advancedId) {
          // Sessão adiantada um dia pela enfermeira (feriado municipal).
          const makeup = { date: addDays(date, -1), shift: p.shift, room: p.room, by: nurse, at: `${addDays(date, -3)}T10:00:00.000Z` }
          absences.push({ id: absences.length + 1, kind: "remarcacao", patientId: p.patientId, date, shift: p.shift, room: p.room, makeupOf: null,
            reason: "Viagem", note: "Paciente viaja no dia da sessão.", makeup, by: nurse, at: makeup.at })
          date = makeup.date
        }
        if (date === missed) {
          const makeup = { date: addDays(date, 1), shift: "3º Turno", room: p.room, by: nurse, at: `${date}T11:00:00.000Z` }
          absences.push({ id: absences.length + 1, kind: "falta", patientId: p.patientId, date, shift: p.shift, room: p.room, makeupOf: null,
            reason: p.patientId === 8 ? "Problema de transporte" : "Internação", note: p.patientId === 8 ? "Avisou por telefone." : "Internada no HU-UFMA.",
            makeup, by: tech, at: `${date}T09:00:00.000Z` })
          if (p.patientId !== 8) return
          date = makeup.date; start = SHIFT_START[makeup.shift]; room = makeup.room; shift = makeup.shift
        }
        pushSession(date, k, start, room, shift)
      })
      // Hoje (pacientes gerados): turnos que já terminaram ficam concluídos e o turno em curso, em andamento,
      // para a tela do dia mostrar as situações. Os pacientes 1 a 13 ficam aguardando, para testar o fluxo.
      if (p.generated && p.days.includes(weekday(today)) && !pendingIds.includes(p.patientId)) {
        const now = new Date().getHours() * 60 + new Date().getMinutes()
        const [h, m] = SHIFT_START[p.shift].split(":").map(Number)
        const begin = h * 60 + m
        if (now >= begin + 250) pushSession(today, n, SHIFT_START[p.shift], p.room, p.shift)
        else if (now >= begin + 20 && p.patientId % 4 !== 0) pushSession(today, n, addMinutes(SHIFT_START[p.shift], (p.patientId % 5) * 5), p.room, p.shift, "em-andamento")
      }
    })
    list.forEach((s) => (s.number = String(sessionNumber(list.filter((x) => x.patientId === s.patientId), s))))
    seededAbsences = absences
    return list
  }

  function readAll() {
    if (memory) return memory
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
      const list = seed()
      localStorage.setItem(KEY, JSON.stringify(list))
      localStorage.setItem(ABSENCE_KEY, JSON.stringify(seededAbsences))
      return list
    } catch {
      memory = seed()
      return memory
    }
  }

  function writeAll(list) {
    if (memory) { memory = list; return }
    try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { memory = list }
  }

  const copy = (v) => JSON.parse(JSON.stringify(v))

  // Faltas e remarcações (mesmo formato: horário original em date/shift/room e o novo horário em makeup).
  // kind "falta": o paciente faltou (registrada pelo técnico ou pela enfermeira); makeup fica null até a
  //   enfermeira remarcar a reposição.
  // kind "remarcacao": a enfermeira mudou a sessão antes de ela acontecer, para antes (adiantamento) ou
  //   depois (adiamento) da data prevista. Não conta como falta.
  const ABSENCE_KEY = "huNefroFaltasHD:v8"
  let absenceMemory = null
  function readAbsences() {
    if (absenceMemory) return absenceMemory
    if (memory) { absenceMemory = seededAbsences; return absenceMemory }
    try {
      if (localStorage.getItem(KEY) === null) readAll() // primeira abertura: gera sessões e faltas de exemplo juntas
      return JSON.parse(localStorage.getItem(ABSENCE_KEY)) || []
    } catch { absenceMemory = seededAbsences; return absenceMemory }
  }
  function writeAbsences(list) {
    if (absenceMemory) { absenceMemory = list; return }
    try { localStorage.setItem(ABSENCE_KEY, JSON.stringify(list)) } catch { absenceMemory = list }
  }

  window.HuNefroFaltasStore = {
    all: () => copy(readAbsences()),
    forPatient: (patientId) => copy(readAbsences().filter((a) => a.patientId === Number(patientId))),
    save(rec) {
      const list = readAbsences()
      const out = { ...copy(rec), id: rec.id || list.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1 }
      writeAbsences([...list.filter((a) => a.id !== out.id), out])
      return copy(out)
    },
    remove(id) { writeAbsences(readAbsences().filter((a) => a.id !== id)) },
  }

  // Sessões extras (Elias, 06/11/2026): por orientação médica, para qualquer paciente, sem limite fixo na semana.
  // A enfermeira (ou o médico) escolhe o dia, o horário, a sala, o médico que orientou (doctorId, doctorName, reason) e os pacientes.
  // shift: "Sessão extra hh:mm". patientIds: pacientes incluídos pela busca. Registros antigos podem ter faltas repostas
  // nela (makeup com extraId); a sessão extra não oferece mais a lista de faltosos (Elias, 06/11/2026).
  const EXTRA_KEY = "huNefroTurnosExtras:v1"
  let extraMemory = null
  function readExtras() {
    if (extraMemory) return extraMemory
    try { return JSON.parse(localStorage.getItem(EXTRA_KEY)) || [] } catch { extraMemory = []; return extraMemory }
  }
  function writeExtras(list) {
    if (extraMemory) { extraMemory = list; return }
    try { localStorage.setItem(EXTRA_KEY, JSON.stringify(list)) } catch { extraMemory = list }
  }
  window.HuNefroTurnosExtrasStore = {
    all: () => copy(readExtras()),
    save(rec) {
      const list = readExtras()
      const out = { ...copy(rec), id: rec.id || list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1 }
      writeExtras([...list.filter((x) => x.id !== out.id), out])
      return copy(out)
    },
    remove(id) { writeExtras(readExtras().filter((x) => x.id !== id)) },
  }

  // Internados na Sala Q (Elias, 06/11/2026): a Sala Q é sob demanda, para sessões extras e pacientes internados no HU.
  // O internado pode ser paciente do setor (patientId) ou ainda não ter cadastro na Nefrologia (person): este não entra
  // na lista de pacientes, recebe um id provisório (PROVISIONAL_BASE + id) para as sessões e pode ser incluído depois
  // como paciente oficial do setor (includedPatientId; as sessões e faltas passam para o novo id).
  // Registro: { id, patientId | null, person: { name, birthDate, sex, hospitalRecord, cpf, cns, serology } | null, bed, clinic,
  //   doctorId, doctorName, indication, access, note, slots: [{ date, shift, room }], status: "internado" | "alta",
  //   dischargeAt, includedPatientId, includedAt, by, at }.
  const INTERN_KEY = "huNefroInternados:v1"
  function seedInternados() {
    const today = toIso(new Date())
    const doctor = (window.HuNefroCatalogos?.PROFESSIONALS || []).find((p) => p.category === "medico")
    return [{ id: 1, patientId: null, person: { name: "Josué Ferreira Lima", birthDate: "1961-03-14", sex: "Masculino", hospitalRecord: "0098765", cpf: "", cns: "", serology: {} },
      bed: "Clínica Médica - Leito 12", clinic: "Clínica Médica", doctorId: doctor?.id || "", doctorName: doctor?.name || "Médico(a) da unidade",
      indication: "Lesão renal aguda", access: "Cateter temporário - Jugular direita", note: "Exemplo: internado sem cadastro na Nefrologia.",
      slots: [{ date: today, shift: "2º Turno", room: "Sala Q" }], status: "internado", by: "Enfermeira (exemplo)", byProfile: "Enfermeiro(a)", at: `${today}T08:00:00.000Z`, seed: true }]
  }
  let internMemory = null
  function readInternados() {
    if (internMemory) return internMemory
    try {
      const raw = localStorage.getItem(INTERN_KEY)
      if (raw === null) { const seedList = seedInternados(); localStorage.setItem(INTERN_KEY, JSON.stringify(seedList)); return seedList }
      return JSON.parse(raw) || []
    } catch { internMemory = seedInternados(); return internMemory }
  }
  function writeInternados(list) {
    if (internMemory) { internMemory = list; return }
    try { localStorage.setItem(INTERN_KEY, JSON.stringify(list)) } catch { internMemory = list }
  }
  const internPatientId = (r) => r.includedPatientId || r.patientId || PROVISIONAL_BASE + r.id
  function provisionalRecord(id) { return readInternados().find((r) => PROVISIONAL_BASE + r.id === Number(id) && !r.patientId) || null }
  function provisionalPatient(id) {
    const r = provisionalRecord(id)
    if (!r || r.includedPatientId) return null
    const [y, m, d] = String(r.person?.birthDate || "").split("-")
    return { id: PROVISIONAL_BASE + r.id, name: r.person?.name || "Internado sem nome", code: `INT-${String(r.id).padStart(4, "0")}`, birthDate: y ? `${d}/${m}/${y}` : "",
      sex: r.person?.sex || "", cpf: r.person?.cpf || "", cns: r.person?.cns || "", program: "Internado (sem cadastro na Nefrologia)", situation: "Internado", provisional: true, internacaoId: r.id }
  }
  window.HuNefroInternadosStore = {
    PROVISIONAL_BASE,
    patientIdOf: internPatientId,
    all: () => copy(readInternados()),
    save(rec) {
      const list = readInternados()
      const out = { ...copy(rec), id: rec.id || list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1 }
      writeInternados([...list.filter((x) => x.id !== out.id), out])
      return copy(out)
    },
    remove(id) { writeInternados(readInternados().filter((x) => x.id !== id)) },
    // Internado sem cadastro incluído como paciente do setor: sessões e faltas passam para o id oficial.
    include(id, newPatientId, by) {
      const list = readInternados()
      const r = list.find((x) => x.id === id)
      if (!r) return null
      const from = PROVISIONAL_BASE + r.id
      const to = Number(newPatientId)
      writeAll(readAll().map((s) => (s.patientId === from ? { ...s, patientId: to } : s)))
      writeAbsences(readAbsences().map((a) => (a.patientId === from ? { ...a, patientId: to } : a)))
      Object.assign(r, { includedPatientId: to, includedAt: new Date().toISOString(), includedBy: by || "" })
      writeInternados(list)
      return copy(r)
    },
  }

  window.HuNefroMock = {
    patients,
    schedule,
    patient: (id) => patients.find((p) => p.id === Number(id)) || (Number(id) >= PROVISIONAL_BASE ? provisionalPatient(id) : null),
    // Cria um prontuário novo (sem escala de HD: o turno, a sala e os dias são definidos no Programa de Tratamento).
    addPatient(data) {
      const id = patients.reduce((m, p) => Math.max(m, p.id), 0) + 1
      const code = String(patients.reduce((m, p) => Math.max(m, Number(p.code) || 0), 0) + 1).padStart(6, "0")
      const situation = /hemodi/i.test(data.program) ? "Clientes em HD" : "Clientes consultório"
      const rec = { ...data, id, code, situation, isNew: true, createdAt: new Date().toISOString() }
      patients.push(rec)
      try { localStorage.setItem(NEW_KEY, JSON.stringify([...readNew(), rec])) } catch { /* sem armazenamento: só nesta visita */ }
      return { ...rec }
    },
    scheduleOf: (id) => schedule.find((s) => s.patientId === Number(id)) || null,
    // Pacientes previstos na data (pela escala do Programa de Tratamento).
    scheduledOn: (iso) => schedule.filter((s) => s.days.includes(weekday(iso))),
    SHIFTS,
    ROOMS,
    EXTRA_CHAIRS,
    INPATIENT_ROOMS,
    weekday,
    addDays,
    testMarkers,
    markersOf,
    serologyRules,
    serologyOf: (id) => serologyRules(markersOf(id)),
    // Apaga tudo o que o protótipo guardou no navegador (sessões, faltas e prontuários salvos); a próxima abertura gera os dados de teste de novo.
    resetTestData() {
      memory = null
      absenceMemory = null
      extraMemory = null
      internMemory = null
      try {
        Object.keys(localStorage).filter((key) => key.startsWith("huNefro")).forEach((key) => localStorage.removeItem(key))
      } catch { /* armazenamento bloqueado: nada guardado */ }
    },
  }

  window.HuNefroSessoesStore = {
    MAX_DIALYZER_USES,
    sessionNumber,
    dialyzerUse,
    all: () => copy(readAll()),
    forPatient: (patientId) => copy(readAll().filter((s) => s.patientId === Number(patientId))),
    // Grava (cria ou substitui) uma sessão e devolve o registro com id.
    save(rec) {
      const list = readAll()
      const out = copy(rec)
      if (out.id) {
        const i = list.findIndex((s) => s.id === out.id)
        if (i >= 0) list[i] = out
        else list.push(out)
      } else {
        out.id = list.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1
        list.push(out)
      }
      writeAll(list)
      return copy(out)
    },
    // Substitui todas as sessões de um paciente (ex.: correções feitas no prontuário).
    replacePatient(patientId, sessions) {
      const id = Number(patientId)
      writeAll([...readAll().filter((s) => s.patientId !== id), ...copy(sessions).map((s) => ({ ...s, patientId: id }))])
    },
    // Avisa quando outra aba altera as sessões ou as faltas (ex.: sessão concluída enquanto o prontuário está aberto).
    subscribe(callback) {
      window.addEventListener("storage", (event) => { if (event.key === KEY || event.key === ABSENCE_KEY) callback() })
    },
  }
})()
