# AGENTS.md - Hu-Nefro

## Identidade do projeto

Hu-Nefro é um sistema web para gestão de pacientes e prontuários
no contexto de nefrologia.

O desenvolvimento deve seguir as Hu-Nefro Engineering Guidelines
e as regras específicas configuradas no Continue.

## Fonte de verdade

Antes de modificar o projeto, o agente deve consultar:

1. Este AGENTS.md
2. `.continue/rules/hu-nefro-regras-do-projeto.md`
3. Skills relevantes em `skills/`
4. Documentação funcional pertinente
5. Implementação existente

## Arquitetura

### Frontend

- HTML5
- CSS3
- JavaScript puro
- Bootstrap 5

### Backend

- Python
- Django
- Django REST Framework

## Regra fundamental

Não inventar requisitos, regras clínicas, regras de negócio,
endpoints ou comportamentos não documentados.

Quando uma informação necessária não estiver documentada:

> Não documentado — não implementar por inferência.

## Sistema legado

O legado pode ser consultado para compreender requisitos e
comportamentos documentados.

Não utilizar o legado como referência visual, arquitetural,
tecnológica ou de implementação.

## Alterações

Antes de editar:

- identificar arquivos afetados;
- verificar dependências;
- consultar Skills relevantes;
- preservar funcionalidades existentes.

Depois de editar:

- revisar alterações;
- verificar regressões;
- verificar acessibilidade;
- verificar consistência;
- verificar tecnologias proibidas.

## Segurança

Nunca utilizar dados reais de pacientes como dados de teste
ou exemplos.

Nunca expor credenciais, tokens, chaves privadas ou arquivos `.env`.

## Objetivo dos agentes

Os agentes devem priorizar:

> Segurança > Clareza > Acessibilidade > Consistência > Eficiência

O objetivo não é produzir o máximo de código.

O objetivo é produzir a alteração correta, documentada,
acessível, consistente e segura para o Hu-Nefro.