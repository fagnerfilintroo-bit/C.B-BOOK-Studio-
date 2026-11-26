
import { supabase } from "./supabase.js";

import {
  uploadDocument,
  listDocuments,
  openDocument,
  deleteDocument
} from "./documents.js";

const $ = id => document.getElementById(id);

let projects = [];
let documents = [];
let currentUser = null;

const initialProjects = [
  {
    id: "descompolitica",
    name: "Descompolítica",
    type: "Comunicação e conhecimento",
    status: "Planejamento",
    goal: "Construir um canal de comunicação no Instagram e YouTube sobre História, Filosofia e Política.",
    next_action: "Consolidar a identidade visual e preparar a primeira publicação.",
    focus: "História • Filosofia • Política • Sociedade",
    color: "blue",
    stages: [
      ["Identidade e posicionamento", false],
      ["Padrão editorial e visual", false],
      ["Primeiro carrossel", false],
      ["Canal do YouTube", false],
      ["Rotina de publicação", false]
    ]
  },
  {
    id: "cbbook",
    name: "C.B.Book",
    type: "Editora independente",
    status: "Planejamento",
    goal: "Estruturar uma editora independente e preparar sua primeira publicação.",
    next_action: "Definir a primeira obra editorial.",
    focus: "Livros • Quadrinhos • Autores",
    color: "green",
    stages: [
      ["Modelo editorial", false],
      ["Escolha da primeira obra", false],
      ["Preparação editorial", false],
      ["Projeto gráfico e revisão", false],
      ["Publicação", false]
    ]
  },
  {
    id: "mandato",
    name: "Mandato",
    type: "Jogo de simulação política",
    status: "Em recuperação",
    goal: "Recuperar e desenvolver o jogo, preservando os recursos existentes.",
    next_action: "Auditar a versão atual.",
    focus: "Simulação política • Estratégia • Personagens",
    color: "gold",
    stages: [
      ["Inventário da versão atual", false],
      ["Mapeamento de falhas", false],
      ["Correções", false],
      ["Testes", false],
      ["Plano de lançamento", false]
    ]
  },
  {
    id: "aster",
    name: "Universo de Aster",
    type: "Universo ficcional autoral",
    status: "Desenvolvimento",
    goal: "Organizar e desenvolver o universo ficcional, seus personagens e sua mitologia.",
    next_action: "Consolidar os materiais canônicos.",
    focus: "Ficção • Personagens • Mitologia",
    color: "",
    stages: [
      ["Bíblia do universo", false],
      ["Personagens e mitologia", false],
      ["Definição da primeira obra", false],
      ["Preparação para publicação", false]
    ]
  }
];

function message(id, text, error = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.style.color = error ? "#C44D5A" : "#168A65";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function showAuthPanel(panel) {
  $("loginPanel").hidden = panel !== "login";
  $("signupPanel").hidden = panel !== "signup";
  message("loginMessage", "");
  message("signupMessage", "");
}

function showApp(session) {
  const loggedIn = Boolean(session);

  $("loginView").hidden = loggedIn;
  $("appView").hidden = !loggedIn;

  if (!loggedIn) {
    $("userDisplayName").textContent = "";
  }
}

async function loadUserProfile() {
  if (!currentUser) return;

  let name = currentUser.user_metadata?.display_name || "";

  const { data, error } = await supabase
    .from("studio_profiles")
    .select("display_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!error && data?.display_name) {
    name = data.display_name;
  }

  $("userDisplayName").textContent = name || currentUser.email || "Usuário";
}

/*
  Cada conta recebe projetos próprios.
  Se o usuário já tiver projetos, nenhum projeto será recriado.
  Os IDs novos são exclusivos para cada usuário.
*/
async function seedProjects() {
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("studio_projects")
    .select("id")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) return;

  const rows = initialProjects.map(project => ({
    ...project,
    id: `${currentUser.id}-${project.id}`,
    user_id: currentUser.id
  }));

  const { error: insertError } = await supabase
    .from("studio_projects")
    .insert(rows);

  if (insertError) throw insertError;
}

async function loadProjects() {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  projects = data || [];
  renderProjects();
}

function renderCard(project) {
  const stages = Array.isArray(project.stages) ? project.stages : [];
  const done = stages.filter(stage => stage[1]).length;

  const percent = stages.length
    ? Math.round(done / stages.length * 100)
    : 0;

  const id = escapeHTML(project.id);

  return `
    <article class="project">
      <div class="project-top">
        <div>
          <h3>${escapeHTML(project.name)}</h3>
          <small>${escapeHTML(project.type)}</small>
        </div>
        <span class="tag">${escapeHTML(project.status)}</span>
      </div>

      <p>${escapeHTML(project.goal)}</p>

      <div class="progress">
        <span style="width:${percent}%"></span>
      </div>

      <div class="meta">
        <span>${done}/${stages.length} etapas</span>
        <b>${percent}%</b>
      </div>

      <p>
        <b>Próxima ação:</b><br>
        ${escapeHTML(project.next_action)}
      </p>

      <p><small>${escapeHTML(project.focus)}</small></p>

      <button type="button" class="btn outline" data-edit="${id}">
        Gerenciar projeto
      </button>

      <div class="detail" id="detail-${id}">
        <label for="status-${id}">Situação</label>
        <select id="status-${id}">
          ${[
            "Planejamento",
            "Em desenvolvimento",
            "Em recuperação",
            "Em pausa",
            "Concluído"
          ].map(status => `
            <option value="${escapeHTML(status)}"
              ${project.status === status ? "selected" : ""}>
              ${escapeHTML(status)}
            </option>
          `).join("")}
        </select>

        <label for="goal-${id}">Objetivo</label>
        <textarea id="goal-${id}">${escapeHTML(project.goal)}</textarea>

        <label for="next-${id}">Próxima ação</label>
        <textarea id="next-${id}">${escapeHTML(project.next_action)}</textarea>

        <label>Etapas</label>

        ${stages.map((stage, index) => `
          <label class="stage">
            <input
              type="checkbox"
              data-stage="${id}"
              data-index="${index}"
              ${stage[1] ? "checked" : ""}
            >
            ${escapeHTML(stage[0])}
          </label>
        `).join("")}

        <button type="button" class="btn yellow" data-save="${id}">
          Salvar alterações
        </button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const totalDone = projects.reduce(
    (sum, project) =>
      sum + (project.stages || []).filter(stage => stage[1]).length,
    0
  );

  $("projectTotal").textContent = projects.length;

  $("activeTotal").textContent = projects.filter(project =>
    ["Em desenvolvimento", "Em recuperação"].includes(project.status)
  ).length;

  $("doneTotal").textContent = totalDone;

  $("overviewGrid").innerHTML = projects.map(renderCard).join("");
  $("projectGrid").innerHTML = projects.map(renderCard).join("");

  const options = projects.map(project => `
    <option value="${escapeHTML(project.id)}">
      ${escapeHTML(project.name)}
    </option>
  `).join("");

  $("uploadProject").innerHTML = options;

  $("filterProject").innerHTML =
    `<option value="">Todos os projetos</option>${options}`;
}

async function saveProject(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;

  const stages = (project.stages || []).map(stage => [...stage]);

  document.querySelectorAll("[data-stage]").forEach(input => {
    if (input.dataset.stage === id) {
      const index = Number(input.dataset.index);
      if (stages[index]) {
        stages[index][1] = input.checked;
      }
    }
  });

  const updates = {
    status: $(`status-${id}`).value,
    goal: $(`goal-${id}`).value,
    next_action: $(`next-${id}`).value,
    stages,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("studio_projects")
    .update(updates)
    .eq("id", id);

  if (error) throw error;

  await loadProjects();
}

async function loadDocuments() {
  documents = await listDocuments($("filterProject").value);
  renderDocuments();
}

function renderDocuments() {
  $("docTotal").textContent = documents.length;

  $("documentList").innerHTML = documents.length
    ? documents.map(document => `
      <div class="document-item">
        <div>
          <strong>${escapeHTML(document.file_name)}</strong>
          <small>
            ${escapeHTML(document.category)}
            •
            ${new Date(document.created_at).toLocaleDateString("pt-BR")}
          </small>
        </div>

        <div>
          <button
            type="button"
            class="btn outline"
            data-open="${escapeHTML(document.id)}">
            Abrir
          </button>

          <button
            type="button"
            class="btn outline"
            data-delete="${escapeHTML(document.id)}">
            Excluir
          </button>
        </div>
      </div>
    `).join("")
    : "<p>Nenhum documento cadastrado.</p>";
}

async function refresh() {
  await loadProjects();
  await loadDocuments();
}

async function initialize() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const session = data.session;

  if (!session) {
    currentUser = null;
    projects = [];
    documents = [];
    showApp(null);
    return;
  }

  currentUser = session.user;
  showApp(session);

  await loadUserProfile();
  await seedProjects();
  await refresh();
}

/* ALTERNAR ENTRE LOGIN E CADASTRO */

$("showSignupBtn").addEventListener("click", () => {
  showAuthPanel("signup");
});

$("showLoginBtn").addEventListener("click", () => {
  showAuthPanel("login");
});

/* LOGIN */

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("loginBtn");
  button.disabled = true;
  button.textContent = "Entrando...";

  message("loginMessage", "Verificando seus dados...");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    await initialize();
  } catch (error) {
    message("loginMessage", error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

/* CADASTRO */

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirmation = $("signupPasswordConfirm").value;

  if (password.length < 8) {
    message("signupMessage", "A senha precisa ter pelo menos 8 caracteres.", true);
    return;
  }

  if (password !== confirmation) {
    message("signupMessage", "As senhas não são iguais.", true);
    return;
  }

  const button = $("signupBtn");
  button.disabled = true;
  button.textContent = "Criando conta...";

  message("signupMessage", "Criando sua conta...");

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name
        }
      }
    });

    if (error) throw error;

    if (data.session) {
      await initialize();
      return;
    }

    message(
      "signupMessage",
      "Cadastro realizado! Verifique seu e-mail para confirmar a conta. Depois, faça login."
    );

    $("signupForm").reset();
  } catch (error) {
    message("signupMessage", error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Criar minha conta";
  }
});

/* RECUPERAÇÃO DE SENHA */

$("forgotPasswordBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    message("loginMessage", "Digite seu e-mail para receber o link de recuperação.", true);
    $("email").focus();
    return;
  }

  message("loginMessage", "Enviando solicitação...");

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) throw error;

    message(
      "loginMessage",
      "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação."
    );
  } catch (error) {
    message("loginMessage", error.message, true);
  }
});

/* LOGOUT */

$("logoutBtn").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;
  projects = [];
  documents = [];

  $("overviewGrid").innerHTML = "";
  $("projectGrid").innerHTML = "";
  $("documentList").innerHTML = "";

  showApp(null);
  showAuthPanel("login");
});

/* ATUALIZAR */

$("refreshBtn").addEventListener("click", async () => {
  try {
    await refresh();
  } catch (error) {
    alert("Não foi possível atualizar: " + error.message);
  }
});

/* FILTRO DE DOCUMENTOS */

$("filterProject").addEventListener("change", async () => {
  try {
    await loadDocuments();
  } catch (error) {
    alert(error.message);
  }
});

/* ENVIO DE DOCUMENTOS */

$("uploadBtn").addEventListener("click", async () => {
  const file = $("fileInput").files[0];
  const projectId = $("uploadProject").value;
  const category = $("uploadCategory").value;

  if (!file) {
    message("uploadMessage", "Selecione um arquivo.", true);
    return;
  }

  if (!projectId) {
    message("uploadMessage", "Selecione um projeto.", true);
    return;
  }

  const button = $("uploadBtn");
  button.disabled = true;

  message("uploadMessage", "Enviando arquivo...");

  try {
    await uploadDocument(file, projectId, category);

    $("fileInput").value = "";

    message("uploadMessage", "Documento enviado com sucesso!");

    await loadDocuments();
  } catch (error) {
    message("uploadMessage", error.message, true);
  } finally {
    button.disabled = false;
  }
});

/* AÇÕES DOS PROJETOS E DOCUMENTOS */

document.addEventListener("click", async event => {
  const edit = event.target.closest("[data-edit]");
  const save = event.target.closest("[data-save]");
  const open = event.target.closest("[data-open]");
  const remove = event.target.closest("[data-delete]");

  if (edit) {
    const detail = $(`detail-${edit.dataset.edit}`);
    if (detail) detail.classList.toggle("open");
  }

  if (save) {
    try {
      await saveProject(save.dataset.save);
      alert("Projeto atualizado!");
    } catch (error) {
      alert("Erro ao salvar projeto: " + error.message);
    }
  }

  if (open) {
    const document = documents.find(
      item => item.id === open.dataset.open
    );

    if (document) {
      try {
        await openDocument(document.storage_path);
      } catch (error) {
        alert("Erro ao abrir documento: " + error.message);
      }
    }
  }

  if (remove) {
    const document = documents.find(
      item => item.id === remove.dataset.delete
    );

    if (document && confirm("Deseja excluir este documento?")) {
      try {
        await deleteDocument(document);
        await loadDocuments();
      } catch (error) {
        alert("Erro ao excluir documento: " + error.message);
      }
    }
  }
});

/* NAVEGAÇÃO */

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    const sectionId = button.dataset.section;

    document.querySelectorAll("[data-section]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".app-section").forEach(section => {
      section.hidden = section.id !== sectionId;
      section.classList.toggle("active", section.id === sectionId);
    });
  });
});

/* ESTADO INICIAL */

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    projects = [];
    documents = [];
    showApp(null);
  }
});

initialize().catch(error => {
  console.error("Erro ao iniciar o C.B.Book Studio:", error);
  alert("Não foi possível carregar o Studio: " + error.message);
});
