(() => {
  const form = document.getElementById("loginForm")
  const username = document.getElementById("username")
  const password = document.getElementById("password")
  const togglePassword = document.getElementById("togglePassword")
  const feedback = document.getElementById("loginFeedback")
  const loginButton = document.getElementById("loginButton")
  const loginLabel = loginButton.querySelector(".login-label")
  const loginLoading = loginButton.querySelector(".login-loading")

  function setFeedback(message, type = "danger") {
    feedback.className = `alert alert-${type} mb-0`
    feedback.textContent = message
  }

  function clearFeedback() {
    feedback.className = "alert d-none mb-0"
    feedback.textContent = ""
  }

  togglePassword?.addEventListener("click", () => {
    const isHidden = password.type === "password"
    password.type = isHidden ? "text" : "password"
    togglePassword.setAttribute(
      "aria-label",
      isHidden ? "Ocultar senha" : "Mostrar senha",
    )
    togglePassword.setAttribute("aria-pressed", String(isHidden))
  })

  form?.addEventListener("submit", (event) => {
    event.preventDefault()
    clearFeedback()

    if (!form.checkValidity()) {
      form.classList.add("was-validated")
      setFeedback("Revise os campos obrigatórios antes de continuar.")
      return
    }

    // Usuário cadastrado (huNefroAdmin:v1, campo users): bloqueado não entra; o perfil vem do cadastro.
    const user = window.HuNefroAdmin?.findUser?.(username.value)
    if (user && user.active === false) {
      setFeedback("Usuário bloqueado. Procure a administração da unidade.")
      return
    }

    form.classList.remove("was-validated")
    loginButton.disabled = true
    loginLabel.classList.add("d-none")
    loginLoading.classList.remove("d-none")

    // Fluxo demonstrativo: registra apenas a sessão do protótipo.
    sessionStorage.setItem("huNefroAuthenticated", "true")
    sessionStorage.setItem("huNefroUsername", username.value.trim())
    if (user) {
      sessionStorage.setItem("huNefroPerfil", user.profile)
      window.HuNefroAdmin.recordLogin(user.login)
    }

    window.setTimeout(() => {
      window.location.replace("pacientes.html")
    }, 450)
  })
})()