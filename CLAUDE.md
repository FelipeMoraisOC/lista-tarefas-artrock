# CLAUDE.md — Contexto do Projeto ArtRock Tarefas

## Visão Geral

Sistema de gestão de tarefas por setor para a empresa **ArtRock**.
App desktop construído com **Electron 28** + **Firebase** (Firestore + Auth) + **Vite**.
Interface 100% em **português (pt-BR)**.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 28 |
| Bundler | Vite 8 |
| Backend | Firebase (Firestore + Authentication) |
| Charts | Chart.js 4.4 (CDN) |
| Markdown | marked 9.1 (CDN) + EasyMDE 2.18 (CDN) |
| Build/Dist | electron-builder (NSIS para Windows) |
| Auto-update | electron-updater + GitHub Releases |

---

## Estrutura de Arquivos

```
lista-tarefas-artrock/
├── main.js                    # Electron main process, BrowserWindow, auto-updater init
├── preload.js                 # Vazio (contextIsolation ativo, sem IPC)
├── updater.js                 # Auto-update via electron-updater
├── vite.config.js             # Vite config (root: renderer, output: dist-renderer)
├── package.json               # Deps, scripts, electron-builder config
├── firebase.json              # Aponta para firestore.rules
├── firestore.rules            # Regras de segurança do Firestore
├── CLAUDE.md                  # Este arquivo (contexto para o Claude)
├── CHANGELOG.md               # Histórico de atualizações para usuários
├── build/
│   ├── icon.ico               # Ícone do app (Windows)
│   └── icon.png               # Ícone do app (PNG)
├── data/                      # JSON legado (backup pré-Firebase, não mais usado)
├── docs/
│   └── plano-migracao-firebase.md
├── release/                   # Output do electron-builder (gitignored)
└── renderer/
    ├── index.html             # Tela de login + shell do app + CDN libs
    ├── css/style.css          # Design system completo (~3400 linhas)
    └── js/
        ├── app.js             # Router, auth listener, boot, navegação
        ├── auth.js            # Firebase Auth (login, logout, onAuthChange, resetPassword)
        ├── firebase.js        # Firebase init, exports db e auth, offline persistence
        ├── store.js           # Camada de dados: CRUD Firestore, cache, funções admin
        ├── utils.js           # showToast, generateId, formatDate, isOverdue, todayISO
        ├── views/
        │   ├── dashboard.js   # Stats, listas em andamento/prazos, gráficos pie+bar
        │   ├── tasks.js       # Minhas Tarefas: grid, tabs de status, busca, ordenação
        │   ├── delegated.js   # Tarefas Delegadas: filtro lateral + grid
        │   ├── admin.js       # Admin: CRUD tipos de atividade + categorias
        │   ├── users.js       # Admin: gestão de usuários (criar/editar)
        │   └── modals.js      # Modais: criar tarefa, detalhe da tarefa, confirmação
        └── components/
            ├── chart.js       # Wrappers Chart.js (pie e bar)
            ├── markdown.js    # Wrapper marked.js
            ├── editor.js      # Wrapper EasyMDE
            ├── searchable-select.js  # Dropdown com busca
            └── task-filter.js # Painel de filtros reutilizável
```

---

## Modelo de Dados (Firestore)

### Collections

| Collection | Leitura | Escrita | Notas |
|---|---|---|---|
| `sectors` | Autenticado | Ninguém | Somente leitura |
| `users` | Autenticado | Admin (setor s4) | Perfis de usuário |
| `activityTypes` | Autenticado | Admin | Tipos de atividade |
| `categories` | Autenticado | Admin | Categorias |
| `tasks` | Autenticado | Criador (createdById) | Tarefas e subtarefas |

### Schema de Tarefa

```
id, type ("task"|"subtask"), parentId, status ("Para Fazer"|"Em Andamento"|"Concluido"),
name, description (Markdown), activityTypeId, categoryId, requesterId, responsibleId,
deadline, priority ("Alta"|"Media"|"Baixa"), startDate, endDate, completionPercent (0-100),
hoursInvested, createdById, createdAt, updatedAt, checklist [{id, text, done}],
comments [{id, userId, text, createdAt, isSystem?}]
```

### Setores

| ID | Nome |
|---|---|
| ALL | TODOS |
| s1 | T.I |
| s2 | Backoffice Digital |
| s3 | Vendas |
| s4 | Admin |

### Controle de Acesso

- `isAdmin(user)`: verifica se `sectorIds` contém o setor com nome "admin" (case-insensitive)
- Rotas `admin` e `users`: restritas a admins (verificado em `navigate()` no app.js)
- Tipos de atividade e categorias filtrados pelos setores do usuário logado

---

## Funcionalidades Existentes

1. **Autenticação** — Login com email/senha (Firebase Auth), logout, reset de senha
2. **Dashboard** — Stats (Para Fazer, Em Andamento, Concluídas + horas), listas de tarefas em andamento e próximos prazos, gráficos pie (horas/categoria) e bar (horas/dia últimos 14 dias)
3. **Minhas Tarefas** — Grid com tabs de status, busca por coluna, ordenação multi-critério, indicador de draft
4. **Tarefas Delegadas** — Tarefas criadas pelo usuário mas atribuídas a outros, com painel de filtros (datas, status, prioridade, solicitante, tipo, categoria)
5. **Criar Tarefa** — Modal com todos os campos, tipo/categoria filtrados por setor, picker de responsável com busca
6. **Detalhe da Tarefa** — Edição inline do nome, editor Markdown para descrição com auto-save de draft (localStorage), checklist, comentários, subtarefas, exclusão com confirmação
7. **Subtarefas** — Herdam tipo/categoria do pai, validação de horas ≤ pai
8. **Admin: Tipos de Atividade** — CRUD com setores, proteção de integridade
9. **Admin: Categorias** — CRUD com tipo de atividade e setores, proteção de integridade
10. **Admin: Usuários** — Criar/editar usuários (UID Firebase, email, nome, iniciais, cargo, setores)
11. **Auto-update** — Verifica GitHub Releases, download silencioso, dialog para reiniciar

---

## Padrões de Código

- **store.js** é a única camada de dados. Views nunca acessam Firestore diretamente.
- Cache em memória (`_cache`) com `bust(key)` após escritas.
- IDs gerados com `generateId(prefix)` → `{prefix}-{timestamp}-{random}`.
- Toasts via `showToast(msg, type)` para feedback ao usuário.
- Modais criados dinamicamente no DOM, destruídos ao fechar.
- Editores EasyMDE destruídos via `destroyAllEditors()` ao fechar modais.
- Offline persistence habilitado via `enableIndexedDbPersistence`.

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Build renderer (Vite) + abre Electron |
| `npm run dev` | Vite dev server + Electron com DevTools |
| `npm run build` | Build apenas do renderer |
| `npm run dist` | Build + gera instalador Windows (.exe) |
| `npm run dist:publish` | Build + publica no GitHub Releases |

---

## Build e Distribuição

- **electron-builder** gera instalador NSIS one-click para Windows
- **Publicação**: GitHub Releases (provider: github, owner: FelipeMoraisOC, repo: lista-tarefas-artrock)
- **Output**: `release/` (gitignored)
- **Sem code signing**: SmartScreen mostra aviso na primeira instalação

---

## Instrução para o Claude: Registro de Atualizações

**Toda vez que uma feature for implementada e commitada**, atualizar o arquivo `CHANGELOG.md`:

1. Adicionar a entrada na seção da versão atual (topo do arquivo)
2. Se for uma nova versão, criar uma nova seção `## [X.Y.Z] — YYYY-MM-DD`
3. Usar linguagem simples e acessível (o público é leigo)
4. Categorizar em: Novidades, Melhorias, Correções
5. Não usar jargão técnico — descrever o que o usuário vê/experimenta
