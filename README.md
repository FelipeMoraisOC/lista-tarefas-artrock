# ArtRock — Lista de Tarefas

Sistema de gestão de tarefas por setor para a empresa ArtRock.  
Aplicativo desktop construído com **Electron** — sem servidor, sem banco de dados.  
Dados persistidos em arquivos `.json` reais no disco (`/data/*.json`).

---

## Como executar

```bash
# 1. Instalar dependências (apenas na primeira vez)
npm install

# 2. Iniciar o aplicativo
npm start

# 3. Modo dev (com DevTools aberto)
npm run dev
```

> **Requisito:** Node.js instalado em `C:\Program Files\nodejs\`

---

## Funcionalidades

### Dashboard
- Cards de estatísticas: Para Fazer / Em Andamento / Concluídas
- Lista de tarefas **Em Andamento** e **Próximos Prazos**
- Gráfico de pizza: horas investidas por categoria
- Gráfico de barras empilhado: horas por dia (últimos 14 dias)

### Minhas Tarefas
- Filtro por status: Para Fazer | Em Andamento | Concluído
- Busca por texto com seleção de coluna (Nome, Categoria, Tipo, Prioridade, Prazo)
- Cards com badge de prioridade e progresso

### Modal: Nova Tarefa
- Todos os campos obrigatórios e opcionais
- Tipo de Atividade filtrado pelo setor do usuário logado
- Categoria filtrada pelo tipo de atividade selecionado
- Seção especial ao selecionar **Concluído**: Horas, Datas obrigatórias

### Modal: Detalhes da Tarefa
- **Nome** clicável → edição inline
- **Descrição** em Markdown → clique para editar com preview
- Todos os campos editáveis na sidebar direita
- Botão **Salvar** aparece apenas quando há alterações
- Lista de Sub-tarefas com acesso direto a cada uma
- Botão **Nova Sub-tarefa**

### Administração *(exclusivo do setor Admin)*
Menu **Administração** visível apenas para usuários que pertencem ao setor `Admin`.
Usuários de outros setores que acessarem `#admin` recebem a tela **Acesso restrito**.

- Aba **Tipos de Atividade**: criar, editar e excluir tipos, definindo os setores com acesso
- Aba **Categorias**: criar, editar e excluir categorias, com tipo de atividade e setores
- Colunas de uso (quantas categorias e tarefas dependem do item) e filtro por tipo de atividade
- Busca por nome em ambas as abas
- Setor **TODOS** é exclusivo: ao marcá-lo, os demais setores são desmarcados
- Validações: nome obrigatório, nome único (por tipo, no caso de categorias), ao menos um setor
- Proteção de integridade: itens em uso por tarefas — ou tipos com categorias vinculadas —
  não podem ser excluídos

### Sub-tarefas
- Herdam Tipo de Atividade e Categoria da tarefa pai (não editáveis)
- Validação: horas da sub-tarefa ≤ horas da tarefa pai
- Status Concluído sem horas é permitido (diferente de tarefa pai)

---

## Troca de usuário
O dropdown no canto inferior da sidebar permite simular diferentes usuários.  
Cada usuário tem setores associados, o que filtra os **Tipos de Atividade** disponíveis.

| Usuário | Setor |
|---|---|
| Carlos Silva | T.I |
| Ana Souza | Backoffice Digital |
| Pedro Costa | T.I + Backoffice Digital |
| Mariana Lima | Vendas |
| Rafael Santos | T.I + Vendas |
| Administrador ArtRock | Admin |

---

## Estrutura de arquivos

```
lista-tarefas-artrock/
├── main.js           ← Electron main + IPC handlers
├── preload.js        ← contextBridge seguro
├── data/             ← Arquivos JSON (persistência real)
│   ├── tasks.json
│   ├── users.json
│   ├── sectors.json
│   ├── activity_types.json
│   ├── categories.json
│   └── session.json
└── renderer/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js
        ├── store.js
        ├── utils.js
        ├── views/
        │   ├── dashboard.js
        │   ├── tasks.js
        │   ├── admin.js      ← CRUD de tipos de atividade e categorias (setor Admin)
        │   └── modals.js
        └── components/
            ├── chart.js
            └── markdown.js
```