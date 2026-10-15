name: nefro-dialysis
description: Cria ou revisa telas e fluxos relacionados a programas de tratamento, hemodiálise, sessões, prescrições, acessos e rotinas dialíticas do Hu-Nefro sem inventar regras clínicas.
---

# Hu-Nefro Dialysis

Use esta Skill para funcionalidades relacionadas à diálise, especialmente hemodiálise e ao módulo de programas de tratamento descrito na documentação funcional do projeto.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, stack e regras de engenharia.
- `Guidelines.md` define produto, UX clínica, acessibilidade e design system.
- Esta Skill especializa esses princípios para fluxos de diálise.
- Nenhuma regra desta Skill autoriza inventar regras clínicas ou de negócio.

## Fonte funcional obrigatória

Consulte a documentação funcional canônica em `legacy/` antes de implementar.

Ela deve ser usada para identificar somente o que estiver documentado sobre programas, procedimentos permitidos, dias de HD, turnos, salas, movimentações, prescrições, dialisador, método de tratamento, solução, histórico e registro/controle de sessões.

## Programa de tratamento

- Diferencie claramente programa atual de histórico.
- Dias da semana, turno e sala devem ser compreensíveis como uma combinação operacional.
- Use agrupamentos que reflitam a rotina documentada do serviço.
- Não misture configuração do programa com movimentação histórica.

## Calendário e dias previstos

Quando houver calendário de HD:

- diferencie previsto, realizado, cancelado ou outro estado somente quando o requisito fornecer esses estados;
- não dependa apenas da cor;
- mantenha mês ou período visível;
- preserve navegação temporal sem perder o contexto do paciente.

## Movimentações

Para entrada, saída ou movimentações de programa:

- deixe data e tipo de movimentação explícitos;
- mantenha o histórico em ordem compreensível;
- mostre responsável quando fizer parte do dado;
- evite registro duplicado por duplo clique ou repetição de envio.

## Prescrição

- Separe histórico de nova prescrição.
- Não pré-preencha valores clínicos arbitrários.
- Torne claro quando o usuário está criando uma nova versão ou revisando uma anterior.
- Preserve confirmação antes de ações que efetivamente publiquem ou substituam uma prescrição, quando aplicável ao fluxo documentado.

## Sessões

A tela de registro e controle de sessões deve respeitar a finalidade indicada na documentação funcional.

Não transforme uma tela de listagem em formulário de registro sem requisito explícito.

## Consistência

Use os mesmos padrões de:

- contexto do paciente;
- cabeçalho;
- filtros;
- tabelas;
- status;
- confirmações;
- feedback;
- histórico.

Não crie uma linguagem visual específica para diálise que concorra com o design system geral do Hu-Nefro.
