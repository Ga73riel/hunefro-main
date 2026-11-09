// Receituários, LME e APAC do prontuário: monta os documentos a partir das medicações em uso e dos dados das
// outras abas, e imprime no padrão do HU-UFMA (logos HU Brasil, HU e UFMA).
//
// A logo do SUS sai só no LME e na APAC, como nos formulários oficiais do SUS.
// Regras: Portaria SVS/MS 344/1998 (alterada pela RDC 1.000/2025) para controle especial e RDC 471/2021 para retenção.
// Documentos gerados automaticamente:
//   - Receituário (uso ambulatorial): medicações sem controle especial, agrupadas pela via;
//   - Receituário de antimicrobiano: 2 vias, validade de 10 dias (RDC 471/2021);
//   - Receita de Controle Especial: modelo da RDC 1.000/2025 (lista C1), 2 vias, até 3 medicamentos por receita;
//   - Medicações na sessão de HD: folha para a equipe de enfermagem;
//   - LME (Componente Especializado): um laudo por protocolo do CEAF (anemia, DMO);
//   - APAC de hemodiálise: laudo do SIA/SUS com o procedimento SIGTAP e as sessões do mês.
// Depende de js/catalogos.js, js/componentes.js e js/catalogo-medicamentos.js.
(() => {
  "use strict"

  const { el, formatDate, todayIso, addDays, normalize } = window.HuNefroUI
  const C = window.HuNefroCatalogos
  const MED = window.HuNefroMedicamentos
  const $ = (id) => document.getElementById(id)
  if (!$("view-medicacoes")) return

  const INST = C.INSTITUICAO
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
  const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 }
  const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  const RCE_MAX_ITEMS = 3

  const dateInWords = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}` }
  const value = (id) => ($(id)?.value || "").trim()
  const professional = (id) => C.PROFESSIONALS.find((p) => p.id === id) || null
  const councilOf = (p) => (p?.council ? `${p.council}-${p.councilUf} ${p.councilNumber}` : "")

  function ageOn(birthIso, on = todayIso()) {
    if (!birthIso) return null
    const [by, bm, bd] = birthIso.split("-").map(Number)
    const [y, m, d] = on.split("-").map(Number)
    return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
  }

  // ---------- Dados do paciente, lidos das outras abas ----------
  function patientContext() {
    const clinical = window.HuNefroDadosClinicos?.getData() || {}
    const hdPrescription = (window.HuNefroPrescricaoHD?.getData() || []).sort((a, b) => b.date.localeCompare(a.date))[0]
    const hdDays = [...document.querySelectorAll('input[name="dias-hd"]:checked')].map((i) => i.value)
    const weekdays = hdDays.includes("diaria") ? [0, 1, 2, 3, 4, 5, 6] : hdDays.map((d) => WEEKDAYS[d]).filter((d) => d !== undefined).sort()
    const allergies = (window.HuNefroEventosDiagnosticos?.getData() || [])
      .filter((e) => e.kind === "alergia" && !e.end).map((e) => e.data?.substancia || e.type).filter(Boolean)
    const street = [value("logradouro"), value("numero")].filter(Boolean).join(", ")
    const address = [street, value("complemento"), value("bairro")].filter(Boolean).join(" - ")
    const city = value("municipio")
    const uf = value("uf-endereco")
    const birth = value("data-nascimento")
    const weight = clinical.peso_seco_kg || Number(hdPrescription?.dryWeight) || null
    return {
      name: value("nome-completo"), birth, age: ageOn(birth), sex: value("sexo"), cpf: value("cpf"), cns: value("cns"),
      code: $("patient-code")?.textContent.trim() || "", mother: value("nome-mae"), phone: value("telefone"), email: value("email"),
      race: value("cor-raca"), address, city, uf, cep: value("cep"),
      fullAddress: [address, [city, uf].filter(Boolean).join(" - "), value("cep") && `CEP ${value("cep")}`].filter(Boolean).join(", "),
      weight, height: clinical.altura_cm || null, etiology: clinical.etiologia ? $("dc-etiologia")?.selectedOptions[0]?.textContent.trim() || "" : "", baseCid: clinical.diagnostico_base_cid || "",
      program: value("programa-atual"), programStart: value("inicio-programa"), shift: value("turno"), room: value("sala"),
      hdDays: weekdays, allergies,
    }
  }

  // ---------- Peças comuns do padrão de impressão ----------
  function letterhead() {
    return el("header", { class: "pr-head" },
      el("img", { class: "pr-logo pr-logo-hubrasil", src: "assets/impressao/logo-hu-brasil.png", alt: "HU Brasil - Hospitais Universitários Federais" }),
      el("div", { class: "pr-head-text" },
        el("strong", { text: "HOSPITAL UNIVERSITÁRIO DA UNIVERSIDADE FEDERAL DO MARANHÃO" }),
        el("span", { text: INST.unidade }),
        el("span", { text: `${INST.endereco} · ${INST.cidade} - ${INST.uf} · CEP ${INST.cep}` }),
        el("span", { text: `Tel. ${INST.telefone}` }),
        el("span", { text: [INST.cnes && `CNES ${INST.cnes}`, INST.cnpj && `CNPJ ${INST.cnpj}`].filter(Boolean).join(" · ") }),
      ),
      el("div", { class: "pr-head-logos" },
        el("img", { class: "pr-logo pr-logo-round", src: "assets/impressao/logo-hu.png", alt: "Hospital Universitário" }),
        el("img", { class: "pr-logo pr-logo-round", src: "assets/impressao/logo-ufma.png", alt: "Universidade Federal do Maranhão" }),
      ),
    )
  }

  // Cabeçalho reduzido (Laudos compactos e páginas de continuação).
  function compactHead() {
    return el("header", { class: "pr-head pr-head-compact" },
      el("img", { class: "pr-logo pr-logo-hubrasil", src: "assets/impressao/logo-hu-brasil.png", alt: "HU Brasil - Hospitais Universitários Federais" }),
      el("div", { class: "pr-head-text" },
        el("strong", { text: "HOSPITAL UNIVERSITÁRIO DA UNIVERSIDADE FEDERAL DO MARANHÃO" }),
        el("span", { text: `${INST.unidade} · CNES ${INST.cnes} · Tel. ${INST.telefone}` }),
      ),
      el("div", { class: "pr-head-logos" },
        el("img", { class: "pr-logo pr-logo-round", src: "assets/impressao/logo-hu.png", alt: "Hospital Universitário" }),
        el("img", { class: "pr-logo pr-logo-round", src: "assets/impressao/logo-ufma.png", alt: "Universidade Federal do Maranhão" }),
      ),
    )
  }

  const footer = (note) => el("footer", { class: "pr-foot" },
    el("span", { text: note || "" }),
    el("span", { text: `Emitido pelo Hu-Nefro em ${formatDate(todayIso())}` }),
  )

  const field = (label, text, cls = "") => el("div", { class: `pr-field ${cls}` }, el("span", { class: "pr-field-label", text: label }), el("span", { class: "pr-field-value", text: text || "-" }))

  function patientBox(ctx, { withSexAge = false, withAddress = false } = {}) {
    const fields = [
      field("Paciente", ctx.name, "pr-span-2"),
      field("Prontuário", ctx.code),
      field("Nascimento", ctx.birth ? `${formatDate(ctx.birth)}${ctx.age !== null ? ` (${ctx.age} anos)` : ""}` : ""),
      withSexAge ? field("Sexo", ctx.sex) : field("Cartão SUS", ctx.cns),
      withSexAge ? field("Cartão SUS", ctx.cns) : field("CPF", ctx.cpf),
      withAddress ? field("Endereço", ctx.fullAddress, "pr-span-3") : null,
      ctx.allergies.length ? field("Alergias", ctx.allergies.join(", "), "pr-span-3 pr-alert") : null,
    ]
    return el("section", { class: "pr-patient" }, ...fields.filter(Boolean))
  }

  function signature(prescriber, date) {
    return el("section", { class: "pr-sign" },
      el("p", { class: "pr-place", text: `${INST.cidade} - ${INST.uf}, ${dateInWords(date)}.` }),
      el("div", { class: "pr-sign-line" },
        el("strong", { text: prescriber?.name || "" }),
        // A especialidade só é citada com o RQE (Resolução CFM nº 2.336/2023).
        el("span", { text: ["Médico(a)", councilOf(prescriber), prescriber?.rqe && `${prescriber.specialty} - RQE ${prescriber.rqe}`].filter(Boolean).join(" · ") }),
        el("span", { class: "pr-sign-hint", text: "Assinatura e carimbo" }),
      ),
    )
  }

  // Item da receita: nome, quantidade e modo de usar.
  function rxItem(med, n, { words = false, opts } = {}) {
    // No SUS a receita usa a denominação genérica (DCB) e não traz nome comercial (Lei 9.787/1999, art. 3º).
    const name = MED.spelledOut([MED.find(med.drug)?.dcb || med.drug, med.complement].filter(Boolean).join(" "))
    return el("li", { class: "pr-rx-item" },
      el("div", { class: "pr-rx-line" },
        el("span", { class: "pr-rx-num", text: `${n}.` }),
        el("strong", { class: "pr-rx-name", text: name }),
        el("span", { class: "pr-rx-dots", "aria-hidden": "true" }),
        el("span", { class: "pr-rx-qty", text: words ? MED.quantityInWords(med) : MED.quantityLabel(med) }),
      ),
      el("p", { class: "pr-rx-use", text: `${MED.spelledOut(med.posology)}. ${MED.usageLabel(med, opts)}.` }),
    )
  }

  function groupedByRoute(meds, opts, words) {
    const groups = new Map()
    meds.forEach((m) => {
      const [, label] = MED.route(m.posology)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label).push(m)
    })
    let n = 0
    return [...groups].map(([label, items]) => el("section", { class: "pr-rx-group" },
      el("h3", { class: "pr-rx-route", text: label.toUpperCase() }),
      el("ol", { class: "pr-rx-list" }, ...items.map((m) => rxItem(m, ++n, { words, opts }))),
    ))
  }

  const page = (cls, ...children) => el("article", { class: `pr-page ${cls}` }, ...children)

  // ---------- Receituário (uso ambulatorial) ----------
  function simpleReceipt(meds, ctx, prescriber, date, opts) {
    return [page("pr-receita",
      letterhead(),
      el("h2", { class: "pr-title", text: "RECEITUÁRIO" }),
      patientBox(ctx, { withAddress: true }),
      el("div", { class: "pr-body" }, ...groupedByRoute(meds, opts)),
      signature(prescriber, date),
      footer("Receita de uso ambulatorial."),
    )]
  }

  // ---------- Antimicrobianos: 2 vias, retenção da 1ª via ----------
  function antimicrobialReceipt(meds, ctx, prescriber, date, opts) {
    return ["1ª via - retenção pela farmácia", "2ª via - paciente"].map((via) => page("pr-receita",
      letterhead(),
      el("h2", { class: "pr-title", text: "RECEITUÁRIO - ANTIMICROBIANO" }),
      el("p", { class: "pr-via", text: via }),
      patientBox(ctx, { withSexAge: true, withAddress: true }),
      el("div", { class: "pr-body" }, ...groupedByRoute(meds, opts)),
      el("p", { class: "pr-note", text: `Validade: 10 dias a contar de ${formatDate(date)} (RDC Anvisa nº 471/2021).` }),
      signature(prescriber, date),
      footer(via),
    ))
  }

  // ---------- Receita de Controle Especial (modelo da RDC 1.000/2025) ----------
  const rceBar = (text) => el("h3", { class: "pr-rce-bar", text })
  const rceLine = (label, text) => el("p", { class: "pr-rce-line" }, el("span", { text: `${label}: ` }), el("strong", { text: text || "" }))
  const blankLine = (label) => el("p", { class: "pr-rce-line pr-rce-blank" }, el("span", { text: `${label}:` }), el("span", { class: "pr-rce-fill" }))

  function controlReceipt(meds, ctx, prescriber, date, opts) {
    const institution = [INST.nome, INST.cnes ? `CNES ${INST.cnes}` : INST.cnpj ? `CNPJ ${INST.cnpj}` : "CNES ________", `${INST.endereco}, ${INST.cidade} - ${INST.uf}, CEP ${INST.cep}`].join(" · ")
    return ["1ª via - Retenção pela Farmácia", "2ª via - Paciente"].map((via, i) => page("pr-rce",
      el("div", { class: "pr-rce-logos" },
        el("img", { src: "assets/impressao/logo-hu-brasil.png", alt: "HU Brasil" }),
        el("img", { src: "assets/impressao/logo-hu.png", alt: "Hospital Universitário" }),
        el("img", { src: "assets/impressao/logo-ufma.png", alt: "UFMA" }),
      ),
      el("h2", { class: "pr-rce-title", text: "RECEITA DE CONTROLE ESPECIAL" }),
      rceBar("IDENTIFICAÇÃO DO EMITENTE"),
      el("p", { class: "pr-rce-line", text: institution }),
      rceLine("TELEFONE", INST.telefone),
      rceBar("IDENTIFICAÇÃO DO PACIENTE"),
      rceLine("NOME COMPLETO", ctx.name),
      rceLine("ENDEREÇO COMPLETO", ctx.fullAddress),
      rceLine("CPF ou, se estrangeiro, PASSAPORTE Nº", ctx.cpf || "não possui"),
      rceBar("PRESCRIÇÃO"),
      el("ol", { class: "pr-rx-list pr-rce-rx" }, ...meds.map((m, n) => rxItem(m, n + 1, { words: true, opts }))),
      el("section", { class: "pr-rce-box" },
        rceLine("DATA", formatDate(date)),
        el("p", { class: "pr-rce-line" }, el("span", { text: "IDENTIFICAÇÃO E ASSINATURA DO PRESCRITOR: " }), el("strong", { text: `${prescriber?.name || ""} - ${councilOf(prescriber)}` })),
        el("div", { class: "pr-rce-sign", text: "Assinatura" }),
      ),
      rceBar("IDENTIFICAÇÃO DO COMPRADOR"),
      el("p", { class: "pr-rce-small", text: "*IMPRESSÃO OPCIONAL - CONFORME PORTARIA Nº 6/99, ARTIGO 85, ALÍNEA C, ESSES DADOS PODEM SER APOSTOS MEDIANTE CARIMBO PELA FARMÁCIA NO MOMENTO DA DISPENSAÇÃO." }),
      blankLine("NOME COMPLETO"), blankLine("CPF ou, se estrangeiro, PASSAPORTE Nº"), blankLine("ENDEREÇO COMPLETO"),
      el("div", { class: "pr-rce-row" }, blankLine("CIDADE"), blankLine("UF"), blankLine("TELEFONE")),
      el("p", { class: "pr-rce-via" },
        el("strong", { class: i === 0 ? "is-current" : "", text: "1ª via - Retenção pela Farmácia" }), " / ",
        el("strong", { class: i === 1 ? "is-current" : "", text: "2ª via - Paciente" })),
      el("p", { class: "pr-rce-printed", text: `DATA DE IMPRESSÃO DESTE RECEITUÁRIO: ${formatDate(todayIso())}` }),
    ))
  }

  // ---------- Medicações administradas na sessão de HD ----------
  function hdSheet(meds, ctx, prescriber, date, opts) {
    const days = ctx.hdDays.map((d) => WEEKDAY_SHORT[d]).join(", ")
    return [page("pr-receita",
      letterhead(),
      el("h2", { class: "pr-title", text: "MEDICAÇÕES NA SESSÃO DE HEMODIÁLISE" }),
      patientBox(ctx),
      el("p", { class: "pr-note", text: [days && `Sessões: ${days}`, ctx.shift && `${ctx.shift}º turno`, ctx.room && `Sala ${ctx.room}`].filter(Boolean).join(" · ") }),
      el("table", { class: "pr-table" },
        el("thead", {}, el("tr", {}, ...["Medicação", "Posologia", "Uso", "Quantidade"].map((t) => el("th", { text: t })))),
        el("tbody", {}, ...meds.map((m) => el("tr", {},
          el("td", { text: MED.spelledOut([m.drug, m.complement].filter(Boolean).join(" ")) }),
          el("td", { text: MED.spelledOut(m.posology) }),
          el("td", { text: MED.usageLabel(m, opts) }),
          el("td", { text: MED.quantityLabel(m) || "-" }),
        ))),
      ),
      signature(prescriber, date),
      footer("Administrar na unidade de hemodiálise. Registrar cada aplicação na sessão."),
    )]
  }

  // ---------- LME ----------
  // Rascunho automático do LME de um protocolo do CEAF. O médico pode revisar antes de imprimir.
  function exam(name) { return window.HuNefroExames?.latest(name) || null }

  function examStatus(protocolKey, date = todayIso()) {
    return MED.PROTOCOLS[protocolKey].exams.map(([name, validity, unit]) => {
      const last = exam(name)
      const age = last ? Math.round((new Date(date) - new Date(last.date)) / 86400000) : null
      return { name, validity, unit, last, ok: Boolean(last) && age <= validity, age }
    })
  }

  function lmeAuto(protocolKey, meds, allMeds, ctx, prescriberId) {
    const protocol = MED.PROTOCOLS[protocolKey]
    const hdPerWeek = ctx.hdDays.length || 3
    const onHd = /Hemodiálise/.test(ctx.program)
    const exams = examStatus(protocolKey)
      .filter((e) => e.last)
      .map((e) => `${e.name === "Saturação da transferrina" ? "IST" : e.name} ${e.last.result}${e.unit === "%" ? "%" : ` ${e.unit}`} (${formatDate(e.last.date)})`)
    const current = meds.map((m) => `${MED.spelledOut(MED.find(m.drug)?.dcb || m.drug)} - ${MED.spelledOut(m.posology).replace(/^./, (c) => c.toLowerCase())}`).join("; ")
    const start = ctx.programStart ? ` desde ${ctx.programStart}` : ""
    const anamnese = [
      `Paciente ${ctx.sex ? ctx.sex.toLowerCase() : ""}${ctx.age !== null ? `, ${ctx.age} anos` : ""}, com doença renal crônica estádio 5${onHd ? ` em hemodiálise ${hdPerWeek} vezes por semana${start}` : ""}.`,
      ctx.etiology ? `Etiologia: ${ctx.etiology}.` : "",
      `Diagnóstico: ${protocol.name.toLowerCase()}.`,
      exams.length ? `Exames: ${exams.join("; ")}.` : "",
      `Em uso de: ${current}.`,
    ].filter(Boolean).join(" ").replace(/\s+/g, " ")
    // Tratamento prévio: medicações do mesmo protocolo prescritas antes (inclusive as suspensas).
    const previous = allMeds.filter((m) => MED.find(m.drug)?.ceaf === protocolKey && (m.status !== "active" || meds.every((x) => x.id !== m.id)))
    const firstDate = allMeds.filter((m) => MED.find(m.drug)?.ceaf === protocolKey).map((m) => m.date).sort()[0]
    const prior = previous.length || (firstDate && firstDate < addDays(todayIso(), -90))
    const isMinor = ctx.age !== null && ctx.age < 18
    return {
      cid: protocol.cids.includes(ctx.baseCid) ? ctx.baseCid : protocol.cid,
      weight: ctx.weight ? String(ctx.weight).replace(".", ",") : "",
      height: ctx.height ? String(ctx.height).replace(".", ",") : "",
      months: 3,
      items: meds.map((m) => ({ medId: m.id, name: MED.spelledOut(MED.find(m.drug)?.lme || m.drug), monthly: String(MED.monthlyQuantity(m, { hdPerWeek }) || "") })),
      anamnese,
      priorTreatment: prior ? "sim" : "nao",
      priorText: prior ? `Em tratamento desde ${formatDate(firstDate)}${previous.length ? `; também usou ${[...new Set(previous.map((m) => m.drug))].join(", ")}` : ""}.` : "",
      incapable: isMinor ? "sim" : "nao",
      guardian: isMinor ? ctx.mother : "",
      filledBy: "medico",
      prescriber: prescriberId,
      date: todayIso(),
    }
  }

  const box = (n, label, content, cls = "") => el("div", { class: `lme-box ${cls}` }, el("span", { class: "lme-label", text: `${n}${n ? "- " : ""}${label}` }), content)
  const val = (text, cls = "") => el("span", { class: `lme-value ${cls}`, text: text || "" })
  const check = (on, label) => el("span", { class: "lme-check" }, el("span", { class: `lme-square${on ? " is-on" : ""}`, text: on ? "X" : "" }), label)

  function lmeDocument(draft, ctx) {
    const p = professional(draft.prescriber)
    const cid = C.CID.find((c) => c.code === draft.cid)
    const rows = [...draft.items.slice(0, 6), ...Array(Math.max(0, 6 - draft.items.length)).fill(null)]
    const races = ["Branca", "Amarela", "Preta", "Indígena", "Parda"]
    const docType = ctx.cpf ? "cpf" : ctx.cns ? "cns" : ""
    return [page("pr-lme",
      el("header", { class: "lme-head" },
        el("img", { class: "lme-sus", src: "assets/impressao/logo-sus.png", alt: "SUS - Sistema Único de Saúde" }),
        el("div", {}, el("p", { text: "Sistema Único de Saúde" }), el("p", { text: "Ministério da Saúde" }), el("p", { text: "Secretaria de Estado da Saúde" })),
      ),
      el("h2", { class: "lme-band", text: "COMPONENTE ESPECIALIZADO DA ASSISTÊNCIA FARMACÊUTICA" }),
      el("h3", { class: "lme-band lme-band-soft", text: "LAUDO DE SOLICITAÇÃO, AVALIAÇÃO E AUTORIZAÇÃO DE MEDICAMENTO(S)" }),
      el("h3", { class: "lme-sub", text: "SOLICITAÇÃO DE MEDICAMENTO(S)" }),
      el("p", { class: "lme-section", text: "CAMPOS DE PREENCHIMENTO EXCLUSIVO PELO MÉDICO SOLICITANTE" }),
      el("div", { class: "lme-row lme-r-1-3" }, box(1, "Número do CNES*", val(INST.cnes)), box(2, "Nome do estabelecimento de saúde solicitante", val(INST.nome))),
      el("div", { class: "lme-row lme-r-4-1" }, box(3, "Nome completo do Paciente*", val(ctx.name)), box(5, "Peso do paciente*", val(draft.weight ? `${draft.weight} kg` : ""))),
      el("div", { class: "lme-row lme-r-4-1" }, box(4, "Nome da Mãe do Paciente*", val(ctx.mother)), box(6, "Altura do paciente*", val(draft.height ? `${draft.height} cm` : ""))),
      el("table", { class: "lme-meds" },
        el("thead", {},
          el("tr", {}, el("th", { rowspan: "2", class: "lme-n" }), el("th", { rowspan: "2", text: "7- Medicamento(s)*" }), el("th", { colspan: "6", text: "8- Quantidade solicitada*" })),
          el("tr", {}, ...["1º mês", "2º mês", "3º mês", "4º mês", "5º mês", "6º mês"].map((t) => el("th", { class: "lme-q", text: t }))),
        ),
        el("tbody", {}, ...rows.map((item, i) => el("tr", {},
          el("td", { class: "lme-n", text: String(i + 1) }),
          el("td", { text: item?.name || "" }),
          ...[0, 1, 2, 3, 4, 5].map((m) => el("td", { class: "lme-q", text: item && m < draft.months ? item.monthly : "" })),
        ))),
      ),
      el("div", { class: "lme-row lme-r-1-4" }, box(9, "CID-10*", val(draft.cid)), box(10, "Diagnóstico", val(cid?.description || ""))),
      box(11, "Anamnese*", val(draft.anamnese, "lme-text"), "lme-tall"),
      box(12, "Paciente realizou tratamento prévio ou está em tratamento da doença?*",
        el("div", { class: "lme-inline" }, check(draft.priorTreatment === "nao", "NÃO"), check(draft.priorTreatment === "sim", "SIM. Relatar:"), val(draft.priorTreatment === "sim" ? draft.priorText : "", "lme-grow"))),
      box(13, "Atestado de capacidade*", el("div", {},
        el("p", { class: "lme-small", text: "A solicitação do medicamento deverá ser realizada pelo paciente. Entretanto, fica dispensada a obrigatoriedade da presença física do paciente considerado incapaz de acordo com os artigos 3º e 4º do Código Civil. O paciente é considerado incapaz?" }),
        el("div", { class: "lme-inline" }, check(draft.incapable === "nao", "NÃO"), check(draft.incapable === "sim", "SIM. Indicar o nome do responsável pelo paciente, o qual poderá realizar a solicitação do medicamento"),
          el("span", { class: "lme-guardian" }, val(draft.incapable === "sim" ? draft.guardian : ""), el("span", { class: "lme-small", text: "Nome do responsável" }))),
      )),
      el("div", { class: "lme-row lme-r-2-1" },
        el("div", {},
          box(14, "Nome do médico solicitante*", val(p?.name)),
          el("div", { class: "lme-row lme-r-2-1" }, box(15, "Número do Cartão Nacional de Saúde (CNS) do médico solicitante*", val(p?.cns)), box(16, "Data da solicitação*", val(formatDate(draft.date)))),
        ),
        // Em branco: o médico assina e carimba à mão (o CRM sai no carimbo, não impresso pelo sistema).
        box(17, "Assinatura e carimbo do médico*", val(""), "lme-sign"),
      ),
      el("div", { class: "lme-box lme-inline lme-filled" },
        el("span", { class: "lme-label", text: "18- CAMPOS ABAIXO PREENCHIDOS POR*:" }),
        check(draft.filledBy === "paciente", "Paciente"), check(draft.filledBy === "mae", "Mãe do paciente"),
        check(draft.filledBy === "responsavel", "Responsável (descrito no item 13)"), check(draft.filledBy === "medico", "Médico solicitante"),
      ),
      el("div", { class: "lme-row lme-r-1-1" },
        box(19, "Raça/Cor/Etnia informado pelo paciente ou responsável*", el("div", { class: "lme-grid-checks" }, ...races.map((r) => check(ctx.race === r, r)))),
        box(20, "Telefone(s) para contato do paciente", val(ctx.phone)),
      ),
      el("div", { class: "lme-row lme-r-1-1" },
        el("div", {},
          box(21, "Número do documento do paciente", el("div", { class: "lme-inline" }, check(docType === "cpf", "CPF ou"), check(docType === "cns", "CNS"), val(docType === "cpf" ? ctx.cpf : ctx.cns))),
          box(22, "Correio eletrônico do paciente", val(ctx.email)),
        ),
        box(23, "Assinatura do responsável pelo preenchimento*", val(""), "lme-sign"),
      ),
      el("p", { class: "lme-foot", text: "* CAMPOS DE PREENCHIMENTO OBRIGATÓRIO" }),
    )]
  }

  // ---------- APAC de hemodiálise ----------
  // Laudo para Solicitação/Autorização de Procedimento Ambulatorial (modelo do SIA/SUS), preenchido para a TRS.
  // Campos 46 a 53 (autorização) ficam em branco: são do autorizador do gestor.
  const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
  const MONTHLY_MAX = { adulto: 13, sorologia: 13, pediatrica: 16 }
  const VIRAL = [["hepatiteB", "hepatite B", "B18.1"], ["hepatiteC", "hepatite C", "B18.2"], ["hiv", "HIV", "B24"]]
  const listPt = (items) => items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : items[0] || ""

  function apacAuto(ctx) {
    const clinical = window.HuNefroDadosClinicos?.getData() || {}
    const markers = clinical.marcadores_virais || {}
    const positive = VIRAL.filter(([id]) => markers[id] === "positivo")
    const pediatric = /Pediátrica/.test(ctx.program)
    const key = pediatric ? "pediatrica" : positive.length ? "sorologia" : "adulto"
    const proc = C.SIGTAP_HD[key]
    const perWeek = Math.min(ctx.hdDays.length || 3, proc.maxPerWeek)
    const access = (window.HuNefroAcessosVasculares?.getData().access || [])
      .filter((a) => a.status === "active").sort((a, b) => b.date.localeCompare(a.date))[0]
    const ktv = exam("Kt/V"), hb = exam("Hemoglobina")
    const known = VIRAL.filter(([id]) => ["positivo", "negativo"].includes(markers[id]))
    const notes = [
      `Doença renal crônica estádio 5 em hemodiálise${ctx.programStart ? ` desde ${ctx.programStart}` : ""}, ${perWeek} ${perWeek === 1 ? "sessão" : "sessões"} por semana${ctx.hdDays.length ? ` (${listPt(ctx.hdDays.map((d) => WEEKDAY_NAMES[d]))})` : ""}${ctx.shift ? `, ${ctx.shift}º turno` : ""}.`,
      access ? `Acesso vascular: ${access.type}${access.loc ? `, ${access.loc.toLowerCase()}` : ""}.` : "",
      ctx.weight ? `Peso seco: ${String(ctx.weight).replace(".", ",")} kg.` : "",
      [ktv && `Kt/V ${String(ktv.result).replace(".", ",")} (${formatDate(ktv.date)})`, hb && `hemoglobina ${String(hb.result).replace(".", ",")} g/dL (${formatDate(hb.date)})`].filter(Boolean).join("; ").replace(/^./, (c) => `Últimos exames: ${c}`) + (ktv || hb ? "." : ""),
      known.length ? `Sorologias: ${known.map(([id, label]) => `${label} ${markers[id]}`).join(", ")}.` : "",
      ctx.allergies.length ? `Alergias: ${ctx.allergies.join(", ")}.` : "",
    ].filter(Boolean).join(" ")
    const phone = (ctx.phone || "").match(/^\(?(\d{2})\)?\s*(.+)$/)
    return {
      proc, key, qty: Math.min(Math.round(perWeek * 52 / 12), MONTHLY_MAX[key]),
      diagnosis: `Doença renal crônica estádio 5 em terapia renal substitutiva (hemodiálise)${ctx.etiology ? `. Etiologia: ${ctx.etiology}` : ""}`,
      cidMain: "N18.0", cidSecondary: ctx.baseCid && ctx.baseCid !== "N18.0" ? ctx.baseCid : "",
      cidAssociated: positive.map(([, , cid]) => cid).join(", "),
      notes, ddd: phone ? phone[1] : "", phoneNumber: phone ? phone[2] : ctx.phone,
      ibge: C.IBGE_MA[Object.keys(C.IBGE_MA).find((n) => normalize(n) === normalize(ctx.city || "")) || ""] || "",
    }
  }

  function apacDocument(apac, ctx, prescriber, date) {
    const p = prescriber
    const band = (text) => el("h3", { class: "lme-band apac-band", text })
    const row = (cls, ...cells) => el("div", { class: `lme-row ${cls}` }, ...cells)
    const races = ["Branca", "Preta", "Parda", "Amarela", "Indígena"]
    // Procedimentos secundários (até 5): usados na Guia SUS da Solicitação de exames.
    const sec = apac.secondary || []
    const secondary = [21, 24, 27, 30, 33].map((n, i) => row("apac-r-proc", box(n, "Código do procedimento secundário", val(sec[i]?.code)), box(n + 1, "Nome do procedimento secundário", val(sec[i]?.name)), box(n + 2, "Qtde.", val(sec[i] ? String(sec[i].qty) : ""))))
    return [page("pr-lme pr-apac",
      el("header", { class: "apac-head" },
        el("div", { class: "lme-head" },
          el("img", { class: "lme-sus", src: "assets/impressao/logo-sus.png", alt: "SUS - Sistema Único de Saúde" }),
          el("div", {}, el("p", { text: "Sistema Único de Saúde" }), el("p", { text: "Ministério da Saúde" })),
        ),
        el("h2", { class: "apac-title", text: "LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL" }),
      ),
      band("IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)"),
      row("lme-r-4-1", box(1, "Nome do estabelecimento de saúde solicitante", val(INST.nome)), box(2, "CNES", val(INST.cnes))),
      band("IDENTIFICAÇÃO DO PACIENTE"),
      row("apac-r-name", box(3, "Nome do paciente", val(ctx.name)),
        box(4, "Sexo", el("div", { class: "lme-inline" }, check(ctx.sex === "Masculino", "Masc."), check(ctx.sex === "Feminino", "Fem."))),
        box(5, "Nº do prontuário", val(ctx.code))),
      row("apac-r-4", box(6, "Cartão Nacional de Saúde (CNS)", val(ctx.cns)), box(7, "Data de nascimento", val(formatDate(ctx.birth))),
        box(8, "Raça/cor", val(races.includes(ctx.race) ? ctx.race : "")), box("8.1", "Etnia", val(""))),
      row("apac-r-phone", box(9, "Nome da mãe", val(ctx.mother)), box(10, "Telefone de contato (DDD e número)", val([apac.ddd && `(${apac.ddd})`, apac.phoneNumber].filter(Boolean).join(" ")))),
      row("apac-r-phone", box(11, "Nome do responsável", val("")), box(12, "Telefone de contato (DDD e número)", val(""))),
      box(13, "Endereço (rua, nº, bairro)", val(ctx.address)),
      row("apac-r-city", box(14, "Município de residência", val(ctx.city)), box(15, "Cód. IBGE município", val(apac.ibge)), box(16, "UF", val(ctx.uf)), box(17, "CEP", val(ctx.cep))),
      band("PROCEDIMENTO SOLICITADO"),
      row("apac-r-proc", box(18, "Código do procedimento principal", val(apac.proc.code)), box(19, "Nome do procedimento principal", val(apac.proc.name)), box(20, "Qtde.", val(String(apac.qty)))),
      band("PROCEDIMENTO(S) SECUNDÁRIO(S)"),
      ...secondary,
      band("JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)"),
      row("apac-r-cid", box(36, "Descrição do diagnóstico", val(apac.diagnosis, "lme-text")), box(37, "CID-10 principal", val(apac.cidMain)), box(38, "CID-10 secundário", val(apac.cidSecondary)), box(39, "CID-10 causas associadas", val(apac.cidAssociated))),
      box(40, "Observações", val(apac.notes, "lme-text"), "apac-notes"),
      band("SOLICITAÇÃO"),
      row("apac-r-sign",
        el("div", {},
          row("lme-r-2-1", box(41, "Nome do profissional solicitante", val(p?.name)), box(42, "Data da solicitação", val(formatDate(date)))),
          row("lme-r-1-3", box(43, "Documento", el("div", { class: "lme-inline" }, check(Boolean(p?.cns), "CNS"), check(false, "CPF"))), box(44, "Nº documento (CNS/CPF) do profissional solicitante", val(p?.cns))),
        ),
        // Em branco: assinatura e carimbo à mão.
        box(45, "Assinatura e carimbo (nº registro do conselho)", val(""), "lme-sign"),
      ),
      band("AUTORIZAÇÃO"),
      row("apac-r-sign",
        el("div", {},
          row("lme-r-2-1", box(46, "Nome do profissional autorizador", val("")), box(47, "Cód. órgão emissor", val(""))),
          row("lme-r-1-3", box(48, "Documento", el("div", { class: "lme-inline" }, check(false, "CNS"), check(false, "CPF"))), box(49, "Nº documento (CNS/CPF) do profissional autorizador", val(""))),
          row("lme-r-1-3", box(50, "Data da autorização", val("")), box(51, "Assinatura e carimbo (nº do registro do conselho)", val(""))),
        ),
        el("div", {}, box(52, "Nº da autorização (APAC)", val(""), "lme-sign"), box(53, "Período de validade da APAC", el("span", { class: "apac-period", text: "____/____/______  a  ____/____/______" }))),
      ),
      band("IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)"),
      row("lme-r-4-1", box(54, "Nome fantasia do estabelecimento de saúde executante", val(INST.nome)), box(55, "CNES", val(INST.cnes))),
    )]
  }

  // ---------- Montagem da lista de documentos ----------
  function buildDocuments({ meds, allMeds, prescriberId, date, lmeDrafts = {} }) {
    const ctx = patientContext()
    const prescriber = professional(prescriberId)
    const opts = { hdDays: ctx.hdDays }
    const info = (m) => MED.find(m.drug) || {}
    const docs = []
    const warnings = []
    const outpatient = meds.filter((m) => !m.hd)
    const blocked = outpatient.filter((m) => ["A", "B1", "B2"].includes(info(m).control))
    const control = outpatient.filter((m) => info(m).control === "C1")
    const antimicrobial = outpatient.filter((m) => info(m).antimicrobial && !info(m).control)
    // Medicações do CEAF aplicadas na HD (alfaepoetina, ferro) também saem na receita: o processo do LME pede a prescrição.
    const simple = meds.filter((m) => (!m.hd || info(m).ceaf) && !info(m).control && !info(m).antimicrobial)
    const names = (list) => list.map((m) => m.drug)

    if (simple.length) docs.push({ key: "receita", kind: "Receituário", title: "Receituário", items: names(simple), vias: 1, pages: () => simpleReceipt(simple, ctx, prescriber, date, opts) })
    if (antimicrobial.length) docs.push({ key: "antimicrobiano", kind: "Antimicrobiano", title: "Receituário de antimicrobiano", items: names(antimicrobial), vias: 2, note: "2 vias · validade de 10 dias", pages: () => antimicrobialReceipt(antimicrobial, ctx, prescriber, date, opts) })
    for (let i = 0; i < control.length; i += RCE_MAX_ITEMS) {
      const chunk = control.slice(i, i + RCE_MAX_ITEMS)
      const part = control.length > RCE_MAX_ITEMS ? ` (${i / RCE_MAX_ITEMS + 1}/${Math.ceil(control.length / RCE_MAX_ITEMS)})` : ""
      docs.push({ key: `controle-${i / RCE_MAX_ITEMS + 1}`, kind: "Controle especial", title: `Receita de controle especial${part}`, items: names(chunk), vias: 2, note: "2 vias · até 3 medicamentos por receita", pages: () => controlReceipt(chunk, ctx, prescriber, date, opts) })
    }
    const hd = meds.filter((m) => m.hd)
    if (hd.length) docs.push({ key: "hd", kind: "Sessão de HD", title: "Medicações na sessão de HD", items: names(hd), vias: 1, note: "folha para a enfermagem", pages: () => hdSheet(hd, ctx, prescriber, date, opts) })

    // APAC: todo paciente em hemodiálise (o laudo não depende das medicações).
    if (/Hemodiálise/.test(ctx.program)) {
      const apac = apacAuto(ctx)
      docs.push({ key: "apac", kind: "APAC", title: "APAC - Hemodiálise", items: [`${apac.proc.code} ${apac.proc.name.split(" (")[0].toLowerCase()}`, `${apac.qty} sessões por mês`], vias: 1, note: "campos de autorização ficam para o gestor", pages: () => apacDocument(apac, ctx, prescriber, date) })
      if (!ctx.cns) warnings.push("APAC: o paciente está sem Cartão Nacional de Saúde (CNS) na Identificação.")
      if (ctx.city && !apac.ibge) warnings.push(`APAC: não encontrei o código IBGE de "${ctx.city}" (campo 15). Confira o município na Identificação.`)
    }

    Object.keys(MED.PROTOCOLS).forEach((key) => {
      const list = meds.filter((m) => info(m).ceaf === key)
      if (!list.length) return
      const auto = lmeAuto(key, list, allMeds, ctx, prescriberId)
      const saved = lmeDrafts[key]
      // O rascunho revisado vale enquanto as medicações do protocolo forem as mesmas.
      const draft = saved && saved.items.map((x) => x.medId).join() === auto.items.map((x) => x.medId).join() ? { ...saved, prescriber: prescriberId } : auto
      const exams = examStatus(key)
      const missing = exams.filter((e) => !e.ok)
      docs.push({
        key: `lme-${key}`, kind: "LME", title: `LME - ${MED.PROTOCOLS[key].name}`, items: draft.items.map((x) => x.name), vias: 1, lme: key, draft, auto, edited: draft !== auto,
        note: missing.length ? `exames a atualizar: ${missing.map((e) => e.name).join(", ")}` : "exames dentro da validade",
        noteLevel: missing.length ? "warning" : "ok",
        pages: () => lmeDocument(draft, ctx),
      })
      if (!draft.weight || !draft.height) warnings.push(`LME - ${MED.PROTOCOLS[key].name}: falta ${!draft.weight ? "peso" : ""}${!draft.weight && !draft.height ? " e " : ""}${!draft.height ? "altura" : ""} (Dados Clínicos).`)
    })

    // Portaria 344/1998, arts. 59 e 60: até 60 dias de tratamento por receita (anticonvulsivantes, 6 meses).
    control.forEach((m) => {
      const perDay = MED.dosesPerDay(m.posology, ctx.hdDays.length || 3) * MED.unitsPerDose(m.posology)
      const days = Number(m.qty) && perDay ? Math.round(Number(m.qty) / perDay) : 0
      const limit = info(m).anticonvulsant ? 180 : 60
      if (days > limit) warnings.push(`${m.drug}: a quantidade cobre cerca de ${days} dias. A Portaria 344/1998 limita a ${limit === 180 ? "6 meses" : "60 dias"} por receita; acima disso, a receita precisa de justificativa com CID e posologia.`)
    })
    if (blocked.length) warnings.push(`${names(blocked).join(", ")}: exige Notificação de Receita (talonário numerado pela Vigilância Sanitária). Não é impressa pelo sistema.`)
    if (control.length && !ctx.cpf) warnings.push("Receita de controle especial: o paciente está sem CPF na Identificação. A receita sairá com \"não possui\".")
    if (control.length && !ctx.address) warnings.push("Receita de controle especial: complete o endereço do paciente na Identificação.")
    if (docs.some((d) => d.lme) && !INST.cnes) warnings.push("LME: o CNES do hospital ainda não está cadastrado (campo 1).")
    if (prescriber && !prescriber.council) warnings.push("O prescritor selecionado não tem registro no conselho cadastrado.")
    if (prescriber && /nefrolog/i.test(String(prescriber.specialty || "")) && !prescriber.rqe) warnings.push("O prescritor é nefrologista e está sem RQE no cadastro do profissional: a especialidade não sai na receita.")
    return { docs, warnings, ctx }
  }

  // ---------- Impressão ----------
  let root = null
  function print(docs) {
    if (!root) {
      root = el("div", { id: "hn-print-root", class: "hn-print-root", "aria-hidden": "true" })
      document.body.append(root)
    }
    root.replaceChildren(...docs.flatMap((d) => d.pages()))
    document.body.classList.add("hn-printing")
    // Espera as logos carregarem antes de abrir a janela de impressão.
    const images = [...root.querySelectorAll("img")].filter((img) => !img.complete)
    Promise.all(images.map((img) => new Promise((done) => { img.onload = img.onerror = done }))).then(() => window.print())
  }
  window.addEventListener("afterprint", () => document.body.classList.remove("hn-printing"))

  // As peças do padrão de impressão (letterhead, compactHead, field, patientBox, signature, footer, page) também servem aos Laudos
  // e à impressão da História Clínica,
  // e a APAC (apacAuto, apacDocument) serve à Guia SUS da Solicitação de exames.
  window.HuNefroReceituarios = {
    patientContext, buildDocuments, lmeAuto, examStatus, print, dateInWords, professional, councilOf,
    letterhead, compactHead, field, patientBox, signature, footer, page, apacAuto, apacDocument,
  }
})()
