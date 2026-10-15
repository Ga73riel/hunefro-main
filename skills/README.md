# Hu-Nefro Skills

Skills especializadas do projeto Hu-Nefro, versionadas junto ao repositório.

## Fonte de autoridade

As Skills são workflows especializados e devem ser usadas em conjunto com:

- `AGENTS.md` — arquitetura, engenharia e stack tecnológica.
- `Guidelines.md` — produto, UX, UI, acessibilidade e design system.
- documentação funcional do projeto — requisitos e comportamento documentados.

Uma Skill não pode substituir ou contradizer as regras obrigatórias desses documentos.

## Estrutura

Cada Skill possui seu próprio diretório e arquivo `SKILL.md`:

```text
skills/
├── nefro-a11y/
│   └── SKILL.md
├── nefro-base/
│   └── SKILL.md
├── nefro-build/
│   └── SKILL.md
├── nefro-clinical/
│   └── SKILL.md
├── nefro-dialysis/
│   └── SKILL.md
├── nefro-form/
│   └── SKILL.md
├── nefro-modernize/
│   └── SKILL.md
├── nefro-patient/
│   └── SKILL.md
├── nefro-review/
│   └── SKILL.md
├── nefro-table/
│   └── SKILL.md
├── nefro-ui/
│   └── SKILL.md
└── README.md
```

## Skills disponíveis

| Skill | Finalidade |
|---|---|
| `nefro-a11y` | Acessibilidade de interfaces |
| `nefro-base` | Princípios gerais do projeto |
| `nefro-build` | Criação de telas e fluxos completos |
| `nefro-clinical` | Interfaces e informação clínica |
| `nefro-dialysis` | Diálise e programas de tratamento |
| `nefro-form` | Formulários, validação e feedback |
| `nefro-modernize` | Modernização de telas legadas |
| `nefro-patient` | Telas dentro do prontuário do paciente |
| `nefro-review` | Revisão estruturada de telas e fluxos |
| `nefro-table` | Tabelas, listas e registros |
| `nefro-ui` | UI, componentes e consistência visual |

## Regras de manutenção

- Manter cada Skill autocontida em um único `SKILL.md`.
- Não adicionar tecnologias proibidas pelo `AGENTS.md`.
- Não criar regras clínicas que não estejam documentadas.
- Não usar o sistema legado como referência visual ou arquitetural.
- Atualizar a Skill quando seu workflow mudar e versionar a alteração no Git.
