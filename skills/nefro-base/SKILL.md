name: nefro-base
description: Aplica os princípios gerais do Hu-Nefro para criar ou modificar protótipos web em Figma Make com foco em consistência, segurança de uso, acessibilidade e implementação em HTML5, CSS3, JavaScript e Bootstrap 5.
---

# Hu-Nefro Base

Use esta Skill como referência geral para qualquer trabalho no protótipo do Hu-Nefro.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, tecnologias obrigatórias e regras de engenharia.
- `Guidelines.md` define produto, UX, UI, acessibilidade e design system.
- Esta Skill reúne princípios gerais de execução e não substitui os dois documentos anteriores.
- Skills especializadas devem ser acionadas quando o tipo de tarefa exigir um workflow específico.

## Fonte funcional

- Consulte a documentação funcional canônica do sistema legado, localizada em `legacy/`, para campos, fluxos, opções, regras e terminologia documentados.
- Não invente campos, valores, categorias, fluxos clínicos, diagnósticos, procedimentos ou regras de negócio quando não estiverem definidos na especificação disponível.
- Quando a especificação marcar algo como “verificar”, “validar”, “não utilizado”, “remover”, “administrador” ou equivalente, preserve essa intenção e trate pendências como pendências.
- Diferencie claramente requisito existente de sugestão de UX.
- O legado é fonte de requisitos e comportamento documentado, não referência visual, arquitetural ou de implementação.

## Stack obrigatória

Frontend:

- HTML5 semântico.
- CSS3.
- JavaScript.
- Bootstrap 5.

Backend:

- Python.
- Django.
- Django REST Framework.

JavaScript é uma tecnologia exclusivamente de frontend neste projeto.

Não introduza React, React DOM, JSX, TSX, TypeScript, Vite, Next.js, Vue, Angular, Svelte, Tailwind CSS ou outro framework frontend/UI.

## Princípios de UX clínica

- Priorize redução de carga cognitiva e prevenção de erro.
- Mantenha o contexto do paciente nas telas do prontuário.
- Dê maior destaque às informações de maior criticidade funcional.
- Não use cor como único canal de significado.
- Não transforme toda informação relevante em alerta.
- Evite alertas repetitivos ou pouco acionáveis.
- Prefira revelar complexidade progressivamente.
- Não dependa da memória do usuário para informações necessárias à decisão ou ao preenchimento.
- Preserve contexto, estado e feedback das ações.

## Ações críticas

- Proteja ações destrutivas de acordo com o risco.
- A linguagem de ações deve deixar clara a consequência.
- Antes de sair de uma tela com alterações não gravadas, informe o usuário e ofereça a opção de permanecer quando aplicável.
- Após salvar ou registrar, forneça feedback visível de sucesso ou erro.

## Identidade e contexto do paciente

- Em telas de prontuário, mostre de forma persistente a identidade mínima necessária para confirmar o paciente correto.
- Evite misturar contexto de pacientes diferentes.
- Se uma ação puder afetar dados clínicos ou administrativos, deixe o alvo da ação explícito.

## Acessibilidade

- Use HTML semântico.
- Garanta foco de teclado visível.
- Mantenha labels associados aos campos.
- Estados não devem depender apenas de cor.
- Mensagens de erro devem ser compreensíveis e próximas do campo ou da ação.
- Componentes interativos devem possuir nome acessível.

## Entrega

Ao implementar uma tela:

1. Preserve os padrões visuais atuais do Hu-Nefro, conforme `Guidelines.md`.
2. Reutilize componentes existentes.
3. Adicione apenas o que o requisito exige ou o que estiver explicitamente definido como melhoria autorizada.
4. Cubra estados normal, carregando, vazio, erro e sucesso quando aplicável.
5. Revise segurança de uso, acessibilidade, responsividade e consistência visual.
6. Verifique se nenhuma regra de domínio foi inventada.
