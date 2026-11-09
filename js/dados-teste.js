// Dados de teste do prontuário (PROVISÓRIO, só para análise do protótipo).
//
// Ao abrir prontuario.html?patient=N, preenche todas as abas com dados fictícios e coerentes do paciente N
// (gerados sempre iguais para o mesmo paciente). "Salvar" guarda o prontuário no navegador; na próxima abertura
// ele volta como foi salvo. "Restaurar dados de teste" (lista de pacientes) apaga o que foi guardado.
// Sessões de diálise e faltas vêm de js/dados-mock.js. Deve ser carregado depois dos scripts das abas.
(() => {
  "use strict"

  const M = window.HuNefroMock
  const C = window.HuNefroCatalogos
  const { formatDate, todayIso, addDays, brToIso, slug, formatDecimal } = window.HuNefroUI
  if (!M || !document.getElementById("view-cadastro")) return

  const patientId = Number(new URLSearchParams(location.search).get("patient")) || 1
  const patient = M.patient(patientId)
  if (!patient) return
  const schedule = M.scheduleOf(patientId)
  const STORAGE_KEY = `huNefroProntuario:v2:${patientId}`

  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id)
  const pad = (n) => String(n).padStart(2, "0")
  const today = todayIso()
  const addMonths = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number)
    const date = new Date(y, m - 1 + n, Math.min(d, 28))
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  const dec = (n, digits = 1) => formatDecimal(n, digits)
  const prof = (id) => C.PROFESSIONALS.find((p) => p.id === id)?.name || ""
  const cid = (code) => C.CID.find((item) => item.code === code) || null
  // Gerador pseudoaleatório com semente: o mesmo paciente sempre recebe os mesmos dados.
  let seed = patientId * 7919
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const between = (min, max, digits = 1) => Math.round((min + rand() * (max - min)) * 10 ** digits) / 10 ** digits

  // ---------- Perfil fixo de cada paciente de teste ----------
  const PROFILES = {
    1: { sex: "Feminino", race: "Parda", mother: "Francisca Martins", city: "São Luís", district: "Cohab Anil", street: "Rua 12, Quadra 8", etiology: "Nefropatia hipertensiva", cid: "I12.0", abo: "A+", height: 158, yearsOnHd: 4 },
    2: { sex: "Masculino", race: "Branca", mother: "Maria do Socorro Lima", city: "São Luís", district: "Renascença", street: "Rua das Palmeiras", etiology: "Glomerulonefrite crônica (exceto Lupus)", cid: "N03", abo: "O+", height: 172, yearsOnHd: 8, transplantYears: 2 },
    3: { sex: "Feminino", race: "Parda", mother: "Raimunda Ribeiro", city: "Paço do Lumiar", district: "Maiobão", street: "Avenida 1", etiology: "Doença renal policística", cid: "Q61.2", abo: "B+", height: 162 },
    4: { sex: "Masculino", race: "Preta", mother: "Antônia Silva", city: "São José de Ribamar", district: "Araçagi", street: "Estrada do Araçagi", etiology: "Nefropatia diabética (tipo I)", cid: "E10.2", abo: "O-", height: 176, diabetic: "dm1", allergy: ["Medicamentosa", "Dipirona", "Urticária e prurido generalizado"], yearsOnHd: 6 },
    5: { sex: "Feminino", race: "Branca", mother: "Teresa Nunes", city: "Imperatriz", district: "Centro", street: "Rua Coronel Manoel Bandeira", etiology: "Nefropatia diabética (tipo II)", cid: "E11.2", abo: "A-", height: 155, diabetic: "dm2", yearsOnHd: 3 },
    6: { sex: "Feminino", race: "Parda", mother: "Luzia Sousa", city: "São Luís", district: "Turu", street: "Rua São Pedro", etiology: "", cid: "", abo: "O+", height: 165 },
    7: { sex: "Masculino", race: "Parda", mother: "Benedita Pereira", city: "São Luís", district: "Cidade Operária", street: "Unidade 103, Rua 5", etiology: "Nefropatia diabética (tipo II)", cid: "E11.2", abo: "B+", height: 170, diabetic: "dm2", yearsOnHd: 3 },
    8: { sex: "Feminino", race: "Preta", mother: "Josefa Costa", city: "Bacabal", district: "Centro", street: "Rua Magalhães de Almeida", etiology: "Nefropatia hipertensiva", cid: "I12.0", abo: "A+", height: 152, yearsOnHd: 1 },
    9: { sex: "Masculino", race: "Parda", mother: "Raimunda Souza", city: "Caxias", district: "Volta Redonda", street: "Rua Aarão Reis", etiology: "Indeterminada", cid: "N18.9", abo: "O+", height: 168, yearsOnHd: 0.4, catheterInfection: true },
    10: { sex: "Masculino", race: "Parda", mother: "Juliana Mendes", city: "São Luís", district: "Cohatrac", street: "Rua 3, Conjunto Cohatrac IV", etiology: "Glomerulonefrite crônica (exceto Lupus)", cid: "N03", abo: "A+", height: 142, yearsOnHd: 1 },
    11: { sex: "Feminino", race: "Parda", mother: "Ana Ferreira", city: "São Luís", district: "Vinhais", street: "Rua dos Jasmins", etiology: "Nefropatia lúpica", cid: "M32.1", abo: "AB+", height: 160, allergy: ["Medicamentosa", "Penicilina", "Edema de face"], yearsOnHd: 7, admitted: true },
    12: { sex: "Masculino", race: "Preta", mother: "Joana Silva", city: "Pinheiro", district: "Centro", street: "Rua Grande", etiology: "Nefropatia hipertensiva", cid: "I12.0", abo: "O+", height: 174, yearsOnHd: 2 },
    13: { sex: "Feminino", race: "Branca", mother: "Marlene Lopes", city: "São Luís", district: "Calhau", street: "Avenida dos Holandeses", etiology: "Doença renal policística", cid: "Q61.2", abo: "A+", height: 163, yearsOnHd: 5 },
  }
  const profile = PROFILES[patientId] || PROFILES[1]
  const onHd = Boolean(schedule)
  const birthIso = brToIso(patient.birthDate)
  const programStart = profile.yearsOnHd ? addDays(today, -Math.round(profile.yearsOnHd * 365)) : ""
  const female = profile.sex === "Feminino"
  const diabetic = Boolean(profile.diabetic)
  const doctor = "p-001", doctor2 = "p-002", nurse = "p-003", nutritionist = "p-005"

  // ---------- Identificação e Programa de Tratamento (campos da própria página) ----------
  const IDENT_FIELDS = ["nome-completo", "data-nascimento", "sexo", "cpf", "cns", "rg", "orgao-emissor", "uf-identidade", "data-identidade", "naturalidade", "uf-naturalidade", "nacionalidade", "nome-mae", "telefone", "email", "cor-raca", "cep", "logradouro", "numero", "complemento", "bairro", "municipio", "uf-endereco"]
  const PROGRAM_FIELDS = ["inicio-programa", "inicio-clinica", "programa-atual", "turno", "sala"]
  const DAY_VALUES = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"]

  function identityData() {
    const digits = String(patientId * 7_654_321 + 1_234_567).padStart(9, "0").slice(-9)
    const email = patient.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(" ")
    return {
      "nome-completo": patient.name.toUpperCase(),
      "data-nascimento": birthIso,
      sexo: profile.sex,
      cpf: `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${patient.cpf.slice(-2)}`,
      cns: `7${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(5, 9)} ${patient.cns.slice(-3).padStart(4, "0")}`,
      rg: `0${digits}`, "orgao-emissor": "SSP", "uf-identidade": "MA", "data-identidade": formatDate(addDays(birthIso, 365 * 18 + 40)),
      naturalidade: profile.city, "uf-naturalidade": "MA", nacionalidade: "Brasileira", "nome-mae": profile.mother.toUpperCase(),
      telefone: patient.phone.replace("9****", `9${digits.slice(0, 4)}`), email: `${email[0]}.${email[email.length - 1]}@email.com`,
      "cor-raca": profile.race, cep: `65${digits.slice(0, 3)}-${digits.slice(3, 6)}`, logradouro: profile.street, numero: String(10 + (patientId * 37) % 900),
      complemento: patientId % 3 === 0 ? "Casa B" : "", bairro: profile.district, municipio: profile.city, "uf-endereco": "MA",
    }
  }

  function programData() {
    const movements = []
    if (programStart) movements.push({ date: programStart, type: "Início de programa", by: prof(doctor) })
    if (profile.transplantYears) movements.push({ date: addDays(today, -profile.transplantYears * 365), type: "Transplante", by: prof(doctor) })
    if (patient.program === "Transferido") movements.push({ date: addDays(today, -200), type: "Transferência de centro", by: prof(doctor) })
    const options = [...$("programa-atual").options].map((o) => o.value || o.textContent)
    return {
      fields: {
        "inicio-programa": programStart ? formatDate(programStart) : "",
        "inicio-clinica": programStart ? formatDate(addDays(programStart, 15)) : "",
        "programa-atual": options.includes(patient.program) ? patient.program : "",
        turno: schedule ? String(parseInt(schedule.shift, 10)) : "",
        sala: schedule ? schedule.room.replace("Sala ", "") : "",
      },
      days: schedule ? schedule.days.map((d) => DAY_VALUES[d]) : [],
      movements,
    }
  }

  function readPageData() {
    const fields = Object.fromEntries([...IDENT_FIELDS, ...PROGRAM_FIELDS].map((id) => [id, $(id)?.value ?? ""]))
    const days = [...document.querySelectorAll('input[name="dias-hd"]:checked')].map((input) => input.value)
    const movements = [...document.querySelectorAll("#movement-history-body tr")].filter((tr) => tr.cells.length === 3)
      .map((tr) => ({ date: brToIso(tr.cells[0].textContent.trim()), type: tr.cells[1].textContent.trim(), by: tr.cells[2].textContent.trim() }))
    return { fields, days, movements }
  }

  function applyPageData({ fields, days, movements }) {
    Object.entries(fields).forEach(([id, value]) => { const field = $(id); if (field) field.value = value })
    document.querySelectorAll('input[name="dias-hd"]').forEach((input) => { input.checked = days.includes(input.value) })
    const body = $("movement-history-body")
    if (body && movements.length) {
      body.replaceChildren(...[...movements].sort((a, b) => b.date.localeCompare(a.date)).map((m) => {
        const tr = document.createElement("tr")
        ;[formatDate(m.date), m.type, m.by].forEach((text) => { const td = document.createElement("td"); td.textContent = text; tr.append(td) })
        return tr
      }))
    }
  }

  // Cabeçalho do paciente (nome, idade, sexo, nascimento, código, programa e título da aba).
  function syncHeader() {
    const name = $("nome-completo").value.trim() || patient.name.toUpperCase()
    const birth = $("data-nascimento").value
    const set = (id, text) => { const node = $(id); if (node) node.textContent = text }
    set("patient-name", name)
    set("patient-sex", $("sexo").value)
    set("patient-birth", formatDate(birth))
    set("patient-code", patient.code)
    set("patient-program", $("programa-atual").value || patient.program)
    if (birth) {
      const [y, m, d] = birth.split("-").map(Number)
      const now = new Date()
      let years = now.getFullYear() - y, months = now.getMonth() + 1 - m
      if (now.getDate() < d) months -= 1
      if (months < 0) { years -= 1; months += 12 }
      set("patient-age", `${years} ${years === 1 ? "ano" : "anos"}${months ? `, ${months} ${months === 1 ? "mês" : "meses"}` : ""}`)
    }
    const avatar = document.querySelector(".patient-avatar")
    if (avatar) avatar.textContent = name.charAt(0)
    document.title = `${name} | Prontuário | Hu-Nefro`
  }

  // ---------- Dados Clínicos ----------
  function clinicalData() {
    const yes = (flag) => (flag ? "sim" : "nao")
    return {
      abo_rh: profile.abo, tabagismo: patientId % 5 === 2 ? "sim" : "nao", etilismo: patientId % 4 === 3 ? "sim" : "nao", drogadicao: "nao",
      etiologia: profile.etiology ? slug(profile.etiology) : null,
      altura_cm: profile.height, peso_seco_kg: schedule ? Number(schedule.dryWeight) : between(55, 80),
      diurese: onHd ? (patientId % 3 === 0 ? "Anúrico" : `${100 + (patientId * 70) % 400} mL/24h`) : "Preservada",
      gestacoes: { quantidade: female && patientId !== 6 ? (patientId % 4) + 1 : null, data: null },
      diagnostico_base_cid: profile.cid || null,
      observacoes: onHd ? `Em hemodiálise desde ${formatDate(programStart)}. ${diabetic ? "Diabético, acompanhamento com endocrinologia." : "Sem acompanhamento com outras especialidades no momento."}` : "",
      alertas: profile.allergy ? `Alergia a ${profile.allergy[1]}.` : "",
      marcadores_virais: M.testMarkers(patientId), // positivos de exemplo e regras da RDC 11/2014 em dados-mock.js
      equipe_vinculada: [doctor, nurse, nutritionist, "p-006"],
      vacinas: [
        { date: addMonths(today, -30), name: "Hepatite B", complement: "1ª dose (dose dobrada)", lot: "HB2301" },
        { date: addMonths(today, -29), name: "Hepatite B", complement: "2ª dose", lot: "HB2301" },
        { date: addMonths(today, -24), name: "Hepatite B", complement: "3ª dose", lot: "HB2307" },
        { date: addMonths(today, -6), name: "Anti gripal", complement: "Campanha anual", lot: "FLU26A" },
        { date: addMonths(today, -14), name: "Covid-19", complement: "Reforço", lot: "CV2511" },
        { date: addMonths(today, -20), name: "Pneumocócica", complement: "VPP23", lot: "PN2209" },
      ],
      previo_tratamento: onHd || profile.yearsOnHd
        ? { epo: "nao", nefrologista: patientId % 2 ? "sim-mais-12-meses" : "sim-menos-6-meses", nutricionista: "nao", primeiro_programa: "hd" }
        : { epo: null, nefrologista: null, nutricionista: null, primeiro_programa: null },
      primeira_sessao_dialise: onHd || profile.yearsOnHd
        ? { realizacao: patientId % 3 === 0 ? "emergencia" : "eletiva", local: "hospital", tipo_dialise: "hemodialise", acesso: "cateter", fav_presente: yes(patientId % 3 !== 0 && patientId % 2 === 1), enxerto_venoso: "nao" }
        : { realizacao: null, local: null, tipo_dialise: null, acesso: null, fav_presente: null, enxerto_venoso: null },
    }
  }

  // ---------- Acessos Vasculares ----------
  function accessData() {
    if (!onHd) return { access: [], evolutions: [], consults: [] }
    const access = []
    const evolutions = []
    const consults = []
    let id = 1
    const firstCatheter = { id: id++, date: programStart, kind: "cateter", type: "Cateter temporário", loc: "Jugular direita", obs: "Implantado para início da hemodiálise.", doctor: "p-009", status: "closed", closedAt: "", closeReason: "", closeNote: "" }
    if (schedule.accessKind === "fav") {
      const favDate = addDays(programStart, 45)
      firstCatheter.closedAt = addDays(favDate, 60)
      firstCatheter.closeReason = "Troca por acesso definitivo"
      access.push(firstCatheter, { id: id++, date: favDate, kind: "fav", type: schedule.accessType, loc: schedule.accessLoc, obs: "Confeccionada pela cirurgia vascular.", doctor: "p-009", status: "active", closedAt: "" })
      consults.push({ id: id++, date: addDays(favDate, -20), obs: "Avaliação pré-operatória: vasos adequados para FAV.", by: prof("p-009") }, { id: id++, date: addMonths(today, -3), obs: "FAV funcionante, frêmito e sopro presentes. Sem sinais de estenose.", by: prof("p-009") })
      const favId = access[1].id
      evolutions.push(
        { id: id++, date: addDays(favDate, 45), event: "Maturação da FAV", obs: "Liberada para punção.", accessId: favId, by: prof(nurse) },
        { id: id++, date: addMonths(today, -2), event: "Avaliação de frêmito / sopro", obs: "Frêmito palpável em toda a extensão.", accessId: favId, by: prof(nurse) },
        { id: id++, date: addDays(today, -12), event: patientId % 2 ? "Hematoma" : "Punção sem intercorrências", obs: patientId % 2 ? "Pequeno hematoma após punção; compressa fria." : "", accessId: favId, by: prof("p-004") },
      )
    } else {
      // Cateter atual: o temporário de entrada já foi trocado (ou é o próprio, se recente).
      if (schedule.accessType === "Cateter temporário") {
        access.push({ ...firstCatheter, date: addDays(today, -40), loc: schedule.accessLoc, status: "active", obs: "Trocado após infecção do cateter anterior." })
        access.push({ ...firstCatheter, id: id++, closedAt: addDays(today, -40), closeReason: "Infecção", closeNote: "Bacteremia relacionada ao cateter." })
      } else {
        firstCatheter.closedAt = addDays(programStart, 90)
        firstCatheter.closeReason = "Troca por acesso definitivo"
        access.push(firstCatheter, { id: id++, date: addDays(programStart, 90), kind: "cateter", type: schedule.accessType, loc: schedule.accessLoc, obs: "Cateter tunelizado.", doctor: "p-009", status: "active", closedAt: "" })
      }
      const active = access.find((a) => a.status === "active")
      evolutions.push(
        { id: id++, date: addMonths(today, -1), event: "Curativo / troca de curativo", obs: "Óstio sem secreção.", accessId: active.id, by: prof(nurse) },
        { id: id++, date: addDays(today, -9), event: "Disfunção do cateter (fluxo inadequado)", obs: "Inversão de linhas na sessão; fluxo de 250 mL/min.", accessId: active.id, by: prof("p-004") },
      )
      consults.push({ id: id++, date: addMonths(today, -1), obs: "Encaminhado para confecção de FAV em membro superior esquerdo.", by: prof("p-009") })
    }
    return { access, evolutions, consults }
  }

  // ---------- Prescrição de Hemodiálise ----------
  function prescriptionData() {
    if (!onHd) return []
    const base = {
      method: schedule.method, machine: "Fresenius 4008S", ufMax: patientId === 10 ? "1500" : "3500", dialyzer: schedule.dialyzer, duration: patientId === 10 ? "03:30" : "04:00",
      solution: "Bicarbonato", bloodFlow: schedule.bloodFlow, dialysateFlow: patientId === 10 ? "300" : "500", needle: schedule.accessKind === "fav" ? "15G" : "",
      heparin: schedule.heparin, bicarbonate: "35", bathTemp: "36.5", ufProfile: "Linear", naBase: "138", naConc: "138", naProfile: "", naInitial: "",
    }
    return [
      { id: 1, date: addDays(programStart, 1), ...base, dryWeight: String(Number(schedule.dryWeight) + 1.5), notes: "Prescrição inicial. Reavaliar peso seco em 30 dias.", by: prof(doctor) },
      { id: 2, date: addMonths(today, -2), ...base, dryWeight: schedule.dryWeight, notes: `Manter peso seco de ${dec(Number(schedule.dryWeight))} kg. Restringir ganho interdialítico a 2 kg.`, by: prof(doctor2) },
    ]
  }

  // ---------- Exames (rotina por periodicidade, últimos 12 meses) ----------
  function examsData() {
    const list = []
    let id = 1
    const by = prof(doctor)
    const add = (date, name, result, description = "") => list.push({ id: id++, date, name, result: String(result), description, by })
    const reactive = (yes) => (yes ? "Reagente" : "Não reagente")
    const monthsBack = onHd ? 12 : 4
    for (let m = monthsBack - 1; m >= 0; m -= 1) {
      // Coleta mensal na primeira semana do mês (exceto o mês atual, se ainda não chegou o dia).
      const ref = addMonths(today, -m)
      const date = `${ref.slice(0, 8)}0${2 + (patientId % 5)}`
      if (date > today) continue
      const hb = between(9.4, 12.2)
      const pre = between(110, 185, 0), post = between(28, 58, 0)
      add(date, "Hemoglobina", dec(hb))
      add(date, "Hematócrito", dec(hb * 3, 0))
      add(date, "Creatinina", dec(between(6, 12)))
      add(date, "Ureia pré-diálise", pre)
      add(date, "Ureia pós-diálise", post)
      add(date, "URR (%)", dec((1 - post / pre) * 100), "Calculado automaticamente a partir da ureia pré e pós-diálise.")
      add(date, "Sódio", between(134, 144, 0))
      add(date, "Potássio", dec(between(4.2, 6.3)))
      add(date, "Cálcio", dec(between(8.3, 10.1)))
      add(date, "Fósforo", dec(between(3.4, 7.2)))
      add(date, "TGP", between(9, 38, 0))
      if (diabetic) add(date, "Glicose", between(95, 210, 0))
      if (m % 3 === 0) {
        const protein = between(6, 7.6), albumin = between(3.2, 4.3)
        add(date, "Ferritina", between(180, 820, 0))
        add(date, "Saturação da transferrina", between(18, 42, 0))
        add(date, "Ferro sérico", between(45, 115, 0))
        add(date, "Proteínas totais", dec(protein))
        add(date, "Albumina", dec(albumin))
        add(date, "Globulina", dec(protein - albumin))
        add(date, "Fosfatase alcalina", between(60, 220, 0))
        if (diabetic) add(date, "Hemoglobina glicada", dec(between(6.2, 8.8)))
        add(date, "Hemácias", dec(hb / 3.1, 2))
        add(date, "Leucócitos", between(4500, 9500, -2))
        add(date, "Plaquetas", between(150000, 320000, -3))
        add(date, "VCM", dec(between(84, 96)))
      }
      // Semestral: o paciente 4 está com a coleta semestral atrasada (para ver o alerta na Rotina de exames).
      if (m % 6 === 1 && !(patientId === 4 && m < 6)) {
        add(date, "PTH", between(140, 780, 0))
        const mk = M.testMarkers(patientId) // sorologias coerentes com os marcadores virais de Dados Clínicos
        add(date, "Anti-HBs", mk.antiHbs === "negativo" ? "Não reagente (< 10 UI/L)" : `Reagente (${between(40, 400, 0)} UI/L)`)
        if (mk.hepatiteB !== "coletado") add(date, "HBsAg", reactive(mk.hepatiteB === "positivo"))
        add(date, "Anti-HCV", reactive(mk.hepatiteC === "positivo"))
        add(date, "25-Hidroxivitamina D", dec(between(16, 42)))
      }
      if (m === 5) {
        add(date, "Colesterol total", between(140, 230, 0))
        add(date, "Colesterol HDL", between(32, 62, 0))
        add(date, "Colesterol LDL", between(70, 150, 0))
        add(date, "Triglicerídeos", between(90, 260, 0))
        add(date, "Anti-HIV", reactive(M.testMarkers(patientId).hiv === "positivo"))
        add(date, "Alumínio sérico", dec(between(4, 18)))
        add(date, "T4", dec(between(0.8, 1.6)))
        add(date, "TSH", dec(between(0.7, 4.2)))
      }
    }
    return list
  }

  // ---------- Eventos e Diagnósticos ----------
  function eventsData() {
    const list = []
    let id = 1
    const now = today
    const event = (kind, type, start, end, data, extra = {}) => list.push({
      id: id++, kind, type, start, end, data, evolutions: [], cultures: [], medications: [], createdAt: start, createdBy: prof(doctor), updatedAt: end || start, ...extra,
    })
    const since = programStart || addMonths(now, -24)
    if (profile.cid) event("problema", "Outro", since, "", { cid: cid(profile.cid), observacao: `Doença de base: ${profile.etiology}.` }, { type: profile.etiology })
    if (onHd) event("problema", "Anemia da doença renal crônica", addDays(since, 30), "", { cid: cid("N18.0"), observacao: "Em uso de eritropoetina e ferro EV." })
    if (patientId % 2 === 1 || diabetic) event("problema", "Hipertensão arterial", since, "", { cid: cid("I10"), observacao: "Controle com anti-hipertensivos e ajuste do peso seco." })
    if (diabetic) event("outros", profile.diabetic === "dm1" ? "Diabetes mellitus tipo 1" : "Diabetes mellitus tipo 2", addMonths(since, -60), "", { cid: cid(profile.cid), observacao: "Acompanhamento com endocrinologia." })
    if (onHd && patientId % 3 === 1) {
      event("problema", "Hiperparatireoidismo secundário", addMonths(now, -8), "", { cid: cid("E21.1"), observacao: "PTH elevado; calcitriol prescrito." })
    }
    if (profile.allergy) event("alergia", profile.allergy[0], since, "", { substancia: profile.allergy[1], reacao: profile.allergy[2] })
    if (profile.catheterInfection) {
      const start = addDays(now, -55)
      event("infeccao", "Infecção de corrente sanguínea", start, addDays(start, 21), {
        relacao: "tratamento", posicao: "Confirmada", cid: cid("A41.9"), sinais: "Febre e calafrios durante a sessão.", conduta: "Hemoculturas, retirada do cateter e antibiótico EV.", fator: "Cateter temporário femoral.",
      }, {
        cultures: [{ culture: "Sangue lúmen do cateter de hemodiálise", agent: "Staphylococcus aureus", sensitive: ["Vancomicina", "Gentamicina"], resistant: ["Oxacilina"] }],
        medications: [{ name: "Vancomicina", posology: "1 g EV após cada sessão", start: addDays(start, 1), end: addDays(start, 21) }],
        evolutions: [{ date: addDays(start, 7), by: prof(doctor), text: "Afebril há 72 h. Cateter trocado." }, { date: addDays(start, 21), by: prof(doctor), text: "Concluído o tratamento. Alta do evento." }],
      })
    }
    if (profile.admitted) {
      const start = addDays(now, -19)
      event("internacao", "Infecção", start, "", { cid: cid("J18.9"), medico: doctor2, observacao: "Internada por pneumonia; HD mantida no leito." }, {
        medications: [{ name: "Ceftriaxona", posology: "1 g EV 1x ao dia", start, end: addDays(start, 10) }],
        evolutions: [{ date: addDays(start, 3), by: prof(doctor2), text: "Melhora clínica, mantém antibiótico." }],
      })
    }
    if (onHd && patientId % 4 === 1) event("transfusao", "Hemácias", addMonths(now, -5), addMonths(now, -5), { responsavel: doctor, observacao: "Hb 7,2 g/dL; 1 concentrado de hemácias." })
    if (onHd && patientId % 3 === 2) event("especialista", "Cardiologia", addMonths(now, -4), "", { especialista: "p-008", observacao: "Ecocardiograma com hipertrofia ventricular esquerda leve." })
    return list
  }

  // ---------- História Clínica e Evolução ----------
  function notesData() {
    const notes = []
    let id = 1
    const note = (date, type, text, by, restricted = false, aux) => notes.push({ id: id++, date, type, restricted, text, by, cancelled: false, ...(aux ? { aux } : {}) })
    if (programStart) note(programStart, "avaliacao-inicial", `Paciente com DRC estágio 5 por ${profile.etiology.toLowerCase() || "causa indeterminada"}. Inicia hemodiálise ${schedule ? `em ${schedule.shift.toLowerCase()}, ${schedule.room}` : ""}. Orientado sobre restrição hídrica e cuidados com o acesso.`, prof(doctor))
    if (onHd) {
      for (let m = 3; m >= 0; m -= 1) {
        const date = addDays(addMonths(today, -m), -3)
        if (date > today) continue
        note(date, "evolucao", `EVOLUÇÃO MENSAL. Paciente estável nas sessões. Ganho interdialítico médio adequado. Exames do mês revisados: ${m % 2 ? "anemia em controle" : "fósforo acima da meta, reforçada orientação dietética"}.`, prof(m % 2 ? doctor : doctor2))
      }
      note(addMonths(today, -1), "anotacao", "Evol Nutrição: recordatório alimentar com consumo proteico adequado; orientada redução de alimentos ricos em fósforo.", prof(nutritionist))
      // Funções auxiliares: Escala de Morse pela enfermagem e solicitação de avaliação da Nutrição.
      const EM = window.HuNefroEvolucaoModelos
      const older = Boolean(birthIso) && birthIso <= addMonths(today, -720)
      const answers = { historico: older, diagnostico: true, deambulacao: older ? 1 : 0, endovenosa: schedule.accessKind === "cateter", marcha: older ? 1 : 0, mental: 0 }
      const morse = { kind: "risco-queda", answers, text: EM.morseText(answers) }
      note(addDays(today, -20), "anotacao", `Avaliação de enfermagem na sessão. ${morse.text}`, prof(nurse), false, [morse])
      const request = { kind: "avaliacao", recipientKind: "categoria", recipient: "nutricao", recipientLabel: "Nutrição", priority: "rotina", due: "", reason: "fósforo acima da meta nos dois últimos meses, reforçar orientação dietética", status: "pendente" }
      request.text = `Solicito avaliação: Nutrição (categoria profissional). Prioridade: rotina. Motivo: ${request.reason}.`
      note(addDays(today, -12), "evolucao", `Fósforo persistentemente elevado. ${request.text}`, prof(doctor), false, [request])
      note(addDays(today, -6), "anotacao", "Paciente refere câimbras no final das sessões. Comunicado ao médico plantonista.", prof(nurse))
      note(addMonths(today, -2), "anotacao", "Serviço Social: avaliado transporte para as sessões; encaminhado ao TFD municipal.", prof("p-006"), true)
    } else {
      note(addMonths(today, -2), "evolucao", "Consulta ambulatorial. Função renal estável. Retorno em 3 meses com exames.", prof(doctor))
    }
    return notes
  }

  // ---------- Medicações ----------
  // Cada medicação tem tipo de uso: "continuo", "tempo" (duração) ou "dose" (número de doses).
  function medicationsData() {
    const base = { status: "active", suspendedAt: "", complement: "", brand: "", usage: "continuo", duration: "", durationUnit: "dias", doses: "" }
    if (!onHd) {
      return { meds: [
        { ...base, id: 1, date: addMonths(today, -2), author: doctor, hd: false, drug: patient.program === "Transplantado" ? "Omeprazol 20 mg" : "Losartana 50 mg", posology: "1 comprimido VO 1x ao dia", qty: "30" },
      ], receipts: [], lmeDrafts: {} }
    }
    const start = addMonths(today, -3)
    const meds = [
      { drug: "Eritropoetina 4000 UI", posology: "SC 3x por semana pós-HD", hd: true, qty: "13" },
      { drug: "Sacarato de Hidróxido de Ferro 100 mg", posology: "1 ampola EV 1x por semana na sessão de HD", hd: true, usage: "dose", doses: "10", qty: "10", date: addDays(today, -20) },
      { drug: "Sevelamer 800 mg", posology: "1 comprimido VO junto às refeições principais", qty: "90" },
      { drug: "Calcitriol 0,25 mcg", posology: "1 cápsula VO 1x ao dia", qty: "30" },
      { drug: "Ácido fólico 5 mg", posology: "1 comprimido VO 1x ao dia", qty: "30" },
      ...(patientId % 2 === 1 || diabetic ? [{ drug: "Anlodipino 5 mg", posology: "1 comprimido VO de 12/12h", qty: "60" }] : []),
      // Prurido urêmico / neuropatia: medicação de controle especial (lista C1).
      ...(patientId % 3 === 1 || diabetic ? [{ drug: "Gabapentina 300 mg", posology: "1 cápsula VO à noite", qty: "30" }] : []),
      ...(patientId % 4 === 3 ? [{ drug: "Sertralina 50 mg", posology: "1 comprimido VO 1x ao dia", qty: "30" }] : []),
      // Infecção de cateter: antibiótico na sessão por número de doses e antimicrobiano oral por tempo.
      ...(profile.catheterInfection ? [
        { drug: "Vancomicina 1 g", posology: "1 g EV após cada sessão de HD", hd: true, usage: "dose", doses: "6", qty: "6", date: addDays(today, -4) },
        { drug: "Cefalexina 500 mg", posology: "1 cápsula VO de 6/6h", usage: "tempo", duration: "7", qty: "28", date: addDays(today, -2) },
      ] : []),
    ].map((m, i) => ({ ...base, id: i + 1, date: start, author: i % 2 ? doctor2 : doctor, hd: false, ...m }))
    meds.push({ ...base, id: meds.length + 1, status: "suspended", suspendedAt: addMonths(today, -1), date: addMonths(today, -6), author: doctor, hd: false, drug: "Carbonato de Cálcio 500 mg", posology: "1 comprimido VO junto às refeições principais", qty: "90" })
    // Tratamento por tempo já concluído (aparece no Histórico como "Concluída").
    meds.push({ ...base, id: meds.length + 1, date: addMonths(today, -2), author: doctor2, hd: false, drug: "Amoxicilina 500 mg", posology: "1 cápsula VO de 8/8h", usage: "tempo", duration: "7", qty: "21" })
    return { meds, receipts: [{ id: 1, date: start, model: "Receituário", author: prof(doctor), items: meds.filter((m) => m.status === "active" && !m.hd).map((m) => m.drug) }], lmeDrafts: {} }
  }

  // ---------- Nutrição ----------
  function nutritionData() {
    const data = {
      "escolaridade-paciente": ["Ensino fundamental incompleto", "Ensino fundamental completo", "Ensino médio completo", "Ensino superior"][patientId % 4],
      "escolaridade-chefe": ["fundamental-2-completo", "medio-completo"][patientId % 2],
      moradores: String(2 + (patientId % 4)), "renda-familiar": `${1500 + (patientId % 5) * 600},00`,
      "cceb-banheiro": "1", "cceb-empregado": "0", "cceb-automovel": String(patientId % 2), "cceb-computador": String(patientId % 3 === 0 ? 1 : 0),
      "cceb-lava-loucas": "0", "cceb-geladeira": "1", "cceb-freezer": "0", "cceb-lava-roupa": "1", "cceb-dvd": "0", "cceb-microondas": String(patientId % 2), "cceb-moto": String(patientId % 3 === 1 ? 1 : 0), "cceb-secadora": "0",
      "agua-encanada": true, "rua-pavimentada": patientId % 3 !== 2,
      has: patientId % 2 === 1 || diabetic, dm1: profile.diabetic === "dm1", dm2: profile.diabetic === "dm2", dislipidemias: patientId % 4 === 1, "atividade-fisica": patientId % 3 === 0,
      "ano-base": String(new Date().getFullYear()),
    }
    // Monitoramento mensal (linhas preenchidas pelo nutricionista) até o mês atual.
    const keys = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    const monthNow = new Date().getMonth()
    keys.slice(0, monthNow + 1).forEach((month, index) => {
      const set = (label, value) => { data[`mensal-${slug(label)}-${month}`] = value }
      set("Constipação (tempo)", index % 4 === 1 ? "3 dias" : "Não")
      set("Diarreia (tempo)", "Não")
      set("Apetite", ["Bom", "Bom", "Regular"][(index + patientId) % 3])
      set("Ingestão hídrica (L)", dec(between(0.6, 1.2)))
      set("Número de refeições", String(4 + (index + patientId) % 2))
      set("Suplemento nutricional", patientId % 3 === 0 ? "Sim" : "Não")
      set("Pró ou simbiótico", "Não")
      set("Quelante (Ca)", patientId % 2 ? "CaCO3" : "Não")
      set("Quelante (P)", "Sevelamer")
      set("PNA (g/kg/dia)", dec(between(0.9, 1.3), 2))

      // Ganho de peso interdialítico (3 medições pré/pós e peso seco)
      const dryKg = schedule ? Number(schedule.dryWeight) : 49.5 + (patientId % 5) * 5
      data[`mensal-gpi-seco-${month}`] = dec(dryKg)
      if (patientId === 1 && month === "jan") {
        data[`mensal-gpi-seco-${month}`] = "49,5"
        data[`mensal-gpi-pre-1-${month}`] = "52,0"
        data[`mensal-gpi-pos-1-${month}`] = "50,0"
        data[`mensal-gpi-pre-2-${month}`] = "52,0"
        data[`mensal-gpi-pos-2-${month}`] = "50,0"
        data[`mensal-gpi-pre-3-${month}`] = "51,5"
        data[`mensal-gpi-pos-3-${month}`] = "50,0"
      } else {
        const gain = between(1.8, 3.2)
        data[`mensal-gpi-pre-1-${month}`] = dec(dryKg + gain)
        data[`mensal-gpi-pos-1-${month}`] = dec(dryKg + between(0.0, 0.4))
        data[`mensal-gpi-pre-2-${month}`] = dec(dryKg + gain + between(-0.3, 0.4))
        data[`mensal-gpi-pos-2-${month}`] = dec(dryKg + between(0.0, 0.4))
        data[`mensal-gpi-pre-3-${month}`] = dec(dryKg + gain + between(-0.5, 0.3))
        data[`mensal-gpi-pos-3-${month}`] = dec(dryKg + between(0.0, 0.4))
      }
    })
    if (patientId === 10) return { ...data, ...pediatricNutrition() }
    // Antropometria semestral (adulto).
    const height = profile.height / 100
    const dry = schedule ? Number(schedule.dryWeight) : between(55, 80)
    ;[[1, `${new Date().getFullYear()}-04-1${patientId % 9}`], [2, addDays(today, -10)]].forEach(([s, date]) => {
      const set = (label, value, evaluation = "") => {
        const key = `antropometria-${slug(label)}-s${s}`
        data[`${key}-valor`] = value
        if (evaluation) data[`${key}-avaliacao`] = evaluation
      }
      data[`data-semestre-${s}`] = date
      const weight = dry + (s === 1 ? 0.8 : 0.2)
      set("Altura (m)", dec(height, 2))
      set("Peso aferido (kg)", dec(weight))
      set("Músculo adutor do polegar - MAP (mm)", dec(between(12, 20)))
      set("Circunferência da cintura (cm)", dec(between(78, 98)))
      set("Circunferência abdominal (cm)", dec(between(82, 104)))
      set("Circunferência do quadril (cm)", dec(between(92, 108)))
      set("Circunferência da coxa (cm)", dec(between(44, 55)))
      set("Circunferência do pescoço (cm)", dec(between(32, 40)))
      set("Circunferência da panturrilha (cm)", dec(between(30, 37)), "Adequada")
      set("Circunferência do braço - CB (cm)", dec(between(24, 31)), "Eutrofia")
      set("PCT (tricipital)", dec(between(10, 22)))
      set("PCB (bicipital)", dec(between(5, 12)))
      set("PCSE (subescapular)", dec(between(12, 24)))
      set("PCSI (supra-ilíaca)", dec(between(10, 22)))
      set("Força de preensão manual - FPM (kg)", dec(between(female ? 14 : 22, female ? 24 : 36)), patientId % 4 === 0 ? "Reduzida" : "Adequada")
      set("Ângulo de fase (°)", dec(between(4.2, 6.4)))
    })
    // ASG / MIS (os itens 8 e 9 são sugeridos pela antropometria e pela albumina).
    const mild = patientId % 3 === 0
    Object.assign(data, {
      "consumo-energetico": mild ? "Abaixo do recomendado" : "Adequado",
      "perda-peso-percentual": mild ? "3" : "0", "perda-peso-tempo": mild ? "3 meses" : "",
      "gordura-corporal": mild ? "Perda leve" : "Nenhuma perda", "massa-muscular": mild ? "Perda leve" : "Nenhuma perda",
      edema: "Nenhum", "reducao-forca": patientId % 4 === 0 ? "Sim, leve" : "Não",
      "asg-resultado": mild ? "B" : "A",
      "mis-1": mild ? "1" : "0", "mis-2": mild ? "1" : "0", "mis-3": "0", "mis-4": mild ? "1" : "0",
      "mis-5": String(Math.min(3, Math.floor((profile.yearsOnHd || 0) / 4) + (diabetic ? 1 : 0) + 1)),
      "mis-6": mild ? "1" : "0", "mis-7": mild ? "1" : "0", "mis-10": "1",
      "diagnostico-final": mild ? "dng-cronica" : "eutrofia",
    })
    return data
  }

  function pediatricNutrition() {
    const data = {}
    const height = profile.height / 100
    ;[1, 2, 3, 4].forEach((q) => {
      const date = addMonths(today, -3 * (4 - q))
      if (date > today) return
      data[`data-trimestre-${q}`] = date
      const set = (label, measure, zScore, percentile, classification) => {
        const key = `pediatrica-${slug(label)}-t${q}`
        data[`${key}-medida`] = measure
        if (zScore) {
          data[`${key}-escore-z`] = zScore
          data[`${key}-referencia`] = `Z ${zScore}`
        }
        if (percentile) data[`${key}-percentil`] = percentile
        if (classification) data[`${key}-classificacao`] = classification
      }
      set("Estatura / idade (m)", dec(height - (4 - q) * 0.012, 2), "-1,20", "11,5", "Estatura adequada")
      set("Peso seco / idade (kg)", dec(Number(schedule.dryWeight) - (4 - q) * 0.4), "-0,80", "21,2", "Peso adequado")
      set("Circunferência do braço / idade (cm)", dec(between(19, 22)), "-0,67", "25,0", "Eutrofia")
      set("PCT / idade (mm)", dec(between(8, 12)), "0,00", "50,0", "Eutrofia")
      set("PCSE / idade (mm)", dec(between(6, 9)), "0,00", "50,0", "Eutrofia")
      data[`diagnostico-antropometrico-trimestre-${q}`] = "Eutrofia com estatura adequada para a idade"
      data[`diagnostico-pediatrico-trimestre-${q}`] = "Eutrofia nutricional"
    })
    data["diagnostico-antropometrico-final"] = "Eutrofia com estatura adequada para a idade"
    data["diagnostico-nutricional-final"] = "Eutrofia nutricional"
    return data
  }

  // ---------- Solicitações de exames (uma por mês, antes da coleta) ----------
  function examRequestsData() {
    if (!onHd) return []
    const monthly = ["Hematócrito", "Hemoglobina", "Ureia pré-diálise", "Ureia pós-diálise", "Creatinina", "Sódio", "Potássio", "Cálcio", "Fósforo", "TGP", ...(diabetic ? ["Glicose"] : [])]
    const quarterly = ["Hemograma completo", "Ferritina", "Saturação da transferrina", "Ferro sérico", "Proteínas totais e frações", "Fosfatase alcalina", ...(diabetic ? ["Hemoglobina glicada"] : [])]
    const list = []
    for (let m = 2; m >= 0; m -= 1) {
      const date = `${addMonths(today, -m).slice(0, 8)}01`
      if (date > today) continue
      const names = [...monthly, ...(m % 3 === 0 ? quarterly : [])]
      list.push({ id: list.length + 1, date, author: m % 2 ? doctor2 : doctor, cid: "N18.0", indication: "Doença renal crônica estádio 5 em hemodiálise. Exames de controle periódico do programa de hemodiálise.", notes: "", items: names.map((name) => ({ name })), by: prof(m % 2 ? doctor2 : doctor), createdAt: date,
        dest: "aghu", protocol: `AGHU-${date.slice(0, 4)}-${String(100000 + patientId * 731 + m * 97).slice(-6)}`, sentAt: `${date}T09:00:00` })
    }
    return list
  }

  // ---------- Laudos ----------
  // O texto é montado pelo modelo depois que as outras abas recebem os dados (ver apply).
  function laudosData() {
    if (!onHd) return []
    const list = []
    const add = (date, model, description, author, layout = "padrao") => list.push({ id: list.length + 1, date, model, layout, description, author, text: null, createdAt: date, updatedAt: date, by: prof(author) })
    add(addMonths(today, -5), "passe-livre", "PASSE LIVRE", doctor2)
    add(addMonths(today, -2), "relatorio-drc", "RELATÓRIO DRC", doctor)
    if (schedule.accessKind === "cateter") add(addMonths(today, -1), "acessos-vasculares", "ACESSOS VASCULARES", doctor)
    if (patientId % 3 === 1) add(addDays(today, -20), "transplante", "RELATÓRIO MÉDICO TRANSPLANTE", doctor, "completo")
    return list
  }

  // ---------- Montagem e gravação ----------
  function generate() {
    return {
      page: { fields: { ...identityData(), ...programData().fields }, days: programData().days, movements: programData().movements },
      dadosClinicos: clinicalData(),
      acessos: accessData(),
      exames: examsData(),
      eventos: eventsData(),
      historia: notesData(),
      medicacoes: medicationsData(),
      prescricao: prescriptionData(),
      nutricao: nutritionData(),
      laudos: laudosData(),
      solicitacoesExames: examRequestsData(),
    }
  }

  const TABS = [
    ["dadosClinicos", "HuNefroDadosClinicos"], ["acessos", "HuNefroAcessosVasculares"], ["exames", "HuNefroExames"],
    ["eventos", "HuNefroEventosDiagnosticos"], ["historia", "HuNefroHistoriaClinica"], ["medicacoes", "HuNefroMedicacoes"],
    ["prescricao", "HuNefroPrescricaoHD"], ["nutricao", "HuNefroNutricao"], ["laudos", "HuNefroLaudos"],
    ["solicitacoesExames", "HuNefroSolicitacaoExames"],
  ]

  function apply(data) {
    applyPageData(data.page)
    syncHeader()
    // Ordem importa: Exames e Acessos antes da Prescrição e da Nutrição, que leem deles. Laudos por último,
    // porque os laudos de teste sem texto são montados pelo modelo com os dados das outras abas.
    const withText = (list) => list.map((l) => (l.text === null ? { ...l, text: window.HuNefroLaudos.compose(l.model, { date: l.date, author: l.author }) } : l))
    TABS.forEach(([key, api]) => {
      if (data[key] === undefined || !window[api]) return
      window[api].setData(key === "laudos" ? withText(data[key]) : data[key])
    })
    window.HuNefroNutricao?.refresh?.()
  }

  // Prontuário novo: só a identificação digitada no cadastro; as outras abas começam vazias.
  function blankRecord() {
    const a = patient.aghu || {} // cadastro trazido do AGHU na inclusão pela Recepção
    const fields = {
      "nome-completo": (a.name || patient.name).toUpperCase(), "data-nascimento": a.birth || brToIso(patient.birthDate), sexo: a.sex || patient.sex || "",
      cpf: a.cpf || patient.cpf || "", cns: a.cns || patient.cns || "", "nome-mae": (a.mother || patient.mother || "").toUpperCase(), telefone: a.phone || patient.phone || "",
      email: a.email || "", rg: a.rg || "", "data-identidade": "", "orgao-emissor": a.rgOrg || "", "uf-identidade": a.rgUf || "", naturalidade: a.birthCity || "", "uf-naturalidade": a.birthUf || "",
      "cor-raca": a.race || "", cep: a.cep || "", logradouro: a.street || "", numero: a.number || "", complemento: a.complement || "", bairro: a.district || "",
      municipio: a.city || "", "uf-endereco": a.uf || "",
      nacionalidade: "Brasileira", "programa-atual": [...$("programa-atual").options].some((o) => (o.value || o.textContent) === patient.program) ? patient.program : "",
    }
    return { page: { fields, days: [], movements: [] } }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
      // Prontuário salvo antes das abas Laudos e Solicitação de exames: recebe os dados de teste delas.
      if (saved) return patient.isNew ? saved : { ...saved, laudos: saved.laudos || laudosData(), solicitacoesExames: saved.solicitacoesExames || examRequestsData() }
    } catch { /* sem armazenamento: usa os dados de teste */ }
    return patient.isNew ? blankRecord() : generate()
  }

  // "Salvar" do prontuário: guarda todas as abas no navegador (as sessões são gravadas pela própria aba).
  document.addEventListener("hunefro:save", () => {
    const data = { page: readPageData() }
    TABS.forEach(([key, api]) => { if (window[api]) data[key] = window[api].getData() })
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* armazenamento bloqueado */ }
    syncHeader()
  })

  const record = load()
  apply(record)
  // Prontuário novo: o cabeçalho não pode mostrar tipo sanguíneo nem "Sem alergias" de exemplo.
  if (patient.isNew) {
    const abo = document.getElementById("patient-abo-flag")
    if (abo && !record.dadosClinicos?.abo_rh) { abo.textContent = ""; abo.hidden = true }
    const allergy = document.getElementById("patient-allergy-flag")
    if (allergy && !record.eventos?.length) { allergy.textContent = "Alergias não informadas"; allergy.className = "flag flag-warning" }
  }
})()
