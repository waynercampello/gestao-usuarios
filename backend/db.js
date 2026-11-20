// CAMADA DE DADOS: só SQL. Não conhece HTTP nem regras de negócio.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(path.join(__dirname, 'data.db'));

// UNIQUE em email e login: o próprio banco garante a unicidade,
// mesmo se duas requisições chegarem ao mesmo tempo.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    login         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1
  )
`);

// password_hash nunca é selecionado: o que não sai do banco não vaza na API.
const COLUMNS = 'id, name, email, login, active';

// SQLite não tem booleano; converte 0/1 para false/true.
const toUser = (row) => (row ? { ...row, active: row.active === 1 } : undefined);

function findAll() {
  return db.prepare(`SELECT ${COLUMNS} FROM users ORDER BY id`).all().map(toUser);
}

function findById(id) {
  return toUser(db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id));
}

function insert({ name, email, login, passwordHash, active }) {
  const result = db
    .prepare('INSERT INTO users (name, email, login, password_hash, active) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, login, passwordHash, active ? 1 : 0);
  return findById(result.lastInsertRowid);
}

// passwordHash é opcional: com null, COALESCE mantém o hash que já existe.
function update(id, { name, email, login, passwordHash, active }) {
  db.prepare(
    `UPDATE users
        SET name = ?, email = ?, login = ?, active = ?,
            password_hash = COALESCE(?, password_hash)
      WHERE id = ?`
  ).run(name, email, login, active ? 1 : 0, passwordHash ?? null, id);
  return findById(id);
}

// Exclusão física. Retorna true se algum registro foi removido.
function remove(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}

module.exports = { findAll, findById, insert, update, remove };