// Aba Clínico / Dados Clínicos do prontuário Hu-Nefro.
//
// Persistência real (leitura/gravação) deve ser feita pelo backend Django/DRF.
// Este arquivo expõe `window.HuNefroDadosClinicos` com getData()/setData()/validate()
// para a integração com a API. As listas próprias desta aba ficam em CATALOGS; profissionais e CID-10
// vêm de js/catalogos.js (a substituir pela API: AGHU e base CID-10).
(() => {
  "use strict"

  const view = document.querySelector("#view-dados-clinicos")
  if (!view) return

  const C = window.HuNefroCatalogos
  const { el, todayIso, formatDate, slug, markDirty, createCombo } = window.HuNefroUI

  // ---------------------------------------------------------------------------
  // Listas (catálogos). Valores: [valor, rótulo]
  // ---------------------------------------------------------------------------
  const SEM_INFO = ["sem-informacao", "Sem informação"]

  const CATALOGS = {
    aboRh: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => [v, v]),
    simNaoSemInfo: [["nao", "Não"], ["sim", "Sim"], SEM_INFO],
    etiologia: [
      "Doença renal policística",
      "Glomerulonefrite crônica (exceto Lupus)",
      "Indeterminada",
      "Nefropatia diabética (tipo I)",
      "Nefropatia diabética (tipo II)",
      "Nefropatia hipertensiva",
      "Nefropatia intersticial crônica",
      "Nefropatia lúpica",
      "Outra",
      "Rejeição TX",
      "Rim do mieloma múltiplo",
    ].map((v) => [slug(v), v]),
    vacinas: [
      "Anti gripal", "BCG", "Caxumba", "Covid-19", "Dengue", "Difteria e Tétano", "Febre Amarela",
      "H1N1", "Hepatite A", "Hepatite B", "Herpes Zoster", "HPV", "Meningite", "Outra", "Pertussis",
      "Pneumocócica", "Poliomielite", "Raiva", "Rubéola", "Sarampo", "Tétano",
      "Tríplice Bacteriana (DPT)", "Tríplice Bacteriana (dTpa)", "Tríplice viral", "Varicela", "Varíola",
    ].map((v) => [v, v]),
    tempoCuidado: [
      ["nao", "Não"],
      SEM_INFO,
      ["sim-menos-6-meses", "Sim, por menos de 6 meses"],
      ["sim-6-a-12-meses", "Sim, entre 6 e 12 meses"],
      ["sim-mais-12-meses", "Sim, por mais de 12 meses"],
    ],
    primeiroPrograma: [["hd", "HD"], ["dpac", "DPAC"], ["dpa", "DPA"], SEM_INFO, ["hdf", "HDF"]],
    realizacao: [["eletiva", "Eletiva"], ["emergencia", "Emergência"], SEM_INFO],
    localSessao: [["clinica-dialise", "Clínica de diálise"], ["hospital", "Hospital"], SEM_INFO],
    // A captura do sistema legado mostra apenas "Hemodiálise"; confirmar a lista completa com a equipe.
    tipoDialise: [["hemodialise", "Hemodiálise"], ["dialise-peritoneal", "Diálise peritoneal"], SEM_INFO],
    acessoSessao: [["fav", "FAV"], ["protese-vascular", "Prótese vascular"], ["cateter", "Catéter"], SEM_INFO],
  }

  // Marcadores virais. `inverse`: para Anti-HBs o resultado positivo é o favorável (imunidade).
  const MARKERS = [
    { id: "hepatiteC", label: "Hepatite C" },
    { id: "hepatiteB", label: "Hepatite B" },
    { id: "hiv", label: "HIV" },
    { id: "antiHbs", label: "Anti-HBs", inverse: true },
    { id: "cmvIgg", label: "CMV (IgG)" },
    { id: "chagasIgm", label: "Chagas (IgM)" },
  ]
  const MARKER_OPTIONS = [
    { value: "positivo", label: "Positivo" },
    { value: "negativo", label: "Negativo" },
    { value: "coletado", label: "Coletado" },
    { value: "nao-informado", label: "Não Inform." },
  ]

  // Equipe vinculada: 5 vínculos, profissionais do AGHU. LISTA FICTÍCIA de desenvolvimento.
  const TEAM_SLOTS = 5

  // ---------------------------------------------------------------------------
  // Utilitários
  // ---------------------------------------------------------------------------
  const $ = (selector) => view.querySelector(selector)

  function parseDecimal(text) {
    const cleaned = String(text).trim().replace(",", ".")
    if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null
    return Number(cleaned)
  }

  // ---------------------------------------------------------------------------
  // Selects a partir dos catálogos
  // ---------------------------------------------------------------------------
  function fillSelect(select, items, { placeholder = "- Selecione -", defaultValue = "" } = {}) {
    select.replaceChildren(el("option", { value: "", text: placeholder }))
    items.forEach(([value, label]) => select.append(el("option", { value, text: label })))
    select.value = defaultValue
  }

  view.querySelectorAll("select[data-catalog]").forEach((select) => {
    fillSelect(select, CATALOGS[select.dataset.catalog] || [], {
      defaultValue: select.dataset.default || "",
    })
  })

  // ---------------------------------------------------------------------------
  // Marcadores virais
  // ---------------------------------------------------------------------------
  function toneFor(marker, value) {
    if (value === "coletado") return "info"
    if (value === "nao-informado") return "warning"
    const positiveIsGood = Boolean(marker.inverse)
    if (value === "positivo") return positiveIsGood ? "success" : "danger"
    return positiveIsGood ? "danger" : "success"
  }

  const markersRoot = $("#dc-markers")
  MARKERS.forEach((marker) => {
    const options = el("div", { class: "dc-marker-options" })
    MARKER_OPTIONS.forEach((option) => {
      const input = el("input", {
        type: "radio",
        name: `dc-marker-${marker.id}`,
        value: option.value,
        checked: option.value === "nao-informado",
      })
      options.append(
        el("label", { class: `dc-marker-option dc-tone-${toneFor(marker, option.value)}` }, input, el("span", { text: option.label })),
      )
    })
    markersRoot.append(el("fieldset", { class: "dc-marker" }, el("legend", { text: marker.label }), options))
  })

  // Regras da RDC ANVISA nº 11/2014 conforme os marcadores (aviso na aba e selo no cabeçalho do paciente).
  const seroAlert = el("div", { class: "hn-alert dc-sero-alert", id: "dc-sero-alert", role: "status", hidden: true })
  markersRoot.after(seroAlert)
  function syncSerology() {
    const rules = window.HuNefroMock?.serologyRules?.(getMarkers())
    const flag = document.getElementById("patient-sero-flag")
    const show = Boolean(rules?.tags.length)
    seroAlert.hidden = !show
    if (flag) flag.hidden = !show
    if (!show) return
    const danger = rules.tone === "danger"
    seroAlert.className = `hn-alert dc-sero-alert ${danger ? "hn-alert-danger" : "hn-alert-warn"}`
    seroAlert.replaceChildren(el("span", { class: "hn-alert-icon", "aria-hidden": "true", text: "!" }),
      el("div", {}, el("strong", { text: `${rules.tags.join(", ")}. Regras na sessão de HD (RDC ANVISA nº 11/2014), avisadas ao técnico em Sessões do dia:` }),
        el("ul", {}, ...rules.rules.map((r) => el("li", { text: r })))))
    if (flag) {
      flag.className = `flag ${danger ? "flag-danger" : "flag-warning"}`
      flag.textContent = `⚠ ${rules.tags.join(" · ")}${rules.singleUse ? " · uso único" : ""}`
      flag.title = rules.rules.join(" ")
    }
  }
  markersRoot.addEventListener("change", syncSerology)

  function getMarkers() {
    return Object.fromEntries(
      MARKERS.map((marker) => [
        marker.id,
        view.querySelector(`input[name="dc-marker-${marker.id}"]:checked`)?.value || "nao-informado",
      ]),
    )
  }

  // ---------------------------------------------------------------------------
  // Equipe vinculada (cada profissional só pode ocupar um vínculo)
  // ---------------------------------------------------------------------------
  const teamRoot = $("#dc-team")
  const teamSelects = []
  for (let slot = 1; slot <= TEAM_SLOTS; slot += 1) {
    const select = el("select", { class: "form-select", id: `dc-team-${slot}`, name: `equipe_${slot}` })
    fillSelect(select, C.professionalOptions(), { placeholder: "- Selecione o profissional -" })
    teamSelects.push(select)
    teamRoot.append(
      el("div", { class: "field-block" }, el("label", { class: "visually-hidden", for: select.id, text: `Vínculo ${slot}` }), select),
    )
    select.addEventListener("change", syncTeamOptions)
  }

  function syncTeamOptions() {
    const taken = new Set(teamSelects.map((select) => select.value).filter(Boolean))
    teamSelects.forEach((select) => {
      [...select.options].forEach((option) => {
        option.disabled = Boolean(option.value) && taken.has(option.value) && option.value !== select.value
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Combobox acessível (Diagnóstico de base / CID)
  // ---------------------------------------------------------------------------

  const diagnosticoBase = createCombo({
    input: $("#dc-diag-base"),
    list: $("#dc-diag-base-list"),
    clearButton: $("#dc-diag-base-combo .dc-combo-clear"),
    items: C.CID,
    onChange: markDirty,
  })

  // ---------------------------------------------------------------------------
  // Vacinas
  // ---------------------------------------------------------------------------
  const vaccineFields = {
    date: $("#dc-vac-data"),
    name: $("#dc-vac-nome"),
    complement: $("#dc-vac-complemento"),
    lot: $("#dc-vac-lote"),
  }
  const vaccineBody = $("#dc-vac-body")
  const vaccineFeedback = $("#dc-vac-feedback")
  let vaccines = []

  vaccineFields.date.max = todayIso()

  function showVaccineError(message, field) {
    vaccineFeedback.textContent = message
    vaccineFeedback.hidden = false
    field?.focus()
  }

  // Total de vacinas abaixo da lista (a lista tem rolagem interna quando passa de 4 registros).
  function renderVaccineCount() {
    const count = $("#dc-vac-count")
    if (!count) return
    const total = vaccines.length
    count.textContent = total > 4 ? `${total} vacinas registradas · role a lista para ver todas` : total ? `${total} ${total === 1 ? "vacina registrada" : "vacinas registradas"}` : ""
  }

  function renderVaccines() {
    vaccineBody.replaceChildren()
    renderVaccineCount()
    if (vaccines.length === 0) {
      vaccineBody.append(el("tr", {}, el("td", { colspan: "5", class: "empty-history", text: "Nenhuma vacina registrada" })))
      return
    }
    vaccines.forEach((vaccine) => {
      const remove = el("button", {
        class: "dc-vac-remove",
        type: "button",
        "aria-label": `Remover vacina ${vaccine.name} de ${formatDate(vaccine.date)}`,
        text: "×",
      })
      remove.addEventListener("click", () => {
        vaccines = vaccines.filter((item) => item !== vaccine)
        renderVaccines()
        markDirty()
        vaccineFields.date.focus()
      })
      vaccineBody.append(
        el(
          "tr",
          {},
          el("td", { text: formatDate(vaccine.date) }),
          el("td", { text: vaccine.name }),
          el("td", { text: vaccine.complement || "-" }),
          el("td", { text: vaccine.lot || "-" }),
          el("td", {}, remove),
        ),
      )
    })
  }

  function addVaccine() {
    const entry = {
      date: vaccineFields.date.value,
      name: vaccineFields.name.value,
      complement: vaccineFields.complement.value.trim(),
      lot: vaccineFields.lot.value.trim(),
    }
    if (!entry.date) return showVaccineError("Informe a data da vacina.", vaccineFields.date)
    if (entry.date > todayIso()) return showVaccineError("A data da vacina não pode ser futura.", vaccineFields.date)
    if (!entry.name) return showVaccineError("Selecione a vacina.", vaccineFields.name)
    if (entry.name === "Outra" && !entry.complement) {
      return showVaccineError("Para a opção “Outra”, descreva a vacina no campo Complemento.", vaccineFields.complement)
    }

    vaccineFeedback.hidden = true
    vaccines = [...vaccines, entry].sort((a, b) => b.date.localeCompare(a.date))
    renderVaccines()
    Object.values(vaccineFields).forEach((field) => { field.value = "" })
    vaccineFields.date.focus()
    markDirty()
  }

  $("#dc-vac-add").addEventListener("click", addVaccine)
  Object.values(vaccineFields).forEach((field) => {
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        addVaccine()
      }
    })
    field.addEventListener("input", () => { vaccineFeedback.hidden = true })
  })
  renderVaccines()

  // ---------------------------------------------------------------------------
  // Validação simples de campos numéricos
  // ---------------------------------------------------------------------------
  const pesoSeco = $("#dc-peso-seco")
  const gestacoes = $("#dc-gestacoes")

  function validatePeso() {
    const raw = pesoSeco.value.trim()
    const value = parseDecimal(raw)
    const valid = raw === "" || (value !== null && value >= 1 && value <= 400)
    pesoSeco.classList.toggle("is-invalid", !valid)
    return valid
  }

  function validateGestacoes() {
    const raw = gestacoes.value.trim()
    const valid = raw === "" || (/^\d+$/.test(raw) && Number(raw) <= 30)
    gestacoes.classList.toggle("is-invalid", !valid)
    return valid
  }

  pesoSeco.addEventListener("blur", validatePeso)
  gestacoes.addEventListener("blur", validateGestacoes)

  // ---------------------------------------------------------------------------
  // ABO/Rh no cabeçalho do paciente
  // ---------------------------------------------------------------------------
  const aboField = $("#dc-abo-rh")
  const headerAboFlag = document.getElementById("patient-abo-flag")

  function syncHeaderAbo() {
    if (!headerAboFlag) return
    headerAboFlag.textContent = aboField.value
    headerAboFlag.hidden = !aboField.value
  }
  aboField.addEventListener("change", syncHeaderAbo)

  // ---------------------------------------------------------------------------
  // Alterações não salvas (o shell do prontuário escuta `hunefro:dirty`)
  // ---------------------------------------------------------------------------
  const markDirtyUnlessDraft = (event) => {
    if (!event.target.hasAttribute("data-no-dirty")) markDirty()
  }
  view.addEventListener("input", markDirtyUnlessDraft)
  view.addEventListener("change", markDirtyUnlessDraft)

  // ---------------------------------------------------------------------------
  // API pública para integração com o backend
  // ---------------------------------------------------------------------------
  const val = (selector) => $(selector).value
  const SELECT_FIELDS = {
    abo_rh: "#dc-abo-rh",
    tabagismo: "#dc-tabagismo",
    etilismo: "#dc-etilismo",
    drogadicao: "#dc-drogadicao",
    etiologia: "#dc-etiologia",
  }
  const PREVIO_FIELDS = {
    epo: "#dc-epo",
    nefrologista: "#dc-nefrologista",
    nutricionista: "#dc-nutricionista",
    primeiro_programa: "#dc-primeiro-programa",
  }
  const SESSAO_FIELDS = {
    realizacao: "#dc-realizacao",
    local: "#dc-local",
    tipo_dialise: "#dc-tipo-dialise",
    acesso: "#dc-acesso",
    fav_presente: "#dc-fav",
    enxerto_venoso: "#dc-enxerto",
  }
  const mapFields = (map) => Object.fromEntries(Object.entries(map).map(([key, selector]) => [key, val(selector) || null]))

  function getData() {
    return {
      ...mapFields(SELECT_FIELDS),
      altura_cm: parseDecimal(val("#dc-altura")),
      peso_seco_kg: parseDecimal(val("#dc-peso-seco")),
      diurese: val("#dc-diurese").trim() || null,
      gestacoes: {
        quantidade: /^\d+$/.test(val("#dc-gestacoes").trim()) ? Number(val("#dc-gestacoes")) : null,
        data: val("#dc-gestacoes-data") || null,
      },
      diagnostico_base_cid: diagnosticoBase.value?.code || null,
      observacoes: val("#dc-observacoes").trim(),
      alertas: val("#dc-alertas").trim(),
      marcadores_virais: getMarkers(),
      equipe_vinculada: teamSelects.map((select) => select.value).filter(Boolean),
      vacinas: vaccines.map((vaccine) => ({ ...vaccine })),
      previo_tratamento: mapFields(PREVIO_FIELDS),
      primeira_sessao_dialise: mapFields(SESSAO_FIELDS),
    }
  }

  function setData(data = {}) {
    const setSelect = (selector, value) => {
      const select = $(selector)
      select.value = value ?? select.dataset.default ?? ""
    }
    Object.entries(SELECT_FIELDS).forEach(([key, selector]) => setSelect(selector, data[key]))
    $("#dc-altura").value = data.altura_cm ?? ""
    $("#dc-peso-seco").value = data.peso_seco_kg ?? ""
    $("#dc-diurese").value = data.diurese ?? ""
    $("#dc-gestacoes").value = data.gestacoes?.quantidade ?? ""
    $("#dc-gestacoes-data").value = data.gestacoes?.data ?? ""
    diagnosticoBase.setByCode(data.diagnostico_base_cid)
    $("#dc-observacoes").value = data.observacoes ?? ""
    $("#dc-alertas").value = data.alertas ?? ""
    MARKERS.forEach((marker) => {
      const value = data.marcadores_virais?.[marker.id] || "nao-informado"
      const input = view.querySelector(`input[name="dc-marker-${marker.id}"][value="${value}"]`)
      if (input) input.checked = true
    })
    syncSerology()
    teamSelects.forEach((select, index) => { select.value = data.equipe_vinculada?.[index] ?? "" })
    syncTeamOptions()
    vaccines = (data.vacinas || []).map((vaccine) => ({ ...vaccine })).sort((a, b) => b.date.localeCompare(a.date))
    renderVaccines()
    Object.entries(PREVIO_FIELDS).forEach(([key, selector]) => setSelect(selector, data.previo_tratamento?.[key]))
    Object.entries(SESSAO_FIELDS).forEach(([key, selector]) => setSelect(selector, data.primeira_sessao_dialise?.[key]))
    syncHeaderAbo()
    validatePeso()
    validateGestacoes()
  }

  function validate() {
    const results = [validatePeso(), validateGestacoes()]
    return results.every(Boolean)
  }

  window.HuNefroDadosClinicos = { getData, setData, validate }
})()
