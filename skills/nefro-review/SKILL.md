name: nefro-review
description: Faz revisão estruturada de uma tela ou fluxo do Hu-Nefro segundo requisitos funcionais, UX clínica, acessibilidade, segurança de uso, consistência visual e qualidade de implementação.
---

# Hu-Nefro Review

Use esta Skill depois que uma tela ou fluxo for criado ou alterado.

## Relação com as regras do projeto

A revisão deve verificar conjuntamente:

- `AGENTS.md` para arquitetura, stack, segurança técnica e qualidade de implementação;
- `Guidelines.md` para produto, UX, UI, acessibilidade e design system;
- documentação funcional em `legacy/` para requisitos e comportamento documentado;
- Skills especializadas relevantes ao domínio da tela.

## Regra

Não refaça a tela por preferência estética. Primeiro identifique problemas concretos contra os requisitos e padrões do projeto.

## 1. Requisitos funcionais

Consulte a documentação funcional e verifique:

- todos os campos necessários estão presentes;
- opções e categorias respeitam a especificação;
- ações documentadas existem;
- itens marcados como remover ou não utilizados não foram reintroduzidos;
- observações e pendências não foram tratadas como decisões definitivas.

## 2. Contexto do paciente

- identidade está clara;
- seção atual está clara;
- não há risco visual de confusão de paciente;
- histórico e estado atual estão diferenciados quando necessário.

## 3. UX clínica

Procure especificamente:

- excesso de alertas;
- informação crítica escondida;
- ações perigosas fáceis demais de executar;
- dependência desnecessária de memória;
- defaults potencialmente ambíguos;
- excesso de escolhas simultâneas;
- mudanças de estado pouco perceptíveis;
- falta de feedback após ações.

## 4. Acessibilidade

Verifique teclado, foco, labels, semântica, mensagens, contraste, nomes acessíveis, redução de movimento e independência de cor.

## 5. Interface

Verifique:

- Bootstrap 5 e componentes existentes foram reutilizados;
- espaçamentos e tipografia seguem `Guidelines.md`;
- botões têm hierarquia consistente;
- tabelas e formulários possuem estados apropriados;
- não há CSS ou componentes duplicados sem justificativa;
- não foram introduzidos padrões visuais concorrentes.

## 6. Estados

Para cada interação relevante, considere:

- carregando;
- vazio;
- erro;
- sucesso;
- desabilitado;
- alterações não salvas;
- confirmação para ações críticas quando aplicável.

## 7. Segurança de uso

Para cada ação que altera dados, pergunte:

- o alvo está claro?
- o efeito está claro?
- existe confirmação proporcional ao risco?
- existe feedback?
- existe rastreabilidade quando necessária e definida?

## 8. Stack e arquitetura

Verifique:

- frontend utiliza somente HTML5, CSS3, JavaScript e Bootstrap 5;
- JavaScript permanece restrito ao frontend;
- backend segue Python + Django + Django REST Framework;
- nenhuma tecnologia proibida pelo `AGENTS.md` foi introduzida.

## Saída da revisão

Apresente os achados agrupados como:

### Bloqueadores

Problemas que impedem uso seguro, acessível ou coerente.

### Importantes

Problemas que prejudicam eficiência, compreensão ou consistência.

### Melhorias

Ajustes menores sem impacto relevante na regra funcional.

Depois, aplique diretamente apenas as correções que possam ser feitas sem inventar requisitos.
