name: nefro-ui
description: Cria ou ajusta componentes e telas do Hu-Nefro seguindo a linguagem visual atual do produto, Bootstrap 5, hierarquia clínica e padrões consistentes de interação.
---

# Hu-Nefro UI

Use esta Skill sempre que a tarefa principal for criar, ajustar ou padronizar a interface visual do Hu-Nefro.

## Relação com as regras do projeto

- `AGENTS.md` define a stack e as regras de implementação.
- `Guidelines.md` é a referência principal para linguagem visual, UX, acessibilidade e design system.
- Esta Skill operacionaliza esses padrões na criação e manutenção da UI.
- A interface legada não é referência visual.

## Antes de alterar

- Inspecione telas e componentes já existentes no Hu-Nefro.
- Preserve navegação, contexto do paciente, sidebar, espaçamentos e padrões visuais já consolidados do produto atual.
- Consulte `Guidelines.md` para confirmar padrões visuais e de interação.
- Consulte a documentação funcional em `legacy/` para o conteúdo e comportamento exigidos pela tela.

## Bootstrap 5

- Use Bootstrap 5 como base de layout, componentes e comportamento compatível.
- Prefira classes e componentes nativos quando forem suficientes.
- Crie CSS próprio somente para necessidades específicas do Hu-Nefro.
- Não duplique um componente existente com pequenas diferenças sem necessidade real.
- Não introduza Tailwind ou outro framework/UI framework.

## Hierarquia

- Use contraste, tamanho, peso, espaçamento e posição para criar hierarquia.
- A ação primária deve ser visualmente distinta das ações secundárias.
- Ações destrutivas não devem competir com ações normais.
- Informações clínicas críticas devem ter maior saliência que dados administrativos quando o requisito exigir essa prioridade.
- Não faça todos os badges, cards e blocos parecerem igualmente importantes.
- Não use cor como único indicador de significado.

## Componentes

Priorize componentes reutilizáveis para padrões recorrentes, por exemplo:

- cabeçalho do paciente;
- sidebar do prontuário;
- cabeçalho de seção;
- campo de formulário;
- alerta clínico;
- badge de status;
- tabela clínica;
- timeline ou histórico;
- modal de confirmação;
- estado vazio;
- estado de loading;
- estado de erro.

Use os nomes existentes no projeto quando já houver componentes equivalentes.

## Layout

- Prefira agrupamentos por tarefa e significado clínico.
- Evite formulários excessivamente longos sem agrupamento.
- Evite abrir novas camadas quando um agrupamento no mesmo contexto resolver.
- Preserve leitura em monitores desktop e comportamento responsivo em larguras menores.
- Não replique a disposição visual do sistema legado apenas por semelhança funcional.

## Estados

Todo componente interativo deve considerar, quando aplicável:

- default;
- hover;
- focus;
- active;
- disabled;
- loading;
- error;
- success.

Os estados devem ser perceptíveis sem depender somente da cor.

## Não fazer

- Não usar cor como único indicador.
- Não adicionar decoração sem função.
- Não introduzir novos padrões de botão sem necessidade.
- Não inventar valores de domínio apenas para preencher a interface.
- Não criar um novo componente quando um padrão existente já atender ao requisito.
- Não copiar visualmente componentes do legado.
