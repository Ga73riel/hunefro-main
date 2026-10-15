name: nefro-modernize
description: Moderniza telas e fluxos do sistema legado do Hu-Nefro, preservando requisitos necessários e reconstruindo a experiência com UX clínica, acessibilidade e o design system atual.
---

# Hu-Nefro Modernize

Use esta Skill para transformar uma tela ou fluxo legado em uma experiência moderna do Hu-Nefro.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, tecnologia e regras de implementação.
- `Guidelines.md` define a experiência, UX, UI, acessibilidade e design system do produto moderno.
- Esta Skill define como extrair o necessário do legado sem reproduzir suas limitações.

## Fonte de requisitos

Consulte sempre a documentação funcional relevante em `legacy/`.

O sistema legado é fonte de requisitos e comportamento documentado. Não utilizar sua estrutura visual, arquitetura ou implementação como padrão.

## Classificação obrigatória

Para cada elemento identificado, classifique:

- **PRESERVAR**
- **MODERNIZAR**
- **REMOVER**
- **VALIDAR**
- **ADMINISTRÁVEL**

## Regras

- Nunca reproduzir cegamente a interface legada.
- Nunca inventar requisitos clínicos.
- Nunca transformar uma observação em requisito definitivo.
- Quando o documento disser “verificar”, “validar”, “aparentemente” ou equivalente, tratar como pendência.
- Preservar regras de negócio relevantes mesmo quando a UI for completamente redesenhada.
- Itens explicitamente descartados não devem reaparecer por conveniência visual.

## Processo

1. Entender a tela ou fluxo legado.
2. Identificar requisitos documentados.
3. Classificar os elementos.
4. Identificar problemas concretos de UX.
5. Definir o novo fluxo conforme `Guidelines.md`.
6. Aplicar o design system do Hu-Nefro.
7. Implementar dentro da stack definida em `AGENTS.md`.
8. Revisar segurança, acessibilidade e consistência.

## Regra de decisão

Quando houver lacuna funcional, não preencher a lacuna por suposição. Registre a pendência e mantenha a decisão afetada sem comportamento inventado.
