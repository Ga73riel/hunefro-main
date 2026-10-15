// Listas (catálogos) compartilhadas entre as telas do prontuário.
//
// TODAS AS LISTAS ABAIXO SÃO PROVISÓRIAS (desenvolvimento). Devem ser substituídas por
// chamadas à API do backend (CID-10 completo, profissionais do AGHU, tipos cadastrados
// pelo administrador). Nomes de profissionais são fictícios.
(() => {
  "use strict"

  const pairs = (list) => list.map((value) => [value, value])

  // Amostra de CID-10. A lista completa deve vir da API.
  const CID = [
    ["A09", "Diarreia e gastroenterite de origem infecciosa presumível"],
    ["A41.9", "Septicemia não especificada"],
    ["B18.2", "Hepatite viral crônica C"],
    ["C90.0", "Mieloma múltiplo"],
    ["E10.2", "Diabetes mellitus insulino-dependente - com complicações renais"],
    ["E11.2", "Diabetes mellitus não-insulino-dependente - com complicações renais"],
    ["E21.1", "Hiperparatireoidismo secundário não classificado em outra parte"],
    ["I10", "Hipertensão essencial (primária)"],
    ["I12.0", "Doença renal hipertensiva com insuficiência renal"],
    ["I50.0", "Insuficiência cardíaca congestiva"],
    ["I63.9", "Infarto cerebral não especificado"],
    ["J18.9", "Pneumonia não especificada"],
    ["K65.0", "Peritonite aguda"],
    ["M32.1", "Lúpus eritematoso disseminado [sistêmico] com comprometimento de outros órgãos e sistemas"],
    ["N03", "Síndrome nefrítica crônica"],
    ["N04", "Síndrome nefrótica"],
    ["N05", "Síndrome nefrítica não especificada"],
    ["N11", "Pielonefrite crônica"],
    ["N17.9", "Insuficiência renal aguda não especificada"],
    ["N18.0", "Doença renal em estádio final"],
    ["N18.8", "Outras insuficiências renais crônicas"],
    ["N18.9", "Insuficiência renal crônica não especificada"],
    ["N19", "Insuficiência renal não especificada"],
    ["N28.9", "Transtorno não especificado do rim e do ureter"],
    ["Q61.2", "Doença renal policística, autossômica dominante"],
    ["Q61.3", "Rim policístico, não especificado"],
    ["T82.7", "Infecção e reação inflamatória devidas a outros dispositivos protéticos, implantes e enxertos cardíacos e vasculares"],
    ["T86.1", "Falência ou rejeição de transplante de rim"],
    ["Z94.0", "Rim transplantado"],
  ].map(([code, description]) => ({ code, description, label: `${code} - ${description}` }))

  // Profissionais (AGHU). category: "medico" | "enfermagem" | "nutricao" | "servico-social" | "psicologia"
  const PROFESSIONALS = [
    { id: "p-001", name: "Profissional Exemplo 01", category: "medico", specialty: "Nefrologia" },
    { id: "p-002", name: "Profissional Exemplo 02", category: "medico", specialty: "Nefrologia" },
    { id: "p-003", name: "Profissional Exemplo 03", category: "enfermagem", specialty: "Enfermagem" },
    { id: "p-004", name: "Profissional Exemplo 04", category: "enfermagem", specialty: "Enfermagem" },
    { id: "p-005", name: "Profissional Exemplo 05", category: "nutricao", specialty: "Nutrição" },
    { id: "p-006", name: "Profissional Exemplo 06", category: "servico-social", specialty: "Serviço Social" },
    { id: "p-007", name: "Profissional Exemplo 07", category: "psicologia", specialty: "Psicologia" },
    { id: "p-008", name: "Profissional Exemplo 08", category: "medico", specialty: "Cardiologia" },
    { id: "p-009", name: "Profissional Exemplo 09", category: "medico", specialty: "Cirurgia Vascular" },
  ].map((p) => ({ ...p, label: `${p.name} — ${p.specialty}` }))

  const pro = (filter) => PROFESSIONALS.filter(filter).map((p) => [p.id, p.label])

  window.HuNefroCatalogos = {
    CID,
    PROFESSIONALS,
    // Todos os profissionais (equipe vinculada)
    professionalOptions: () => pro(() => true),
    // Somente médicos (ex.: responsável pela transfusão, médico/assistente da internação)
    doctorOptions: () => PROFESSIONALS.filter((p) => p.category === "medico").map((p) => [p.id, p.name]),
    // Especialistas médicos, exceto nefrologia (avaliação por outro especialista)
    specialistOptions: () =>
      PROFESSIONALS.filter((p) => p.category === "medico" && p.specialty !== "Nefrologia").map((p) => [
        p.id,
        `${p.name} — ${p.specialty}`,
      ]),
    specialties: pairs(["Cardiologia", "Cirurgia Vascular", "Endocrinologia", "Infectologia", "Neurologia", "Psiquiatria"]),

    // Tipos de evento (listas provisórias; o administrador poderá cadastrar novos)
    tiposProblema: pairs([
      "Anemia da doença renal crônica",
      "Hiperparatireoidismo secundário",
      "Hipertensão arterial",
      "Insuficiência cardíaca",
      "Hipotensão intradialítica",
    ]),
    tiposInternacao: pairs([
      "AVC",
      "Cirurgia para confecção de acesso",
      "Descompensação cardiovascular",
      "Infecção",
    ]),
    tiposInfeccao: pairs([
      "Abscesso Intra-abdominal",
      "Fístula Arteriovenosa (FAV)",
      "Infecção do óstio do cateter",
      "Infecção de corrente sanguínea",
      "Peritonite",
      "Pneumonia",
    ]),
    tiposTransfusao: pairs(["Hemácias", "Outro", "Plaquetas", "Plasma", "Total"]),
    tiposAlergia: pairs(["Alimentar", "Medicamentosa", "Outra"]),
    alergiasMedicamentosas: pairs(["Dipirona", "Penicilina", "Sulfas", "Contraste iodado"]),

    // Infecção
    posicoesInfeccao: pairs(["Aguardando resultado", "Confirmada", "Descartada", "Diagnóstico Clínico"]),
    culturas: pairs([
      "Não Coletada",
      "Fezes",
      "Líquido ascítico",
      "Líquido de diálise peritoneal",
      "Líquido pericárdico",
      "Líquido pleural",
      "Líquor",
      "Óstio do cateter de hemodiálise",
      "Óstio do cateter de Tenckhoff",
      "Ponta de cateter",
      "Sangue da fístula arterio-venosa",
      "Sangue da linha",
      "Sangue lúmen do cateter de hemodiálise",
      "Sangue periférico",
      "Secreção de fístula arterio-venosa",
      "Secreção de incisão cirúrgica",
      "Secreção de pele",
      "Secreção vaginal",
      "Sinovial",
      "Swab anal",
      "Swab nasal",
      "Swab Osteo Cateter",
      "Urina",
    ]),
    agentes: pairs([
      "Enterococcus faecalis",
      "Escherichia coli",
      "Klebsiella pneumoniae",
      "Pseudomonas aeruginosa",
      "Staphylococcus aureus",
      "Staphylococcus epidermidis",
    ]),
    antibioticos: pairs([
      "Amoxicilina",
      "Ampicilina",
      "Ácido Pipemídico",
      "Cefazolina",
      "Ceftriaxona",
      "Ciprofloxacino",
      "Gentamicina",
      "Meropenem",
      "Oxacilina",
      "Vancomicina",
    ]),
    acessosVasculares: pairs([
      "Cateter de hemodiálise",
      "Cateter de diálise peritoneal",
      "FAV",
      "Prótese vascular",
      "Não se aplica",
    ]),
  }
})()
