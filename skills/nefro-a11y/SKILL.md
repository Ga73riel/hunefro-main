name: nefro-a11y
description: Faz revisão e ajustes de acessibilidade nas interfaces do Hu-Nefro, com foco em teclado, foco, semântica, contraste, mensagens de erro, independência de cor e redução de movimento.
---

# Hu-Nefro Accessibility

Use esta Skill para revisar ou implementar acessibilidade em qualquer tela do Hu-Nefro.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, tecnologias obrigatórias e regras de engenharia.
- `Guidelines.md` define princípios de produto, UX, UI, acessibilidade e design system.
- Esta Skill define o workflow especializado de acessibilidade.
- Esta Skill não pode substituir ou contradizer `AGENTS.md` ou `Guidelines.md`.

## Objetivo

Garantir que a interface seja operável, compreensível e perceptível por diferentes usuários, sem mudar a regra funcional da aplicação.

## Checklist estrutural

- Use HTML5 semântico.
- Mantenha hierarquia correta de títulos.
- Associe labels aos campos.
- Use botões para ações e links para navegação.
- Use `aria-*` somente quando necessário e de forma semanticamente correta.
- Garanta nome acessível para controles sem texto visível.

## Teclado e foco

Verifique:

- toda função importante é alcançável por teclado;
- a ordem de foco é lógica;
- o foco permanece visível;
- modais devolvem o foco ao elemento de origem quando apropriado;
- nenhum controle fica preso no fluxo de foco;
- menus, abas, tabelas interativas e outros componentes mantêm comportamento compreensível por teclado.

## Formulários

- Erros devem ser associados ao campo afetado.
- O usuário deve conseguir identificar o que precisa ser corrigido.
- Campos obrigatórios precisam de indicação textual ou semântica apropriada, não somente de símbolo visual ambíguo.
- Placeholders não substituem labels.

## Cor, contraste e movimento

- Não use cor como único indicador de erro, sucesso, status ou prioridade.
- Combine cor com texto, ícone, posição, estrutura ou outro indicador compreensível.
- Verifique contraste de textos e controles.
- Não dependa de animação para comunicar estado.
- Evite movimento desnecessário.
- Respeite `prefers-reduced-motion`.

## Tabelas e conteúdo denso

- Use cabeçalhos semânticos.
- Evite tabelas visualmente densas sem agrupamento ou hierarquia.
- Garanta que o significado das colunas e ações permaneça claro em larguras menores.
- Preserve leitura e identificação inequívoca do registro.

## Alertas e feedback

- Mensagens críticas devem ser legíveis e compreensíveis.
- O feedback não deve depender apenas de cor, movimento ou posição.
- Diferencie visual e semanticamente aviso, erro, sucesso e bloqueio quando esses estados existirem.

## Revisão final

Antes de finalizar:

- percorra a tela com teclado;
- verifique foco;
- verifique labels e nomes acessíveis;
- verifique textos de erro;
- verifique contraste;
- verifique dependência de cor;
- verifique comportamento com redução de movimento;
- verifique leitura do conteúdo em largura reduzida.
