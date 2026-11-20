// O frontend só conversa com a API REST; nunca toca no banco.
const API = 'http://localhost:3000/users';

const $ = (id) => document.getElementById(id);

// ---------- Comunicação com a API ----------

// Único ponto que chama fetch: concentra loading, leitura do JSON e tratamento de erro.
async function request(url, options = {}) {
  setLoading(true);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(data?.error || 'Erro inesperado.');
    return data;
  } catch (err) {
    // fetch só lança TypeError quando nem chegou na API (offline, servidor desligado).
    if (err instanceof TypeError) {
      throw new Error('Não foi possível conectar à API. Ela está rodando?');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// ---------- Feedback visual ----------

function setLoading(on) {
  $('loading').hidden = !on;
  document.querySelectorAll('button').forEach((b) => (b.disabled = on));
}

let messageTimer;
function notify(text, type) {
  clearTimeout(messageTimer);
  const box = $('message');
  box.textContent = text;
  box.className = `message ${type}`; // "ok" ou "error"
  box.hidden = false;
  messageTimer = setTimeout(() => (box.hidden = true), 4000);
}

// ---------- Lista ----------

function cell(content) {
  const td = document.createElement('td');
  td.append(content);
  return td;
}

function button(label, onClick, className = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

// Tabela com textContent/append (nunca innerHTML) para não abrir brecha de XSS.
function render(users) {
  const tbody = $('tbody');
  tbody.replaceChildren();

  if (users.length === 0) {
    const td = cell('Nenhum usuário cadastrado.');
    td.colSpan = 6;
    const tr = document.createElement('tr');
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const user of users) {
    const actions = cell('');
    actions.className = 'row-actions';
    actions.append(
      button('Editar', () => startEdit(user)),
      button('Excluir', () => removeUser(user), 'danger')
    );

    const tr = document.createElement('tr');
    tr.append(
      cell(String(user.id)),
      cell(user.name),
      cell(user.email),
      cell(user.login),
      cell(user.active ? 'Ativo' : 'Inativo'),
      actions
    );
    tbody.append(tr);
  }
}

async function loadUsers() {
  try {
    render(await request(API));
  } catch (err) {
    notify(err.message, 'error');
  }
}

// ---------- Formulário (cadastrar e editar usam o mesmo) ----------

function resetForm() {
  $('form').reset();
  $('id').value = '';
  $('active').checked = true;
  $('password').placeholder = '';
  $('form-title').textContent = 'Novo usuário';
  $('cancel').hidden = true;
}

function startEdit(user) {
  $('id').value = user.id;
  $('name').value = user.name;
  $('email').value = user.email;
  $('login').value = user.login;
  $('password').value = '';
  $('password').placeholder = 'Deixe em branco para manter a atual';
  $('active').checked = user.active;
  $('form-title').textContent = `Editar usuário #${user.id}`;
  $('cancel').hidden = false;
  $('name').focus();
}

$('cancel').addEventListener('click', resetForm);

$('form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const id = $('id').value; // vazio = cadastro novo; preenchido = edição
  const body = {
    name: $('name').value,
    email: $('email').value,
    login: $('login').value,
    active: $('active').checked,
  };
  
  // Na edição, só envia a senha se a pessoa digitou uma nova, caso não digite será mantida a senha atual
  if (!id || $('password').value) body.password = $('password').value;

  try {
    await request(id ? `${API}/${id}` : API, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    notify(id ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!', 'ok');
    resetForm();
    await loadUsers();
  } catch (err) {
    notify(err.message, 'error');
  }
});

// ---------- Exclusão ----------

async function removeUser(user) {
  if (!confirm(`Excluir o usuário "${user.name}"?`)) return;

  try {
    await request(`${API}/${user.id}`, { method: 'DELETE' });
    if ($('id').value === String(user.id)) resetForm(); // estava editando o excluído
    notify('Usuário excluído com sucesso!', 'ok');
    await loadUsers();
  } catch (err) {
    notify(err.message, 'error');
  }
}

loadUsers();