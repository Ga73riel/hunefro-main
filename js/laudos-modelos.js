// Modelos de preenchimento rápido dos Laudos (PROVISÓRIO: o administrador poderá cadastrar e editar os modelos).
//
// Cada modelo cabe em uma folha, exceto os marcados com multiPage, que são paginados.
// Cada modelo monta o texto do laudo a partir do contexto do paciente (montado em js/laudos.js com os dados das
// outras abas). Dado que não existe no prontuário sai como [preencher]: na tela o médico completa, e na impressão
// ele vira uma linha em branco para preencher à mão.
// Convenções do texto: linha curta terminada em ":" vira título de seção e linha iniciada por "- " vira item de lista.
(() => {
  "use strict"

  const BLANK = "[preencher]"
  const or = (text) => (text ? String(text) : BLANK)
  const listPt = (items) => items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : items[0] || ""
  const bullets = (items, empty = "Nenhum registro no prontuário.") => (items.length ? items : [empty]).map((t) => `- ${t}`)
  // Lista longa (exames, sorologias, medicações) em um parágrafo só, para caber em uma folha.
  const inlineList = (items, empty) => (items.length ? `${items.join("; ")}.` : empty)
  const lines = (...parts) => parts.flat(Infinity).filter((p) => p !== null && p !== undefined && p !== false).join("\n").replace(/\n{3,}/g, "\n\n").trim()

  // Concordância com o sexo do paciente.
  const art = (ctx) => (ctx.female ? "a paciente" : "o paciente")
  const Art = (ctx) => (ctx.female ? "A paciente" : "O paciente")
  const carrier = (ctx) => (ctx.female ? "portadora" : "portador")

  const DRC = "doença renal crônica estádio 5 (CID-10 N18.0)"
  const since = (ctx) => (ctx.programStart ? ` desde ${ctx.programStart}` : "")
  const etiologyLine = (ctx) => ctx.etiology ? `${ctx.etiology}${ctx.baseCid ? ` (CID-10 ${ctx.baseCid})` : ""}` : ""
  const hdRoutine = (ctx) => {
    const days = ctx.hdDayNames.length ? ` (${listPt(ctx.hdDayNames)})` : ""
    const shift = ctx.shift ? `, no ${ctx.shift}º turno` : ""
    return `${ctx.perWeek} ${ctx.perWeek === 1 ? "sessão" : "sessões"} por semana${days}${shift}`
  }
  const accessText = (a) => `${a.type}${a.loc ? `, ${a.loc.toLowerCase()}` : ""}${a.date ? `, desde ${a.dateBr}` : ""}`
  const diagnoses = (ctx) => [
    `Doença renal crônica estádio 5 em hemodiálise (CID-10 N18.0)`,
    etiologyLine(ctx) && `Doença de base: ${etiologyLine(ctx)}`,
    ...ctx.problems,
  ].filter(Boolean)

  const MODELS = [
    {
      id: "acessos-vasculares",
      name: "Acessos vasculares",
      hint: "Encaminhamento à Cirurgia Vascular",
      title: "ENCAMINHAMENTO - CIRURGIA VASCULAR",
      layout: "padrao",
      build(ctx) {
        const a = ctx.activeAccess
        const reason = !a ? "confecção de acesso vascular para hemodiálise"
          : a.kind === "cateter" ? "confecção de acesso vascular definitivo (fístula arteriovenosa) para o tratamento dialítico"
            : ctx.accessProblem ? "avaliação de disfunção da fístula arteriovenosa" : "avaliação da fístula arteriovenosa"
        return lines(
          `Encaminho ${art(ctx)} ${ctx.name}, em programa regular de hemodiálise neste serviço${since(ctx)}, para avaliação pela Cirurgia Vascular, com a finalidade de ${reason}.`,
          "",
          "Diagnóstico:",
          bullets(diagnoses(ctx)),
          "",
          "Acesso atual:",
          bullets(a ? [accessText(a)] : [], "Sem acesso vascular ativo registrado."),
          "",
          "Histórico de acessos:",
          bullets(ctx.previousAccesses, "Sem acessos anteriores registrados."),
          ctx.accessEvents.length ? ["", "Últimas intercorrências do acesso:", bullets(ctx.accessEvents)] : null,
          "",
          `Hemodiálise: ${hdRoutine(ctx)}${ctx.hd.bloodFlow ? `, fluxo de sangue de ${ctx.hd.bloodFlow} mL/min` : ""}.`,
          ctx.allergies.length ? `Alergias: ${ctx.allergies.join(", ")}.` : "Sem alergias registradas.",
          "",
          "Solicito avaliação e conduta.",
        )
      },
    },
    {
      id: "passe-livre",
      name: "Passe livre",
      hint: "Laudo para gratuidade no transporte",
      title: "LAUDO MÉDICO PARA PASSE LIVRE",
      layout: "padrao",
      build(ctx) {
        const companion = ctx.age !== null && ctx.age < 18 ? `sim, por se tratar de menor de idade (responsável: ${or(ctx.mother)})` : BLANK
        return lines(
          `Atesto, para fins de concessão do Passe Livre no transporte coletivo, que ${art(ctx)} ${ctx.name}, Cartão Nacional de Saúde ${or(ctx.cns)}, é ${carrier(ctx)} de ${DRC}, em programa regular de hemodiálise no ${ctx.institution}${since(ctx)}.`,
          "",
          `O tratamento é contínuo e por tempo indeterminado, sem previsão de alta, e exige o deslocamento ao hospital em ${hdRoutine(ctx)}, além das consultas e exames de acompanhamento.`,
          "",
          `Necessita de acompanhante: ${companion}.`,
          "",
          `Município de residência: ${or([ctx.city, ctx.uf].filter(Boolean).join(" - "))}.`,
        )
      },
    },
    {
      id: "relatorio-drc",
      name: "Relatório DRC",
      hint: "Relatório médico da doença renal crônica",
      title: "RELATÓRIO MÉDICO",
      layout: "padrao",
      build(ctx) {
        return lines(
          `${Art(ctx)} ${ctx.name}${ctx.age !== null ? `, ${ctx.age} anos` : ""}, é ${carrier(ctx)} de ${DRC}${ctx.etiology ? `, tendo como causa ${ctx.etiology.toLowerCase()}` : ""}. Está em programa regular de hemodiálise neste serviço${since(ctx)}, em ${hdRoutine(ctx)}${ctx.hd.duration ? `, com duração de ${ctx.hd.durationText} cada` : ""}.`,
          "",
          "Diagnósticos:",
          bullets(diagnoses(ctx)),
          "",
          "Acesso vascular:",
          bullets(ctx.activeAccess ? [accessText(ctx.activeAccess)] : [], "Sem acesso vascular ativo registrado."),
          "",
          `Exames recentes${ctx.examsDate ? ` (${ctx.examsDate})` : ""}: ${inlineList(ctx.exams, "sem exames registrados.")}`,
          "",
          "Medicações em uso:",
          bullets(ctx.meds, "Sem medicações em uso registradas."),
          "",
          "Conclusão:",
          `Trata-se de doença crônica e irreversível, que exige hemodiálise contínua por tempo indeterminado, até a realização de transplante renal. ${Art(ctx)} precisa comparecer ao hospital ${ctx.perWeek} vezes por semana e não deve interromper o tratamento.`,
        )
      },
    },
    {
      // Relatório médico especializado para fins de perícia (Res. CFM 2.381/2024, art. 4º, VIII), com os itens que o
      // INSS confere na análise documental (Portaria Conjunta MPS/INSS nº 13/2026): identificação do segurado, data,
      // diagnóstico ou CID, tempo estimado de afastamento, assinatura e registro no conselho.
      // O CID só sai com autorização expressa do paciente, registrada no próprio documento.
      id: "inss",
      name: "Relatório para o INSS",
      hint: "Perícia médica e benefício por incapacidade",
      title: "RELATÓRIO MÉDICO PARA FINS DE PERÍCIA - INSS",
      layout: "completo",
      multiPage: true, // pode passar de uma folha (pedido de Elias, 29/10/2026)
      build(ctx) {
        const h = ctx.hd
        const therapy = [
          `Hemodiálise em ${hdRoutine(ctx)}${h.duration ? `, ${h.durationText} por sessão` : ""}`,
          ctx.activeAccess ? `acesso vascular: ${accessText(ctx.activeAccess)}` : "",
        ].filter(Boolean).join("; ")
        const fav = ctx.activeAccess?.kind === "fav"
        return lines(
          `Relatório solicitado pel${ctx.female ? "a" : "o"} paciente para a Perícia Médica Federal do INSS. Acompanhad${ctx.female ? "a" : "o"} neste serviço${since(ctx)}.`,
          "",
          "Diagnóstico:",
          bullets(diagnoses(ctx)),
          "",
          `Terapêutica atual: ${therapy}.`,
          "",
          "Medicações em uso:",
          bullets(ctx.meds, "Nenhuma medicação em uso registrada."),
          "",
          `Exames complementares${ctx.examsDate ? ` (${ctx.examsDate})` : ""}: ${inlineList(ctx.exams, "sem exames registrados.")}`,
          "",
          "Evolução clínica:",
          bullets([
            ...ctx.clinicalEvents,
            ...ctx.recentComplications.map((c) => `Na sessão de ${c}`),
            ctx.transfusions.length ? `Hemotransfusão, a última em ${ctx.transfusions[0]}` : "",
          ].filter(Boolean), "Sem internações ou intercorrências graves nos últimos 12 meses."),
          "",
          `Prognóstico: doença crônica, progressiva e irreversível. Depende de hemodiálise por tempo indeterminado, sem previsão de alta, até a realização de transplante renal. Do ponto de vista clínico, o quadro corresponde a nefropatia grave (doença renal crônica estádio 5 em terapia renal substitutiva).`,
          "",
          "Limitações para o trabalho:",
          bullets([
            `Comparecimento obrigatório ao hospital ${ctx.perWeek} vezes por semana${ctx.shift ? `, no ${ctx.shift}º turno` : ""}, além de consultas e exames.`,
            "Fadiga, hipotensão e câimbras após as sessões, que reduzem a capacidade para esforço físico.",
            fav ? "Fístula arteriovenosa no membro superior: não pode receber carga, compressão ou trauma." : "Cateter venoso central: risco de infecção e restrição a esforço e a ambientes insalubres.",
          ]),
          "",
          // A conclusão sobre a incapacidade é do médico: o sistema só sugere a data de início da hemodiálise.
          `Conclusão: incapacidade para o trabalho ${BLANK} (temporária ou permanente), com início provável em ${or(ctx.programStart)} (início da hemodiálise). Tempo estimado de afastamento: ${BLANK} dias.`,
          "",
          `Autorizo a inclusão do diagnóstico e do CID-10 neste relatório. Assinatura d${ctx.female ? "a" : "o"} paciente ou responsável: ${BLANK}`,
        )
      },
    },
    {
      id: "transplante",
      name: "Relatório médico transplante",
      hint: "Encaminhamento ao pré-transplante renal",
      title: "ENCAMINHAMENTO AO AMBULATÓRIO DE PRÉ-TRANSPLANTE RENAL",
      layout: "completo",
      build(ctx) {
        const m = ctx.markers
        const serology = [["HBsAg (hepatite B)", m.hepatiteB], ["Anti-HCV (hepatite C)", m.hepatiteC], ["Anti-HIV", m.hiv], ["Anti-HBs", m.antiHbs], ["CMV IgG", m.cmvIgg], ["Chagas", m.chagasIgm]]
          .map(([label, value]) => `${label} ${value === "positivo" ? "positivo" : value === "negativo" ? "negativo" : BLANK}`)
        return lines(
          `Encaminho ${art(ctx)} para avaliação no ambulatório de pré-transplante renal. Médico assistente: ${or(ctx.authorName)}.`,
          "",
          "Terapia renal substitutiva:",
          bullets([
            `Início da terapia renal substitutiva: ${or(ctx.programStart)}, no Serviço de Nefrologia do HU-UFMA`,
            `Hemodiálise: ${hdRoutine(ctx)}`,
            `Diurese residual: ${or(ctx.diuresis)}. Ganho de peso interdialítico médio: ${or(ctx.gid)}. Peso seco: ${ctx.weight ? `${ctx.weightText} kg` : BLANK}`,
            `Acesso atual: ${ctx.activeAccess ? accessText(ctx.activeAccess) : "sem acesso ativo registrado"}`,
            `Acessos prévios: ${ctx.previousAccesses.length ? ctx.previousAccesses.join("; ") : "nenhum registrado"}`,
          ]),
          "",
          "Diagnósticos:",
          bullets(diagnoses(ctx)),
          "",
          "Dados para a avaliação:",
          bullets([
            `Tipagem sanguínea (ABO/Rh): ${or(ctx.abo)}`,
            `Hemotransfusão: ${ctx.transfusions.length ? `sim, ${ctx.transfusions.length} ${ctx.transfusions.length === 1 ? "registro" : "registros"}. Data da última bolsa: ${ctx.transfusions[0]}` : "sem registro no prontuário"}`,
            ctx.female ? `Gestações: ${ctx.pregnancies !== null ? ctx.pregnancies : BLANK}. Partos e abortos: ${BLANK}. Última gestação: ${or(ctx.lastPregnancy)}` : null,
            `Alergias: ${ctx.allergies.length ? ctx.allergies.join(", ") : "nenhuma registrada"}`,
            `Ocupação: ${BLANK}`,
            `Estrutura familiar e suporte: ${BLANK}`,
          ].filter(Boolean)),
          "",
          `Sorologias: ${inlineList(serology)}`,
          "",
          `Exames recentes${ctx.examsDate ? ` (${ctx.examsDate})` : ""}: ${inlineList(ctx.exams, "sem exames registrados.")}`,
        )
      },
    },
    {
      id: "resumo-paciente",
      name: "Resumo do paciente",
      hint: "Resumo clínico em uma folha",
      title: "RESUMO CLÍNICO DO PACIENTE",
      layout: "compacto",
      build(ctx) {
        const h = ctx.hd
        const prescription = [
          h.method, h.dialyzer && `dialisador ${h.dialyzer}`, h.duration && ctx.hd.durationText, h.bloodFlow && `fluxo de sangue ${h.bloodFlow} mL/min`,
          h.dialysateFlow && `fluxo de dialisato ${h.dialysateFlow} mL/min`, h.heparin && `heparina ${h.heparin} UI`, ctx.weight && `peso seco ${ctx.weightText} kg`,
        ].filter(Boolean)
        return lines(
          `Programa: ${or(ctx.program)}${since(ctx)}. ${hdRoutine(ctx).replace(/^./, (c) => c.toUpperCase())}${ctx.room ? `, sala ${ctx.room}` : ""}.`,
          prescription.length ? `Prescrição de hemodiálise atual: ${prescription.join(", ")}.` : "Sem prescrição de hemodiálise registrada.",
          `Acesso vascular: ${ctx.activeAccess ? accessText(ctx.activeAccess) : "sem acesso ativo registrado"}.`,
          `Tipagem sanguínea: ${or(ctx.abo)}. Diurese residual: ${or(ctx.diuresis)}. Ganho interdialítico médio: ${or(ctx.gid)}.`,
          "",
          "Diagnósticos:",
          bullets(diagnoses(ctx)),
          "",
          `Alergias: ${inlineList(ctx.allergies, "nenhuma registrada.")}`,
          "",
          `Exames recentes${ctx.examsDate ? ` (${ctx.examsDate})` : ""}: ${inlineList(ctx.exams, "sem exames registrados.")}`,
          "",
          "Medicações em uso:",
          bullets(ctx.meds, "Sem medicações em uso registradas."),
          ctx.recentComplications.length ? ["", "Intercorrências nas sessões (últimos 30 dias):", bullets(ctx.recentComplications)] : null,
        )
      },
    },
    {
      id: "em-branco",
      name: "Laudo em branco",
      hint: "Texto livre com o cabeçalho do hospital",
      title: "",
      layout: "padrao",
      build: () => "",
    },
  ]

  // Modelos de impressão: o mesmo texto pode sair em folhas diferentes.
  const LAYOUTS = [
    { id: "padrao", name: "Padrão HU-UFMA", hint: "timbrado completo e identificação básica" },
    { id: "completo", name: "Identificação completa", hint: "para encaminhamentos a outros serviços" },
    { id: "compacto", name: "Compacto", hint: "cabeçalho reduzido, mais espaço para o texto" },
  ]

  // Modelos cadastrados na Gestão (js/gestao-store.js), antes do Laudo em branco.
  const blankIndex = MODELS.findIndex((m) => m.id === "em-branco")
  MODELS.splice(blankIndex < 0 ? MODELS.length : blankIndex, 0, ...(window.HuNefroAdmin?.customLaudoModels() || []))

  window.HuNefroLaudosModelos = {
    MODELS, LAYOUTS, BLANK,
    find: (id) => MODELS.find((m) => m.id === id) || null,
    layout: (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0],
  }
})()
