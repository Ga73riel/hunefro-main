name: nefro-patient
description: Cria ou modifica telas dentro do prontuário do paciente, preservando identificação, contexto clínico, navegação e regras de segurança de uso do Hu-Nefro.
---

# Hu-Nefro Patient

Use esta Skill para qualquer tela que faça parte do prontuário de um paciente.

## Relação com as regras do projeto

- `AGENTS.md` define arquitetura, stack e regras técnicas.
- `Guidelines.md` define UX clínica, contexto do paciente, acessibilidade e padrões visuais.
- Esta Skill especializa esses princípios para o prontuário.

## Regra principal

O usuário deve conseguir responder rapidamente:

- “Estou no paciente certo?”
- “Onde estou no prontuário?”
- “O que é mais importante aqui?”
- “O que minha próxima ação fará?”

## Fonte funcional

- Consulte a documentação funcional relevante em `legacy/` antes de criar campos, ações ou seções.
- Preserve os requisitos documentados e as observações de uso conforme sua classificação.
- Não invente conteúdo clínico para completar lacunas.
- Não use o legado como referência visual.

## Cabeçalho do paciente

Mantenha contexto persistente com, conforme disponível e documentado no projeto:

- nome do paciente;
- idade ou data de nascimento;
- sexo;
- código do paciente;
- programa de tratamento;
- indicadores clínicos críticos documentados.

As informações exibidas devem ser consistentes com o padrão atual do prontuário.

## Navegação

Preserve a estrutura de navegação definida para o prontuário e deixe evidente a seção atual.

Organize conteúdo por tarefa, quando essas áreas existirem no requisito:

- cadastro;
- clínico;
- tratamento / prescrição;
- resultados.

Quando uma seção tiver muitos subitens, use agrupamento ou revelação progressiva sem esconder contexto essencial.

## Formulários no prontuário

- Labels sempre visíveis.
- Agrupe campos relacionados.
- Use somente campos necessários à tarefa.
- Mostre dependências entre campos quando existirem.
- Valide valores próximos ao ponto de entrada.
- Preserve dados não gravados.
- Após gravar, informe o resultado.

## Histórico

Quando o requisito envolver eventos, alterações ou registros históricos:

- mostre data e tipo do registro;
- deixe o estado do registro compreensível;
- identifique o responsável quando esse dado fizer parte da regra;
- preserve possibilidade de consultar o contexto anterior sem perder o atual.

## Ações

- Separe ações normais, secundárias e destrutivas.
- Exija confirmação para exclusão ou outra ação irreversível quando aplicável.
- Não esconda consequências importantes de uma ação.
- Deixe o paciente ou registro afetado explicitamente identificado quando necessário.

## Qualidade da tela

Antes de concluir, verifique:

- identidade do paciente;
- seção atual;
- criticidade das informações;
- estados de erro e vazio;
- feedback de gravação;
- acessibilidade;
- consistência com outras telas do prontuário.
