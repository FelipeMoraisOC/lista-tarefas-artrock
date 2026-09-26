# ArtRock — Sistema de Gestão de Tarefas

Sistema de gestão de tarefas por setor para a empresa ArtRock.
Aplicativo desktop construído com **Electron** + **Firebase** (Firestore + Authentication).

---

## Instalação (para usuários)

1. Baixe o instalador `.exe` na página de [Releases](https://github.com/FelipeMoraisOC/lista-tarefas-artrock/releases)
2. Execute o arquivo baixado
3. Se o Windows mostrar um aviso de proteção, clique em **"Mais informações"** e depois em **"Executar assim mesmo"**
4. O aplicativo será instalado e abrirá automaticamente

Atualizações futuras são instaladas automaticamente — o app avisa quando uma nova versão estiver pronta.

---

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (com hot reload e DevTools)
npm run dev

# Rodar o app (build + Electron)
npm start

# Gerar instalador Windows
npm run dist

# Gerar instalador e publicar no GitHub Releases
# (requer GH_TOKEN configurado)
npm run dist:publish

# Testes automatizados (100% locais — não acessam o Firebase)
npm test
npm run test:watch      # modo contínuo para TDD: roda de novo a cada arquivo salvo
npm run test:coverage   # + relatório de cobertura em coverage/index.html
```

**Requisito:** Node.js 22.22+ ou 24.15+ (exigido pelo Vite 8 e pelo jsdom dos testes)

---

## Funcionalidades

### Login
- Autenticação com email e senha (Firebase Auth)
- Recuperação de senha por email
- Sessão persistente

### Dashboard
- Cards de estatísticas: Para Fazer / Em Andamento / Concluídas + horas totais
- Lista de tarefas em andamento e próximos prazos
- Gráfico de pizza: horas investidas por categoria
- Gráfico de barras empilhado: horas por dia (últimos 14 dias)

### Minhas Tarefas
- Filtro por status: Para Fazer | Em Andamento | Concluído
- Busca por texto com seleção de coluna (Nome, Categoria, Tipo, Prioridade, Prazo)
- Ordenação por status, prioridade, prazo ou solicitante
- Indicador de rascunho não salvo nos cards

### Tarefas Delegadas
- Tarefas criadas por você mas atribuídas a outros
- Painel de filtros: prazo, datas, status, prioridade, solicitante, tipo de atividade, categoria
- Ordenação por prazo, conclusão ou início

### Criar Tarefa
- Campos: nome, status, prioridade, prazo, solicitante, responsável, descrição
- Tipo de atividade filtrado pelos setores do usuário
- Categoria filtrada pelo tipo de atividade selecionado
- Seletor de responsável com busca

### Detalhes da Tarefa
- Nome editável inline (clique para editar)
- Descrição em Markdown com editor rico (EasyMDE) e auto-save de rascunho
- Todos os campos editáveis na sidebar
- Checklist com barra de progresso
- Comentários e histórico de atividade
- Lista de subtarefas com acesso direto
- Exclusão com confirmação (digitar "excluir")

### Subtarefas
- Herdam tipo de atividade e categoria da tarefa pai
- Validação: horas da subtarefa ≤ horas da tarefa pai

### Administração *(exclusivo do setor Admin)*
- **Tipos de Atividade**: criar, editar, excluir — com setores vinculados
- **Categorias**: criar, editar, excluir — vinculadas a tipo de atividade e setores
- **Usuários**: criar e editar usuários (UID Firebase, email, nome, iniciais, cargo, setores)
- Proteção de integridade: itens em uso não podem ser excluídos
- Setor "TODOS" é exclusivo (desmarca os demais)

### Auto-update
- Verificação automática ao abrir o app
- Download silencioso em segundo plano
- Aviso para reiniciar quando a atualização estiver pronta

---

## Setores

| ID | Nome |
|---|---|
| ALL | TODOS |
| s1 | T.I |
| s2 | Backoffice Digital |
| s3 | Vendas |
| s4 | Admin |

---

## Estrutura do Projeto

```
lista-tarefas-artrock/
├── main.js                    # Electron main process
├── preload.js                 # Preload (contextIsolation)
├── updater.js                 # Auto-update (electron-updater)
├── vite.config.js             # Vite config
├── package.json               # Dependências, scripts, config do builder
├── firebase.json              # Config Firebase
├── firestore.rules            # Regras de segurança Firestore
├── CLAUDE.md                  # Contexto do projeto para IA
├── CHANGELOG.md               # Histórico de atualizações
├── build/                     # Ícones do app
├── data/                      # JSON legado (backup pré-Firebase)
├── dist-renderer/             # Build do renderer (Vite)
├── release/                   # Output do instalador (gitignored)
└── renderer/
    ├── index.html             # Tela de login + shell do app
    ├── css/style.css          # Design system
    └── js/
        ├── app.js             # Router, auth, navegação
        ├── auth.js            # Firebase Auth
        ├── firebase.js        # Firebase init + offline persistence
        ├── store.js           # Camada de dados (Firestore CRUD)
        ├── utils.js           # Utilitários
        ├── views/
        │   ├── dashboard.js   # Dashboard com gráficos
        │   ├── tasks.js       # Minhas Tarefas
        │   ├── delegated.js   # Tarefas Delegadas
        │   ├── admin.js       # Admin: tipos e categorias
        │   ├── users.js       # Admin: gestão de usuários
        │   └── modals.js      # Modais de criação e detalhe
        └── components/
            ├── chart.js       # Gráficos (Chart.js)
            ├── markdown.js    # Renderização Markdown
            ├── editor.js      # Editor rico (EasyMDE)
            ├── searchable-select.js  # Dropdown com busca
            └── task-filter.js # Painel de filtros
```

---

## Tecnologias

- **Electron 28** — Framework desktop
- **Firebase** — Firestore (banco de dados) + Authentication (login)
- **Vite** — Bundler para o renderer
- **Chart.js** — Gráficos no dashboard
- **EasyMDE** — Editor Markdown para descrições
- **electron-builder** — Geração do instalador Windows
- **electron-updater** — Atualização automática via GitHub Releases
