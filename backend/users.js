// CAMADA DE NEGÓCIO: validações, hash de senha e regras. Não conhece HTTP nem SQL.
const crypto = require('node:crypto');
const db = require('./db');

// Erro com status HTTP embutido; o server.js o converte em resposta.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// scrypt: algoritmo de hash de senhas (lento e com uso intenso de memória de propósito),
// já embutido no Node. Cada senha ganha um "salt" aleatório, então senhas iguais
// geram hashes diferentes. Formato guardado: "salt:hash" em hexadecimal.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Valida o JSON recebido e devolve os dados já limpos (sem espaços nas pontas).
// Na edição a senha é opcional: se não vier, a atual é mantida.
function parse(body, { passwordRequired }) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'O corpo da requisição deve ser um objeto JSON.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const login = typeof body.login === 'string' ? body.login.trim() : '';
  const { password, active } = body;

  if (name.length < 3) {
    throw new HttpError(400, 'O nome é obrigatório e deve ter no mínimo 3 caracteres.');
  }
  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, 'O e-mail é obrigatório e deve ter um formato válido.');
  }
  if (login.length < 3) {
    throw new HttpError(400, 'O login é obrigatório e deve ter no mínimo 3 caracteres.');
  }
  if ((passwordRequired || password !== undefined) &&
      (typeof password !== 'string' || password.length < 8)) {
    throw new HttpError(400, 'A senha é obrigatória e deve ter no mínimo 8 caracteres.');
  }
  if (active !== undefined && typeof active !== 'boolean') {
    throw new HttpError(400, 'O campo active deve ser true ou false.');
  }

  return { name, email, login, password, active };
}

// Traduz o erro técnico do banco (UNIQUE) em mensagem para a pessoa usuária.
function explain(err) {
  if (/UNIQUE.*users\.email/.test(err.message)) {
    return new HttpError(400, 'Este e-mail já está cadastrado.');
  }
  if (/UNIQUE.*users\.login/.test(err.message)) {
    return new HttpError(400, 'Este login já está em uso.');
  }
  return err;
}

function list() {
  return db.findAll();
}

function get(id) {
  const user = db.findById(id);
  if (!user) throw new HttpError(404, 'Usuário não encontrado.');
  return user;
}

function create(body) {
  const data = parse(body, { passwordRequired: true });
  try {
    return db.insert({
      name: data.name,
      email: data.email,
      login: data.login,
      passwordHash: hashPassword(data.password),
      active: data.active ?? true, // regra: ativo por padrão
    });
  } catch (err) {
    throw explain(err);
  }
}

function update(id, body) {
  const current = get(id); // lança 404 se não existir
  const data = parse(body, { passwordRequired: false });
  try {
    return db.update(id, {
      name: data.name,
      email: data.email,
      login: data.login,
      passwordHash: data.password === undefined ? undefined : hashPassword(data.password),
      active: data.active ?? current.active, // se não vier, mantém o status atual
    });
  } catch (err) {
    throw explain(err);
  }
}

function remove(id) {
  if (!db.remove(id)) throw new HttpError(404, 'Usuário não encontrado.');
}

module.exports = { list, get, create, update, remove, HttpError };