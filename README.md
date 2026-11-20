# Gestão de Usuários

Aplicação full-stack com CRUD de usuários, desenvolvida para o desafio técnico.

## Tecnologias

| Camada | Escolha | Por quê |

| Frontend | HTML + CSS + JavaScript puro (Vanilla JS) | Sem build nem dependências; o fluxo clique → requisição → resposta fica visível no código. |

| Backend | Node.js (módulo `http` nativo) | Mesma linguagem do frontend e nenhuma dependência para instalar. |

| Banco | SQLite (módulo `node:sqlite`, nativo do Node) | Banco real em um único arquivo, com restrições `UNIQUE`, sem precisar de servidor. |

| Senha | `scrypt` (módulo `crypto`, nativo do Node) | Algoritmo de hash de senhas com salt aleatório por usuário. |

## Estrutura

```
backend/
  server.js   Camada HTTP: rotas, CORS, JSON e status HTTP
  users.js    Camada de negócio: validações, hash de senha, regras
  db.js       Camada de dados: todo o SQL fica aqui
frontend/
  index.html  Estrutura da página (HTML)
  stylo.css  Aparência da página (CSS)
  app.js      Lógica da tela: chamadas à API, formulário, feedback
```

Fluxo de uma requisição: `app.js` → `server.js` (rota) → `users.js` (regras) → `db.js` (SQL) → SQLite, e a resposta faz o caminho inverso. O frontend nunca acessa o banco diretamente.

## Como executar

**Requisito:** Node.js **22.13 ou superior** (`node --version`). Nenhum `npm install` é necessário.

### 1. Backend

```bash
npm start
```

A API sobe em `http://localhost:3000`. O arquivo do banco (`backend/data.db`) é criado automaticamente na primeira execução. Para usar outra porta: `PORT=4000 npm start` (e ajuste a constante `API` no início de `frontend/app.js`).

### 2. Frontend

Com o backend rodando, abra o arquivo `frontend/index.html` no navegador (duplo clique).

## Testando a API com cURL

```bash
# Criar (201) — "active" é opcional e, se omitido, vale true
curl -i -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Silva","email":"ana@teste.com","login":"ana","password":"senha1234"}'

# Listar (200)
curl -i http://localhost:3000/users

# Buscar por id (200, ou 404 se não existir)
curl -i http://localhost:3000/users/1

# Atualizar (200) — "password" é opcional na edição
curl -i -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Maria","email":"ana@teste.com","login":"ana","active":false}'

# Excluir (204)
curl -i -X DELETE http://localhost:3000/users/1
```

Resposta de exemplo (a senha e o hash nunca são retornados):

```json
{ "id": 1, "name": "Ana Silva", "email": "ana@teste.com", "login": "ana", "active": true }
```

Erro de validação (400):

```json
{ "error": "A senha é obrigatória e deve ter no mínimo 8 caracteres." }
```

## Regras implementadas

- **ID**: inteiro autoincremento gerado pelo banco.
- **name**: obrigatório, mínimo de 3 caracteres após remover espaços das pontas.
- **email**: obrigatório, formato válido, único (comparado em minúsculas).
- **login**: obrigatório, mínimo de 3 caracteres, único.
- **password**: obrigatória no cadastro, mínimo de 8 caracteres, armazenada como hash `scrypt` com salt. Na edição é opcional: se omitida, a senha atual é mantida.
- **active**: booleano, `true` por padrão.
- **Payload inválido ou duplicado**: `400 Bad Request` com `{ "error": "..." }`.
- **Exclusão**: física (o registro é removido).

## Decisões de projeto

- **Três camadas no backend** (HTTP, negócio, dados): cada arquivo tem uma responsabilidade, e trocar o banco afeta só o `db.js`.
- **Unicidade garantida pelo banco** (`UNIQUE`), não por uma consulta prévia: evita a condição de corrida em que duas requisições simultâneas passariam na checagem.
- **`password_hash` nunca é selecionado** nas consultas, então não há como vazar na resposta.
- **Exclusão física:** optei por apagar o registro de verdade porque é o mais simples e libera o e-mail e o login para serem reutilizados. A desvantagem é que o histórico se perde; em um sistema real com auditoria, eu usaria exclusão lógica (marcando o registro como excluído, sem apagá-lo).
- **Validação só na API**: o formulário usa `novalidate` e exibe a mensagem devolvida pelo servidor, porque a validação do frontend pode ser contornada e a regra de negócio deve existir em um lugar só. Como melhoria, o HTML também poderia validar (`required`, `minlength`) para dar retorno mais rápido.
- **Frontend sem `innerHTML`**: a tabela é montada com `textContent`, o que impede injeção de HTML (XSS) por nomes maliciosos.