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

  togglePassword.addEventListener("click", () => {
    const isHidden = password.type === "password"
    password.type = isHidden ? "text" : "password"
    togglePassword.setAttribute(
      "aria-label",
      isHidden ? "Ocultar senha" : "Mostrar senha",
    )
    togglePassword.setAttribute("aria-pressed", String(isHidden))
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    clearFeedback()

    if (!form.checkValidity()) {
      form.classList.add("was-validated")
      setFeedback("Revise os campos obrigatórios antes de continuar.")
      return
    }

    form.classList.remove("was-validated")
    loginButton.disabled = true
    loginLabel.classList.add("d-none")
    loginLoading.classList.remove("d-none")

    // Fluxo demonstrativo: registra apenas a sessão do protótipo.
    sessionStorage.setItem("huNefroAuthenticated", "true")
    sessionStorage.setItem("huNefroUsername", username.value.trim())

    window.setTimeout(() => {
      window.location.replace("pacientes.html")
    }, 450)
  })

  const recoveryButton = document.getElementById("recoveryButton")
  const recoveryDialog = document.getElementById("recoveryDialog")
  const recoveryForm = document.getElementById("recoveryForm")
  const recoveryEmail = document.getElementById("recoveryEmail")
  const recoveryFeedback = document.getElementById("recoveryFeedback")
  const recoveryClose = document.getElementById("recoveryClose")
  const recoveryCancel = document.getElementById("recoveryCancel")

  function openRecoveryDialog() {
    recoveryFeedback.textContent = ""
    recoveryEmail.value = username.value.trim()
    recoveryDialog.showModal()
    window.requestAnimationFrame(() => recoveryEmail.focus())
  }

  function closeRecoveryDialog() {
    if (recoveryDialog.open) recoveryDialog.close()
    recoveryButton.focus()
  }

  recoveryButton.addEventListener("click", openRecoveryDialog)
  recoveryClose.addEventListener("click", closeRecoveryDialog)
  recoveryCancel.addEventListener("click", closeRecoveryDialog)

  recoveryDialog.addEventListener("cancel", (event) => {
    event.preventDefault()
    closeRecoveryDialog()
  })

  recoveryDialog.addEventListener("click", (event) => {
    if (event.target === recoveryDialog) closeRecoveryDialog()
  })

  recoveryForm.addEventListener("submit", (event) => {
    event.preventDefault()

    if (!recoveryEmail.checkValidity()) {
      recoveryEmail.reportValidity()
      return
    }

    recoveryFeedback.className = "recovery-feedback is-info"
    recoveryFeedback.textContent =
      "A recuperação de senha é feita pelo serviço institucional de acesso."
  })
})()
