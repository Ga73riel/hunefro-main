// Comunicações da unidade: Solicitação de avaliação, Aviso e Tarefa.
// PROVISÓRIO: os itens ficam no navegador (localStorage) até existir a API. No backend, o envio,
// a leitura e as respostas serão gravados no servidor e os usuários virão do AGHU.
// Também mostra, no menu do cabeçalho, quantas comunicações não lidas o usuário tem.
(() => {
  "use strict"

  const KEY = "huNefroComunicacoes:v1"

  const TYPES = [["avaliacao", "Solicitação de avaliação"], ["aviso", "Aviso"], ["tarefa", "Tarefa"]]
  const PRIORITIES = [["rotina", "Rotina"], ["prioritaria", "Prioritária"], ["urgente", "Urgente"]]
  const RECIPIENT_KINDS = [["grupo", "Grupo profissional"], ["perfil", "Perfil"], ["usuario", "Usuário"]]
  // Grupos profissionais (mesma lista da Solicitar avaliação da evolução). "todos" = toda a equipe da unidade.
  const GROUPS = [
    ["todos", "Toda a equipe da unidade"], ["medico", "Corpo médico"], ["enfermagem", "Enfermagem"], ["tec-enfermagem", "Téc. Enfermagem"],
    ["aux-enfermagem", "Aux. Enfermagem"], ["nutricao", "Nutrição"], ["servico-social", "Serviço Social"], ["psicologia", "Psicologia"],
    ["farmacia", "Farmácia"], ["fisioterapia", "Fisioterapia"], ["recepcao", "Recepção"], ["administracao", "Administração"],
  ]
  // Perfis de acesso do sistema (no protótipo só Técnico e Enfermeiro podem ser simulados no login).
  const PROFILES = [
    ["recepcao", "Recepção"], ["medico", "Médico(a)"], ["enfermeiro", "Enfermeiro(a)"], ["tecnico", "Técnico(a) de enfermagem"],
    ["nutricionista", "Nutricionista"], ["assistente-social", "Assistente social"], ["psicologo", "Psicólogo(a)"], ["administrador", "Administrador(a)"],
  ]
  // Grupo profissional de cada perfil simulado, para saber o que é "para mim".
  const PROFILE_GROUP = { recepcao: "recepcao", tecnico: "tec-enfermagem", enfermeiro: "enfermagem", medico: "medico", nutricionista: "nutricao", "assistente-social": "servico-social", psicologo: "psicologia", administrador: "administracao" }

  const labelOf = (list, key) => (list.find(([k]) => k === key) || [, key])[1]
  const me = () => ({
    name: sessionStorage.getItem("huNefroUsername") || "Usuário",
    profile: window.HuNefroSessao?.profile?.() || "tecnico",
  })

  // ---------- Dados de exemplo (só quando ainda não há nada salvo) ----------
  function iso(days, hour = 8) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const day = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return localDay(d) }
  function seed() {
    return [
      { id: 1, type: "aviso", priority: "prioritaria", title: "Manutenção preventiva das máquinas da Sala B", text: "As máquinas 05 a 08 da Sala B passam por manutenção na próxima quinta, das 6h às 7h. Os pacientes do 1º turno começam após a liberação.",
        recipients: [{ kind: "grupo", value: "todos", label: "Toda a equipe da unidade" }], author: "Coordenação de Enfermagem", createdAt: iso(-1, 9), readBy: [], replies: [], status: "aberta" },
      { id: 2, type: "tarefa", priority: "rotina", title: "Conferir validade dos kits de cateter", text: "Conferir a validade dos kits de cateter e curativos do armário da Sala A e registrar os vencidos.", due: day(2),
        recipients: [{ kind: "perfil", value: "tecnico", label: "Técnico(a) de enfermagem" }], author: "Coordenação de Enfermagem", createdAt: iso(-1, 10), readBy: [], replies: [], status: "aberta" },
      { id: 3, type: "tarefa", priority: "urgente", title: "Remarcar os faltosos da semana", text: "Há faltas sem remarcação na aba Faltas e remarcações das Sessões do dia. Definir a reposição de cada uma.", due: day(-1),
        recipients: [{ kind: "perfil", value: "enfermeiro", label: "Enfermeiro(a)" }], author: "Profissional Exemplo 01", createdAt: iso(-3, 11), readBy: [], replies: [], status: "aberta" },
      { id: 4, type: "avaliacao", priority: "prioritaria", title: "Avaliação nutricional: ganho de peso interdialítico alto", text: "Paciente com ganho de peso interdialítico acima de 4% nas últimas sessões. Solicito avaliação e orientação.", due: day(3), patientId: 4,
        recipients: [{ kind: "grupo", value: "nutricao", label: "Nutrição" }, { kind: "grupo", value: "enfermagem", label: "Enfermagem" }], author: "Profissional Exemplo 02", createdAt: iso(-2, 14), readBy: [], replies: [], status: "aberta" },
      { id: 5, type: "aviso", priority: "rotina", title: "Novo fluxo de coleta dos exames trimestrais", text: "A partir deste mês, a coleta dos exames trimestrais é feita no início da sessão do 1º dia da semana do paciente.",
        recipients: [{ kind: "grupo", value: "enfermagem", label: "Enfermagem" }, { kind: "grupo", value: "tec-enfermagem", label: "Téc. Enfermagem" }], author: "Profissional Exemplo 01", createdAt: iso(-6, 8), readBy: [], replies: [], status: "aberta" },
      { id: 6, type: "tarefa", priority: "rotina", title: "Atualizar o mapa de cadeiras da Sala Q", text: "Atualizar o mapa das 4 cadeiras da Sala Q com as internações da semana.", due: day(-4),
        recipients: [{ kind: "perfil", value: "enfermeiro", label: "Enfermeiro(a)" }], author: "Coordenação de Enfermagem", createdAt: iso(-8, 9), readBy: ["Coordenação de Enfermagem"],
        replies: [{ by: "Profissional Exemplo 03", at: iso(-5, 15), text: "Mapa atualizado e afixado na porta da sala." }], status: "concluida", doneBy: "Profissional Exemplo 03", doneAt: iso(-5, 15) },
    ]
  }

  let items
  function read() {
    try {
      const raw = localStorage.getItem(KEY)
      items = raw ? JSON.parse(raw) : seed()
      if (!raw) save()
    } catch { items = items || seed() }
    return items
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* armazenamento bloqueado */ }
    document.dispatchEvent(new CustomEvent("hunefro:comunicacoes"))
  }
  read()

  // ---------- Regras ----------
  function isForMe(item, who = me()) {
    return item.recipients.some((r) =>
      (r.kind === "grupo" && (r.value === "todos" || r.value === PROFILE_GROUP[who.profile])) ||
      (r.kind === "perfil" && r.value === who.profile) ||
      (r.kind === "usuario" && r.label.split(" - ")[0] === who.name))
  }
  const isMine = (item, who = me()) => item.author === who.name
  const isRead = (item, who = me()) => isMine(item, who) || item.readBy.includes(who.name)
  const hasDue = (type) => type !== "aviso"
  const isOverdue = (item) => hasDue(item.type) && item.status !== "concluida" && item.due && item.due < localDay(new Date())
  const unreadCount = () => items.filter((i) => isForMe(i) && !isRead(i) && i.status !== "concluida").length

  const find = (id) => items.find((i) => i.id === id)
  function add(data) {
    const id = items.reduce((max, i) => Math.max(max, i.id), 0) + 1
    const item = { status: "aberta", priority: "rotina", replies: [], readBy: [], ...data, id, author: data.author || me().name, createdAt: new Date().toISOString() }
    if (!hasDue(item.type)) delete item.due
    items.unshift(item)
    save()
    return item
  }
  function markRead(id) {
    const item = find(id)
    if (!item || isRead(item)) return
    item.readBy.push(me().name)
    save()
  }
  function reply(id, text) {
    const item = find(id)
    if (!item || !text.trim()) return
    item.replies.push({ by: me().name, at: new Date().toISOString(), text: text.trim() })
    save()
  }
  function setDone(id, done) {
    const item = find(id)
    if (!item || !hasDue(item.type)) return
    item.status = done ? "concluida" : "aberta"
    if (done) Object.assign(item, { doneBy: me().name, doneAt: new Date().toISOString() })
    else { delete item.doneBy; delete item.doneAt }
    save()
  }

  // ---------- Contador no menu do cabeçalho ----------
  function syncNavBadge() {
    document.querySelectorAll('.app-nav a[href="comunicacoes.html"]').forEach((link) => {
      let badge = link.querySelector(".nav-badge")
      if (!badge) {
        badge = document.createElement("span")
        badge.className = "nav-badge"
        link.append(badge)
      }
      const n = unreadCount()
      badge.textContent = n > 99 ? "99+" : String(n)
      badge.hidden = !n
      badge.setAttribute("aria-label", `${n} não ${n === 1 ? "lida" : "lidas"}`)
    })
  }
  document.addEventListener("DOMContentLoaded", syncNavBadge)
  document.addEventListener("hunefro:comunicacoes", syncNavBadge)
  document.addEventListener("hunefro:perfil", syncNavBadge)
  // Outra aba (ex.: o prontuário enviou uma Solicitação de avaliação).
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return
    read()
    document.dispatchEvent(new CustomEvent("hunefro:comunicacoes"))
  })

  window.HuNefroComunicacoes = {
    TYPES, PRIORITIES, RECIPIENT_KINDS, GROUPS, PROFILES, labelOf, me,
    all: () => items, find, add, markRead, reply, setDone, isForMe, isMine, isRead, isOverdue, hasDue, unreadCount,
  }
})()
