# Plano de Migração para Firebase (Firestore + Authentication)

## Contexto

O app Electron ArtRock usa **arquivos JSON locais** como banco de dados (`data/*.json`), acessados via IPC (`main.js` → `preload.js` → `store.js`). Não existe autenticação real — um dropdown na sidebar troca o usuário gravando em `session.json`. O objetivo é migrar para **Firestore** (persistência na nuvem) e **Firebase Authentication** (login real com email/senha), habilitando persistência offline para que o app desktop funcione sem internet.

### Decisões do usuário
- **Bundler**: Vite — necessário para importar o Firebase SDK v9 modular
- **Firebase Console**: incluir os passos de criação do projeto
- **User-switcher**: manter para dev/teste, esconder em produção; adicionar tela de login real
- **Offline**: habilitar persistência offline do Firestore (IndexedDB)

### Princípio de migração
A **camada única de dados** é o `store.js` — todas as views importam somente dele. A estratégia é reescrever as funções internas `load()` e `save()` para usar Firestore, **mantendo todas as assinaturas de exportação idênticas**. Assim nenhuma view precisa ser reescrita para a parte de dados.

---

## Fase 1 — Configuração do Projeto Firebase

### 1.1 Criar projeto no Firebase Console
1. Acessar https://console.firebase.google.com → **Criar Projeto** → nome: `artrock-tarefas`
2. **Firestore Database** → Criar banco de dados → modo de produção → região `southamerica-east1`
3. **Authentication** → Primeiros passos → Habilitar provedor **Email/Senha**
4. **Configurações do projeto** → Seus apps → **Adicionar app Web** → copiar o objeto `firebaseConfig`
5. Criar as contas de email/senha manualmente no console Auth para cada usuário existente

### 1.2 Instalar dependências
```bash
npm install firebase                    # SDK do Firebase (runtime)
npm install --save-dev vite             # Bundler
npm install --save-dev firebase-admin   # Apenas para o script de migração
```

### 1.3 Configurar Vite

Criar `vite.config.js` na raiz:
```js
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
  },
});
```

Atualizar `package.json` → scripts:
```json
{
  "scripts": {
    "start": "npm run build && electron .",
    "dev": "vite renderer & electron . --dev",
    "build": "vite build --config vite.config.js"
  }
}
```

Atualizar `main.js` → `win.loadFile(...)` para carregar do `dist-renderer/` em produção, e apontar para o dev server do Vite em modo dev (`http://localhost:5173`).

### 1.4 Criar `renderer/js/firebase.js`
```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = { /* colar config do console */ };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistência offline — dados funcionam sem internet
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Offline: múltiplas abas abertas');
  if (err.code === 'unimplemented')       console.warn('Offline: navegador não suporta');
});
```

**Arquivos afetados:** `package.json`, `main.js`, novo `vite.config.js`, novo `renderer/js/firebase.js`

---

## Fase 2 — Script de Migração de Dados

### 2.1 Criar `scripts/seed-firestore.js`

Script Node.js (roda uma vez, localmente) usando `firebase-admin`:
1. Lê cada JSON de `data/`
2. Cria contas no Firebase Auth (email/senha) para cada usuário
3. Grava documentos no Firestore, convertendo IDs de usuário locais (`u1`..`u6`) para UIDs do Firebase Auth

### 2.2 Mapeamento de coleções

| Arquivo JSON | Coleção Firestore | Doc ID | Notas |
|---|---|---|---|
| `users.json` | `users` | Firebase Auth UID | Campos: `name`, `role`, `initials`, `sectorIds`, `legacyId` |
| `sectors.json` | `sectors` | ID existente (`ALL`, `s1`…) | Raramente muda |
| `activity_types.json` | `activityTypes` | ID existente (`at1`, `at-...`) | CRUD pelo admin |
| `categories.json` | `categories` | ID existente (`c1`, `c-...`) | CRUD pelo admin |
| `tasks.json` | `tasks` | ID existente (`task-...`, `sub-...`) | Flat — subtarefas com `parentId` |
| `session.json` | *eliminado* | — | Firebase Auth gerencia a sessão |

**Decisão: coleção plana para tarefas** (sem subcollections). Os arrays `checklist[]` e `comments[]` permanecem embutidos no documento (volume pequeno, dentro do limite de 1MB do Firestore).

### 2.3 Conversão de IDs de usuário

O script mapeia `u1`→`UID_firebase_do_carlos`, etc. Os campos afetados em cada tarefa são:
- `createdById` (obrigatório)
- `requesterId` (pode ser null)
- `comments[].userId`

O doc do usuário no Firestore recebe um campo `legacyId` (`u1`, `u2`…) para referência.

### 2.4 Mapeamento de emails para criação no Auth

```js
const userCredentials = {
  u1: { email: 'carlos@artrock.com', password: 'ArtRock@2024!' },
  u2: { email: 'backoffice@artrock.com', password: 'ArtRock@2024!' },
  u3: { email: 'pedro@artrock.com', password: 'ArtRock@2024!' },
  u4: { email: 'mariana@artrock.com', password: 'ArtRock@2024!' },
  u5: { email: 'rafael@artrock.com', password: 'ArtRock@2024!' },
  u6: { email: 'admin@artrock.com', password: 'ArtRock@2024!' },
};
```

> Os emails e senhas são placeholders — o usuário deverá definir os reais antes de rodar o script.

**Arquivos afetados:** novo `scripts/seed-firestore.js`, novo `scripts/serviceAccountKey.json` (não comitado, adicionado ao `.gitignore`)

---

## Fase 3 — Reescrever `store.js` para Firestore

Esta é a fase central. O `store.js` é a **única camada de dados** do app — todas as 5 views importam funções dele. A estratégia é reescrever as funções internas mantendo as assinaturas públicas idênticas.

### 3.1 Novos imports no topo

```js
import { db, auth } from './firebase.js';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, writeBatch
} from 'firebase/firestore';
```

### 3.2 Funções de leitura — `load(key)` → `loadCollection(name)`

```js
async function loadCollection(name) {
  if (_cache[name]) return _cache[name];
  const snap = await getDocs(collection(db, name));
  const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  _cache[name] = data;
  return data;
}

export const getSectors       = () => loadCollection('sectors');
export const getUsers         = () => loadCollection('users');
export const getActivityTypes = () => loadCollection('activityTypes');
export const getCategories    = () => loadCollection('categories');
export const getTasks         = () => loadCollection('tasks');
```

### 3.3 Sessão — `getCurrentUser()` usa Firebase Auth

```js
export async function getCurrentUser() {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  if (_cache._currentUser) return _cache._currentUser;
  const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!snap.exists()) return null;
  const user = { ...snap.data(), id: snap.id };
  _cache._currentUser = user;
  return user;
}
```

`setCurrentUser()` permanece para o user-switcher de dev/teste, mas em produção é ignorada.

### 3.4 Task CRUD — operações individuais no Firestore

- **`createTask(data)`**: `setDoc(doc(db, 'tasks', newId), { ...data, id: newId, ... })` + bustar cache
- **`updateTask(id, updates)`**: `updateDoc(doc(db, 'tasks', id), { ...updates, updatedAt })` + bustar cache
- **`deleteTask(id)`**: deletar doc + query subtarefas com `where('parentId', '==', id)` e deletar cada uma via `writeBatch`

### 3.5 Admin CRUD — mesma lógica, destino Firestore

As funções `createActivityType`, `updateActivityType`, `deleteActivityType` e equivalentes de categoria mantêm toda a validação existente (nome obrigatório, unicidade case-insensitive, setor obrigatório, guarda de uso). Apenas as chamadas `save(key, array)` são substituídas por `setDoc`/`updateDoc`/`deleteDoc` individuais.

### 3.6 Cache

O `_cache` e `bust(key)` permanecem. Cada operação de escrita bustar o cache da coleção afetada para forçar re-leitura.

**Arquivo afetado:** `renderer/js/store.js` (reescrita completa das internals)

---

## Fase 4 — Tela de Login + Fluxo de Auth

### 4.1 Criar `renderer/js/auth.js`

```js
import { auth } from './firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

export const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);
export const getFirebaseUser = () => auth.currentUser;
```

### 4.2 Adicionar tela de login ao `index.html`

- Nova `<div id="login-screen">` visível por padrão (logo ArtRock, campos email/senha, botão "Entrar", mensagem de erro)
- O `<div id="app">` começa com `display: none`
- Estilizada com os tokens CSS existentes (cores da marca)

### 4.3 Modificar `app.js` — fluxo de boot

```js
import { onAuthChange, logout } from './auth.js';

// Antes de boot(), escutar o estado de auth:
onAuthChange(async (firebaseUser) => {
  if (firebaseUser) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    await boot();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});
```

### 4.4 User-switcher — manter para dev, esconder em prod

- O dropdown permanece no HTML com uma classe `dev-only`
- Em modo dev (`--dev` flag), fica visível; em produção, fica `display: none`
- Adicionar botão **"Sair"** (logout) na sidebar, sempre visível
- A função `initUserSwitcher()` é renomeada para `initUserInfo()` — mostra avatar/nome/role do usuário logado

**Arquivos afetados:** novo `renderer/js/auth.js`, `renderer/index.html`, `renderer/js/app.js`, `renderer/css/style.css`

---

## Fase 5 — Regras de Segurança do Firestore

### 5.1 Criar `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid))
             .data.sectorIds.hasAny(['s4']);
    }

    // Setores: somente leitura
    match /sectors/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Usuários: leitura para autenticados, escrita somente admin
    match /users/{id} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Tipos de atividade e categorias: leitura geral, CRUD somente admin
    match /activityTypes/{id} {
      allow read: if request.auth != null;
      allow create, update, delete: if isAdmin();
    }
    match /categories/{id} {
      allow read: if request.auth != null;
      allow create, update, delete: if isAdmin();
    }

    // Tarefas: leitura geral, escrita pelo criador
    match /tasks/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.createdById == request.auth.uid;
      allow update, delete: if request.auth != null
                            && resource.data.createdById == request.auth.uid;
    }
  }
}
```

### 5.2 Deploy via Firebase CLI
```bash
npm install -g firebase-tools   # se não tiver
firebase login
firebase init firestore         # selecionar o projeto artrock-tarefas
firebase deploy --only firestore:rules
```

**Arquivos afetados:** novo `firestore.rules`, novo `firebase.json`, novo `.firebaserc`

---

## Fase 6 — Limpeza do Código Legado

1. **`main.js`**: Remover os `ipcMain.handle('read-data', ...)` e `ipcMain.handle('write-data', ...)`. Remover `fs`, `DATA_DIR`, `ensureDataDir()`.
2. **`preload.js`**: Esvaziar o `contextBridge` (manter o arquivo vazio por segurança — `contextIsolation` continua ativo).
3. **`store.js`**: Remover referências a `window.api`. A lógica de `session.json` já foi substituída pelo Firebase Auth na Fase 3.
4. **`data/`**: Manter a pasta como backup durante a transição. Pode ser removida do repositório após validação completa.

**Arquivos afetados:** `main.js`, `preload.js`, `store.js`, `data/` (arquivamento)

---

## Ordem de Execução

| Etapa | Fase | Descrição | App funciona? |
|-------|------|-----------|---------------|
| 1 | Fase 1 | Criar projeto Firebase, instalar SDK, configurar Vite | ✅ Nada muda |
| 2 | Fase 2 | Rodar script de migração para popular Firestore | ✅ Dados locais intactos |
| 3 | Fase 3 | Reescrever `store.js` para Firestore | ✅ Mesmas assinaturas |
| 4 | Fase 4 | Tela de login + auth no `app.js` | ✅ Login necessário |
| 5 | Fase 5 | Deploy das regras de segurança | ✅ Proteção ativada |
| 6 | Fase 6 | Limpeza do código IPC/JSON | ✅ Código legado removido |

---

## Verificação

### Após Fase 1
- `npm run dev` inicia o Vite + Electron sem erros
- O app funciona exatamente como antes (ainda usando JSONs locais)
- `import { db, auth } from './firebase.js'` não quebra nada

### Após Fase 2
- Verificar no Firebase Console → Firestore que todas as coleções existem com os documentos corretos
- Verificar no Firebase Console → Authentication que os 6 usuários foram criados

### Após Fase 3
- O app carrega dados do Firestore em vez dos JSONs
- Dashboard, Tarefas e Admin funcionam normalmente
- CRUD de tarefas persiste no Firestore (verificar no console)
- O app funciona offline (desligar internet → os dados já carregados permanecem acessíveis, novas escritas são enfileiradas e sincronizadas ao reconectar)

### Após Fase 4
- Ao abrir o app, aparece a tela de login
- Login com email/senha válidos → acessa o app
- Email/senha inválidos → mensagem de erro
- Botão "Sair" faz logout e volta para a tela de login
- Em modo dev (`--dev`), o user-switcher aparece
- Em produção, o user-switcher fica oculto

### Após Fase 5
- Tentar escrever diretamente no Firestore sem autenticação → bloqueado
- Tentar deletar um tipo de atividade com um usuário não-admin → bloqueado
- Tentar criar uma tarefa com `createdById` diferente do UID autenticado → bloqueado

### Após Fase 6
- `main.js` não tem mais handlers IPC de leitura/escrita
- `preload.js` está vazio ou mínimo
- O app continua funcionando normalmente usando apenas Firestore
