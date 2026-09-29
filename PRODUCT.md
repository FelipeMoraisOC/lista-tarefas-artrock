# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Duas audiências principais, **com o mesmo peso** — nenhuma pode ser sacrificada pela outra:

- **Colaboradores** (setores T.I, Backoffice Digital, Vendas): organizam as próprias tarefas e registram horas ao longo do expediente. O app fica aberto o dia todo; o timer no rodapé do menu lateral acompanha a tarefa em andamento.
- **Gestores** (setores Admin e Gestão): delegam trabalho, acompanham prazos e andamento da equipe e leem para onde vai o tempo. Têm acesso total às tarefas.

O setor **Admin** também mantém a estrutura do sistema: tipos de atividade, categorias e usuários.

Escala: **até 15 pessoas** — uma equipe pequena em que todos se conhecem. Parte da equipe não é técnica; o público do histórico de atualizações é descrito como leigo.

## Product Purpose

Gestão de tarefas por setor da empresa ArtRock, com registro de horas integrado. Cada tarefa acumula **Horas Investidas**, e essas horas alimentam os **relatórios de produtividade**: a gestão vê onde o tempo da equipe é gasto, por setor, tipo de atividade e categoria.

Sucesso significa: todos registram o trabalho sem atrito, e a gestão enxerga a distribuição do tempo sem pagar por ferramentas extras.

## Positioning

É um sistema próprio, escolhido em vez de Trello, ClickUp ou Jira, porque:

- **Estrutura sob medida**: a hierarquia setor → tipo de atividade → categoria e as permissões refletem como a ArtRock trabalha. A ferramenta se adapta à empresa, não o contrário.
- **Simplicidade para leigos**: as ferramentas de mercado são complexas demais para parte da equipe.
- **Horas por categoria, integradas**: o timer grava direto nas Horas Investidas da tarefa, sem ferramenta paralela.
- **Custo e controle**: não há mensalidade por usuário, os dados ficam sob controle da empresa e os relatórios não dependem de plano pago (no Trello, a geração de relatórios é paga).

## Operating Context

- App desktop para **Windows** (Electron). A janela abre em 1440×900 e tem tamanho mínimo de 1100×700.
- Instalação com um clique (instalador NSIS, sem permissão de administrador). As atualizações automáticas vêm do GitHub Releases. Não há assinatura de código: o SmartScreen mostra um aviso na primeira instalação.
- Login com email e senha. As contas são criadas pelo setor Admin (não há cadastro próprio).
- Funciona offline: o Firestore guarda os dados localmente e sincroniza depois.
- O app fica aberto durante todo o expediente. O timer grava o tempo ao pausar, trocar de tarefa, concluir, sair da conta e fechar o app.
- Interface 100% em português (pt-BR).

## Capabilities and Constraints

**Funcionalidades confirmadas** (detalhes em `CLAUDE.md` e `README.md`): login, Dashboard pessoal (contadores por status, horas por categoria, horas por dia), Minhas Tarefas, Tarefas Delegadas, Backlog por setor (inclui tarefas sem responsável), criação e detalhe de tarefa (descrição em Markdown com rascunho automático, checklist, comentários, histórico, subtarefas), timer no menu lateral, Configurações, Administração (tipos de atividade, categorias, usuários) e atualização automática.

**Terminologia do produto** (usar exatamente assim): Para Fazer / Em Andamento / Concluído; Horas Investidas; Minhas Tarefas; Tarefas Delegadas; Backlog; Solicitante; Responsável; Setor; Tipo de Atividade; Categoria; Subtarefa; Prioridade Alta / Média / Baixa.

**Regras de acesso**: podem editar uma tarefa quem a criou, o responsável e os setores Admin e Gestão. Os demais usuários abrem a tarefa só para visualização. Tarefas de Admin e Gestão ficam protegidas no Backlog. As rotas de Administração e de Usuários são exclusivas do Admin.

**Restrições técnicas**:
- `store.js` é a única camada de dados; as telas nunca acessam o Firestore diretamente.
- Chart.js, marked e EasyMDE vêm de CDN. Sem internet, eles podem não carregar, e as telas precisam continuar utilizáveis nesse caso (a versão 1.1.1 corrigiu exatamente isso na edição da descrição).
- As horas registradas nunca podem se perder: o timer grava valores absolutos e se recupera de fechamentos inesperados.
- O projeto segue TDD, e os testes rodam 100% localmente, sem Firebase nem rede.

**Decisões em aberto**:
- O Dashboard atual mostra os números do próprio usuário. Não foi confirmado onde os relatórios de produtividade da gestão são produzidos hoje (dentro do app ou fora dele).
- Alinhar o app à identidade visual oficial da ArtRock (ver Brand Commitments).

## Brand Commitments

- Nome da empresa: **ArtRock**. Nome do produto: **ArtRock Tarefas** (é o que aparece no instalador e no atalho).
- A ArtRock **tem uma identidade visual oficial, mas o app hoje não a segue**. O wordmark "ART/ROCK Tarefas" e as cores atuais foram feitos para o app e **não** são a marca oficial. Adotar a identidade oficial é uma decisão em aberto. Os arquivos oficiais (logo, manual, cores) **não estão no repositório** e devem ser pedidos ao usuário, nunca recriados nem inventados.
- Voz: português do Brasil simples, direto e sem jargão técnico, falando com o usuário como "você". Descreva o que a pessoa vê e faz, não como o sistema funciona por dentro.

## Evidence on Hand

- Ícone do app: `build/icon.ico`, `build/icon.png`.
- Histórico de versões escrito para usuários: `CHANGELOG.md` (1.0.0 → 1.1.1).
- Documentação técnica: `CLAUDE.md`, `README.md`, `docs/plano-migracao-firebase.md`.
- Dados legados de antes do Firebase: `data/*.json`.
- **Não existem** no repositório: os arquivos da identidade visual oficial, pesquisas com usuários, métricas de uso ou depoimentos. Não fabricar nada disso.

## Product Principles

1. **Registrar trabalho custa quase nada.** Os relatórios de produtividade só valem o que a equipe registra, então o caminho de registrar tarefa e horas precisa ser o mais curto do app.
2. **Óbvio para quem não é técnico.** Cada tela deve ser entendida sem treinamento, com a terminologia do produto e português simples.
3. **Colaborador e gestor pesam igual.** Recursos de acompanhamento não podem adicionar atrito a quem executa, e recursos de execução não podem esconder informação de quem gere.
4. **A estrutura da ArtRock manda.** Setor → tipo de atividade → categoria é a espinha do produto; relatórios, filtros e permissões seguem essa hierarquia.
5. **Tempo registrado é sagrado.** Nenhuma mudança pode arriscar perder horas já registradas, nem com o app offline, fechado de repente ou com o computador suspenso.

## Accessibility & Inclusion

- Parte da equipe tem **baixa visão ou dificuldade de leitura** e precisa de texto maior e contraste alto. Mudanças nunca devem reduzir o tamanho do texto nem a legibilidade atuais.
- Nenhuma norma formal (por exemplo, um nível WCAG) foi exigida. A legibilidade para esse grupo é o requisito real.
