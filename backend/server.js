// CAMADA HTTP: rotas, CORS, JSON e status. Não tem regra de negócio nem SQL.
const http = require('node:http');
const users = require('./users');

const { HttpError } = users;
const PORT = process.env.PORT || 3000;

// CORS: permite que o frontend (outra origem) chame a API sem bloqueio do navegador.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  const headers = { ...CORS_HEADERS };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    payload = JSON.stringify(body);
  }
  res.writeHead(status, headers);
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new HttpError(400, 'JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    // Preflight: o navegador pergunta "posso?" antes de POST/PUT/DELETE.
    if (req.method === 'OPTIONS') return send(res, 204);

    // Casa /users e /users/123 (id só com dígitos).
    const { pathname } = new URL(req.url, 'http://localhost');
    const match = pathname.match(/^\/users(?:\/(\d+))?\/?$/);
    if (!match) throw new HttpError(404, 'Rota não encontrada.');

    const id = match[1] ? Number(match[1]) : null;
    const { method } = req;

    if (!id && method === 'GET') return send(res, 200, users.list());
    if (!id && method === 'POST') return send(res, 201, users.create(await readJson(req)));
    if (id && method === 'GET') return send(res, 200, users.get(id));
    if (id && (method === 'PUT' || method === 'PATCH')) {
      return send(res, 200, users.update(id, await readJson(req)));
    }
    if (id && method === 'DELETE') {
      users.remove(id);
      return send(res, 204);
    }

    throw new HttpError(405, 'Método não permitido.');
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Erro interno do servidor.' });
  }
});

server.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));