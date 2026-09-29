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
├── preload.js                 # Ponte mínima (contextBridge): window.appLifecycle.onBeforeClose
├── updater.js                 # Auto-update via electron-updater
├── vite.config.js             # Vite config (root: renderer, output: dist-renderer)
├── vitest.config.mjs          # Testes: aliases firebase/* → tests/fakes, jsdom, cobertura
├── tests/                     # Testes automatizados (ver seção "Testes Automatizados")
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
        │   ├── settings.js    # Configurações: perfil, ativar/desativar timer, recarregar, sair
        │   └── modals.js      # Modais: criar tarefa, detalhe da tarefa, confirmação
        └── components/
            ├── chart.js       # Wrappers Chart.js (pie e bar)
            ├── markdown.js    # Wrapper marked.js
            ├── editor.js      # Wrapper EasyMDE
            ├── searchable-select.js  # Dropdown com busca
            ├── task-filter.js # Painel de filtros reutilizável
            ├── task-timer.js  # Timer das tarefas em andamento (menu lateral)
            ├── a11y.js        # Acessibilidade: foco em diálogos (trapTab), setPressed, keepFocus
            └── sidebar-toggle.js # Botão ☰ do menu compacto (zoom alto / janela estreita)
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
| s5 | Gestão |

### Controle de Acesso

- `isAdmin(user)`: verifica se `sectorIds` contém `s4` (Admin)
- `isManager(user)`: verifica se `sectorIds` contém `s4` (Admin) ou `s5` (Gestão) — acesso total às tarefas
- Os IDs `s4`/`s5` são fixos em `store.js` **e** em `firestore.rules` — manter os dois em sincronia
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
12. **Backlog** — Setores → tipos de atividade → tabela de tarefas; criação com setor e sem responsável
13. **Timer (menu lateral)** — Tarefas "Em Andamento" do usuário; a do topo conta tempo. Arrastar reordena/troca a ativa, arrastar acima da lista conclui (com Desfazer), botão direito adiciona 5/10/15/30 min. Pode ser desativado nas Configurações (preferência por usuário no localStorage)
14. **Configurações** — Aberta pelo usuário no topo do menu: perfil, timer on/off, recarregar a aplicação e sair da conta

---

## Padrões de Código

- **store.js** é a única camada de dados. Views nunca acessam Firestore diretamente.
- Cache em memória (`_cache`) com `bust(key)` após escritas.
- IDs gerados com `generateId(prefix)` → `{prefix}-{timestamp}-{random}`.
- Toasts via `showToast(msg, type)` para feedback ao usuário.
- Modais criados dinamicamente no DOM, destruídos ao fechar. Todo modal abre por `openShell(html, cls, { label | labelledBy })`: ele dá `role="dialog"` e nome, deixa `#app` `inert`, prende o Tab, fecha com Esc e devolve o foco a quem abriu. Sobreposições dentro de um modal (ex.: seletor de responsável) tratam Esc/Tab e chamam `stopPropagation()`.
- Cores por papel (`:root` do `style.css`, bloco "Papéis de cor"): texto `--text/--text-2/--text-muted`, ação `--action`, foco `--focus` (azul — vermelho é só erro: `--danger*`), seleção `--selected`, contorno de campo `--border-input` (≥ 3:1), status em pílula preenchida `--st-*`, prioridade em pílula contornada `--pr-*`. Use esses tokens, não hex soltos; todo texto ≥ 4.5:1. O modal de tarefa (`.tc`) é claro, mapeado nos mesmos tokens. Gráficos: paleta categórica validada em `components/chart.js` (a cor segue a categoria).
- Tipografia por papel (`:root`, bloco "Tipografia"): `--fs-meta` (14,2px, o menor permitido), `--fs-ui`, `--fs-body`, `--fs-heading`, `--fs-title`, `--fs-title-lg`, `--fs-display`; famílias `--font-sans` / `--font-mono`. Use sempre `font-size: var(--fs-*)` — nada de valores soltos nem texto abaixo de 14px (exceção: iniciais em avatares). Rótulos em caixa normal (sem `text-transform: uppercase`), salvo a marca "TAREFAS". A raiz é `html { font-size: 18.2px }`.
- Zoom e janela pequena (fim do `style.css`, seção "ADAPTAÇÃO"): alvo = notebook 1366×768 com zoom de 150% (911×512) e 200% (683×384), sem rolagem lateral. As telas usam container queries (`#main-content` é o container `main`; a tabela do Backlog é `bltable`). Abaixo de 800px o menu vira coluna de ícones (timer compacto) e o botão `#btn-menu` abre o menu completo por cima (`components/sidebar-toggle.js`, classe `#app.sidebar-open`). O detalhe da tarefa fica em uma coluna abaixo de 1024px.
- Acessibilidade (ver `components/a11y.js`): campos com `<label for>` ou `aria-label`; botões de alternância (abas, ordenação, filtros) mudam com `setPressed()` (classe `.active` + `aria-pressed`); listas refeitas com `innerHTML` usam `keepFocus()` para não perder o foco do teclado.
- Editores EasyMDE destruídos via `destroyAllEditors()` ao fechar modais.
- Offline persistence habilitado via `enableIndexedDbPersistence`.
- Escritas em tarefas disparam `window` event `tasks-changed` (store.js) — o timer escuta para recarregar.
- Timer: `hoursInvested` é a fonte da verdade; gravações sempre com valor **absoluto** (idempotentes). Estado local em `localStorage` (`artrock:timer:<uid>`). Grava no Firebase só ao pausar, trocar a ativa, concluir, adicionar tempo, salvar/fechar o detalhe, sair e fechar o app.
- Fechar a janela: `main.js` segura o `close`, envia `app:before-close`, o renderer grava o timer e responde `app:close-ready` (limite de 4s).

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Build renderer (Vite) + abre Electron |
| `npm run dev` | Vite dev server + Electron com DevTools |
| `npm run build` | Build apenas do renderer |
| `npm run dist` | Build + gera instalador Windows (.exe) |
| `npm run dist:publish` | Build + publica no GitHub Releases |
| `npm test` | Roda todos os testes automatizados (Vitest) |
| `npm run test:watch` | Testes em modo contínuo (ciclo TDD) |
| `npm run test:coverage` | Testes + cobertura (`coverage/index.html`) |

---

## Testes Automatizados (TDD)

O projeto segue **TDD**: toda feature ou correção nova começa por um teste que falha
(vermelho), depois o código mínimo para passar (verde), depois refatoração. Rode
`npm run test:watch` enquanto desenvolve.

**Regra de ouro: nenhum teste acessa o Firebase ou a rede.**
- `vitest.config.mjs` troca `firebase/app`, `firebase/auth` e `firebase/firestore` pelos fakes de `tests/fakes/` (banco e sessão em memória).
- `tests/setup.js` bloqueia `fetch`, `XMLHttpRequest` e `WebSocket` e limpa tudo depois de cada teste (banco falso, sessão, localStorage, DOM, cache do store, timer).

**Stack:** Vitest 5 + jsdom 30 + `@vitest/coverage-v8`.

**Estrutura:**
```
tests/
├── setup.js                 # bloqueio de rede, polyfills do jsdom, limpeza entre testes
├── fakes/                   # firebase-app / firebase-auth / firebase-firestore em memória
├── helpers/
│   ├── world.js             # dados de teste: SECTORS, TYPES, CATEGORIES, USERS, makeTask, seedWorld, signInAs
│   └── dom.js               # mountAppShell (HTML real do index.html), click, typeInto, choose, waitFor…
├── unit/                    # funções e componentes isolados (utils, store, auth, card, filtros…)
├── features/                # uma suíte por funcionalidade, testando a tela como o usuário usa
└── main/                    # processo principal do Electron (main.js, preload.js, updater.js) com electron-fake.js
```

**Convenções:**
- Nomes de `describe`/`it` em português, descrevendo o comportamento esperado.
- Monte cenários com `seedWorld({ tasks })` + `signInAs(USERS.dev)` + `mountAppShell()`.
- Espere telas assíncronas com `waitFor(() => expect(...))` — não conte "voltas" fixas.
- Timer e datas: `vi.useFakeTimers({ now })` + `vi.advanceTimersByTimeAsync(ms)`.
- O Firestore falso simula falhas e rede: `__failNext(op, code)`, `__setOffline(bool)`, `__holdReads()`, `__writes(colecao, op)`.
- Testes do Electron rodam com `// @vitest-environment node` e injetam o fake via `mockModule('electron', …)`.
- Quando um teste revela bug, corrija o código (não o teste) e mantenha o teste como proteção.

**Fora do escopo atual:** as regras do Firestore (`firestore.rules`) só podem ser testadas com o Firebase Emulator (exige Java) — ainda não automatizado.

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
