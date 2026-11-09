// Simulação da integração com o AGHU (Aplicativo de Gestão para Hospitais Universitários).
// PROVISÓRIO: no sistema final estas consultas vão para a API do AGHU pelo backend Django/DRF.
// - buscarPorCpf: cadastro do paciente (nome, nascimento, sexo, CNS, mãe, contato e endereço).
// - enviarSolicitacaoExames: pedido de exames ao laboratório do HU, que devolve o número do pedido.
// Pessoas e números são fictícios (CPF e CNS com dígitos verificadores válidos, para testar a validação).
;(() => {
  "use strict"

  const PESSOAS = Object.freeze([
    { cpf: "382.915.047-41", cns: "704 3172 6300 6310", name: "JOSÉ RIBAMAR CARVALHO SANTOS", birth: "1964-03-12", sex: "Masculino", mother: "RAIMUNDA CARVALHO SANTOS",
      phone: "(98) 98812-4471", email: "", rg: "045123987", rgOrg: "SSP", rgUf: "MA", race: "Parda", birthCity: "São Luís", birthUf: "MA",
      cep: "65040-120", street: "Rua do Passeio", number: "214", complement: "", district: "Centro", city: "São Luís", uf: "MA" },
    { cpf: "514.027.638-08", cns: "706 2568 7067 3057", name: "MARIA DAS GRAÇAS PINHEIRO LIMA", birth: "1971-08-25", sex: "Feminino", mother: "ANTÔNIA PINHEIRO LIMA",
      phone: "(98) 99134-2208", email: "gracas.lima@email.com", rg: "032654178", rgOrg: "SSP", rgUf: "MA", race: "Preta", birthCity: "Codó", birthUf: "MA",
      cep: "65061-300", street: "Avenida Jerônimo de Albuquerque", number: "1530", complement: "Bloco C, apto 204", district: "Cohab Anil", city: "São Luís", uf: "MA" },
    { cpf: "209.384.751-50", cns: "701 9944 9848 6662", name: "ENZO GABRIEL SOUSA COSTA", birth: "2016-11-03", sex: "Masculino", mother: "LARISSA SOUSA COSTA",
      phone: "(98) 98420-7715", email: "larissa.costa@email.com", rg: "", rgOrg: "", rgUf: "", race: "Parda", birthCity: "Paço do Lumiar", birthUf: "MA",
      cep: "65130-000", street: "Rua 15", number: "48", complement: "Quadra 7", district: "Maiobão", city: "Paço do Lumiar", uf: "MA" },
    { cpf: "613.058.294-33", cns: "701 2176 0516 6576", name: "FRANCISCA ALVES DE OLIVEIRA", birth: "1958-01-30", sex: "Feminino", mother: "BENEDITA ALVES DE OLIVEIRA",
      phone: "(99) 98155-3902", email: "", rg: "018745632", rgOrg: "SSP", rgUf: "MA", race: "Parda", birthCity: "Caxias", birthUf: "MA",
      cep: "65600-000", street: "Rua Afonso Pena", number: "77", complement: "", district: "Centro", city: "Caxias", uf: "MA" },
    { cpf: "745.120.369-70", cns: "707 0302 0241 7184", name: "PEDRO HENRIQUE MENDES BARROS", birth: "1989-06-17", sex: "Masculino", mother: "ELIANE MENDES BARROS",
      phone: "(98) 99260-1184", email: "pedro.barros@email.com", rg: "067321459", rgOrg: "SSP", rgUf: "MA", race: "Branca", birthCity: "São José de Ribamar", birthUf: "MA",
      cep: "65110-000", street: "Estrada de Ribamar", number: "3020", complement: "Casa 2", district: "Araçagy", city: "São José de Ribamar", uf: "MA" },
    { cpf: "128.463.950-98", cns: "704 2177 0166 7933", name: "ANA LÚCIA FERREIRA MOURA", birth: "1980-12-09", sex: "Feminino", mother: "TEREZINHA FERREIRA MOURA",
      phone: "(98) 98735-6620", email: "analucia.moura@email.com", rg: "054987321", rgOrg: "SSP", rgUf: "MA", race: "Parda", birthCity: "Bacabal", birthUf: "MA",
      cep: "65700-000", street: "Rua Magalhães de Almeida", number: "512", complement: "", district: "Centro", city: "Bacabal", uf: "MA" },
  ])

  const digits = (v) => String(v || "").replace(/\D/g, "")
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Devolve { found: true, person } ou { found: false }. A espera imita o tempo de resposta da API.
  async function buscarPorCpf(cpf) {
    await wait(700)
    const person = PESSOAS.find((p) => digits(p.cpf) === digits(cpf))
    return person ? { found: true, person: { ...person } } : { found: false }
  }

  // Pedido de exames enviado ao AGHU: devolve o número do pedido gerado pelo laboratório do HU.
  async function enviarSolicitacaoExames(pedido) {
    await wait(900)
    const now = new Date()
    const protocol = `AGHU-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`
    return { ok: true, protocol, sentAt: now.toISOString(), items: (pedido?.items || []).length }
  }

  window.HuNefroAGHU = { buscarPorCpf, enviarSolicitacaoExames, cpfsDeTeste: () => PESSOAS.map((p) => p.cpf) }
})()
