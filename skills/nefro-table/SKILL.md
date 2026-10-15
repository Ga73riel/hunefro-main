name: nefro-table
description: Cria ou revisa tabelas, listas e registros do Hu-Nefro com foco em leitura rápida, identificação segura, filtros, estados e ações consistentes.
---

# Hu-Nefro Table

Use esta Skill para listas de pacientes, históricos, registros, resultados e outras tabelas.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, stack e engenharia.
- `Guidelines.md` define hierarquia, acessibilidade, UI e design system.
- Esta Skill especializa esses princípios para tabelas e listas.

## Fonte funcional

Consulte a documentação funcional relevante em `legacy/` para definir colunas, filtros, estados e ações.

Não invente colunas que não tenham função documentada.

## Estrutura

- Cabeçalho de coluna curto e claro.
- Alinhamento consistente por tipo de dado.
- Informações críticas facilmente escaneáveis.
- Identificação do registro ou paciente em posição previsível.
- Ações próximas do registro afetado.
- Diferencie informações funcionalmente distintas em colunas separadas quando isso melhorar a compreensão e estiver de acordo com o requisito.

## Lista de pacientes

Ao trabalhar em listas de pacientes:

- mantenha identificação inequívoca;
- use código e outros dados contextuais quando fizerem parte do requisito;
- diferencie status e programa de tratamento sem depender somente da cor;
- mantenha filtros e total de registros visíveis quando aplicável;
- permita localizar por campos documentados pela especificação.

## Filtros

- Mostre filtros de uso frequente primeiro.
- Filtros adicionais podem ficar em área secundária.
- Mantenha o resultado atual compreensível.
- Não remova critérios aplicados silenciosamente.
- Preserve a terminologia das opções documentadas.

## Ordenação e paginação

- Indique visualmente a coluna ordenada quando houver ordenação.
- Preserve o critério durante atualização quando possível.
- Evite perder o contexto do usuário após editar ou retornar de um registro.

## Ações destrutivas

- Evite botão de exclusão visualmente dominante na barra principal quando a ação não for central à tarefa.
- Prefira menu de ações ou área secundária quando isso for coerente com o fluxo.
- Exija confirmação explícita para exclusões ou outras ações irreversíveis quando aplicável.
- Identifique o registro afetado na confirmação.

## Estados

A tabela deve prever, conforme aplicável:

- carregando;
- sem resultados;
- erro;
- resultado parcial, quando tecnicamente aplicável;
- sucesso após ação.

## Responsividade

Em telas menores, priorize as colunas mais importantes e use expansão ou detalhe do registro para dados secundários quando isso preservar a compreensão e o contexto.

## Acessibilidade

- Use cabeçalhos semânticos.
- Garanta foco visível em controles.
- Não dependa somente da cor para indicar estado ou seleção.
- Mantenha ações identificáveis por teclado e nome acessível.
