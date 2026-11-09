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
    ["E83.3", "Distúrbios do metabolismo do fósforo"],
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
    ["N18.2", "Doença renal crônica, estádio 2"],
    ["N18.3", "Doença renal crônica, estádio 3"],
    ["N18.4", "Doença renal crônica, estádio 4"],
    ["N18.5", "Doença renal crônica, estádio 5"],
    ["N18.8", "Outras insuficiências renais crônicas"],
    ["N18.9", "Insuficiência renal crônica não especificada"],
    ["N19", "Insuficiência renal não especificada"],
    ["N25.0", "Osteodistrofia renal"],
    ["N28.9", "Transtorno não especificado do rim e do ureter"],
    ["Q61.2", "Doença renal policística, autossômica dominante"],
    ["Q61.3", "Rim policístico, não especificado"],
    ["T82.7", "Infecção e reação inflamatória devidas a outros dispositivos protéticos, implantes e enxertos cardíacos e vasculares"],
    ["T86.1", "Falência ou rejeição de transplante de rim"],
    ["Z94.0", "Rim transplantado"],
  ].map(([code, description]) => ({ code, description, label: `${code} - ${description}` }))

  // Profissionais (AGHU). category: "medico" | "enfermagem" | "nutricao" | "servico-social" | "psicologia"
  // Médicos trazem conselho (CRM/UF), RQE da especialidade e CNS, que saem nas receitas e no LME. Números fictícios.
  const PROFESSIONALS = [
    { id: "p-001", name: "Profissional Exemplo 01", category: "medico", specialty: "Nefrologia", council: "CRM", councilNumber: "0000-1", councilUf: "MA", rqe: "0001", cns: "700 0000 0000 0001" },
    { id: "p-002", name: "Profissional Exemplo 02", category: "medico", specialty: "Nefrologia", council: "CRM", councilNumber: "0000-2", councilUf: "MA", rqe: "0002", cns: "700 0000 0000 0002" },
    { id: "p-003", name: "Profissional Exemplo 03", category: "enfermagem", specialty: "Enfermagem" },
    { id: "p-004", name: "Profissional Exemplo 04", category: "enfermagem", specialty: "Enfermagem" },
    { id: "p-005", name: "Profissional Exemplo 05", category: "nutricao", specialty: "Nutrição" },
    { id: "p-006", name: "Profissional Exemplo 06", category: "servico-social", specialty: "Serviço Social" },
    { id: "p-007", name: "Profissional Exemplo 07", category: "psicologia", specialty: "Psicologia" },
    { id: "p-008", name: "Profissional Exemplo 08", category: "medico", specialty: "Cardiologia", council: "CRM", councilNumber: "0000-8", councilUf: "MA", cns: "700 0000 0000 0008" },
    { id: "p-009", name: "Profissional Exemplo 09", category: "medico", specialty: "Cirurgia Vascular", council: "CRM", councilNumber: "0000-9", councilUf: "MA", cns: "700 0000 0000 0009" },
  ].map((p) => ({ ...p, label: `${p.name} - ${p.specialty}` }))

  const pro = (filter) => PROFESSIONALS.filter(filter).map((p) => [p.id, p.label])

  // Estabelecimento emitente das receitas e do LME (dados informados por Elias em 28/10/2026).
  // Virão do cadastro do administrador quando a API existir.
  // Códigos IBGE dos 217 municípios do Maranhão (campo 15 da APAC).
  const IBGE_MA = Object.freeze({
    "Afonso Cunha": "2100105", "Alcântara": "2100204", "Aldeias Altas": "2100303", "Altamira do Maranhão": "2100402",
    "Alto Alegre do Maranhão": "2100436", "Alto Alegre do Pindaré": "2100477", "Alto Parnaíba": "2100501", "Amapá do Maranhão": "2100550",
    "Amarante do Maranhão": "2100600", "Anajatuba": "2100709", "Anapurus": "2100808", "Apicum-Açu": "2100832", "Araguanã": "2100873",
    "Araioses": "2100907", "Arame": "2100956", "Arari": "2101004", "Axixá": "2101103", "Açailândia": "2100055", "Bacabal": "2101202",
    "Bacabeira": "2101251", "Bacuri": "2101301", "Bacurituba": "2101350", "Balsas": "2101400", "Barra do Corda": "2101608",
    "Barreirinhas": "2101707", "Barão de Grajaú": "2101509", "Bela Vista do Maranhão": "2101772", "Belágua": "2101731", "Benedito Leite": "2101806",
    "Bequimão": "2101905", "Bernardo do Mearim": "2101939", "Boa Vista do Gurupi": "2101970", "Bom Jardim": "2102002",
    "Bom Jesus das Selvas": "2102036", "Bom Lugar": "2102077", "Brejo": "2102101", "Brejo de Areia": "2102150", "Buriti": "2102200",
    "Buriti Bravo": "2102309", "Buriticupu": "2102325", "Buritirana": "2102358", "Cachoeira Grande": "2102374", "Cajapió": "2102408",
    "Cajari": "2102507", "Campestre do Maranhão": "2102556", "Cantanhede": "2102705", "Capinzal do Norte": "2102754", "Carolina": "2102804",
    "Carutapera": "2102903", "Caxias": "2103000", "Cedral": "2103109", "Central do Maranhão": "2103125", "Centro Novo do Maranhão": "2103174",
    "Centro do Guilherme": "2103158", "Chapadinha": "2103208", "Cidelândia": "2103257", "Codó": "2103307", "Coelho Neto": "2103406",
    "Colinas": "2103505", "Conceição do Lago-Açu": "2103554", "Coroatá": "2103604", "Cururupu": "2103703", "Cândido Mendes": "2102606",
    "Davinópolis": "2103752", "Dom Pedro": "2103802", "Duque Bacelar": "2103901", "Esperantinópolis": "2104008", "Estreito": "2104057",
    "Feira Nova do Maranhão": "2104073", "Fernando Falcão": "2104081", "Formosa da Serra Negra": "2104099", "Fortaleza dos Nogueiras": "2104107",
    "Fortuna": "2104206", "Godofredo Viana": "2104305", "Gonçalves Dias": "2104404", "Governador Archer": "2104503",
    "Governador Edison Lobão": "2104552", "Governador Eugênio Barros": "2104602", "Governador Luiz Rocha": "2104628",
    "Governador Newton Bello": "2104651", "Governador Nunes Freire": "2104677", "Grajaú": "2104800", "Graça Aranha": "2104701",
    "Guimarães": "2104909", "Humberto de Campos": "2105005", "Icatu": "2105104", "Igarapé Grande": "2105203", "Igarapé do Meio": "2105153",
    "Imperatriz": "2105302", "Itaipava do Grajaú": "2105351", "Itapecuru Mirim": "2105401", "Itinga do Maranhão": "2105427", "Jatobá": "2105450",
    "Jenipapo dos Vieiras": "2105476", "Joselândia": "2105609", "João Lisboa": "2105500", "Junco do Maranhão": "2105658", "Lago Verde": "2105906",
    "Lago da Pedra": "2105708", "Lago do Junco": "2105807", "Lago dos Rodrigues": "2105948", "Lagoa Grande do Maranhão": "2105963",
    "Lagoa do Mato": "2105922", "Lajeado Novo": "2105989", "Lima Campos": "2106003", "Loreto": "2106102", "Luís Domingues": "2106201",
    "Magalhães de Almeida": "2106300", "Maracaçumé": "2106326", "Marajá do Sena": "2106359", "Maranhãozinho": "2106375", "Mata Roma": "2106409",
    "Matinha": "2106508", "Matões": "2106607", "Matões do Norte": "2106631", "Milagres do Maranhão": "2106672", "Mirador": "2106706",
    "Miranda do Norte": "2106755", "Mirinzal": "2106805", "Montes Altos": "2107001", "Monção": "2106904", "Morros": "2107100",
    "Nina Rodrigues": "2107209", "Nova Colinas": "2107258", "Nova Iorque": "2107308", "Nova Olinda do Maranhão": "2107357",
    "Olho d'Água das Cunhãs": "2107407", "Olinda Nova do Maranhão": "2107456", "Palmeirândia": "2107605", "Paraibano": "2107704",
    "Parnarama": "2107803", "Passagem Franca": "2107902", "Pastos Bons": "2108009", "Paulino Neves": "2108058", "Paulo Ramos": "2108108",
    "Paço do Lumiar": "2107506", "Pedreiras": "2108207", "Pedro do Rosário": "2108256", "Penalva": "2108306", "Peri Mirim": "2108405",
    "Peritoró": "2108454", "Pindaré-Mirim": "2108504", "Pinheiro": "2108603", "Pio XII": "2108702", "Pirapemas": "2108801",
    "Porto Franco": "2109007", "Porto Rico do Maranhão": "2109056", "Poção de Pedras": "2108900", "Presidente Dutra": "2109106",
    "Presidente Juscelino": "2109205", "Presidente Médici": "2109239", "Presidente Sarney": "2109270", "Presidente Vargas": "2109304",
    "Primeira Cruz": "2109403", "Raposa": "2109452", "Riachão": "2109502", "Ribamar Fiquene": "2109551", "Rosário": "2109601", "Sambaíba": "2109700",
    "Santa Filomena do Maranhão": "2109759", "Santa Helena": "2109809", "Santa Inês": "2109908", "Santa Luzia": "2110005",
    "Santa Luzia do Paruá": "2110039", "Santa Quitéria do Maranhão": "2110104", "Santa Rita": "2110203", "Santana do Maranhão": "2110237",
    "Santo Amaro do Maranhão": "2110278", "Santo Antônio dos Lopes": "2110302", "Satubinha": "2111722", "Senador Alexandre Costa": "2111748",
    "Senador La Rocque": "2111763", "Serrano do Maranhão": "2111789", "Sucupira do Norte": "2111904", "Sucupira do Riachão": "2111953",
    "São Benedito do Rio Preto": "2110401", "São Bento": "2110500", "São Bernardo": "2110609", "São Domingos do Azeitão": "2110658",
    "São Domingos do Maranhão": "2110708", "São Francisco do Brejão": "2110856", "São Francisco do Maranhão": "2110906",
    "São Félix de Balsas": "2110807", "São José de Ribamar": "2111201", "São José dos Basílios": "2111250", "São João Batista": "2111003",
    "São João do Carú": "2111029", "São João do Paraíso": "2111052", "São João do Soter": "2111078", "São João dos Patos": "2111102",
    "São Luís": "2111300", "São Luís Gonzaga do Maranhão": "2111409", "São Mateus do Maranhão": "2111508", "São Pedro da Água Branca": "2111532",
    "São Pedro dos Crentes": "2111573", "São Raimundo das Mangabeiras": "2111607", "São Raimundo do Doca Bezerra": "2111631",
    "São Roberto": "2111672", "São Vicente Ferrer": "2111706", "Sítio Novo": "2111805", "Tasso Fragoso": "2112001", "Timbiras": "2112100",
    "Timon": "2112209", "Trizidela do Vale": "2112233", "Tufilândia": "2112274", "Tuntum": "2112308", "Turiaçu": "2112407", "Turilândia": "2112456",
    "Tutóia": "2112506", "Urbano Santos": "2112605", "Vargem Grande": "2112704", "Viana": "2112803", "Vila Nova dos Martírios": "2112852",
    "Vitorino Freire": "2113009", "Vitória do Mearim": "2112902", "Zé Doca": "2114007", "Água Doce do Maranhão": "2100154",
  })

  // Procedimentos SIGTAP de hemodiálise usados na APAC (grupo 03.05.01, Portaria GM/MS nº 815/2023).
  // maxPerWeek: limite de sessões do próprio procedimento.
  const SIGTAP_HD = Object.freeze({
    adulto: { code: "03.05.01.010-7", name: "HEMODIÁLISE (MÁXIMO 3 SESSÕES POR SEMANA)", maxPerWeek: 3 },
    sorologia: { code: "03.05.01.011-5", name: "HEMODIÁLISE EM PACIENTE COM SOROLOGIA POSITIVA PARA HIV E/OU HEPATITE B E/OU HEPATITE C (MÁXIMO 3 SESSÕES POR SEMANA)", maxPerWeek: 3 },
    pediatrica: { code: "03.05.01.020-4", name: "HEMODIÁLISE PEDIÁTRICA (MÁXIMO 04 SESSÕES POR SEMANA)", maxPerWeek: 4 },
  })

  // Exames que podem ser solicitados, com o código SIGTAP (grupo 02, procedimentos com finalidade diagnóstica).
  // Códigos conferidos em tabelas SUS publicadas por consórcios e municípios (2023-2025), não no SIGTAP oficial,
  // que estava inacessível: confirmar com o faturamento do HU. check: true marca os que apareceram em uma só tabela.
  // Exames sem código (code: "") saem na solicitação, mas não na guia SUS. group: lab, imagem ou outros.
  const EXAMES_SOLICITACAO = Object.freeze([
    ["Hematócrito", "lab", "02.02.02.037-1", "HEMATOCRITO"],
    ["Hemoglobina", "lab", "02.02.02.030-4", "DOSAGEM DE HEMOGLOBINA"],
    ["Hemograma completo", "lab", "02.02.02.038-0", "HEMOGRAMA COMPLETO"],
    ["Ureia pré-diálise", "lab", "02.02.01.069-4", "DOSAGEM DE UREIA", { note: "coletar antes da sessão" }],
    ["Ureia pós-diálise", "lab", "02.02.01.069-4", "DOSAGEM DE UREIA", { note: "coletar ao final da sessão" }],
    ["Creatinina", "lab", "02.02.01.031-7", "DOSAGEM DE CREATININA"],
    ["Sódio", "lab", "02.02.01.063-5", "DOSAGEM DE SODIO"],
    ["Potássio", "lab", "02.02.01.060-0", "DOSAGEM DE POTASSIO"],
    ["Cálcio", "lab", "02.02.01.021-0", "DOSAGEM DE CALCIO"],
    ["Fósforo", "lab", "02.02.01.043-0", "DOSAGEM DE FOSFORO"],
    ["Magnésio", "lab", "02.02.01.056-2", "DOSAGEM DE MAGNESIO"],
    ["TGP", "lab", "02.02.01.065-1", "DOSAGEM DE TRANSAMINASE GLUTAMICO-PIRUVICA (TGP)"],
    ["Glicose", "lab", "02.02.01.047-3", "DOSAGEM DE GLICOSE"],
    ["Hemoglobina glicada", "lab", "02.02.01.050-3", "DOSAGEM DE HEMOGLOBINA GLICOSILADA"],
    ["Ácido úrico", "lab", "02.02.01.012-0", "DOSAGEM DE ACIDO URICO"],
    ["Gasometria venosa", "lab", "02.02.01.073-2", "GASOMETRIA (PH PCO2 PO2 BICARBONATO AS2 (EXCESSO OU DEFICIT BASE)"],
    ["Ferritina", "lab", "02.02.01.038-4", "DOSAGEM DE FERRITINA"],
    ["Ferro sérico", "lab", "02.02.01.039-2", "DOSAGEM DE FERRO SERICO"],
    ["Saturação da transferrina", "lab", "02.02.01.066-0", "DETERMINAÇÃO DO ÍNDICE DE SATURAÇÃO DA TRANSFERRINA", { check: true }],
    ["Proteínas totais e frações", "lab", "02.02.01.062-7", "DOSAGEM DE PROTEINAS TOTAIS E FRACOES", { note: "inclui albumina e globulina" }],
    ["Fosfatase alcalina", "lab", "02.02.01.042-2", "DOSAGEM DE FOSFATASE ALCALINA"],
    ["PTH", "lab", "02.02.06.027-6", "DOSAGEM DE PARATORMONIO"],
    ["25-Hidroxivitamina D", "lab", "02.02.01.076-7", "DOSAGEM DE VITAMINA D-25 HIDROXI", { check: true }],
    ["Anti-HBs", "lab", "02.02.03.063-6", "PESQUISA DE ANTICORPOS CONTRA ANTIGENO DE SUPERFICIE DO VIRUS DA HEPATITE B (ANTI-HBS)"],
    ["HBsAg", "lab", "02.02.03.097-0", "PESQUISA DE ANTIGENO DE SUPERFICIE DO VIRUS DA HEPATITE B (HBSAG)"],
    ["Anti-HCV", "lab", "02.02.03.067-9", "PESQUISA DE ANTICORPOS CONTRA O VIRUS DA HEPATITE C (ANTI-HCV)"],
    ["Anti-HIV", "lab", "02.02.03.030-0", "PESQUISA DE ANTICORPOS ANTI-HIV-1 + HIV-2 (ELISA)"],
    ["Colesterol total", "lab", "02.02.01.029-5", "DOSAGEM DE COLESTEROL TOTAL"],
    ["Colesterol HDL", "lab", "02.02.01.027-9", "DOSAGEM DE COLESTEROL HDL"],
    ["Colesterol LDL", "lab", "02.02.01.028-7", "DOSAGEM DE COLESTEROL LDL"],
    ["Triglicerídeos", "lab", "02.02.01.067-8", "DOSAGEM DE TRIGLICERIDEOS"],
    ["Alumínio sérico", "lab", "02.02.07.008-5", "DOSAGEM DE ALUMINIO"],
    ["T4", "lab", "02.02.06.037-3", "DOSAGEM DE TIROXINA (T4)"],
    ["T4 livre", "lab", "02.02.06.038-1", "DOSAGEM DE TIROXINA LIVRE (T4 LIVRE)"],
    ["TSH", "lab", "02.02.06.025-0", "DOSAGEM DE HORMONIO TIREOESTIMULANTE (TSH)"],
    ["Radiografia de tórax (PA e perfil)", "imagem", "02.04.03.015-3", "RADIOGRAFIA DE TORAX (PA E PERFIL)"],
    ["Ultrassonografia de abdome total", "imagem", "02.05.02.004-6", "ULTRASSONOGRAFIA DE ABDOMEN TOTAL"],
    ["Ecocardiograma transtorácico", "imagem", "", ""],
    ["Ultrassonografia com Doppler da fístula", "imagem", "", ""],
    ["Eletrocardiograma", "outros", "", ""],
    // Alta complexidade / alto custo: só com Laudo para Solicitação de APAC, autorizado pelo gestor (regulação)
    // antes da realização. Códigos SIGTAP a confirmar com o faturamento (o SIGTAP oficial estava inacessível).
    ["Tomografia computadorizada de tórax", "apac", "", "TOMOGRAFIA COMPUTADORIZADA DE TORAX", { apac: true, check: true }],
    ["Tomografia computadorizada de abdome total", "apac", "", "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN TOTAL", { apac: true, check: true }],
    ["Ressonância magnética de abdome", "apac", "", "RESSONANCIA MAGNETICA DE ABDOMEN SUPERIOR", { apac: true, check: true }],
    ["Angiotomografia do acesso vascular (fístula)", "apac", "", "ANGIOTOMOGRAFIA", { apac: true, check: true }],
    ["Cintilografia de paratireoides", "apac", "", "CINTILOGRAFIA DE PARATIREOIDES", { apac: true, check: true, note: "hiperparatireoidismo secundário" }],
    ["Cintilografia renal (DMSA ou DTPA)", "apac", "", "CINTILOGRAFIA RENAL", { apac: true, check: true }],
    ["Cateterismo cardíaco", "apac", "", "CATETERISMO CARDIACO", { apac: true, check: true, note: "avaliação pré-transplante" }],
  ].map(([name, group, code, sigtap, extra = {}]) => Object.freeze({ name, group, code, sigtap, note: "", check: false, apac: false, ...extra })))

  const INSTITUICAO = Object.freeze({
    nome: "Hospital Universitário da Universidade Federal do Maranhão - HU-UFMA",
    sigla: "HU-UFMA / Ebserh",
    unidade: "Unidade Presidente Dutra · Serviço de Nefrologia - Terapia Renal Substitutiva",
    cnes: "2726653",
    cnpj: "06.279.103/0002-08", // CNPJ da unidade
    cnpjMantenedora: "06.279.103/0001-19", // UFMA
    cnpjEbserh: "15.126.437/0004-96", // filial Ebserh
    endereco: "Rua Barão de Itapary, 227, Centro",
    cidade: "São Luís",
    uf: "MA",
    cep: "65020-070",
    telefone: "(98) 2109-1021 / 2109-1063 · Nefrologia (98) 2109-1047",
  })

  window.HuNefroCatalogos = {
    CID,
    PROFESSIONALS,
    INSTITUICAO,
    IBGE_MA,
    SIGTAP_HD,
    EXAMES_SOLICITACAO,
    // Todos os profissionais (equipe vinculada)
    professionalOptions: () => pro(() => true),
    // Somente médicos (ex.: responsável pela transfusão, médico/assistente da internação)
    doctorOptions: () => PROFESSIONALS.filter((p) => p.category === "medico").map((p) => [p.id, p.name]),
    // Especialistas médicos, exceto nefrologia (avaliação por outro especialista)
    specialistOptions: () =>
      PROFESSIONALS.filter((p) => p.category === "medico" && p.specialty !== "Nefrologia").map((p) => [
        p.id,
        `${p.name} - ${p.specialty}`,
      ]),
    specialties: pairs(["Cardiologia", "Cirurgia Vascular", "Endocrinologia", "Infectologia", "Neurologia", "Psiquiatria", "Outra"]),

    // Tipos de evento (listas provisórias; o administrador poderá cadastrar novos)
    tiposProblema: pairs([
      "Anemia da doença renal crônica",
      "Hiperparatireoidismo secundário",
      "Hipertensão arterial",
      "Insuficiência cardíaca",
      "Hipotensão intradialítica",
      "Outro",
    ]),
    tiposInternacao: pairs([
      "AVC",
      "Cirurgia para confecção de acesso",
      "Descompensação cardiovascular",
      "Infecção",
      "Outro",
    ]),
    tiposInfeccao: pairs([
      "Abscesso Intra-abdominal",
      "Fístula Arteriovenosa (FAV)",
      "Infecção do óstio do cateter",
      "Infecção de corrente sanguínea",
      "Peritonite",
      "Pneumonia",
      "outra",
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
      "Líquido pericárdico",
      "Líquido pleural",
      "Líquor",
      "Óstio do cateter de hemodiálise",
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
      "Outra"
    ]),
    agentes: pairs([
      "Enterococcus faecalis",
      "Escherichia coli",
      "Klebsiella pneumoniae",
      "Pseudomonas aeruginosa",
      "Staphylococcus aureus",
      "Staphylococcus epidermidis",
      "Outro"
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
      "FAV",
      "Prótese vascular",
      "Não se aplica",
    ]),
  }
})()
