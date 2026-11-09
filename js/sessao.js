// Sessão do protótipo: bloqueia as páginas internas sem login e trata o botão "Sair" (#logout-button).
// Demonstração apenas: a autenticação e a autorização reais ficam no backend Django/DRF.
(() => {
  "use strict"

  const AUTH_KEY = "huNefroAuthenticated"
  const USER_KEY = "huNefroUsername"
  const PROFILE_KEY = "huNefroPerfil"

  // Perfis simulados no protótipo (o perfil real virá do login no backend). Mesma lista das Comunicações.
  // Remarcar sessão ou reposição de falta é atribuição da enfermeira; o técnico registra a falta.
  // Sessão extra (por orientação médica): enfermeira ou médico.
  // A Recepção faz o primeiro cadastro (busca pelo CPF no AGHU) e mantém o Programa de Tratamento.
  const PROFILES = Object.freeze({
    recepcao: "Recepção", tecnico: "Técnico(a) de enfermagem", enfermeiro: "Enfermeiro(a)", medico: "Médico(a)", nutricionista: "Nutricionista",
    "assistente-social": "Assistente social", psicologo: "Psicólogo(a)", administrador: "Administrador(a)",
  })
  // Permissões padrão. Ajustes salvos antes em huNefroAdmin:v1 continuam valendo
  // (gravado em huNefroAdmin:v1, campo permissions). "administrar" vale para quem tem qualquer área da Gestão.
  const DEFAULT_PERMISSIONS = Object.freeze({
    "remarcar-sessao": ["enfermeiro"], "turno-extra": ["enfermeiro", "medico"], "sala-q": ["enfermeiro", "medico"], "incluir-paciente": ["recepcao"], "editar-programa": ["recepcao"], "adm-unidade": ["administrador"], "adm-cadastros": ["administrador"],
    "adm-modelos": ["administrador"], "adm-acesso": ["administrador"],
  })
  function permissions() {
    try {
      const saved = JSON.parse(localStorage.getItem("huNefroAdmin:v1") || "null")?.permissions
      if (saved && typeof saved === "object") return { ...DEFAULT_PERMISSIONS, ...saved, "adm-acesso": [...new Set([...(saved["adm-acesso"] || []), "administrador"])] }
    } catch { /* sem armazenamento */ }
    return DEFAULT_PERMISSIONS
  }
  const DEFAULT_PROFILE = "tecnico"

  function profile() {
    const value = sessionStorage.getItem(PROFILE_KEY)
    return PROFILES[value] ? value : DEFAULT_PROFILE
  }
  const profileLabel = (value = profile()) => PROFILES[value]
  function can(action) {
    const all = permissions()
    if (action === "administrar") return Object.keys(all).some((k) => k.startsWith("adm-") && all[k].includes(profile()))
    return (all[action] || []).includes(profile())
  }
  function setProfile(value) {
    if (!PROFILES[value]) return
    sessionStorage.setItem(PROFILE_KEY, value)
    document.dispatchEvent(new CustomEvent("hunefro:perfil", { detail: { profile: value } }))
  }

  if (sessionStorage.getItem(AUTH_KEY) !== "true") window.location.replace("login.html")

  function logout() {
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(PROFILE_KEY)
    window.location.replace("login.html")
  }

  // Nome do usuário logado no cabeçalho (#current-user) e botão "Sair".
  document.addEventListener("DOMContentLoaded", () => {
    const user = document.getElementById("current-user")
    if (user) {
      const name = sessionStorage.getItem(USER_KEY) || "Usuário"
      user.dataset.initial = name.charAt(0).toUpperCase()
      user.replaceChildren(Object.assign(document.createElement("span"), { textContent: name }))
    }
    document.getElementById("logout-button")?.addEventListener("click", logout)

    // Seletor do perfil simulado, ao lado do usuário.
    const actions = document.querySelector(".header-actions")
    if (actions) {
      const select = document.createElement("select")
      select.className = "form-select form-select-sm profile-switch"
      select.id = "profile-switch"
      select.setAttribute("aria-label", "Perfil do usuário (simulação do protótipo)")
      select.title = "Perfil simulado: muda o que o usuário pode fazer"
      Object.entries(PROFILES).forEach(([value, label]) => select.append(new Option(label, value, false, value === profile())))
      select.addEventListener("change", () => setProfile(select.value))
      actions.prepend(select)
    }
  })

  window.HuNefroSessao = { logout, profile, profileLabel, setProfile, can, permissions, PROFILES, DEFAULT_PERMISSIONS }
})()
