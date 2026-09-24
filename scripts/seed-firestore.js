/**
 * Script de migração — popula o Firestore com os dados dos JSONs locais
 * e cria as contas de autenticação no Firebase Auth.
 *
 * Execução (uma vez só):
 *   1. Gere uma Service Account Key no Firebase Console:
 *      Configurações → Contas de serviço → Gerar nova chave privada
 *   2. Salve o JSON como  scripts/serviceAccountKey.json  (está no .gitignore)
 *   3. Ajuste os emails e senhas em USER_CREDENTIALS abaixo
 *   4. Rode:  node scripts/seed-firestore.js
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth }      = require('firebase-admin/auth');
const fs    = require('fs');
const path  = require('path');

// ── Service account ───────────────────────────────────────
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.cert(serviceAccount) });
const db   = getFirestore();
const auth = getAuth();

// ── Diretório de dados ────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));

// ── Credenciais dos usuários (ajustar antes de rodar) ─────
const USER_CREDENTIALS = {
  u1: { email: 'felipemoraisoc@gmail.com',     password: 'Artrock@2026!' },
  u2: { email: 'alinemorais79.li@gmail.com',  password: 'Artrock@2026!' },
  u3: { email: 'felipe@artrock.com',       password: 'Artrock@2026!' },
};

// ── Helpers ───────────────────────────────────────────────

function replaceUserId(value, uidMap) {
  if (!value) return value;
  return uidMap[value] ?? value;
}

async function batchWrite(collectionName, docs) {
  // Firestore limita batches a 500 operações
  const chunks = [];
  for (let i = 0; i < docs.length; i += 450) {
    chunks.push(docs.slice(i, i + 450));
  }
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const { id, ...data } of chunk) {
      batch.set(db.collection(collectionName).doc(id), data);
    }
    await batch.commit();
  }
  console.log(`  ✓ ${collectionName}: ${docs.length} documento(s)`);
}

// ── Migração principal ────────────────────────────────────

async function migrate() {
  console.log('═══ Migração ArtRock → Firestore ═══\n');

  // 1. Criar contas no Firebase Auth e mapear IDs
  console.log('1. Criando contas no Firebase Auth...');
  const uidMap = {};
  const users = readJSON('users.json');

  for (const user of users) {
    const creds = USER_CREDENTIALS[user.id];
    if (!creds) {
      console.warn(`   ⚠ Sem credenciais para ${user.id} (${user.name}) — pulando Auth`);
      uidMap[user.id] = user.id; // mantém o ID original
      continue;
    }

    try {
      const authUser = await auth.createUser({
        email:       creds.email,
        password:    creds.password,
        displayName: user.name,
      });
      uidMap[user.id] = authUser.uid;
      console.log(`   ✓ ${user.name} → ${authUser.uid} (${creds.email})`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        // Conta já existe — buscar o UID
        const existing = await auth.getUserByEmail(creds.email);
        uidMap[user.id] = existing.uid;
        console.log(`   ≈ ${user.name} já existe → ${existing.uid}`);
      } else {
        throw err;
      }
    }
  }

  // 2. Migrar usuários (doc ID = UID do Auth)
  console.log('\n2. Migrando coleções...');
  const userDocs = users.map(u => ({
    id:        uidMap[u.id],
    name:      u.name,
    role:      u.role,
    initials:  u.initials,
    sectorIds: u.sectorIds,
    legacyId:  u.id,
  }));
  await batchWrite('users', userDocs);

  // 3. Setores
  const sectors = readJSON('sectors.json');
  await batchWrite('sectors', sectors);

  // 4. Tipos de atividade
  const activityTypes = readJSON('activity_types.json');
  await batchWrite('activityTypes', activityTypes);

  // 5. Categorias
  const categories = readJSON('categories.json');
  await batchWrite('categories', categories);

  // 6. Tarefas (converter referências de usuário)
  const tasks = readJSON('tasks.json');
  const taskDocs = tasks.map(t => ({
    ...t,
    createdById: replaceUserId(t.createdById, uidMap),
    requesterId: replaceUserId(t.requesterId, uidMap),
    comments:    (t.comments ?? []).map(c => ({
      ...c,
      userId: replaceUserId(c.userId, uidMap),
    })),
  }));
  await batchWrite('tasks', taskDocs);

  // Resultado
  console.log('\n═══ Migração concluída! ═══');
  console.log('\nMapa de IDs (legacyId → Firebase UID):');
  for (const [legacy, uid] of Object.entries(uidMap)) {
    const u = users.find(x => x.id === legacy);
    console.log(`  ${legacy} (${u?.name ?? '?'}) → ${uid}`);
  }

  console.log('\n⚠  Lembre-se de atualizar o firebaseConfig em renderer/js/firebase.js');
  console.log('   com os valores do seu projeto Firebase.');
}

migrate().catch(err => {
  console.error('\n✕ Erro na migração:', err);
  process.exit(1);
});
