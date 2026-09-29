# Atualizações — ArtRock Tarefas

Histórico de novidades e melhorias do aplicativo.

---

## [1.1.2] — 2026-09-28

### Melhorias

- **Usar o aplicativo pelo teclado** — As janelas de tarefa agora recebem o cursor assim que abrem, a tecla Tab não "escapa" mais para o que está atrás delas, e ao fechar (com Esc ou no ✕) você volta exatamente para onde estava.
- **Escolher o responsável pelo teclado** — Na janela "Escolher Responsável", digite parte do nome, use as setas ↑ e ↓ e aperte Enter para confirmar. O mesmo vale para o campo Responsável nos detalhes da tarefa.
- **Timer pelo teclado** — Com uma tarefa do timer selecionada, as setas ↑ e ↓ passam de uma tarefa para outra, e Alt + ↑/↓ mudam a ordem (a do topo é a que conta o tempo). A tecla Menu do teclado (ou Shift+F10) abre as opções da tarefa.
- **Concluir pelo menu do timer** — Clique com o botão direito numa tarefa do timer e escolha "Concluir tarefa". Antes, só dava para concluir arrastando.
- **Editar o nome da tarefa pelo teclado** — Nos detalhes, chegue ao nome com Tab e aperte Enter para editar.
- **Programas que leem a tela em voz alta** — Todos os campos dos formulários agora têm nome, as janelas se apresentam com o nome da tarefa, e as abas e botões de ordenação avisam qual está selecionado.
- **Textos mais fáceis de ler** — As etiquetas de status e prioridade, os textos em cinza e os botões verdes ficaram mais escuros e com mais contraste. Isso ajuda principalmente quem enxerga com dificuldade.
- **Janela da tarefa clara** — As janelas de criar e de ver uma tarefa agora são claras, como o resto do aplicativo. Os olhos não precisam mais se readaptar do claro para o escuro a cada tarefa aberta.
- **Cada cor com um significado** — Status aparece como etiqueta preenchida e prioridade como etiqueta com contorno, para não confundir as duas. A categoria ficou neutra (antes era azul, como "Em Andamento"). O campo em que você está digitando fica com borda azul; vermelho agora aparece só em erros, atrasos e prioridade Alta.
- **Campos com borda visível** — Os campos de texto, datas e listas têm contorno mais forte, fácil de enxergar.
- **Letras maiores e mais organizadas** — Nenhum texto do aplicativo fica mais abaixo de um tamanho confortável de leitura. Etiquetas, datas, o timer e os rótulos dos campos cresceram, e os tamanhos foram padronizados para que títulos, textos e detalhes se diferenciem de relance.
- **Menos letras maiúsculas** — Rótulos como "Criado por", "Setores" e os títulos das colunas agora aparecem em letras normais, que são mais fáceis de ler do que TUDO EM MAIÚSCULAS.
- **Funciona bem com zoom** — Quem aumenta o tamanho da tela (Ctrl +) agora vê tudo sem cortes. Com zoom alto, o menu lateral vira uma coluna de ícones que mantém o timer à vista; o botão ☰ no topo abre o menu completo. O Dashboard, as Tarefas Delegadas e as abas se reorganizam para caber, e os detalhes da tarefa passam a rolar como uma página só.
- **Backlog cabe na tela** — A tabela do Backlog não corta mais a coluna de Prazo. Em janelas mais estreitas, as colunas menos importantes ("Criado por" e depois "Categoria") saem da tabela — elas continuam nos detalhes da tarefa — e, bem estreito, cada tarefa aparece como um cartão.
- **Descrição mais confortável de ler** — As linhas da descrição da tarefa ficaram mais curtas e espaçadas, e o campo de edição da descrição usa a mesma letra do resto do aplicativo.
- **Gráficos do Dashboard** — Cada categoria tem a mesma cor nos dois gráficos, a legenda da pizza mostra as horas de cada categoria, e as cores foram escolhidas para serem diferenciadas também por quem tem daltonismo. Com muitas categorias, as menores aparecem juntas em "Outras".

### Correções

- **Nome errado de um campo** — Ao criar uma tarefa, o campo de prioridade aparecia como "Etiquetas". Agora aparece como "Prioridade", igual aos detalhes da tarefa.
- **Botão Salvar do comentário** — Ao passar com Tab pela caixa de comentário vazia, o botão Salvar sumia e o cursor se perdia. Corrigido.
- **Esc na lista de responsável** — Apertar Esc na lista de responsável, nos detalhes, fechava a tarefa inteira. Agora fecha só a lista.
- **Sub-tarefas no Backlog pelo teclado** — Apertar Enter na setinha de sub-tarefas abria a tarefa em vez de mostrar as sub-tarefas. Corrigido.

---

## [1.1.1] — 2026-09-26

### Correções

- **Editar a descrição sem internet** — Antes, se o aplicativo abrisse sem internet, o botão "Editar" da descrição de uma tarefa não funcionava. Agora a descrição pode ser editada normalmente, num campo de texto simples.
- **Histórico de tarefa nova** — Tarefas recém-criadas mostravam no histórico uma "Última atualização" que não tinha acontecido. Agora aparece só o registro de criação.
- **Timer mais seguro** — Se o relógio do computador fosse ajustado para trás, o timer podia deixar de guardar o tempo por um período e, se o aplicativo travasse nesse meio-tempo, horas podiam se perder. Isso foi corrigido.
- **Abrir tarefa ao sair da conta** — Se a sessão fosse encerrada enquanto os detalhes de uma tarefa abriam, a janela podia travar. Agora ela abre só para visualização.

---

## [1.1.0] — 2026-09-25

### Novidades

- **Backlog** — Nova tela no menu lateral onde você vê as tarefas de todos os setores. Escolha um setor, depois um tipo de atividade, e veja a lista de tarefas com responsável, categoria, prioridade, status e prazo. Tarefas com sub-tarefas podem ser expandidas na própria lista.
- **Tarefas sem responsável** — Pelo Backlog é possível criar uma tarefa sem responsável, para atribuir a alguém depois. Um filtro mostra só as tarefas que ainda estão sem responsável.
- **Criar tarefa para qualquer setor** — No Backlog, você escolhe primeiro o setor da tarefa; depois aparecem apenas os tipos de atividade e categorias daquele setor.
- **Filtros e ordenação na Administração** — Nas abas Tipos de Atividade e Categorias, agora dá para filtrar por setor e por uso em tarefas, e ordenar por nome, setores, quantidade de tarefas e mais.
- **Timer de tarefas** — No rodapé do menu lateral aparecem suas tarefas em andamento, cada uma com seu tempo. A tarefa do topo é a que conta o tempo: aperte ▶ para iniciar e ⏸ para pausar. O tempo vai direto para as Horas Investidas da tarefa.
- **Trocar de tarefa arrastando** — Arraste uma tarefa para o topo da lista e o timer passa a contar para ela. Arraste uma tarefa para cima da lista e ela é concluída — a próxima começa a contar sozinha. Errou? Use o botão "Desfazer".
- **Adicionar tempo rápido** — Clique com o botão direito numa tarefa do timer para somar 5, 10, 15 ou 30 minutos.
- **Configurações** — Clique no seu nome, no topo do menu, para ver seu perfil, ligar ou desligar o timer, recarregar o aplicativo ou sair da conta.

### Melhorias

- **Quem pode editar uma tarefa** — Além de quem criou, o responsável pela tarefa e os setores Admin e Gestão também podem editar ou excluir. As demais pessoas abrem a tarefa apenas para visualização.
- **Tarefas de Admin e Gestão protegidas** — No Backlog, as tarefas desses setores só aparecem para quem faz parte deles ou para quem criou a tarefa.
- **Nova e Editar Categoria** — Os setores agora são escolhidos antes do tipo de atividade, e a lista mostra apenas os tipos disponíveis para os setores marcados. Categorias para "TODOS" só podem usar tipos marcados como "TODOS".
- **Seu tempo não se perde** — O tempo do timer é salvo ao pausar, trocar de tarefa, concluir, sair da conta e fechar o aplicativo. Se o aplicativo fechar de repente ou o computador entrar em suspensão, o tempo é registrado até aquele momento e o timer é pausado.
- **Horas no detalhe da tarefa** — Com o timer rodando, as Horas Investidas acompanham o tempo ao vivo. Se você corrigir as horas à mão, o timer passa a contar a partir do novo valor.
- **Menu lateral reorganizado** — Seu nome agora fica no topo do menu e o botão Sair foi para a tela de Configurações.
- **Aplicativo mais leve** — Menos leituras repetidas dos dados, deixando as telas mais rápidas.

---

## [1.0.0] — 2026-09-24

Primeira versão do aplicativo.

### Novidades

- **Login com email e senha** — Cada usuário acessa o sistema com suas próprias credenciais. Inclui opção de recuperar senha por email.
- **Dashboard pessoal** — Tela inicial com resumo das suas tarefas: quantas estão pendentes, em andamento e concluídas, total de horas investidas, gráfico de horas por categoria e gráfico de horas por dia.
- **Minhas Tarefas** — Visualize todas as tarefas atribuídas a você. Filtre por status (Para Fazer, Em Andamento, Concluído), busque por nome, categoria ou prioridade, e ordene como preferir.
- **Tarefas Delegadas** — Veja as tarefas que você criou mas delegou para outras pessoas. Filtre por prazo, status, prioridade e muito mais.
- **Criar tarefa** — Crie tarefas com nome, prioridade, prazo, tipo de atividade, categoria, responsável e descrição formatada.
- **Detalhes da tarefa** — Edite qualquer campo da tarefa. Adicione checklist, comentários e subtarefas. A descrição usa editor de texto rico com formatação.
- **Salvamento automático de rascunho** — Se você começar a escrever uma descrição e fechar sem salvar, o rascunho fica guardado automaticamente. Um aviso aparece no card da tarefa indicando que há um rascunho pendente.
- **Subtarefas** — Crie subtarefas dentro de uma tarefa principal. Elas herdam automaticamente o tipo de atividade e a categoria.
- **Administração (apenas admins)** — Gerencie tipos de atividade, categorias e usuários do sistema. O sistema impede exclusão de itens que estão em uso.
- **Atualização automática** — O aplicativo verifica automaticamente se há novas versões. Quando uma atualização é encontrada, ela é baixada em segundo plano e você recebe um aviso para reiniciar.
- **Instalador simplificado** — Basta baixar o arquivo .exe e executar. A instalação é feita com um único clique, sem precisar de permissão de administrador.
