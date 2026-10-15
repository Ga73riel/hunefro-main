name: nefro-form
description: Cria e revisa formulários do Hu-Nefro com foco em preenchimento eficiente, prevenção de erro, validação, dependências, acessibilidade e feedback.
---

# Hu-Nefro Form

Use esta Skill quando a tarefa envolver criação ou revisão de formulários.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, tecnologias e regras de engenharia.
- `Guidelines.md` define princípios de produto, UX, UI, acessibilidade e design system.
- Esta Skill define o workflow especializado para formulários.

## Estrutura

1. Identifique a tarefa do formulário.
2. Consulte a documentação funcional relevante em `legacy/` para os campos e regras documentados.
3. Agrupe campos por significado e sequência de trabalho.
4. Use Bootstrap 5.
5. Implemente estados e validações exigidos ou documentados.

## Labels e ajuda

- Cada campo deve possuir label visível.
- Placeholders não substituem labels.
- Instruções devem explicar apenas o que é necessário.
- Unidades devem aparecer perto do campo quando aplicável.
- Mensagens de erro devem dizer o que precisa ser corrigido.

## Tipos de entrada

Escolha o controle pelo tipo de decisão:

- texto para conteúdo textual;
- select quando há conjunto fechado de opções;
- radio quando uma escolha única precisa ficar visível;
- checkbox quando múltiplas opções podem ser escolhidas;
- data para datas;
- textarea para descrições extensas.

Não troque um controle sem avaliar a regra funcional.

## Defaults

- Não introduza valores padrão que possam ser confundidos com dados clínicos confirmados.
- Quando houver preenchimento automático, deixe claro que o valor é sugerido, herdado ou copiado.
- Nunca trate uma sugestão do sistema como confirmação do usuário.

## Dependências

Quando um campo mudar a disponibilidade ou opções de outro:

- deixe a relação compreensível;
- atualize a interface imediatamente;
- preserve consistência dos valores selecionados;
- informe quando uma seleção anterior deixar de ser válida.

## Validação

Valide somente o que estiver definido:

- presença de campos obrigatórios;
- formato;
- intervalo quando definido pela especificação;
- dependências entre campos.

Não invente limites clínicos não documentados.

## Salvamento

- Mostre estado de salvando quando houver operação assíncrona.
- Impeça envio duplicado enquanto a operação estiver em andamento.
- Após sucesso, mostre confirmação.
- Após erro, preserve dados digitados e explique como tentar novamente.
- Ao abandonar um formulário modificado, alerte sobre alterações não salvas quando aplicável.

## Revisão final

Verifique labels, foco, teclado, mensagens, contraste, estados, prevenção de perda de dados e ausência de regras inventadas.
