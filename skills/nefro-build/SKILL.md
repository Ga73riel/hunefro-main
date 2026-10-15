name: nefro-build
description: Constrói uma nova tela ou fluxo do Hu-Nefro do início ao fim, combinando requisitos funcionais, UX clínica, Bootstrap 5, acessibilidade, estados e revisão em uma única execução.
---

# Hu-Nefro Build

Use esta Skill como Skill principal para criar uma nova tela ou fluxo do Hu-Nefro.

Ela deve funcionar como workflow completo, aplicando em conjunto as regras de domínio, UI, prontuário, formulários/tabelas, segurança de uso, acessibilidade, estados e revisão.

## Regras de autoridade

Antes de implementar:

- consulte `AGENTS.md` para arquitetura, stack, organização técnica e regras de engenharia;
- consulte `Guidelines.md` para produto, UX, UI, acessibilidade e design system;
- consulte a documentação funcional relevante em `legacy/` para requisitos e comportamento documentado;
- utilize Skills especializadas quando o fluxo exigir uma disciplina específica.

Esta Skill não pode contradizer as regras do `AGENTS.md` ou do `Guidelines.md`.

## 1. Entender o requisito

- Identifique campos, opções, fluxos, observações e restrições documentados.
- Não invente regra clínica ou de negócio ausente na especificação.
- Separe requisito explícito, pendência e melhoria de UX.
- Preserve a terminologia documentada.
- Itens explicitamente removidos não devem ser reintroduzidos.

## 2. Entender o contexto

Antes de implementar:

- identifique se a tela pertence ao prontuário;
- identifique o paciente e o nível de contexto necessário;
- verifique componentes, estilos e padrões já existentes;
- reutilize a arquitetura atual do Hu-Nefro em vez de criar uma página isolada;
- não trate a interface legada como referência visual.

## 3. Arquitetura da tela

Defina primeiro:

- objetivo principal;
- conteúdo prioritário;
- agrupamentos;
- ação primária;
- ações secundárias;
- ações destrutivas;
- estados necessários.

Organize por tarefa e fluxo de trabalho. Não crie telas ou seções apenas porque “faltou espaço” em outra.

## 4. Implementação

Utilize exclusivamente a stack definida pelo `AGENTS.md`:

- HTML5 semântico;
- CSS3;
- JavaScript no frontend;
- Bootstrap 5.

Regras:

- reutilize componentes existentes;
- não introduza framework frontend adicional;
- não introduza React, TypeScript, JSX, TSX, Vite, Tailwind CSS ou equivalentes;
- evite CSS duplicado;
- prefira componentes reutilizáveis;
- mantenha frontend e backend separados conforme a arquitetura do projeto.

## 5. Segurança de uso

Verifique:

- identidade do paciente quando aplicável;
- informações críticas com prioridade visual adequada;
- ações com consequências claras;
- confirmação proporcional para ações destrutivas ou críticas;
- prevenção de envio duplicado;
- proteção contra perda de alterações não salvas;
- feedback após ações.

## 6. Formulários

Quando houver formulário:

- labels visíveis;
- controles adequados ao tipo de decisão;
- validação próxima ao campo;
- erros compreensíveis;
- dependências entre campos claras;
- defaults somente quando seguros e explicitamente justificados;
- preservação dos dados em caso de erro.

Não invente limites clínicos, unidades ou valores padrão não definidos pela especificação.

## 7. Tabelas e históricos

Quando houver lista ou histórico:

- cabeçalhos claros;
- informações importantes facilmente escaneáveis;
- identificação inequívoca do registro;
- filtros compreensíveis;
- ordenação indicada quando existir;
- estados vazio, carregando e erro;
- ações associadas ao registro correto.

## 8. Acessibilidade

Verifique:

- foco visível;
- navegação por teclado;
- semântica adequada;
- labels associados;
- mensagens de erro compreensíveis;
- não uso de cor como único significado;
- contraste adequado;
- redução de movimento quando aplicável.

## 9. Estados

Implemente, conforme aplicável:

- carregando;
- vazio;
- erro;
- sucesso;
- disabled;
- alterações não salvas;
- confirmação de ações críticas.

## 10. Revisão antes de concluir

Faça uma revisão final contra:

1. requisitos funcionais documentados;
2. `Guidelines.md`;
3. `AGENTS.md`;
4. contexto e identificação do paciente;
5. carga cognitiva;
6. prevenção de erro;
7. acessibilidade;
8. estados de interação;
9. reutilização de componentes;
10. ausência de regras inventadas.

Se encontrar um problema concreto, corrija-o antes de finalizar.

## Regra de saída

Entregue uma tela funcional, coerente com os padrões atuais do Hu-Nefro e concentrada no que foi solicitado.

Não faça redesign geral do produto durante uma tarefa localizada.
