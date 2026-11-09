// Aba Clínico / Nutrição do prontuário Hu-Nefro: ficha de acompanhamento nutricional em hemodiálise.
// Depende de js/componentes.js e js/nutricao-calculos.js. Dados em memória até existir a API.
// A ficha só registra o que é da nutrição. Identificação, programa, dados clínicos e acesso ficam nas próprias abas
// (a ficha impressa lê de lá); pesos e exames do monitoramento mensal vêm das Sessões de Diálise e da aba Exames.
// A altura aferida na antropometria alimenta o campo Altura de Dados Clínicos.
// Expõe `window.HuNefroNutricao` com getData()/setData()/validate() para a integração com a API.
;(() => {
  "use strict"

  const view = document.querySelector("#view-nutricao")
  if (!view) return

  const calculations = window.HuNefroNutritionCalculations
  if (!calculations) {
    throw new Error("Módulo de cálculos nutricionais não carregado.")
  }
  const { formatDate, todayIso, slug, markDirty } = window.HuNefroUI
  const $ = (selector) => view.querySelector(selector)

  const months = [
    ["jan", "janeiro"],
    ["fev", "fevereiro"],
    ["mar", "março"],
    ["abr", "abril"],
    ["mai", "maio"],
    ["jun", "junho"],
    ["jul", "julho"],
    ["ago", "agosto"],
    ["set", "setembro"],
    ["out", "outubro"],
    ["nov", "novembro"],
    ["dez", "dezembro"],
  ]

  const monthlyGroups = [
    {
      label: "Sintomas gastrointestinais e consumo",
      rows: [
        "Constipação (tempo)",
        "Diarreia (tempo)",
        "Apetite",
        "Ingestão hídrica (L)",
        "Número de refeições",
        "Suplemento nutricional",
        "Pró ou simbiótico",
        // Quelante de cálcio e quelante de fósforo em linhas separadas (pedido do Elias, 09/11/2026).
        "Quelante (Ca)",
        "Quelante (P)",
      ],
    },
    // Ganho de peso interdialítico: registro de 3 medições pré/pós e cálculos automáticos de médias, % GPI e IMC.
    {
      label: "Ganho de peso interdialítico",
      type: "gpi",
      rows: [
        { label: "P. Seco", type: "dry", key: "dryWeight" },
        { label: "P.Pré / P.Pós", type: "measurement", measurement: 1 },
        { label: "P.Pré / P.Pós", type: "measurement", measurement: 2 },
        { label: "P.Pré / P.Pós", type: "measurement", measurement: 3 },
        { label: "X̄ Peso", type: "mean" },
        { label: "% GPI", type: "percent" },
        { label: "IMC", type: "imc" },
      ],
    },
    // Último resultado do mês na aba Exames (somente leitura), exceto PNA.
    {
      label: "Exames mensais de rotina · aba Exames",
      rows: [
        { label: "Creatinina (mg/dL)", exam: "Creatinina" },
        { label: "Fósforo (mg/dL)", exam: "Fósforo" },
        { label: "Cálcio × fósforo", auto: "calciumPhosphorus" },
        { label: "Ureia pré-diálise (mg/dL)", exam: "Ureia pré-diálise" },
        { label: "Ureia pós-diálise (mg/dL)", exam: "Ureia pós-diálise" },
        { label: "TRU (%)", exam: "URR (%)" },
        { label: "Hemoglobina (g/dL)", exam: "Hemoglobina" },
        { label: "Hematócrito (%)", exam: "Hematócrito" },
        "PNA (g/kg/dia)",
      ],
    },
  ]
  // Exames de referência para a avaliação nutricional (lidos da aba Exames).
  const REFERENCE_EXAMS = [
    "Albumina", "Proteínas totais", "Ferritina", "Saturação da transferrina", "Ferro sérico", "Glicose", "Hemoglobina glicada",
    "Colesterol total", "Colesterol HDL", "Colesterol LDL", "Triglicerídeos", "TSH", "T4", "25-Hidroxivitamina D",
  ]

  const anthropometryGroups = [
    {
      label: "Antropometria geral e circunferências",
      rows: [
        { label: "Altura (m)", metric: "heightM" },
        { label: "Peso aferido (kg)", metric: "weightKg" },
        { label: "IMC (kg/m²)", metric: "bmi", derived: true },
        {
          label: "Músculo adutor do polegar - MAP (mm)",
          metric: "adductorPollicisMm",
        },
        { label: "Circunferência da cintura (cm)", metric: "waistCm" },
        "Circunferência abdominal (cm)",
        { label: "Circunferência do quadril (cm)", metric: "hipCm" },
        {
          label: "Relação cintura-quadril",
          metric: "waistHipRatio",
          derived: true,
        },
        { label: "Circunferência da coxa (cm)", metric: "thighCm" },
        { label: "Circunferência do pescoço (cm)", metric: "neckCm" },
        { label: "Circunferência da panturrilha (cm)", metric: "calfCm" },
        {
          label: "Circunferência do braço - CB (cm)",
          metric: "armCircumferenceCm",
        },
      ],
    },
    {
      label: "Dobras cutâneas e índices",
      rows: [
        { label: "PCT (tricipital)", metric: "tricepsSkinfoldMm" },
        { label: "PCB (bicipital)", metric: "bicepsSkinfoldMm" },
        { label: "PCSE (subescapular)", metric: "subscapularSkinfoldMm" },
        { label: "PCSI (supra-ilíaca)", metric: "suprailiacSkinfoldMm" },
        {
          label: "Circunferência muscular do braço - CMB",
          metric: "armMuscleCircumferenceCm",
          derived: true,
        },
        {
          label: "Gordura corporal (%)",
          metric: "bodyFatPercentage",
          derived: true,
        },
        {
          label: "Diâmetro abdominal sagital - DAS",
          metric: "sagittalAbdominalDiameterCm",
        },
      ],
    },
    {
      label: "Bioimpedância elétrica (BIA) e funcionalidade",
      rows: [
        {
          label: "FPM - mão dominante (kg)",
          metric: "handgripDominantKg",
        },
        {
          label: "FPM - mão não dominante (kg)",
          metric: "handgripNonDominantKg",
        },
        "Tempo de marcha (s)",
        "Ângulo de fase (°)",
        "Capacitância",
        "Resistência (R) / Reatância (Xc)",
        "Água corporal total (L / %)",
        "Água intracelular (L / %)",
        "Água extracelular (L / %)",
        "Massa celular corporal - MCC",
        "Massa extracelular",
        "Massa gorda - MG",
        "Massa magra - MM",
      ],
    },
  ]

  const pediatricAnthropometryRows = [
    {
      label: "Estatura / idade (m)",
      metric: "heightM",
      lmsKey: "height_for_age",
      unit: "m",
    },
    {
      label: "Peso seco / idade (kg)",
      metric: "weightKg",
      lmsKey: "dry_weight_for_age",
      unit: "kg",
    },
    {
      label: "IMC / idade (kg/m²)",
      metric: "bmi",
      lmsKey: "bmi_for_age",
      unit: "kg/m²",
      derived: true,
    },
    {
      label: "Circunferência do braço / idade (cm)",
      metric: "armCircumferenceCm",
      lmsKey: "arm_circ_for_age",
      unit: "cm",
    },
    {
      label: "PCT / idade (mm)",
      metric: "tricepsSkinfoldMm",
      lmsKey: "triceps_skinfold_for_age",
      unit: "mm",
    },
    {
      label: "PCSE / idade (mm)",
      metric: "subscapularSkinfoldMm",
      lmsKey: "subscapular_skinfold_for_age",
      unit: "mm",
    },
    {
      label: "Soma PCT + PCSE (mm)",
      metric: "skinfoldSumMm",
      lmsKey: "sum_skinfolds_for_age",
      unit: "mm",
      derived: true,
    },
    {
      label: "CMB / idade (cm)",
      metric: "armMuscleCircumferenceCm",
      lmsKey: "arm_muscle_circ_for_age",
      unit: "cm",
      derived: true,
    },
    {
      label: "Peso por Altura (kg)",
      metric: "weightForStature",
      unit: "kg",
      derived: true,
      special: "weightForStature",
    },
    {
      label: "Idade Estatural",
      metric: "heightAge",
      unit: "anos e meses",
      derived: true,
      special: "heightAge",
    },
  ]

  const COMMON_PEDIATRIC_ANTHRO_DIAGNOSES = [
    "Eutrofia",
    "Baixo peso para a idade",
    "Muito baixo peso para a idade",
    "Baixa estatura para a idade",
    "Estatura adequada para a idade",
    "Magreza",
    "Magreza acentuada",
    "Sobrepeso",
    "Obesidade",
    "Depleção muscular",
    "Percentual de gordura adequado",
    "Percentual de gordura elevado",
    "Percentual de gordura excessivo",
    "Percentual de gordura baixo",
  ]

  const COMMON_PEDIATRIC_NUTRI_DIAGNOSES = [
    "Eutrofia nutricional",
    "Adequado estado nutricional",
    "Risco de desnutrição proteico-calórica",
    "Desnutrição proteico-calórica leve",
    "Desnutrição proteico-calórica moderada",
    "Desnutrição proteico-calórica grave",
    "Sobrepeso",
    "Obesidade",
  ]

  // Escore de Desnutrição e Inflamação (MIS, Kalantar-Zadeh et al., 2001): 10 itens pontuados de 0 a 3.
  const MIS_ITEMS = [
    ["Histórico", "Alteração do peso seco pós-diálise (últimos 3 a 6 meses)", [
      "Sem perda ou perda < 0,5 kg", "Perda de 0,5 a 1 kg", "Perda > 1 kg, mas < 5%", "Perda ≥ 5%"]],
    ["Histórico", "Ingestão alimentar", [
      "Bom apetite, sem piora do padrão alimentar", "Ingestão sólida um pouco abaixo do ideal",
      "Redução moderada, dieta líquida completa", "Dieta líquida hipocalórica até jejum"]],
    ["Histórico", "Sintomas gastrointestinais", [
      "Sem sintomas, bom apetite", "Sintomas leves, pouco apetite ou náusea ocasional",
      "Vômitos ocasionais ou sintomas moderados", "Diarreia ou vômitos frequentes, ou anorexia grave"]],
    ["Histórico", "Capacidade funcional (relacionada à nutrição)", [
      "Normal ou melhorando, sente-se bem", "Dificuldade ocasional para deambular ou cansaço frequente",
      "Dificuldade para atividades independentes (ex.: ir ao banheiro)", "Acamado ou em cadeira, pouca ou nenhuma atividade"]],
    ["Histórico", "Comorbidades, incluindo tempo de diálise", [
      "Em diálise há < 1 ano e sem outras doenças", "Diálise de 1 a 4 anos ou comorbidade leve (exceto CCM)",
      "Diálise > 4 anos ou comorbidade moderada (incluindo uma CCM)", "Comorbidade grave ou múltipla (2 ou mais CCM)"]],
    ["Exame físico", "Redução das reservas de gordura / perda de gordura subcutânea", ["Normal (sem alteração)", "Leve", "Moderada", "Grave"]],
    ["Exame físico", "Sinais de perda de massa muscular", ["Normal (sem alteração)", "Leve", "Moderada", "Grave"]],
    ["Índice de massa corporal", "IMC (kg/m²)", ["≥ 20", "18 a 19,99", "16 a 17,99", "< 16"]],
    ["Laboratório", "Albumina sérica (g/dL)", ["≥ 4,0", "3,5 a 3,9", "3,0 a 3,4", "< 3,0"]],
    ["Laboratório", "Capacidade total de ligação do ferro - TIBC (mg/dL)", ["≥ 250", "200 a 249", "150 a 199", "< 150"]],
  ]
  const MIS_BMI = 8
  const MIS_ALBUMIN = 9
  const misScoreBmi = (bmi) => (bmi >= 20 ? 0 : bmi >= 18 ? 1 : bmi >= 16 ? 2 : 3)
  const misScoreAlbumin = (g) => (g >= 4 ? 0 : g >= 3.5 ? 1 : g >= 3 ? 2 : 3)

  const monthlyBody = $("#monthly-table-body")
  const anthropometryBody = $("#anthropometry-table-body")
  const pediatricQuarterGrid = $("#pediatric-quarter-grid")

  function createInput(name, label, lockAttribute, options = {}) {
    const input = document.createElement("input")
    input.name = name
    input.setAttribute("aria-label", label)
    input.placeholder = "-"
    input.inputMode = "decimal"

    if (options.metric) {
      input.dataset.metric = options.metric
      input.dataset.semester = String(options.semester)
    }

    if (options.derived) {
      input.dataset.derivedOutput = ""
      input.readOnly = true
      input.setAttribute("aria-readonly", "true")
      input.title = "Calculado automaticamente"
    } else {
      input.disabled = true
      if (lockAttribute) input.setAttribute(lockAttribute, "")
    }

    return input
  }

  // Diagnóstico calculado: textarea somente leitura, para as classificações longas quebrarem em mais de uma linha.
  function createDiagnosisOutput(name, label) {
    const output = document.createElement("textarea")
    output.name = name
    output.rows = 2
    output.readOnly = true
    output.placeholder = "-"
    output.setAttribute("aria-label", label)
    output.setAttribute("aria-readonly", "true")
    output.dataset.derivedOutput = ""
    output.title = "Calculado automaticamente"
    return output
  }

  function createGroupRow(label, columnCount) {
    const row = document.createElement("tr")
    row.className = "nutrition-group-row"
    const heading = document.createElement("th")
    heading.scope = "rowgroup"
    heading.colSpan = columnCount
    heading.textContent = label
    row.append(heading)
    return row
  }

  function renderGpiRow(rowDef) {
    const row = document.createElement("tr")
    if (["mean", "percent", "imc"].includes(rowDef.type)) {
      row.className = "nutrition-calc-row"
    }
    const heading = document.createElement("th")
    heading.scope = "row"
    if (rowDef.type === "measurement") {
      const titleSpan = document.createElement("span")
      titleSpan.textContent = rowDef.label
      const badgeSpan = document.createElement("span")
      badgeSpan.className = "nutrition-row-badge"
      badgeSpan.textContent = `(${rowDef.measurement})`
      heading.append(titleSpan, " ", badgeSpan)
    } else {
      heading.textContent = rowDef.label
    }
    row.append(heading)

    months.forEach(([monthKey, monthLabel], monthIndex) => {
      const cell = document.createElement("td")

      if (rowDef.type === "dry") {
        const input = createInput(
          `mensal-gpi-seco-${monthKey}`,
          `Peso seco em ${monthLabel} (kg)`,
          "data-monthly-lock",
        )
        input.dataset.gpiField = "dry"
        input.dataset.month = String(monthIndex)
        cell.append(input)
      } else if (rowDef.type === "measurement") {
        cell.className = "nutrition-dual-cell"
        const wrap = document.createElement("div")
        wrap.className = "nutrition-dual-input"

        const inputPre = createInput(
          `mensal-gpi-pre-${rowDef.measurement}-${monthKey}`,
          `${rowDef.measurement}ª medição: Peso pré-diálise em ${monthLabel} (kg)`,
          "data-monthly-lock",
        )
        inputPre.placeholder = "Pré"
        inputPre.dataset.gpiField = "pre"
        inputPre.dataset.measurement = String(rowDef.measurement)
        inputPre.dataset.month = String(monthIndex)

        const inputPos = createInput(
          `mensal-gpi-pos-${rowDef.measurement}-${monthKey}`,
          `${rowDef.measurement}ª medição: Peso pós-diálise em ${monthLabel} (kg)`,
          "data-monthly-lock",
        )
        inputPos.placeholder = "Pós"
        inputPos.dataset.gpiField = "pos"
        inputPos.dataset.measurement = String(rowDef.measurement)
        inputPos.dataset.month = String(monthIndex)

        wrap.append(inputPre, inputPos)
        cell.append(wrap)
      } else if (rowDef.type === "mean") {
        cell.className = "nutrition-dual-cell"
        const wrap = document.createElement("div")
        wrap.className = "nutrition-dual-input"

        const outputPre = createInput(
          `mensal-gpi-media-pre-${monthKey}`,
          `Média calculada do peso pré-diálise em ${monthLabel} (kg)`,
          null,
          { derived: true },
        )
        outputPre.placeholder = "-"
        outputPre.dataset.gpiCalc = "media-pre"
        outputPre.dataset.month = String(monthIndex)
        outputPre.title = "Média calculada automaticamente das medições pré-diálise"

        const outputPos = createInput(
          `mensal-gpi-media-pos-${monthKey}`,
          `Média calculada do peso pós-diálise em ${monthLabel} (kg)`,
          null,
          { derived: true },
        )
        outputPos.placeholder = "-"
        outputPos.dataset.gpiCalc = "media-pos"
        outputPos.dataset.month = String(monthIndex)
        outputPos.title = "Média calculada automaticamente das medições pós-diálise"

        wrap.append(outputPre, outputPos)
        cell.append(wrap)
      } else if (rowDef.type === "percent") {
        const output = createInput(
          `mensal-gpi-percent-${monthKey}`,
          `Ganho de peso interdialítico percentual em ${monthLabel} (% GPI)`,
          null,
          { derived: true },
        )
        output.dataset.gpiCalc = "percent"
        output.dataset.month = String(monthIndex)
        output.title = "Calculado automaticamente: (Média Pré − Peso Seco) ÷ Peso Seco × 100"
        cell.append(output)
      } else if (rowDef.type === "imc") {
        const output = createInput(
          `mensal-gpi-imc-${monthKey}`,
          `Índice de massa corporal em ${monthLabel} (kg/m²)`,
          null,
          { derived: true },
        )
        output.dataset.gpiCalc = "imc"
        output.dataset.month = String(monthIndex)
        output.title = "Calculado a partir do peso pós médio e da altura"
        cell.append(output)
      }

      row.append(cell)
    })
    monthlyBody.append(row)
  }

  monthlyGroups.forEach((group) => {
    monthlyBody.append(createGroupRow(group.label, 13))
    group.rows.forEach((rowDefinition) => {
      if (group.type === "gpi") {
        renderGpiRow(rowDefinition)
        return
      }
      const { label, auto, exam } = typeof rowDefinition === "string" ? { label: rowDefinition } : rowDefinition
      const row = document.createElement("tr")
      const heading = document.createElement("th")
      heading.scope = "row"
      heading.textContent = label
      row.append(heading)
      months.forEach(([monthKey, monthLabel], monthIndex) => {
        const cell = document.createElement("td")
        const input = createInput(
          `mensal-${slug(label)}-${monthKey}`,
          `${label} em ${monthLabel}`,
          "data-monthly-lock",
          { derived: Boolean(auto || exam) },
        )
        if (auto || exam) {
          input.dataset.monthlyAuto = auto || `exam:${exam}`
          input.dataset.month = String(monthIndex)
          input.title = exam ? `Último resultado do mês na aba Exames (${exam})` : "Calculado a partir das Sessões de Diálise"
          if (auto === "calciumPhosphorus") input.title = "Cálcio × fósforo do mês (aba Exames)"
        }
        cell.append(input)
        row.append(cell)
      })
      monthlyBody.append(row)
    })
  })

  // Métricas com % de adequação e diagnóstico automáticos (tabela P50 por idade e sexo): CB, PCT e CMB.
  const referenceMetrics = new Set(Object.keys(calculations.ARM_REFERENCE_P50))
  // Linhas com % de adequação: CB, PCT e CMB (P50) e MAP (mediana de referência por sexo).
  const adequacyMetrics = new Set([...referenceMetrics, "adductorPollicisMm"])
  // Linhas com diagnóstico automático: as acima, as classificadas por ponto de corte (cintura, RCQ, coxa, pescoço,
  // panturrilha e DAS), o FPM (P5 por mão, sexo e idade) e a % de gordura. Nas demais o diagnóstico é registrado pelo profissional.
  const classifiedMetrics = new Set([
    ...adequacyMetrics,
    ...Object.keys(calculations.CUTOFF_CLASSIFICATIONS),
    ...Object.keys(calculations.HANDGRIP_METRICS),
    "bodyFatPercentage",
  ])
  // Colunas de cada semestre: valor, % de adequação, diagnóstico e observação.
  const SEMESTER_COLUMNS = 4

  function createAnthropometryCell(semester, columnIndex, content) {
    const cell = document.createElement("td")
    cell.className = `anthro-sem-${semester}${columnIndex === 0 ? " anthro-sem-start" : ""}`
    if (content) cell.append(content)
    return cell
  }

  anthropometryGroups.forEach((group) => {
    anthropometryBody.append(
      createGroupRow(group.label, 1 + 2 * SEMESTER_COLUMNS),
    )
    group.rows.forEach((rowDefinition) => {
      const definition =
        typeof rowDefinition === "string"
          ? { label: rowDefinition }
          : rowDefinition
      const { label } = definition
      const hasAdequacy = adequacyMetrics.has(definition.metric)
      const hasDiagnosis = classifiedMetrics.has(definition.metric)
      const row = document.createElement("tr")
      const heading = document.createElement("th")
      heading.scope = "row"
      heading.textContent = label
      row.append(heading)
      ;[1, 2].forEach((semester) => {
        const key = `antropometria-${slug(label)}-s${semester}`
        const semesterLabel = `${label}, ${semester}º semestre`

        // Valor medido (ou calculado).
        const value = createInput(
          `${key}-valor`,
          `Valor de ${semesterLabel}`,
          "data-anthropometry-lock",
          {
            metric: definition.metric,
            semester,
            derived: definition.derived,
          },
        )
        row.append(createAnthropometryCell(semester, 0, value))

        // % de adequação: só existe para CB, PCT, CMB e MAP (calculada). Nas demais linhas a célula fica vazia.
        let adequacy = null
        if (hasAdequacy) {
          adequacy = createInput(
            `${key}-adequacao`,
            `Porcentagem de adequação de ${semesterLabel}`,
            "data-anthropometry-lock",
            { derived: true },
          )
          adequacy.dataset.adequacyFor = definition.metric
          adequacy.dataset.semester = String(semester)
        }
        const adequacyCell = createAnthropometryCell(semester, 1, adequacy)
        if (!hasAdequacy) adequacyCell.classList.add("anthro-not-applicable")
        row.append(adequacyCell)

        // Diagnóstico: automático nas linhas classificadas (ver classifiedMetrics); nas demais é registrado pelo profissional.
        const diagnosisName = `${key}-diagnostico`
        const diagnosisLabel = `Diagnóstico de ${semesterLabel}`
        const diagnosis = hasDiagnosis
          ? createDiagnosisOutput(diagnosisName, diagnosisLabel)
          : createInput(diagnosisName, diagnosisLabel, "data-anthropometry-lock")
        if (hasDiagnosis) {
          diagnosis.dataset.diagnosisFor = definition.metric
          diagnosis.dataset.semester = String(semester)
        }
        row.append(createAnthropometryCell(semester, 2, diagnosis))

        // Observação: sempre do profissional.
        row.append(
          createAnthropometryCell(
            semester,
            3,
            createInput(
              `${key}-observacao`,
              `Observação de ${semesterLabel}`,
              "data-anthropometry-lock",
            ),
          ),
        )
      })
      anthropometryBody.append(row)
    })
  })

  function createPediatricInput({
    name,
    label,
    metric,
    quarter,
    derived = false,
    numeric = false,
    role = "measure",
  }) {
    const input = document.createElement("input")
    input.name = name
    input.setAttribute("aria-label", label)
    input.placeholder = "-"
    input.dataset.quarter = String(quarter)
    if (numeric) input.inputMode = "decimal"
    if (metric) input.dataset.pediatricMetric = metric
    if (role) input.dataset.pediatricRole = role

    if (role === "zscore") input.dataset.pediatricZscore = ""
    if (role === "percentile") input.dataset.pediatricPercentile = ""
    if (role === "classification") input.dataset.pediatricClassification = ""

    if (derived) {
      input.dataset.derivedOutput = ""
      input.readOnly = true
      input.setAttribute("aria-readonly", "true")
      input.title = "Calculado automaticamente"
    } else {
      input.disabled = true
      input.dataset.pediatricLock = ""
    }
    return input
  }

  function createPediatricDiagnosisBlock({
    type,
    title,
    name,
    id,
    placeholder,
    quarter,
    commonOptions,
  }) {
    const block = document.createElement("div")
    block.className = "pediatric-diagnosis-block"

    const label = document.createElement("label")
    label.className = "field-label"
    label.htmlFor = id
    label.textContent = title

    const textarea = document.createElement("textarea")
    textarea.className = "form-control pediatric-diagnosis-textarea"
    textarea.id = id
    textarea.name = name
    textarea.rows = 2
    textarea.placeholder = placeholder
    textarea.disabled = true
    textarea.dataset.pediatricLock = ""
    textarea.dataset.pediatricDiagnosisType = type
    textarea.dataset.quarter = String(quarter)

    const quickGroup = document.createElement("div")
    quickGroup.className = "pediatric-quick-fill"
    quickGroup.setAttribute("role", "group")
    quickGroup.setAttribute("aria-label", `Preenchimento rápido de ${title}`)

    const head = document.createElement("div")
    head.className = "pediatric-quick-head"

    const headLabel = document.createElement("span")
    headLabel.className = "pediatric-quick-title"
    headLabel.textContent = "Preenchimento rápido"

    const undoButton = document.createElement("button")
    undoButton.type = "button"
    undoButton.className = "btn btn-link btn-sm pediatric-quick-undo"
    undoButton.textContent = "Desfazer"
    undoButton.hidden = true
    undoButton.dataset.pediatricLock = ""
    undoButton.disabled = true

    head.append(headLabel, undoButton)

    const chipsList = document.createElement("div")
    chipsList.className = "pediatric-quick-chips"
    chipsList.dataset.chipsFor = `${type}-${quarter}`

    // Chip de sugestão automática baseado em percentis
    const suggestionChip = document.createElement("button")
    suggestionChip.type = "button"
    suggestionChip.className =
      "btn btn-sm btn-outline-primary pediatric-quick-chip pediatric-chip-suggested"
    suggestionChip.dataset.suggestionChip = ""
    suggestionChip.dataset.quarter = String(quarter)
    suggestionChip.dataset.type = type
    suggestionChip.hidden = true
    suggestionChip.dataset.pediatricLock = ""
    suggestionChip.disabled = true
    chipsList.append(suggestionChip)

    commonOptions.forEach((optionText) => {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "btn btn-sm btn-outline-secondary pediatric-quick-chip"
      chip.textContent = optionText
      chip.dataset.diagnosisOption = optionText
      chip.dataset.quarter = String(quarter)
      chip.dataset.type = type
      chip.setAttribute("aria-pressed", "false")
      chip.dataset.pediatricLock = ""
      chip.disabled = true
      chipsList.append(chip)
    })

    quickGroup.append(head, chipsList)
    block.append(label, textarea, quickGroup)

    let previousCustomText = null

    function syncChips() {
      const current = textarea.value.trim()
      chipsList
        .querySelectorAll("button[data-diagnosis-option]")
        .forEach((chip) => {
          chip.setAttribute(
            "aria-pressed",
            String(current !== "" && chip.dataset.diagnosisOption === current),
          )
        })
      if (suggestionChip.dataset.suggestedValue) {
        suggestionChip.setAttribute(
          "aria-pressed",
          String(
            current !== "" &&
              suggestionChip.dataset.suggestedValue === current,
          ),
        )
      }
    }

    textarea.addEventListener("input", () => {
      undoButton.hidden = true
      previousCustomText = null
      syncChips()
    })

    chipsList.addEventListener("click", (event) => {
      const chip = event.target.closest("button.pediatric-quick-chip")
      if (!chip || textarea.disabled) return
      const textToSet =
        chip.dataset.suggestedValue || chip.dataset.diagnosisOption
      if (!textToSet) return

      const current = textarea.value
      const isCustom =
        current.trim() !== "" &&
        !commonOptions.includes(current.trim()) &&
        current.trim() !== chip.dataset.suggestedValue

      if (isCustom) {
        previousCustomText = current
        undoButton.hidden = false
      }

      textarea.value = textToSet
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.focus()
      syncChips()
    })

    undoButton.addEventListener("click", () => {
      if (previousCustomText === null || textarea.disabled) return
      textarea.value = previousCustomText
      previousCustomText = null
      undoButton.hidden = true
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.focus()
      syncChips()
    })

    return block
  }

  function createPediatricQuarter(quarter) {
    const section = document.createElement("section")
    section.className = "pediatric-quarter-card"
    section.dataset.pediatricQuarter = String(quarter)
    section.setAttribute(
      "aria-labelledby",
      `pediatric-quarter-${quarter}-title`,
    )

    const header = document.createElement("header")
    header.className = "pediatric-quarter-header"
    const title = document.createElement("h4")
    title.id = `pediatric-quarter-${quarter}-title`
    title.textContent = `${quarter}º trimestre`
    const dateLabel = document.createElement("label")
    dateLabel.textContent = "Data"
    const dateInput = document.createElement("input")
    dateInput.className = "form-control form-control-sm"
    dateInput.name = `data-trimestre-${quarter}`
    dateInput.type = "date"
    dateInput.disabled = true
    dateInput.dataset.pediatricLock = ""
    dateLabel.append(dateInput)
    header.append(title, dateLabel)

    const table = document.createElement("table")
    table.className = "table table-sm pediatric-quarter-table"
    const caption = document.createElement("caption")
    caption.className = "visually-hidden"
    caption.textContent = `Indicadores antropométricos do ${quarter}º trimestre`
    const tableHead = document.createElement("thead")
    const headingRow = document.createElement("tr")
    ;["Indicador", "Medida", "Escore-Z", "Percentil", "Classificação"].forEach(
      (labelText) => {
        const heading = document.createElement("th")
        heading.scope = "col"
        heading.textContent = labelText
        headingRow.append(heading)
      },
    )
    tableHead.append(headingRow)

    const tableBody = document.createElement("tbody")
    pediatricAnthropometryRows.forEach((definition) => {
      const row = document.createElement("tr")
      const heading = document.createElement("th")
      heading.scope = "row"
      heading.textContent = definition.label
      row.append(heading)

      const key = `pediatrica-${slug(definition.label)}-t${quarter}`
      const measureCell = document.createElement("td")
      measureCell.append(
        createPediatricInput({
          name: `${key}-medida`,
          label: `Medida de ${definition.label}, ${quarter}º trimestre`,
          metric: definition.metric,
          quarter,
          derived: definition.derived,
          numeric: true,
          role: "measure",
        }),
      )
      const zScoreCell = document.createElement("td")
      zScoreCell.append(
        createPediatricInput({
          name: `${key}-escore-z`,
          label: `Escore-Z de ${definition.label}, ${quarter}º trimestre`,
          metric: definition.metric,
          quarter,
          numeric: true,
          role: "zscore",
        }),
      )
      const percentileCell = document.createElement("td")
      percentileCell.append(
        createPediatricInput({
          name: `${key}-percentil`,
          label: `Percentil de ${definition.label}, ${quarter}º trimestre`,
          metric: definition.metric,
          quarter,
          numeric: true,
          role: "percentile",
        }),
      )
      const classificationCell = document.createElement("td")
      classificationCell.append(
        createPediatricInput({
          name: `${key}-classificacao`,
          label: `Classificação de ${definition.label}, ${quarter}º trimestre`,
          metric: definition.metric,
          quarter,
          role: "classification",
        }),
      )
      row.append(measureCell, zScoreCell, percentileCell, classificationCell)
      tableBody.append(row)
    })
    table.append(caption, tableHead, tableBody)

    // 4. Diagnóstico Antropométrico posicionado imediatamente ANTES de Diagnóstico Nutricional
    const diagnosesContainer = document.createElement("div")
    diagnosesContainer.className = "pediatric-diagnoses-container"

    const anthroBlock = createPediatricDiagnosisBlock({
      type: "antropometrico",
      title: "Diagnóstico Antropométrico",
      name: `diagnostico-antropometrico-trimestre-${quarter}`,
      id: `diagnostico-antropometrico-trimestre-${quarter}`,
      placeholder:
        "Escreva o diagnóstico antropométrico ou use o preenchimento rápido abaixo",
      quarter,
      commonOptions: COMMON_PEDIATRIC_ANTHRO_DIAGNOSES,
    })

    const nutriBlock = createPediatricDiagnosisBlock({
      type: "nutricional",
      title: "Diagnóstico Nutricional",
      name: `diagnostico-pediatrico-trimestre-${quarter}`,
      id: `diagnostico-pediatrico-trimestre-${quarter}`,
      placeholder:
        "Escreva o diagnóstico nutricional ou use o preenchimento rápido abaixo",
      quarter,
      commonOptions: COMMON_PEDIATRIC_NUTRI_DIAGNOSES,
    })

    diagnosesContainer.append(anthroBlock, nutriBlock)
    section.append(header, table, diagnosesContainer)
    return section
  }

  if (pediatricQuarterGrid) {
    pediatricQuarterGrid.append(...[1, 2, 3, 4].map(createPediatricQuarter))
  }

  const misGrid = $("#mis-grid")
  MIS_ITEMS.forEach(([group, label, options], index) => {
    const number = index + 1
    const block = document.createElement("div")
    block.className = "field-block mis-item"
    const fieldLabel = document.createElement("label")
    fieldLabel.className = "field-label"
    fieldLabel.htmlFor = `mis-${number}`
    fieldLabel.textContent = `${number} - ${label}`
    const groupTag = document.createElement("span")
    groupTag.className = "mis-group"
    groupTag.textContent = group
    const select = document.createElement("select")
    select.className = "form-select"
    select.id = `mis-${number}`
    select.name = `mis-${number}`
    select.dataset.misItem = String(number)
    const empty = document.createElement("option")
    empty.value = ""
    empty.textContent = "Selecione"
    select.append(empty)
    options.forEach((text, score) => {
      const option = document.createElement("option")
      option.value = String(score)
      option.textContent = `${score} - ${text}`
      select.append(option)
    })
    const hint = document.createElement("div")
    hint.className = "form-text"
    hint.id = `mis-${number}-hint`
    block.append(groupTag, fieldLabel, select, hint)
    misGrid?.append(block)
  })

  const tabs = [...view.querySelectorAll('.nutrition-tabs [role="tab"]')]
  const panels = [...view.querySelectorAll(".nutrition-panel")]
  const printButton = $("#nt-print")
  const printSheet = document.querySelector("#nutrition-print-sheet")
  const editMonthly = $("#edit-monthly")
  const editAnthropometry = $("#edit-anthropometry")
  const editPediatricAnthropometry = $("#edit-pediatric-anthropometry")
  const form = $("#nutrition-form")
  // Sexo e data de nascimento usados nas fórmulas (vêm da aba Identificação).
  const referenceContext = { sex: "", birthDate: "" }
  let isPediatricMode = false

  function setText(selector, value) {
    const element = $(selector)
    if (element && value) element.textContent = value
  }

  function formatAge(birthDate, referenceDate = todayIso()) {
    const years = calculations.calculateAgeAtDate(birthDate, referenceDate)
    if (years === null) return ""
    const birth = new Date(`${birthDate}T00:00:00`)
    const reference = new Date(`${referenceDate}T00:00:00`)
    let months = (reference.getMonth() - birth.getMonth() + 12) % 12
    if (reference.getDate() < birth.getDate()) months = (months + 11) % 12
    const yearsLabel = `${years} ${years === 1 ? "ano" : "anos"}`
    return months ? `${yearsLabel}, ${months} ${months === 1 ? "mês" : "meses"}` : yearsLabel
  }

  // "dd/mm/aaaa" (campos de texto do Programa de Tratamento) → "aaaa-mm-dd".
  function brDateToIso(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : ""
  }

  function selectedText(selector) {
    const select = document.querySelector(selector)
    return select?.value ? select.selectedOptions[0]?.textContent.trim() || "" : ""
  }

  function setNutritionMode(pediatric) {
    isPediatricMode = pediatric
    const adultAnthropometry = $("#adult-anthropometry-card")
    const pediatricAnthropometry = $("#pediatric-anthropometry-card")
    const adultAsg = $("#adult-asg-card")
    const adultDiagnosis = $("#adult-diagnosis-card")
    const pediatricDiagnosis = $("#pediatric-diagnosis-card")

    if (adultAnthropometry) adultAnthropometry.hidden = pediatric
    if (pediatricAnthropometry) pediatricAnthropometry.hidden = !pediatric
    if (adultAsg) adultAsg.hidden = pediatric
    if (adultDiagnosis) adultDiagnosis.hidden = pediatric
    if (pediatricDiagnosis) pediatricDiagnosis.hidden = !pediatric

    setText(
      "#nutrition-form-description",
      pediatric
        ? "Ficha pediátrica de acompanhamento nutricional em hemodiálise, com avaliação antropométrica trimestral."
        : "Ficha de acompanhamento nutricional em hemodiálise: perfil, monitoramento mensal, antropometria e avaliação nutricional.",
    )
    // O aviso só aparece na ficha pediátrica (explica por que a ficha mudou).
    const notice = $(".nutrition-notice")
    if (notice) notice.hidden = !pediatric
    setText("#nutrition-notice-title", "Ficha pediátrica selecionada pela idade.")
    setText(
      "#nutrition-notice-copy",
      "Paciente com menos de 18 anos (0 a 215 meses). Curvas CDC/NCHS (2000) e Frisancho (1990) pelo método LMS ativas para avaliação pediátrica.",
    )
    setText(
      "#anthropometry-tab-label",
      pediatric ? "Antropometria pediátrica" : "Antropometria e BIA",
    )
    setText(
      "#diagnosis-tab-label",
      pediatric ? "Diagnóstico e Exames" : "ASG e Diagnóstico",
    )
  }

  // Lê o contexto do paciente nas outras abas do prontuário (mesma página). Usado no modo da ficha e na impressão.
  function readRecordContext() {
    const value = (selector) => document.querySelector(selector)?.value?.trim() || ""
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() || ""
    const activeAccess = window.HuNefroAcessosVasculares?.getData().access
      .filter((access) => access.status === "active")
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const scheduledDays = [...document.querySelectorAll('input[name="dias-hd"]:checked')]
      .map((input) => input.closest("label")?.textContent.trim())
      .filter(Boolean)

    return {
      identity: {
        name: value("#nome-completo") || text("#patient-name"),
        code: text("#patient-code"),
        birthDate: value("#data-nascimento"),
        sex: value("#sexo"),
        program: value("#programa-atual") || text("#patient-program"),
      },
      treatment: {
        dialysisStart: brDateToIso(value("#inicio-programa")),
        activeAccessType: activeAccess ? [activeAccess.type, activeAccess.loc].filter(Boolean).join(" - ") : "",
        room: selectedText("#sala"),
        shift: selectedText("#turno"),
        scheduledDays,
      },
      clinical: {
        baseDiagnosis: value("#dc-diag-base") || selectedText("#dc-etiologia"),
        diuresis: value("#dc-diurese"),
        smoking: selectedText("#dc-tabagismo"),
        alcoholUse: selectedText("#dc-etilismo"),
      },
    }
  }

  function applyPatientContext(context) {
    const identity = context?.identity || {}
    setNutritionMode(calculations.isPediatricPatient(identity.birthDate, todayIso()))
    referenceContext.sex = identity.sex || ""
    referenceContext.birthDate = identity.birthDate || ""
  }

  // ---------- Monitoramento mensal: valores vindos de Sessões de Diálise e Exames ----------
  const numberOf = (value) => calculations.parseNumeric(String(value ?? "").trim().split(/\s/)[0])
  const average = (values) => {
    const list = values.filter((value) => value !== null && Number.isFinite(value))
    return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null
  }

  // Altura (m) da antropometria mais recente ou, se vazia, de Dados Clínicos (cm).
  function latestHeightM() {
    const inputs = isPediatricMode
      ? [4, 3, 2, 1].map((quarter) => getPediatricMetricInput("heightM", quarter))
      : [2, 1].map((semester) => getMetricInput("heightM", semester))
    const own = inputs.map((input) => calculations.parseNumeric(input?.value)).find((value) => value !== null && value > 0)
    if (own) return own > 3 ? own / 100 : own
    const cm = calculations.parseNumeric(document.querySelector("#dc-altura")?.value)
    return cm ? cm / 100 : null
  }

  function recalculateMonthlyGpi(monthIndex) {
    const monthKey = months[monthIndex][0]
    const preInputs = [1, 2, 3].map((m) =>
      view.querySelector(`[name="mensal-gpi-pre-${m}-${monthKey}"]`)
    )
    const posInputs = [1, 2, 3].map((m) =>
      view.querySelector(`[name="mensal-gpi-pos-${m}-${monthKey}"]`)
    )
    const dryInput = view.querySelector(`[name="mensal-gpi-seco-${monthKey}"]`)
    const mediaPreOutput = view.querySelector(`[name="mensal-gpi-media-pre-${monthKey}"]`)
    const mediaPosOutput = view.querySelector(`[name="mensal-gpi-media-pos-${monthKey}"]`)
    const percentOutput = view.querySelector(`[name="mensal-gpi-percent-${monthKey}"]`)
    const imcOutput = view.querySelector(`[name="mensal-gpi-imc-${monthKey}"]`)

    const preValues = preInputs.map((input) => calculations.parseNumeric(input?.value)).filter((v) => v !== null)
    const posValues = posInputs.map((input) => calculations.parseNumeric(input?.value)).filter((v) => v !== null)
    const dryValue = calculations.parseNumeric(dryInput?.value)

    const mediaPre = calculations.calculateAverageWeight(preValues)
    const mediaPos = calculations.calculateAverageWeight(posValues)
    const gpiPercent = calculations.calculateGpiPercentage(mediaPre, dryValue)

    const height = latestHeightM()
    const weightForBmi = mediaPos ?? dryValue
    const bmi = weightForBmi && height ? calculations.calculateBmi(weightForBmi, height) : null

    if (mediaPreOutput) mediaPreOutput.value = mediaPre !== null ? formatCalculatedValue(mediaPre, 1) : ""
    if (mediaPosOutput) mediaPosOutput.value = mediaPos !== null ? formatCalculatedValue(mediaPos, 1) : ""
    if (percentOutput) percentOutput.value = gpiPercent !== null ? formatCalculatedValue(gpiPercent, 1) : ""
    if (imcOutput) imcOutput.value = bmi !== null ? formatCalculatedValue(bmi, 1) : ""
  }

  function recalculateAllMonthlyGpi() {
    months.forEach((_, index) => recalculateMonthlyGpi(index))
  }

  function monthlyAutoValues(year) {
    const sessions = (window.HuNefroSessoesDialise?.getData() || [])
      .filter((session) => session.state !== "em-andamento")
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""))
    const exams = window.HuNefroExames?.getData() || []
    return months.map((_, index) => {
      const prefix = `${year}-${String(index + 1).padStart(2, "0")}`
      const inMonth = sessions.filter((session) => session.date.startsWith(prefix))
      const exam = (name) => {
        const found = exams.filter((item) => item.name === name && item.date.startsWith(prefix)).sort((a, b) => b.date.localeCompare(a.date))[0]
        return found ? numberOf(found.result) : null
      }
      const calcium = exam("Cálcio"), phosphorus = exam("Fósforo")
      return {
        dryWeight: average(inMonth.map((session) => numberOf(session.dryWeight))),
        sessions: inMonth,
        calciumPhosphorus: calcium !== null && phosphorus !== null ? calcium * phosphorus : null,
        exam,
      }
    })
  }

  function fillMonthlyAuto() {
    const yearField = $("#ano-base")
    if (yearField && !yearField.value) yearField.value = String(new Date().getFullYear())
    const values = monthlyAutoValues(yearField?.value || new Date().getFullYear())
    view.querySelectorAll("[data-monthly-auto]").forEach((input) => {
      const month = values[Number(input.dataset.month)]
      const key = input.dataset.monthlyAuto
      const value = key.startsWith("exam:") ? month.exam(key.slice(5)) : month[key]
      input.value = value === null || value === undefined ? "" : formatCalculatedValue(value, key === "calciumPhosphorus" ? 0 : 1)
    })

    // Sugestão das sessões de diálise para o ganho de peso quando vazio
    months.forEach(([monthKey], monthIndex) => {
      const monthData = values[monthIndex]
      const dryInput = view.querySelector(`[name="mensal-gpi-seco-${monthKey}"]`)
      if (dryInput && !dryInput.value.trim() && monthData.dryWeight !== null) {
        dryInput.value = formatCalculatedValue(monthData.dryWeight, 1)
      }
      const sessions = monthData.sessions || []
      ;[1, 2, 3].forEach((m, sIndex) => {
        const preInput = view.querySelector(`[name="mensal-gpi-pre-${m}-${monthKey}"]`)
        const posInput = view.querySelector(`[name="mensal-gpi-pos-${m}-${monthKey}"]`)
        if (sessions[sIndex]) {
          const sPre = numberOf(sessions[sIndex].weightStart)
          const sPos = numberOf(sessions[sIndex].weightEnd)
          if (preInput && !preInput.value.trim() && sPre !== null) {
            preInput.value = formatCalculatedValue(sPre, 1)
          }
          if (posInput && !posInput.value.trim() && sPos !== null) {
            posInput.value = formatCalculatedValue(sPos, 1)
          }
        }
      })
    })

    recalculateAllMonthlyGpi()
  }

  function renderExamSummary() {
    const box = $("#nt-exams-summary")
    if (!box) return
    box.replaceChildren(...REFERENCE_EXAMS.map((name) => {
      const exam = window.HuNefroExames?.latest(name)
      const item = document.createElement("div")
      const term = printElement("dt", "", name)
      const detail = printElement("dd", exam ? "" : "is-empty", exam ? exam.result : "Sem registro")
      if (exam) detail.append(printElement("small", "", formatDate(exam.date)))
      item.append(term, detail)
      return item
    }))
  }

  function syncFromRecord() {
    applyPatientContext(readRecordContext())
    recalculateAllAnthropometry()
    fillMonthlyAuto()
    renderExamSummary()
    updateMis()
    updateCceb()
  }

  // ---------- CCEB (Critério Brasil ABEP 2024): pontos por item, total e classe ----------
  const ccebFieldset = $("#cceb-fieldset")
  const formatCurrency = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  function readCceb() {
    const items = {}
    calculations.CCEB_ITEMS.forEach(({ key }) => {
      items[key] = form.querySelector(`[name="cceb-${key}"]`)?.value.trim() ?? ""
    })
    return calculations.calculateCceb({
      items,
      education: $("#escolaridade-chefe")?.value || "",
      aguaEncanada: Boolean(form.querySelector('[name="agua-encanada"]')?.checked),
      ruaPavimentada: Boolean(form.querySelector('[name="rua-pavimentada"]')?.checked),
    })
  }

  function updateCceb() {
    if (!ccebFieldset) return null
    calculations.CCEB_ITEMS.forEach(({ key }) => {
      const input = form.querySelector(`[name="cceb-${key}"]`)
      const points = calculations.ccebItemPoints(key, input?.value.trim())
      const output = form.querySelector(`[data-cceb-points="${key}"]`)
      if (output) output.textContent = points === null ? "" : `${points} pt${points === 1 ? "" : "s"}`
    })
    const result = readCceb()
    const resultOutput = $("#cceb-result")
    const detail = $("#cceb-result-detail")
    const classification = result.classification
    if (resultOutput) {
      resultOutput.textContent = classification
        ? `CCEB: ${result.points} pontos - Classe ${classification.code}`
        : `CCEB: falta${result.missing.length === 1 ? "" : "m"} ${result.missing.length} ${result.missing.length === 1 ? "item" : "itens"}`
      resultOutput.classList.toggle("is-complete", Boolean(classification))
      resultOutput.title = classification ? "" : `Sem resposta: ${result.missing.join(", ")}`
    }
    if (detail) {
      detail.textContent = classification
        ? `Faixa da classe ${classification.code}: ${classification.min} a ${classification.max} pontos. Renda média domiciliar estimada do estrato (ABEP, PNADC 2023): ${formatCurrency(classification.income)}.`
        : `Sem resposta: ${result.missing.join(", ")}.`
    }
    const pointsField = $("#cceb-pontos")
    const classField = $("#cceb-classe")
    if (pointsField) pointsField.value = classification ? String(result.points) : ""
    if (classField) classField.value = classification ? classification.code : ""
    return result
  }

  // Fichas antigas tinham a escolaridade do chefe em texto livre: converte o que é inequívoco e mostra o texto antigo no resto.
  function legacyEducationLevel(text) {
    const value = slug(text)
    if (!value) return ""
    if (/superior-completo|graduad|pos-graduac/.test(value)) return "superior-completo"
    if (/superior-incompleto|medio-completo|colegial-completo/.test(value)) return "medio-completo"
    if (/medio-incompleto|fundamental-ii-completo|fundamental-2-completo|ginasio-completo|colegial-incompleto/.test(value) || value === "ensino-fundamental-completo" || value === "fundamental-completo") return "fundamental-2-completo"
    if (/fundamental-i-completo|fundamental-1-completo|fundamental-ii-incompleto|fundamental-2-incompleto|primario-completo|ginasio-incompleto/.test(value)) return "fundamental-1-completo"
    if (/analfabet|fundamental-i-incompleto|fundamental-1-incompleto|primario-incompleto|sem-escolaridade/.test(value)) return "analfabeto-fundamental-1-incompleto"
    return ""
  }

  function applyLegacyEducation(raw) {
    const select = $("#escolaridade-chefe")
    const hint = $("#escolaridade-chefe-legacy")
    if (!select) return
    if (hint) hint.hidden = true
    if (!raw || select.value) return
    const level = legacyEducationLevel(raw)
    if (level) {
      select.value = level
      return
    }
    if (hint) {
      hint.textContent = `Registro anterior: "${raw}". Selecione o nível correspondente.`
      hint.hidden = false
    }
  }

  ccebFieldset?.addEventListener("input", updateCceb)
  ccebFieldset?.addEventListener("change", updateCceb)
  $("#escolaridade-chefe")?.addEventListener("change", () => {
    const hint = $("#escolaridade-chefe-legacy")
    if (hint) hint.hidden = true
    updateCceb()
  })

  function ccebPrintLabel() {
    const result = readCceb()
    if (!result.classification) return `Incompleto (falta${result.missing.length === 1 ? "" : "m"} ${result.missing.length} ${result.missing.length === 1 ? "item" : "itens"})`
    return `Classe ${result.classification.code} - ${result.points} pontos`
  }

  function printElement(tagName, className, text) {
    const element = document.createElement(tagName)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }

  function fieldValue(selector, empty = "-") {
    const field = $(selector)
    const value = field?.value?.trim()
    return value || empty
  }

  function namedFieldValue(name, empty = "-") {
    return fieldValue(`[name="${name}"]`, empty)
  }

  function namedDateValue(name, empty = "-") {
    const value = namedFieldValue(name, "")
    return value ? formatDate(value) : empty
  }

  function checkboxLabel(name) {
    const field = $(`[name="${name}"]`)
    return field?.checked ? "Sim" : "Não"
  }

  function appendDataGrid(parent, title, items, columns = 4) {
    const section = printElement("section", "print-section")
    section.append(printElement("h2", "", title))
    const list = printElement(
      "dl",
      `print-data-grid print-data-grid-${columns}`,
    )
    items.forEach(([label, value]) => {
      const item = printElement("div", "print-data-item")
      item.append(
        printElement("dt", "", label),
        printElement("dd", "", value || "-"),
      )
      list.append(item)
    })
    section.append(list)
    parent.append(section)
  }

  function printableTable(source, className) {
    const table = source.cloneNode(true)
    table.removeAttribute("id")
    table.className = className
    table.querySelectorAll("[id]").forEach((element) => {
      element.removeAttribute("id")
    })
    table.querySelectorAll("input, select, textarea").forEach((control) => {
      const isDual = Boolean(control.closest(".nutrition-dual-input"))
      let value = control.value?.trim() || (isDual ? "" : "-")
      if (control.type === "checkbox" || control.type === "radio") {
        value = control.checked ? "Sim" : "Não"
      } else if (control.type === "date" && control.value) {
        value = formatDate(control.value)
      }
      control.replaceWith(printElement("span", "", value))
    })
    return table
  }

  function appendTableSection(
    parent,
    title,
    sourceSelector,
    tableClass,
    { pageBreak = false } = {},
  ) {
    const source = $(sourceSelector)
    if (!source) return
    const section = printElement(
      "section",
      `print-section print-section-flow${pageBreak ? " print-page-break" : ""}`,
    )
    section.append(printElement("h2", "", title))
    const wrap = printElement("div", "print-table-wrap")
    wrap.append(printableTable(source, tableClass))
    section.append(wrap)
    parent.append(section)
  }

  // Logos da impressão: criadas e carregadas uma vez, quando a página abre, e reaproveitadas a cada ficha.
  // A folha de impressão fica oculta na tela, e Firefox e Safari não baixam imagens de elementos ocultos
  // (nem dá tempo de baixá-las entre o clique e a janela de impressão); por isso elas já ficam prontas na memória.
  function createLogo(src, alt, className = "print-institution-logo") {
    const image = new Image()
    image.className = className
    image.alt = alt
    image.decoding = "sync"
    image.src = src
    return image
  }
  const printLogos = {
    huBrasil: createLogo("assets/impressao/logo-hu-brasil.png", "HU Brasil - Hospitais Universitários Federais", "print-institution-logo print-logo-hubrasil"),
    hu: createLogo("assets/impressao/logo-hu.png", "Hospital Universitário"),
    ufma: createLogo("assets/impressao/logo-ufma.png", "Universidade Federal do Maranhão"),
  }

  // Resolve quando todas as imagens da folha estão baixadas e decodificadas (ou falharam), com limite de tempo.
  function whenImagesReady(root, timeoutMs = 4000) {
    const images = [...(root?.querySelectorAll("img") || [])]
    const ready = images.map((image) => {
      const loaded = image.complete
        ? Promise.resolve()
        : new Promise((done) => {
            image.addEventListener("load", done, { once: true })
            image.addEventListener("error", done, { once: true })
          })
      return loaded.then(() => (image.naturalWidth && image.decode ? image.decode().catch(() => {}) : undefined))
    })
    const timeout = new Promise((done) => setTimeout(done, timeoutMs))
    return Promise.race([Promise.all(ready), timeout])
  }

  function createPrintHeader() {
    const header = printElement("header", "print-document-header")
    const logos = printElement("div", "print-logo-row")
    const huBrasil = printLogos.huBrasil

    const institution = printElement("div", "print-institution-lines")
    // Mesmos dados da unidade das outras impressões (a página Gestão pode alterá-los).
    const inst = window.HuNefroCatalogos?.INSTITUICAO || {}
    institution.append(
      printElement("strong", "", "HOSPITAL UNIVERSITÁRIO DA UNIVERSIDADE FEDERAL DO MARANHÃO"),
      printElement("span", "", inst.unidade || ""),
      printElement("span", "", `${inst.endereco || ""} · ${inst.cidade || ""} - ${inst.uf || ""} · CEP ${inst.cep || ""}`),
      printElement("span", "", `Tel. ${inst.telefone || ""}`),
      printElement("span", "", [inst.cnes && `CNES ${inst.cnes}`, inst.cnpj && `CNPJ ${inst.cnpj}`].filter(Boolean).join(" · ")),
    )

    const secondaryLogos = printElement("div", "print-secondary-logos")
    secondaryLogos.append(printLogos.hu, printLogos.ufma)
    logos.append(huBrasil, institution, secondaryLogos)

    const title = printElement("div", "print-document-title")
    title.append(
      printElement(
        "strong",
        "",
        isPediatricMode
          ? "Acompanhamento Nutricional Pediátrico em Hemodiálise"
          : "Acompanhamento Nutricional de Pacientes em Hemodiálise",
      ),
      printElement(
        "span",
        "",
        "Hospital Universitário da Universidade Federal do Maranhão · Unidade Renal · Nutrição Clínica",
      ),
    )

    const metadata = printElement("dl", "print-document-meta")
    ;[
      ["Tipo", "Formulário"],
      ["Código", "FOR.GAS.1197"],
      ["Emissão", "20/07/2022"],
      ["Versão", "02"],
    ].forEach(([label, value]) => {
      const item = printElement("div")
      item.append(printElement("dt", "", label), printElement("dd", "", value))
      metadata.append(item)
    })
    header.append(logos, title, metadata)
    return header
  }

  function appendPediatricPrintEvaluations(parent) {
    // Organiza os quatro trimestres em uma única linha na impressão A4 paisagem,
    // permitindo comparar simultaneamente os períodos sem alterar a tela de edição.
    const quarterGrid = printElement("div", "print-pediatric-quarter-grid")
    ;[1, 2, 3, 4].forEach((quarter) => {
      const card = printElement("section", "print-pediatric-quarter-card")
      card.append(printElement("h2", "", `${quarter}º trimestre`))

      const summary = printElement("dl", "print-pediatric-quarter-summary")
      ;[
        ["Data", namedDateValue(`data-trimestre-${quarter}`)],
        ["Diagnóstico antropométrico", namedFieldValue(`diagnostico-antropometrico-trimestre-${quarter}`)],
        ["Diagnóstico nutricional", namedFieldValue(`diagnostico-pediatrico-trimestre-${quarter}`)],
      ].forEach(([label, value]) => {
        const item = printElement("div")
        item.append(printElement("dt", "", label), printElement("dd", "", value))
        summary.append(item)
      })
      card.append(summary)

      const source = $(`[data-pediatric-quarter="${quarter}"] .pediatric-quarter-table`)
      if (source) {
        const wrap = printElement("div", "print-table-wrap")
        wrap.append(printableTable(source, "print-pediatric-quarter-table"))
        card.append(wrap)
      }
      quarterGrid.append(card)
    })
    parent.append(quarterGrid)
  }

  function buildPrintSheet() {
    if (!printSheet) return
    printSheet.replaceChildren(createPrintHeader())

    const { identity, treatment, clinical } = readRecordContext()
    appendDataGrid(printSheet, "Identificação e programa de tratamento", [
      ["Nome", identity.name],
      ["Prontuário", identity.code],
      ["Data de nascimento", identity.birthDate ? formatDate(identity.birthDate) : ""],
      ["Idade", formatAge(identity.birthDate)],
      ["Sexo", selectedText("#sexo")],
      ["Programa atual", identity.program],
      ["Sala", treatment.room],
      ["Turno", treatment.shift],
      ["Dias de HD", treatment.scheduledDays.join(", ")],
      ["Início da diálise", treatment.dialysisStart ? formatDate(treatment.dialysisStart) : ""],
      ["Tipo de acesso", treatment.activeAccessType],
      ["Diagnóstico de base", clinical.baseDiagnosis],
    ])

    appendDataGrid(printSheet, "Dados demográficos, econômicos e sociais", [
      ["Cor / raça", selectedText("#cor-raca")],
      ["Escolaridade do paciente", fieldValue("#escolaridade-paciente")],
      ["Grau de instrução do chefe da família", selectedText("#escolaridade-chefe") || "-"],
      ["Moradores no domicílio", fieldValue("#moradores")],
      ["Renda familiar", fieldValue("#renda-familiar")],
      ["Água encanada", checkboxLabel("agua-encanada")],
      ["Rua pavimentada", checkboxLabel("rua-pavimentada")],
      ["Classificação CCEB (ABEP 2024)", ccebPrintLabel()],
    ])

    const ccebItems = [
      ["Banheiro", "cceb-banheiro"],
      ["Empregado doméstico", "cceb-empregado"],
      ["Automóvel", "cceb-automovel"],
      ["Computador", "cceb-computador"],
      ["Lava-louças", "cceb-lava-loucas"],
      ["Geladeira", "cceb-geladeira"],
      ["Freezer", "cceb-freezer"],
      ["Máquina de lavar roupa", "cceb-lava-roupa"],
      ["DVD", "cceb-dvd"],
      ["Micro-ondas", "cceb-microondas"],
      ["Moto", "cceb-moto"],
      ["Secadora de roupa", "cceb-secadora"],
    ].map(([label, name]) => {
      const quantity = namedFieldValue(name)
      const points = calculations.ccebItemPoints(name.replace(/^cceb-/, ""), quantity === "-" ? "" : quantity)
      return [label, points === null ? quantity : `${quantity} (${points} pt${points === 1 ? "" : "s"})`]
    })
    appendDataGrid(
      printSheet,
      "Critério de Classificação Econômica Brasil (quantidades e pontos)",
      ccebItems,
    )

    appendDataGrid(printSheet, "Histórico clínico e hábitos de vida", [
      ["Diurese (Dados Clínicos)", clinical.diuresis],
      ["Hipertensão arterial sistêmica", checkboxLabel("has")],
      ["Diabetes mellitus tipo 1", checkboxLabel("dm1")],
      ["Diabetes mellitus tipo 2", checkboxLabel("dm2")],
      ["Dislipidemias", checkboxLabel("dislipidemias")],
      ["Tabagismo (Dados Clínicos)", clinical.smoking],
      ["Etilismo (Dados Clínicos)", clinical.alcoholUse],
      ["Pratica atividade física", checkboxLabel("atividade-fisica")],
    ])

    appendTableSection(
      printSheet,
      "Monitoramento mensal e exames de rotina",
      ".nutrition-monthly-table",
      "print-monthly-table",
    )
    if (isPediatricMode) {
      appendPediatricPrintEvaluations(printSheet)
    } else {
      appendTableSection(
        printSheet,
        "Avaliação antropométrica e composição corporal",
        ".anthropometry-table",
        "print-anthropometry-table",
      )
    }
    appendDataGrid(
      printSheet,
      "Exames de referência (último resultado na aba Exames)",
      REFERENCE_EXAMS.map((name) => {
        const exam = window.HuNefroExames?.latest(name)
        return [name, exam ? `${exam.result} (${formatDate(exam.date)})` : "-"]
      }),
      3,
    )

    if (!isPediatricMode) {
      appendDataGrid(
        printSheet,
        "Avaliação Subjetiva Global (ASG / MIS)",
        [
          ["Consumo energético", fieldValue("#consumo-energetico")],
          ["Perda de peso (%)", namedFieldValue("perda-peso-percentual")],
          ["Tempo de perda", namedFieldValue("perda-peso-tempo")],
          ["Gordura corporal", fieldValue("#gordura-corporal")],
          ["Massa muscular", fieldValue("#massa-muscular")],
          ["Edema ou ascite", fieldValue("#edema")],
          ["Redução da força", fieldValue("#reducao-forca")],
          ["Resultado ASG", $("#asg-resultado")?.value ? $("#asg-resultado").selectedOptions[0].textContent : "-"],
          ["Score MIS", misSummary()],
        ],
        3,
      )
      appendDataGrid(
        printSheet,
        "Escore de Desnutrição e Inflamação (MIS)",
        MIS_ITEMS.map(([, label], index) => {
          const select = $(`#mis-${index + 1}`)
          return [`${index + 1} - ${label}`, select?.value ? select.selectedOptions[0].textContent : "-"]
        }),
        2,
      )

      const diagnosisSection = printElement("section", "print-section")
      diagnosisSection.append(
        printElement("h2", "", "Diagnóstico nutricional final"),
      )
      diagnosisSection.append(
        printElement("p", "print-diagnosis-text", fieldValue('[name="diagnostico-final"]')),
      )
      printSheet.append(diagnosisSection)
    }

    const signatures = printElement("div", "print-signatures")
    signatures.append(
      printElement("div", "print-signature", "Nutricionista responsável · CRN"),
      printElement("div", "print-signature", "Data e assinatura"),
    )
    printSheet.append(signatures)

    const footer = printElement("footer", "print-document-footer")
    footer.append(
      printElement(
        "span",
        "",
        "Hu-Nefro · Ficha de acompanhamento nutricional",
      ),
      printElement(
        "span",
        "",
        `Impresso em ${new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date())}`,
      ),
    )
    printSheet.append(footer)
  }

  function getMetricInput(metric, semester) {
    return anthropometryBody.querySelector(
      `[data-metric="${metric}"][data-semester="${semester}"]`,
    )
  }

  function formatCalculatedValue(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : ""
  }

  function updateDerivedMetric(metric, semester, value, digits) {
    const output = getMetricInput(metric, semester)
    if (!output) return
    output.value = value === null ? "" : formatCalculatedValue(value, digits)
  }

  function getEvaluationContext(semester) {
    // Sem data da avaliação, usa a data de hoje para a idade da fórmula.
    const evaluationDate =
      $(`[name="data-semestre-${semester}"]`)?.value || todayIso()

    return {
      sex: referenceContext.sex,
      ageYears: calculations.calculateAgeAtDate(
        referenceContext.birthDate,
        evaluationDate,
      ),
    }
  }

  const positiveValue = (raw) => {
    const number = calculations.parseNumeric(raw)
    return number !== null && number > 0 ? number : null
  }
  const nonNegativeValue = (raw) => {
    const number = calculations.parseNumeric(raw)
    return number !== null && number >= 0 ? number : null
  }
  const HANDGRIP_HAND_LABELS = { dominant: "dominante", nonDominant: "não dominante" }

  const REFERENCE_NAMES = {
    armCircumferenceCm: { short: "CB", unit: "cm" },
    tricepsSkinfoldMm: { short: "PCT", unit: "mm" },
    armMuscleCircumferenceCm: { short: "CMB", unit: "cm" },
  }
  // Unidade e casas decimais com que o ponto de corte aparece na dica do diagnóstico.
  const CUTOFF_DISPLAY = {
    waistCm: { unit: " cm", digits: 0 },
    waistHipRatio: { unit: "", digits: 2 },
    thighCm: { unit: " cm", digits: 0 },
    neckCm: { unit: " cm", digits: 0 },
    calfCm: { unit: " cm", digits: 0 },
    sagittalAbdominalDiameterCm: { unit: " cm", digits: 1 },
  }
  // Motivos pelos quais a adequação não pôde ser calculada, por semestre (alimenta o aviso abaixo da tabela).
  const referenceIssues = { 1: [], 2: [] }

  function describeReferenceRange({ minAge, maxAge }) {
    if (maxAge === Number.POSITIVE_INFINITY) return `${minAge} anos ou mais`
    return minAge === maxAge ? `${minAge} anos` : `${minAge} a ${maxAge} anos`
  }

  function setReferenceOutputs(metric, semester, { percent, diagnosis, title, diagnosisTitle, placeholder }) {
    const query = (attribute) =>
      anthropometryBody.querySelector(`[${attribute}="${metric}"][data-semester="${semester}"]`)
    const percentOutput = query("data-adequacy-for")
    const diagnosisOutput = query("data-diagnosis-for")
    if (percentOutput) {
      percentOutput.value = percent ?? ""
      percentOutput.title = title || "Calculado automaticamente"
    }
    if (diagnosisOutput) {
      diagnosisOutput.value = diagnosis ?? ""
      diagnosisOutput.placeholder = placeholder || "-"
      diagnosisOutput.title = diagnosis ? diagnosisTitle || "Calculado a partir da % de adequação" : "Calculado automaticamente"
    }
  }

  // % de adequação e diagnóstico de CB, PCT e CMB pela tabela P50 (idade na data da avaliação e sexo).
  function updateArmReferences(semester, context, measuredByMetric) {
    const issues = []
    const sexKey = calculations.normalizeReferenceSex(context.sex)

    referenceMetrics.forEach((metric) => {
      const measured = measuredByMetric[metric]
      if (measured === null || measured === undefined) {
        setReferenceOutputs(metric, semester, {})
        return
      }

      const range = calculations.getArmReferenceRow(metric, context.ageYears)
      const p50 = calculations.getArmReferenceP50(metric, context.ageYears, context.sex)
      if (p50 === null) {
        const { short } = REFERENCE_NAMES[metric]
        if (sexKey === null) issues.push("sex")
        if (context.ageYears === null) issues.push("birth")
        else if (sexKey !== null && !range) {
          const table = calculations.ARM_REFERENCE_P50[metric]
          issues.push(
            `${semester}º semestre: a tabela de ${short} cobre ${table[0].minAge} a ${table.at(-1).maxAge} anos; não há referência para ${context.ageYears} anos.`,
          )
        }
        setReferenceOutputs(metric, semester, { placeholder: "Sem referência" })
        return
      }

      const percent = calculations.calculateAdequacy(measured, p50)
      const { unit } = REFERENCE_NAMES[metric]
      setReferenceOutputs(metric, semester, {
        percent: formatCalculatedValue(percent, 1),
        diagnosis: calculations.classifyArmAdequacy(percent, metric),
        title: `Referência P50: ${formatCalculatedValue(p50, 1)} ${unit} (${sexKey === "male" ? "homens" : "mulheres"} de ${describeReferenceRange(range)})`,
      })
    })

    return issues
  }

  // Diagnóstico automático das demais linhas: MAP (% da mediana por sexo), cintura, RCQ, coxa, pescoço, panturrilha e DAS
  // (pontos de corte) e % de gordura (faixas por sexo e idade). Devolve os motivos de não ter calculado, como updateArmReferences.
  function updateMeasurementClassifications(semester, context, measuredByMetric) {
    const issues = []
    const sexKey = calculations.normalizeReferenceSex(context.sex)
    const sexLabel = sexKey === "male" ? "homens" : "mulheres"
    const withoutReference = (metric) =>
      setReferenceOutputs(metric, semester, { placeholder: "Sem referência" })
    const isEmpty = (measured) => measured === null || measured === undefined

    const map = measuredByMetric.adductorPollicisMm
    if (isEmpty(map)) {
      setReferenceOutputs("adductorPollicisMm", semester, {})
    } else if (sexKey === null) {
      issues.push("sex")
      withoutReference("adductorPollicisMm")
    } else {
      const reference = calculations.getAdductorPollicisReference(context.sex)
      const percent = calculations.calculateAdequacy(map, reference)
      setReferenceOutputs("adductorPollicisMm", semester, {
        percent: formatCalculatedValue(percent, 1),
        diagnosis: calculations.classifyAdductorPollicisAdequacy(percent),
        title: `Mediana de referência: ${formatCalculatedValue(reference, 0)} mm (${sexLabel})`,
      })
    }

    Object.entries(calculations.CUTOFF_CLASSIFICATIONS).forEach(([metric, rule]) => {
      const measured = measuredByMetric[metric]
      if (isEmpty(measured)) {
        setReferenceOutputs(metric, semester, {})
        return
      }
      const cutoff = calculations.getCutoff(metric, context.sex)
      if (cutoff === null) {
        issues.push("sex")
        withoutReference(metric)
        return
      }
      const { unit, digits } = CUTOFF_DISPLAY[metric]
      const comparison = rule.riskWhen === "lt" ? "<" : "≥"
      const audience = typeof rule.cutoff === "number" ? "homens e mulheres" : sexLabel
      setReferenceOutputs(metric, semester, {
        diagnosis: calculations.classifyByCutoff(metric, measured, context.sex),
        diagnosisTitle: `Ponto de corte: ${comparison} ${formatCalculatedValue(cutoff, digits)}${unit} (${audience})`,
      })
    })

    Object.entries(calculations.HANDGRIP_METRICS).forEach(([metric, hand]) => {
      const measured = measuredByMetric[metric]
      if (isEmpty(measured)) {
        setReferenceOutputs(metric, semester, {})
        return
      }
      if (sexKey === null || context.ageYears === null) {
        if (sexKey === null) issues.push("sex")
        if (context.ageYears === null) issues.push("birth")
        withoutReference(metric)
        return
      }
      const range = calculations.getHandgripReferenceRow(hand, context.ageYears)
      const p5 = calculations.getHandgripP5(hand, context.ageYears, context.sex)
      if (p5 === null) {
        const table = calculations.HANDGRIP_P5_KG[hand]
        const covered = describeReferenceRange({ minAge: table[0].minAge, maxAge: table.at(-1).maxAge })
        issues.push(
          `${semester}º semestre: a tabela de FPM da mão ${HANDGRIP_HAND_LABELS[hand]} cobre ${covered}; não há referência para ${context.ageYears} anos.`,
        )
        withoutReference(metric)
        return
      }
      setReferenceOutputs(metric, semester, {
        diagnosis: calculations.classifyHandgrip(measured, hand, context.ageYears, context.sex),
        diagnosisTitle: `Referência P5: ${formatCalculatedValue(p5, 0)} kg (${sexLabel} de ${describeReferenceRange(range)}, mão ${HANDGRIP_HAND_LABELS[hand]})`,
      })
    })

    const bodyFat = measuredByMetric.bodyFatPercentage
    if (isEmpty(bodyFat)) {
      setReferenceOutputs("bodyFatPercentage", semester, {})
    } else if (sexKey === null || context.ageYears === null) {
      if (sexKey === null) issues.push("sex")
      if (context.ageYears === null) issues.push("birth")
      withoutReference("bodyFatPercentage")
    } else {
      const band = calculations.getBodyFatReferenceBand(context.ageYears, context.sex)
      if (!band) {
        const { min, max } = calculations.BODY_FAT_AGE_LIMITS
        issues.push(
          `${semester}º semestre: a classificação da % de gordura cobre ${min} a ${max} anos; não há referência para ${context.ageYears} anos.`,
        )
        withoutReference("bodyFatPercentage")
      } else {
        setReferenceOutputs("bodyFatPercentage", semester, {
          diagnosis: calculations.classifyBodyFat(bodyFat, context.ageYears, context.sex),
          diagnosisTitle: `Faixas adaptadas de Gallagher et al. (2000): ${sexLabel} de ${band.minAge} a ${band.maxAge} anos`,
        })
      }
    }

    return issues
  }

  function renderReferenceStatus() {
    const status = $("#anthropometry-reference-status")
    if (!status) return
    const issues = new Set(Object.values(referenceIssues).flat())
    const missingSex = issues.delete("sex")
    const missingBirth = issues.delete("birth")
    const messages = []
    const purpose = "para calcular a adequação e os diagnósticos da antropometria."

    if (missingSex && missingBirth) {
      messages.push(`Informe o sexo e a data de nascimento na aba Identificação ${purpose}`)
    } else if (missingSex) {
      messages.push(`Informe o sexo na aba Identificação ${purpose}`)
    } else if (missingBirth) {
      messages.push(`Informe a data de nascimento na aba Identificação (e confira a data da avaliação) ${purpose}`)
    }
    messages.push(...issues)

    status.textContent = messages.join(" ")
    status.hidden = messages.length === 0
  }

  function recalculateAnthropometry(semester) {
    const value = (metric) => getMetricInput(metric, semester)?.value ?? ""

    updateDerivedMetric(
      "bmi",
      semester,
      calculations.calculateBmi(value("weightKg"), value("heightM")),
      2,
    )
    // A adequação usa a CMB sem arredondar (o campo mostra 2 casas).
    const armMuscle = calculations.calculateArmMuscleCircumference(
      value("armCircumferenceCm"),
      value("tricepsSkinfoldMm"),
    )
    updateDerivedMetric("armMuscleCircumferenceCm", semester, armMuscle, 2)
    const waistHipRatio = calculations.calculateWaistHipRatio(
      value("waistCm"),
      value("hipCm"),
    )
    updateDerivedMetric("waistHipRatio", semester, waistHipRatio, 2)

    const context = getEvaluationContext(semester)
    const bodyFat = calculations.calculateFourSkinfoldBodyFat({
      tricepsMm: value("tricepsSkinfoldMm"),
      subscapularMm: value("subscapularSkinfoldMm"),
      bicepsMm: value("bicepsSkinfoldMm"),
      suprailiacMm: value("suprailiacSkinfoldMm"),
      ageYears: context.ageYears,
      sex: context.sex,
    })
    updateDerivedMetric(
      "bodyFatPercentage",
      semester,
      bodyFat?.bodyFatPercentage ?? null,
      2,
    )

    const issues = updateArmReferences(semester, context, {
      armCircumferenceCm: positiveValue(value("armCircumferenceCm")),
      tricepsSkinfoldMm: positiveValue(value("tricepsSkinfoldMm")),
      armMuscleCircumferenceCm: armMuscle,
    })

    // Valores sem arredondar (RCQ e % de gordura) vêm do cálculo; os medidos, do campo.
    const measuredByMetric = {
      adductorPollicisMm: positiveValue(value("adductorPollicisMm")),
      waistHipRatio,
      bodyFatPercentage: bodyFat?.bodyFatPercentage ?? null,
    }
    Object.keys(calculations.CUTOFF_CLASSIFICATIONS).forEach((metric) => {
      if (!(metric in measuredByMetric)) {
        measuredByMetric[metric] = positiveValue(value(metric))
      }
    })
    // FPM aceita 0 kg.
    Object.keys(calculations.HANDGRIP_METRICS).forEach((metric) => {
      measuredByMetric[metric] = nonNegativeValue(value(metric))
    })
    issues.push(
      ...updateMeasurementClassifications(semester, context, measuredByMetric),
    )

    referenceIssues[semester] = issues
    renderReferenceStatus()
  }

  function recalculateAllAnthropometry() {
    recalculateAnthropometry(1)
    recalculateAnthropometry(2)
  }

  function getPediatricField(quarter, metric, role = "measure") {
    if (!pediatricQuarterGrid) return null
    return pediatricQuarterGrid.querySelector(
      `[data-quarter="${quarter}"][data-pediatric-metric="${metric}"][data-pediatric-role="${role}"]`,
    )
  }

  function getPediatricMetricInput(metric, quarter) {
    return getPediatricField(quarter, metric, "measure")
  }

  function updatePediatricDerivedMetric(metric, quarter, value) {
    const output = getPediatricField(quarter, metric, "measure")
    if (!output) return
    output.value = value === null ? "" : formatCalculatedValue(value, 2)
  }

  function updatePediatricSuggestions(quarter) {
    const bmiP = calculations.parseNumeric(
      getPediatricField(quarter, "bmi", "percentile")?.value,
    )
    const heightP = calculations.parseNumeric(
      getPediatricField(quarter, "heightM", "percentile")?.value,
    )
    const weightP = calculations.parseNumeric(
      getPediatricField(quarter, "weightKg", "percentile")?.value,
    )
    const armMuscleP = calculations.parseNumeric(
      getPediatricField(quarter, "armMuscleCircumferenceCm", "percentile")?.value,
    )
    const skinfoldSumP = calculations.parseNumeric(
      getPediatricField(quarter, "skinfoldSumMm", "percentile")?.value,
    )

    const metrics = {
      bmiPercentile: bmiP,
      heightPercentile: heightP,
      weightPercentile: weightP,
      armMusclePercentile: armMuscleP,
      skinfoldSumPercentile: skinfoldSumP,
      weightForStaturePercentile: calculations.parseNumeric(getPediatricField(quarter, "weightForStature", "percentile")?.value),
      weightForStatureOutOfRange: /Recomendado uso de IMC por Idade/i.test(getPediatricField(quarter, "weightForStature", "classification")?.value || ""),
      heightAgeFormatted: getPediatricField(quarter, "heightAge", "measure")?.value || "",
      ageMonths: calculations.calculateAgeInMonths(referenceContext.birthDate, namedFieldValue(`data-trimestre-${quarter}`) || todayIso()),
    }

    const anthroSug =
      calculations.generatePediatricAnthropometricDiagnosis(metrics)
    const nutriSug =
      calculations.generatePediatricNutritionalDiagnosis(metrics)

    const anthroChip = pediatricQuarterGrid?.querySelector(
      `button[data-suggestion-chip][data-quarter="${quarter}"][data-type="antropometrico"]`,
    )
    if (anthroChip) {
      if (anthroSug) {
        anthroChip.textContent = `✨ Sugestão: ${anthroSug}`
        anthroChip.dataset.suggestedValue = anthroSug
        anthroChip.hidden = false
      } else {
        anthroChip.hidden = true
        anthroChip.dataset.suggestedValue = ""
      }
    }

    const nutriChip = pediatricQuarterGrid?.querySelector(
      `button[data-suggestion-chip][data-quarter="${quarter}"][data-type="nutricional"]`,
    )
    if (nutriChip) {
      if (nutriSug) {
        nutriChip.textContent = `✨ Sugestão: ${nutriSug}`
        nutriChip.dataset.suggestedValue = nutriSug
        nutriChip.hidden = false
      } else {
        nutriChip.hidden = true
        nutriChip.dataset.suggestedValue = ""
      }
    }

    updateTab4PediatricSuggestions()
  }

  function updateTab4PediatricSuggestions() {
    const quarters = [4, 3, 2, 1]
    let latestQuarter = null
    for (const q of quarters) {
      const hVal = getPediatricField(q, "heightM", "measure")?.value
      const wVal = getPediatricField(q, "weightKg", "measure")?.value
      if (hVal || wVal) {
        latestQuarter = q
        break
      }
    }
    if (!latestQuarter) return

    const bmiP = calculations.parseNumeric(
      getPediatricField(latestQuarter, "bmi", "percentile")?.value,
    )
    const heightP = calculations.parseNumeric(
      getPediatricField(latestQuarter, "heightM", "percentile")?.value,
    )
    const weightP = calculations.parseNumeric(
      getPediatricField(latestQuarter, "weightKg", "percentile")?.value,
    )
    const armMuscleP = calculations.parseNumeric(
      getPediatricField(latestQuarter, "armMuscleCircumferenceCm", "percentile")?.value,
    )
    const skinfoldSumP = calculations.parseNumeric(
      getPediatricField(latestQuarter, "skinfoldSumMm", "percentile")?.value,
    )

    const metrics = {
      bmiPercentile: bmiP,
      heightPercentile: heightP,
      weightPercentile: weightP,
      armMusclePercentile: armMuscleP,
      skinfoldSumPercentile: skinfoldSumP,
      weightForStaturePercentile: calculations.parseNumeric(getPediatricField(latestQuarter, "weightForStature", "percentile")?.value),
      weightForStatureOutOfRange: /Recomendado uso de IMC por Idade/i.test(getPediatricField(latestQuarter, "weightForStature", "classification")?.value || ""),
      heightAgeFormatted: getPediatricField(latestQuarter, "heightAge", "measure")?.value || "",
      ageMonths: calculations.calculateAgeInMonths(referenceContext.birthDate, namedFieldValue(`data-trimestre-${latestQuarter}`) || todayIso()),
    }

    const anthroSug = calculations.generatePediatricAnthropometricDiagnosis(metrics)
    const nutriSug = calculations.generatePediatricNutritionalDiagnosis(metrics)

    const finalAnthroChip = document.querySelector(
      "#pediatric-final-anthro-chips button[data-suggestion-chip]",
    )
    if (finalAnthroChip) {
      if (anthroSug) {
        finalAnthroChip.textContent = `✨ Sugestão: ${anthroSug}`
        finalAnthroChip.dataset.suggestedValue = anthroSug
        finalAnthroChip.hidden = false
      } else {
        finalAnthroChip.hidden = true
        finalAnthroChip.dataset.suggestedValue = ""
      }
    }

    const finalNutriChip = document.querySelector(
      "#pediatric-final-nutri-chips button[data-suggestion-chip]",
    )
    if (finalNutriChip) {
      if (nutriSug) {
        finalNutriChip.textContent = `✨ Sugestão: ${nutriSug}`
        finalNutriChip.dataset.suggestedValue = nutriSug
        finalNutriChip.hidden = false
      } else {
        finalNutriChip.hidden = true
        finalNutriChip.dataset.suggestedValue = ""
      }
    }
  }

  // Sincronização bidirecional: alteração manual do Escore-Z recalcula o Percentil
  function syncFromZScoreInput(zInput, quarter) {
    const metric = zInput.dataset.pediatricMetric
    const definition = pediatricAnthropometryRows.find((r) => r.metric === metric)
    if (!definition) return

    const zVal = calculations.parseNumeric(zInput.value)
    const pInput = getPediatricField(quarter, metric, "percentile")
    const classInput = getPediatricField(quarter, metric, "classification")

    if (zVal === null) {
      if (pInput && !pInput.matches(":focus")) pInput.value = ""
      if (classInput) classInput.value = ""
    } else {
      const p = calculations.zScoreToPercentile(zVal)
      if (pInput && !pInput.matches(":focus")) {
        pInput.value = p === null ? "" : formatCalculatedValue(p, 1)
      }
      if (classInput) {
        classInput.value = calculations.classifyPediatricMetric(
          definition.lmsKey,
          p,
          zVal,
        )
      }
    }
    updatePediatricSuggestions(quarter)
  }

  // Sincronização bidirecional: alteração manual do Percentil recalcula o Escore-Z
  function syncFromPercentileInput(pInput, quarter) {
    const metric = pInput.dataset.pediatricMetric
    const definition = pediatricAnthropometryRows.find((r) => r.metric === metric)
    if (!definition) return

    const pVal = calculations.parseNumeric(pInput.value)
    const zInput = getPediatricField(quarter, metric, "zscore")
    const classInput = getPediatricField(quarter, metric, "classification")

    if (pVal === null || pVal <= 0 || pVal >= 100) {
      if (zInput && !zInput.matches(":focus")) zInput.value = ""
      if (classInput) classInput.value = ""
    } else {
      const z = calculations.percentileToZScore(pVal)
      if (zInput && !zInput.matches(":focus")) {
        zInput.value = z === null ? "" : formatCalculatedValue(z, 2)
      }
      if (classInput) {
        classInput.value = calculations.classifyPediatricMetric(
          definition.lmsKey,
          pVal,
          z,
        )
      }
    }
    updatePediatricSuggestions(quarter)
  }

  function recalculatePediatricAnthropometry(quarter) {
    const value = (metric) =>
      getPediatricField(quarter, metric, "measure")?.value ?? ""

    // 1. Métricas derivadas
    updatePediatricDerivedMetric(
      "bmi",
      quarter,
      calculations.calculateBmi(value("weightKg"), value("heightM")),
    )
    updatePediatricDerivedMetric(
      "skinfoldSumMm",
      quarter,
      calculations.calculatePediatricSkinfoldSum(
        value("tricepsSkinfoldMm"),
        value("subscapularSkinfoldMm"),
      ),
    )
    updatePediatricDerivedMetric(
      "armMuscleCircumferenceCm",
      quarter,
      calculations.calculatePediatricArmMuscleCircumference(
        value("armCircumferenceCm"),
        value("tricepsSkinfoldMm"),
      ),
    )

    // 2. Idade em meses na data da avaliação do trimestre
    const dateField = namedFieldValue(`data-trimestre-${quarter}`)
    const quarterDate = dateField || todayIso()
    const { identity } = readRecordContext()
    const birthDate = identity.birthDate
    const sex = identity.sex
    const ageMonths = calculations.calculateAgeInMonths(birthDate, quarterDate)

    // 1. Limite de Faixa Etária: curvas exclusivamente para 0 a 17 anos e 11 meses (0 a 215 meses)
    // A partir dos 18 anos (>= 216 meses), desativa os cálculos pediátricos
    const isEligible = ageMonths !== null && ageMonths >= 0 && ageMonths <= 215

    // Métricas complementares: Peso por Altura (0-60 meses) e Idade Estatural.
    const statureRaw = calculations.parseNumeric(value("heightM"))
    const statureCm = statureRaw === null ? null : (statureRaw <= 3 ? statureRaw * 100 : statureRaw)
    const weightForStatureMeasure = getPediatricField(quarter, "weightForStature", "measure")
    const wfsZ = getPediatricField(quarter, "weightForStature", "zscore")
    const wfsP = getPediatricField(quarter, "weightForStature", "percentile")
    const wfsClass = getPediatricField(quarter, "weightForStature", "classification")
    if (weightForStatureMeasure) {
      const weight = calculations.parseNumeric(value("weightKg"))
      weightForStatureMeasure.value = weight === null ? "" : formatCalculatedValue(weight, 2)
    }
    const wfs = calculations.calculateWeightForStature({
      weightKg: value("weightKg"), statureCm, ageMonths, sex,
    })
    if (wfsZ) wfsZ.value = wfs.outOfRange ? "" : (wfs.zScore === null ? "" : formatCalculatedValue(wfs.zScore, 2))
    if (wfsP) wfsP.value = wfs.outOfRange ? "" : (wfs.percentile === null ? "" : formatCalculatedValue(wfs.percentile, 1))
    if (wfsClass) wfsClass.value = wfs.outOfRange ? wfs.message : calculations.classifyWeightForStature(wfs.percentile, wfs.zScore)

    const heightAgeOutput = getPediatricField(quarter, "heightAge", "measure")
    if (heightAgeOutput) {
      heightAgeOutput.value = statureCm !== null && sex
        ? calculations.calculateAndFormatHeightAge(statureCm, sex)
        : ""
    }

    pediatricAnthropometryRows.forEach((definition) => {
      if (definition.special) return
      const measureInput = getPediatricField(quarter, definition.metric, "measure")
      const zInput = getPediatricField(quarter, definition.metric, "zscore")
      const pInput = getPediatricField(quarter, definition.metric, "percentile")
      const classInput = getPediatricField(quarter, definition.metric, "classification")

      if (!isEligible) {
        if (zInput && !zInput.matches(":focus")) zInput.value = ""
        if (pInput && !pInput.matches(":focus")) pInput.value = ""
        if (classInput && !classInput.matches(":focus")) classInput.value = ""
        return
      }

      const numVal = calculations.parseNumeric(measureInput?.value)
      if (numVal === null || numVal <= 0) {
        if (zInput && !zInput.matches(":focus")) zInput.value = ""
        if (pInput && !pInput.matches(":focus")) pInput.value = ""
        if (classInput && !classInput.matches(":focus")) classInput.value = ""
        return
      }

      const z = calculations.calculatePediatricZScore(
        definition.lmsKey,
        numVal,
        ageMonths,
        sex,
      )
      const p = z !== null ? calculations.zScoreToPercentile(z) : null

      if (zInput && !zInput.matches(":focus")) {
        zInput.value = z === null ? "" : formatCalculatedValue(z, 2)
      }
      if (pInput && !pInput.matches(":focus")) {
        pInput.value = p === null ? "" : formatCalculatedValue(p, 1)
      }
      if (classInput && !classInput.matches(":focus")) {
        classInput.value = calculations.classifyPediatricMetric(
          definition.lmsKey,
          p,
          z,
        )
      }
    })

    updatePediatricSuggestions(quarter)
  }

  function recalculateAllPediatricAnthropometry() {
    ;[1, 2, 3, 4].forEach(recalculatePediatricAnthropometry)
  }

  // A altura mais recente da antropometria alimenta o campo Altura (cm) de Dados Clínicos.
  function syncHeightToClinicalData() {
    const target = document.querySelector("#dc-altura")
    if (!target) return
    const candidates = isPediatricMode
      ? [4, 3, 2, 1].map((quarter) => getPediatricMetricInput("heightM", quarter))
      : [2, 1].map((semester) => getMetricInput("heightM", semester))
    const height = candidates
      .map((input) => calculations.parseNumeric(input?.value))
      .find((value) => value !== null && value > 0)
    if (height === undefined) {
      // Só limpa o que esta ficha preencheu; não apaga uma altura vinda da API.
      if (target.dataset.fromNutrition === "true") {
        target.value = ""
        delete target.dataset.fromNutrition
      }
      return
    }
    // A ficha registra metros; valores acima de 3 são tratados como centímetros.
    const heightCm = height > 3 ? height : height * 100
    target.value = String(Math.round(heightCm * 10) / 10).replace(".", ",")
    target.dataset.fromNutrition = "true"
  }

  // ---------- MIS ----------
  function latestBmi() {
    const outputs = isPediatricMode
      ? [4, 3, 2, 1].map((quarter) => getPediatricMetricInput("bmi", quarter))
      : [2, 1].map((semester) => getMetricInput("bmi", semester))
    return outputs.map((input) => calculations.parseNumeric(input?.value)).find((value) => value !== null && value > 0) ?? null
  }

  // Albumina: último resultado da aba Exames.
  function latestAlbumin() {
    const exam = window.HuNefroExames?.latest("Albumina")
    const value = calculations.parseNumeric(String(exam?.result || "").split(/\s/)[0])
    return value !== null && value > 0 ? [value, `aba Exames (${formatDate(exam.date)})`] : [null, ""]
  }

  // Sugestão automática: só preenche o item se ele estiver vazio ou se foi preenchido automaticamente antes.
  function suggestMisItem(number, score, source) {
    const select = $(`#mis-${number}`)
    const hint = $(`#mis-${number}-hint`)
    if (!select) return
    if (score === null) {
      if (select.dataset.auto === "true") { select.value = ""; delete select.dataset.auto }
      if (hint) hint.textContent = ""
      return
    }
    if (!select.value || select.dataset.auto === "true") {
      select.value = String(score)
      select.dataset.auto = "true"
    }
    if (hint) hint.textContent = `Sugerido a partir de ${source}.`
  }

  function updateMis() {
    const bmi = latestBmi()
    suggestMisItem(MIS_BMI, bmi === null ? null : misScoreBmi(bmi), bmi === null ? "" : `IMC ${formatCalculatedValue(bmi, 2)} kg/m² da antropometria`)
    const [albumin, source] = latestAlbumin()
    suggestMisItem(MIS_ALBUMIN, albumin === null ? null : misScoreAlbumin(albumin), `albumina ${formatCalculatedValue(albumin, 1)} g/dL, ${source}`)

    const selects = [...view.querySelectorAll("[data-mis-item]")]
    const filled = selects.filter((select) => select.value !== "")
    const total = filled.reduce((sum, select) => sum + Number(select.value), 0)
    const totalOutput = $("#mis-total")
    if (totalOutput) {
      totalOutput.textContent = filled.length === selects.length ? `${total} de 30` : filled.length ? `${total} (parcial)` : "Não calculado"
    }
    const count = $("#mis-count")
    if (count) count.textContent = `${filled.length} de ${selects.length}`
  }

  function misSummary() {
    const total = $("#mis-total")?.textContent || "Não calculado"
    return total
  }

  function selectTab(tab, { focus = false, updateUrl = true } = {}) {
    tabs.forEach((item) => {
      const active = item === tab
      item.setAttribute("aria-selected", String(active))
      item.tabIndex = active ? 0 : -1
    })
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab
    })
    if (updateUrl) {
      const url = new URL(window.location.href)
      url.searchParams.set("section", "nutricao")
      url.searchParams.set("tab", tab.dataset.tab)
      window.history.replaceState({}, "", url)
    }
    if (focus) tab.focus()
  }

  function toggleEdit(button, selector, editLabel) {
    const editing = button.getAttribute("aria-pressed") !== "true"
    button.setAttribute("aria-pressed", String(editing))
    button.textContent = editing ? "Concluir edição" : editLabel
    view.querySelectorAll(selector).forEach((field) => {
      field.disabled = !editing
    })
    if (editing) $(selector)?.focus()
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab))
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return
      event.preventDefault()
      let targetIndex = index
      if (event.key === "ArrowRight") targetIndex = (index + 1) % tabs.length
      if (event.key === "ArrowLeft")
        targetIndex = (index - 1 + tabs.length) % tabs.length
      if (event.key === "Home") targetIndex = 0
      if (event.key === "End") targetIndex = tabs.length - 1
      selectTab(tabs[targetIndex], { focus: true })
    })
  })

  const params = new URLSearchParams(window.location.search)
  if (params.get("section") === "nutricao") {
    const initialTab = tabs.find((tab) => tab.dataset.tab === params.get("tab"))
    if (initialTab) selectTab(initialTab, { updateUrl: false })
  }

  // Alterações não salvas (o shell do prontuário escuta `hunefro:dirty`).
  // Os campos das tabelas são criados por este script, depois do registro feito em prontuario.js.
  const markDirtyUnlessDraft = (event) => {
    if (!event.target.hasAttribute("data-no-dirty")) markDirty()
  }
  form?.addEventListener("input", markDirtyUnlessDraft)
  form?.addEventListener("change", markDirtyUnlessDraft)
  // Item do MIS alterado à mão deixa de ser sugestão automática.
  misGrid?.addEventListener("change", (event) => {
    if (event.target.dataset.misItem) delete event.target.dataset.auto
    updateMis()
  })
  form?.addEventListener("input", (event) => {
    if (event.target.dataset.metric || event.target.dataset.pediatricMetric) updateMis()
    if (event.target.name === "ano-base" || event.target.dataset.metric === "heightM" || event.target.dataset.pediatricMetric === "heightM") fillMonthlyAuto()
  })
  monthlyBody?.addEventListener("input", (event) => {
    const month = event.target.dataset.month
    if (month !== undefined && (event.target.dataset.gpiField || (event.target.name && event.target.name.startsWith("mensal-gpi-")))) {
      recalculateMonthlyGpi(Number(month))
    }
  })

  anthropometryBody.addEventListener("input", (event) => {
    const semester = Number(event.target.dataset.semester)
    if (event.target.dataset.metric && [1, 2].includes(semester)) {
      recalculateAnthropometry(semester)
      if (event.target.dataset.metric === "heightM") syncHeightToClinicalData()
    }
  })

  pediatricQuarterGrid?.addEventListener("input", (event) => {
    const quarter = Number(event.target.dataset.quarter)
    if (![1, 2, 3, 4].includes(quarter)) return

    if (
      event.target.dataset.pediatricRole === "measure" ||
      (!event.target.dataset.pediatricRole && event.target.dataset.pediatricMetric)
    ) {
      recalculatePediatricAnthropometry(quarter)
      if (event.target.dataset.pediatricMetric === "heightM") {
        syncHeightToClinicalData()
      }
      return
    }

    if (event.target.dataset.pediatricRole === "zscore") {
      syncFromZScoreInput(event.target, quarter)
      return
    }

    if (event.target.dataset.pediatricRole === "percentile") {
      syncFromPercentileInput(event.target, quarter)
      return
    }
  })

  pediatricQuarterGrid?.addEventListener("change", (event) => {
    if (event.target.name && event.target.name.startsWith("data-trimestre-")) {
      const quarter = Number(event.target.name.replace("data-trimestre-", ""))
      if ([1, 2, 3, 4].includes(quarter)) {
        recalculatePediatricAnthropometry(quarter)
      }
    }
  })

  view
    .querySelectorAll('[name^="data-semestre-"]')
    .forEach((field, index) => {
      field.addEventListener("change", () =>
        recalculateAnthropometry(index + 1),
      )
    })

  editMonthly?.addEventListener("click", () => {
    toggleEdit(editMonthly, "[data-monthly-lock]", "Editar dados")
  })

  editAnthropometry?.addEventListener("click", () => {
    toggleEdit(
      editAnthropometry,
      "[data-anthropometry-lock]",
      "Editar avaliação",
    )
  })

  editPediatricAnthropometry?.addEventListener("click", () => {
    toggleEdit(
      editPediatricAnthropometry,
      "[data-pediatric-lock]",
      "Editar avaliações",
    )
  })

  // ---------- Diagnóstico nutricional final: texto livre com preenchimento rápido ----------
  // O campo é um texto que o profissional escreve; os diagnósticos comuns abaixo só o preenchem e o texto continua editável.
  // `legacy` é o código que a ficha gravava quando o diagnóstico era uma opção marcada; setData converte para o texto.
  const COMMON_DIAGNOSES = [
    { legacy: "dng-inanicao", text: "Desnutrição não grave relacionada à inanição" },
    { legacy: "dng-aguda", text: "Desnutrição não grave relacionada à doença aguda" },
    { legacy: "dng-cronica", text: "Desnutrição não grave relacionada à doença crônica" },
    { legacy: "dg-inanicao", text: "Desnutrição grave relacionada à inanição ou não relacionada à doença" },
    { legacy: "dg-aguda", text: "Desnutrição grave relacionada à doença aguda" },
    { legacy: "dg-cronica", text: "Desnutrição grave relacionada à doença crônica" },
    { legacy: "alto-risco", text: "Alto risco para desenvolvimento de desnutrição" },
    { legacy: "eutrofia", text: "Eutrofia" },
  ]
  const diagnosisField = $("#diagnostico-final-texto")
  const diagnosisQuickList = $("#diagnosis-quick-list")
  const diagnosisUndo = $("#diagnosis-undo")
  // Texto digitado que o último preenchimento rápido substituiu (para desfazer); null quando não há o que desfazer.
  let diagnosisBeforeQuickFill = null

  function setDiagnosisUndo(previousText) {
    diagnosisBeforeQuickFill = previousText
    if (diagnosisUndo) diagnosisUndo.hidden = previousText === null
  }

  // Marca como ativo o diagnóstico comum cujo texto está no campo.
  function syncDiagnosisQuickList() {
    const current = diagnosisField?.value.trim() ?? ""
    diagnosisQuickList?.querySelectorAll("button[data-diagnosis-text]").forEach((button) => {
      button.setAttribute("aria-pressed", String(current !== "" && button.dataset.diagnosisText === current))
    })
  }

  function writeDiagnosis(text) {
    diagnosisField.value = text
    // Dispara o evento para o formulário marcar a ficha como alterada.
    diagnosisField.dispatchEvent(new Event("input", { bubbles: true }))
  }

  COMMON_DIAGNOSES.forEach(({ text }) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "btn btn-outline-secondary btn-sm diagnosis-quick-item"
    button.textContent = text
    button.dataset.diagnosisText = text
    button.setAttribute("aria-pressed", "false")
    diagnosisQuickList?.append(button)
  })

  diagnosisQuickList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-diagnosis-text]")
    if (!button || !diagnosisField) return
    const current = diagnosisField.value
    // Só guarda para desfazer o que foi escrito à mão; trocar um diagnóstico comum por outro não precisa.
    const isCustom = current.trim() !== "" && !COMMON_DIAGNOSES.some(({ text }) => text === current.trim())
    writeDiagnosis(button.dataset.diagnosisText)
    setDiagnosisUndo(isCustom ? current : null)
    diagnosisField.focus()
  })

  diagnosisUndo?.addEventListener("click", () => {
    if (diagnosisBeforeQuickFill === null || !diagnosisField) return
    writeDiagnosis(diagnosisBeforeQuickFill)
    setDiagnosisUndo(null)
    diagnosisField.focus()
  })

  // Qualquer digitação passa a ser o texto atual: não há mais o que desfazer.
  diagnosisField?.addEventListener("input", () => {
    setDiagnosisUndo(null)
    syncDiagnosisQuickList()
  })

  // Dados antigos traziam o código da opção marcada; no campo de texto vira o texto do diagnóstico.
  function restoreFinalDiagnosis() {
    if (!diagnosisField) return
    const legacy = COMMON_DIAGNOSES.find(({ legacy: code }) => code === diagnosisField.value.trim())
    if (legacy) diagnosisField.value = legacy.text
    setDiagnosisUndo(null)
    syncDiagnosisQuickList()
  }

  function prepareNutritionPrint() {
    buildPrintSheet()
    document.body.classList.add("nutrition-printing")
    printSheet?.setAttribute("aria-hidden", "false")
  }

  function finishNutritionPrint() {
    document.body.classList.remove("nutrition-printing")
    printSheet?.setAttribute("aria-hidden", "true")
  }

  // Monta a ficha, espera as logos ficarem prontas e só então abre a janela de impressão.
  let printing = false
  printButton?.addEventListener("click", async () => {
    if (printing) return
    printing = true
    printButton.disabled = true
    try {
      prepareNutritionPrint()
      await whenImagesReady(printSheet)
      // Dois quadros para o navegador pintar a folha com as imagens antes de imprimir.
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      window.print()
    } finally {
      printing = false
      printButton.disabled = false
    }
  })
  // Ctrl+P com a aba Nutrição aberta imprime a ficha; as impressões das outras abas usam a própria classe *-printing.
  // Se a ficha já foi montada pelo botão, não remonta (remontar trocaria as imagens prontas por outras ainda carregando).
  window.addEventListener("beforeprint", () => {
    const otherPrint = [...document.body.classList].some(
      (name) => name.endsWith("-printing") && name !== "nutrition-printing",
    )
    if (document.body.classList.contains("nutrition-printing")) return
    if (view.classList.contains("active") && !otherPrint) prepareNutritionPrint()
  })
  window.addEventListener("afterprint", finishNutritionPrint)

  function initPediatricTab4Diagnosis() {
    const card = $("#pediatric-diagnosis-card")
    if (!card) return

    function setupBlock(type, textareaId, undoId, chipsId, commonOptions) {
      const textarea = $(`#${textareaId}`)
      const undoBtn = $(`#${undoId}`)
      const chipsContainer = $(`#${chipsId}`)
      if (!textarea || !chipsContainer) return

      const suggestionChip = document.createElement("button")
      suggestionChip.type = "button"
      suggestionChip.className =
        "btn btn-outline-primary btn-sm diagnosis-quick-item pediatric-chip-suggested"
      suggestionChip.dataset.suggestionChip = ""
      suggestionChip.hidden = true
      chipsContainer.append(suggestionChip)

      commonOptions.forEach((optionText) => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "btn btn-outline-secondary btn-sm diagnosis-quick-item"
        btn.textContent = optionText
        btn.dataset.diagnosisText = optionText
        btn.setAttribute("aria-pressed", "false")
        chipsContainer.append(btn)
      })

      let previousText = null

      function sync() {
        const current = textarea.value.trim()
        chipsContainer
          .querySelectorAll("button[data-diagnosis-text]")
          .forEach((btn) => {
            btn.setAttribute(
              "aria-pressed",
              String(current !== "" && btn.dataset.diagnosisText === current),
            )
          })
        if (suggestionChip.dataset.suggestedValue) {
          suggestionChip.setAttribute(
            "aria-pressed",
            String(
              current !== "" &&
                suggestionChip.dataset.suggestedValue === current,
            ),
          )
        }
      }

      textarea.addEventListener("input", () => {
        if (undoBtn) undoBtn.hidden = true
        previousText = null
        sync()
      })

      chipsContainer.addEventListener("click", (event) => {
        const btn = event.target.closest("button.diagnosis-quick-item")
        if (!btn) return
        const val = btn.dataset.suggestedValue || btn.dataset.diagnosisText
        if (!val) return

        const current = textarea.value
        const isCustom =
          current.trim() !== "" &&
          !commonOptions.includes(current.trim()) &&
          current.trim() !== btn.dataset.suggestedValue
        if (isCustom) {
          previousText = current
          if (undoBtn) undoBtn.hidden = false
        }
        textarea.value = val
        textarea.dispatchEvent(new Event("input", { bubbles: true }))
        textarea.focus()
        sync()
      })

      undoBtn?.addEventListener("click", () => {
        if (previousText === null) return
        textarea.value = previousText
        previousText = null
        undoBtn.hidden = true
        textarea.dispatchEvent(new Event("input", { bubbles: true }))
        textarea.focus()
        sync()
      })
    }

    setupBlock(
      "antropometrico",
      "pediatric-final-anthro-diag",
      "pediatric-final-anthro-undo",
      "pediatric-final-anthro-chips",
      COMMON_PEDIATRIC_ANTHRO_DIAGNOSES,
    )

    setupBlock(
      "nutricional",
      "pediatric-final-nutri-diag",
      "pediatric-final-nutri-undo",
      "pediatric-final-nutri-chips",
      COMMON_PEDIATRIC_NUTRI_DIAGNOSES,
    )
  }

  initPediatricTab4Diagnosis()

  // Contexto do paciente: atualizado sempre que a aba é aberta.
  document
    .querySelector('[data-section="nutricao"]')
    ?.addEventListener("click", syncFromRecord)
  syncFromRecord()
  recalculateAllPediatricAnthropometry()

  // ---------------------------------------------------------------------------
  // API pública para integração com o backend
  // ---------------------------------------------------------------------------
  // Campos vinculados (somente leitura) e calculados pertencem às outras abas e não são enviados.
  const isOwnField = (field) =>
    field.name &&
    !field.classList.contains("field-linked-source") &&
    field.dataset.linked !== "true" &&
    !field.hasAttribute("data-derived-output")

  function getData() {
    const data = {}
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!isOwnField(field)) return
      if (field.type === "radio") {
        if (field.checked) data[field.name] = field.value
        else if (!(field.name in data)) data[field.name] = null
      } else if (field.type === "checkbox") {
        data[field.name] = field.checked
      } else {
        data[field.name] = field.value.trim() || null
      }
    })
    return data
  }

  function setData(data = {}) {
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!isOwnField(field)) return
      const value = data[field.name]
      if (field.type === "radio") field.checked = value === field.value
      else if (field.type === "checkbox") field.checked = Boolean(value)
      else field.value = value ?? ""
    })

    applyLegacyEducation(data["escolaridade-chefe"])
    updateCceb()

    // Fichas antigas tinham uma linha só "Quelante (Ca / P)": o valor vai para a linha do quelante de fósforo.
    months.forEach(([monthKey]) => {
      const legacy = data[`mensal-quelante-ca-p-${monthKey}`]
      const target = form.querySelector(`[name="mensal-${slug("Quelante (P)")}-${monthKey}"]`)
      if (legacy && target && !data[target.name]) target.value = legacy
    })

    // Compatibilidade com dados legados/referência única
    ;[1, 2, 3, 4].forEach((q) => {
      pediatricAnthropometryRows.forEach((def) => {
        const key = `pediatrica-${slug(def.label)}-t${q}`
        if (
          !data[`${key}-escore-z`] &&
          !data[`${key}-percentil`] &&
          data[`${key}-referencia`]
        ) {
          const ref = String(data[`${key}-referencia`]).trim()
          if (ref.startsWith("Z")) {
            const z = calculations.parseNumeric(ref.replace(/^Z\s*/, ""))
            if (z !== null) {
              const zIn = getPediatricField(q, def.metric, "zscore")
              const pIn = getPediatricField(q, def.metric, "percentile")
              if (zIn) zIn.value = formatCalculatedValue(z, 2)
              const p = calculations.zScoreToPercentile(z)
              if (pIn && p !== null) pIn.value = formatCalculatedValue(p, 1)
            }
          } else if (ref.startsWith("P")) {
            const p = calculations.parseNumeric(ref.replace(/^P\s*/, ""))
            if (p !== null) {
              const pIn = getPediatricField(q, def.metric, "percentile")
              const zIn = getPediatricField(q, def.metric, "zscore")
              if (pIn) pIn.value = formatCalculatedValue(p, 1)
              const z = calculations.percentileToZScore(p)
              if (zIn && z !== null) zIn.value = formatCalculatedValue(z, 2)
            }
          }
        }
      })
    })

    restoreFinalDiagnosis()
    syncFromRecord()
    recalculateAllPediatricAnthropometry()
    syncHeightToClinicalData()
  }

  function validate() {
    return { valid: true, errors: [] }
  }

  // Medidas antropométricas preenchidas na Nutrição, no formato de exame da aba Exames ({ date, name, result, description, origin }).
  // A Nutrição é o único lugar de preenchimento; a aba Exames só inclui o que vem daqui (botão "Incluir exames antropométricos").
  function anthropometryExams() {
    const fieldValueByName = (name) => form.querySelector(`[name="${name}"]`)?.value?.trim() || ""
    const exams = []
    if (isPediatricMode) {
      ;[1, 2, 3, 4].forEach((quarter) => {
        const date = fieldValueByName(`data-trimestre-${quarter}`)
        if (!date) return
        const origin = `${quarter}º trimestre`
        pediatricAnthropometryRows.forEach((definition) => {
          const key = `pediatrica-${slug(definition.label)}-t${quarter}`
          const result = fieldValueByName(`${key}-medida`)
          if (!result) return
          const zScore = fieldValueByName(`${key}-escore-z`)
          const percentile = fieldValueByName(`${key}-percentil`)
          const classification = fieldValueByName(`${key}-classificacao`)
          exams.push({
            date,
            name: definition.label,
            result,
            origin,
            description: [
              `Avaliação antropométrica pediátrica do ${origin} (aba Nutrição)`,
              zScore && `Escore-Z: ${zScore}`,
              percentile && `Percentil: ${percentile}`,
              classification && `Classificação: ${classification}`,
            ].filter(Boolean).join(". "),
          })
        })
      })
      return exams
    }
    ;[1, 2].forEach((semester) => {
      const date = fieldValueByName(`data-semestre-${semester}`)
      if (!date) return
      const origin = `${semester}º semestre`
      anthropometryGroups.flatMap((group) => group.rows).forEach((rowDefinition) => {
        const label = typeof rowDefinition === "string" ? rowDefinition : rowDefinition.label
        const key = `antropometria-${slug(label)}-s${semester}`
        const result = fieldValueByName(`${key}-valor`)
        if (!result || result === "-") return
        const adequacy = fieldValueByName(`${key}-adequacao`)
        const diagnosis = fieldValueByName(`${key}-diagnostico`)
        const note = fieldValueByName(`${key}-observacao`)
        exams.push({
          date,
          name: label,
          result,
          origin,
          description: [
            `Avaliação antropométrica do ${origin} (aba Nutrição)`,
            adequacy && `Adequação: ${adequacy}%`,
            diagnosis && diagnosis !== "-" && `Diagnóstico: ${diagnosis}`,
            note && note !== "-" && `Observação: ${note}`,
          ].filter(Boolean).join(". "),
        })
      })
    })
    return exams
  }

  window.HuNefroNutricao = { getData, setData, validate, refresh: syncFromRecord, anthropometryExams }
})()
