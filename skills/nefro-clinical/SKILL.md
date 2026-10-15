name: nefro-clinical
description: Cria ou revisa interfaces clínicas do Hu-Nefro para dados, eventos, diagnósticos, alergias, exames e registros assistenciais, priorizando contexto, segurança e rastreabilidade.
---

# Hu-Nefro Clinical

Use esta Skill quando a interface representar informação clínica, histórico assistencial ou uma ação com potencial impacto no atendimento.

## Relação com as regras do projeto

- `AGENTS.md` define as regras de engenharia e tecnologia.
- `Guidelines.md` define os princípios de produto, UX clínica, acessibilidade e interface.
- Esta Skill especializa esses princípios para interfaces clínicas.
- Não altere regras funcionais ou clínicas sem requisito documentado.

## Princípio

A interface deve apoiar o usuário a encontrar, entender, registrar e revisar informação clínica sem exigir memória desnecessária.

## Fonte funcional

- Consulte a documentação funcional canônica em `legacy/` para campos e fluxos do domínio.
- Preserve a terminologia documentada.
- Não introduza interpretação clínica, recomendação terapêutica, dose, diagnóstico ou limiar clínico que não esteja definido no requisito.

## Hierarquia clínica

Organize visualmente a informação por criticidade funcional:

1. informação crítica para segurança;
2. informação importante para a tarefa atual;
3. contexto e histórico;
4. metadados administrativos.

A prioridade deve aparecer por mais de um canal visual quando necessário: texto, posição, ícone, estrutura ou padrão — não somente cor.

## Alertas

- Use alertas para situações acionáveis ou relevantes à tarefa.
- Não transforme qualquer informação clínica em alerta.
- Diferencie aviso informativo de bloqueio de ação quando esses estados existirem.
- Evite repetir o mesmo alerta em múltiplos pontos sem benefício.

## Eventos

Quando o requisito envolver eventos clínicos:

- mostre data, tipo e informações relevantes;
- represente início e fim quando a especificação exigir;
- permita visualizar evolução ou registros relacionados quando previstos;
- identifique responsável quando esse dado fizer parte do requisito.

## Diagnósticos e CID

- Trate CID como dado estruturado, conforme a especificação.
- Não invente códigos.
- Deixe claro quando o usuário está selecionando um item catalogado versus digitando texto livre.

## Alergias

- Apresente o tipo de alergia de forma clara.
- Não esconda informação crítica em controles secundários.
- Diferencie classificação, descrição e seleção estruturada conforme a especificação.

## Resultados e exames

- Preserve a distinção entre solicitado, disponível e registrado quando essas etapas existirem.
- Dê destaque ao resultado atual sem apagar o histórico.
- Mostre unidade, data e contexto quando esses dados fizerem parte do registro.

## Auditabilidade

Quando o registro puder ser alterado:

- identifique quem realizou a ação quando previsto;
- preserve data e hora;
- diferencie criação, edição e exclusão/inativação quando essas ações existirem no requisito;
- não apague silenciosamente o histórico necessário para entender o estado atual.

## Revisão final

Antes de concluir, verifique contexto do paciente, criticidade, alertas, acessibilidade, estados, feedback e aderência estrita aos dados e comportamentos documentados.
