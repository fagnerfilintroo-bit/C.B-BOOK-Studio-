
import {
  uploadDocument,
  listDocuments,
  openDocument,
  deleteDocument
} from "./documents.js";

/* =========================================================
   C.B.BOOK STUDIO — VERSÃO LOCAL
========================================================= */

const STORAGE_KEY = "cbbook_studio_local_v2";
const SESSION_KEY = "cbbook_studio_session_v2";
const THEME_KEY = "cbbook_studio_theme_v1";

const $ = (id) => document.getElementById(id);

let state = {
  initialized: false,
  users: [],
  projects: [],
  activity: []
};

let currentUser = null;
let activeProjectId = null;
let activeWorkspaceTab = "summary";
let documents = [];
let toastTimer = null;

/* =========================================================
   APARÊNCIA — TEMA CLARO E ESCURO
========================================================= */

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = selectedTheme;

  try {
    localStorage.setItem(THEME_KEY, selectedTheme);
  } catch (error) {
    console.warn("Não foi possível salvar a aparência:", error);
  }

  const icon = $("themeIcon");
  const label = $("themeLabel");
  const button = $("themeToggle");

  if (icon) {
    icon.textContent = selectedTheme === "dark" ? "☀" : "☾";
  }

  if (label) {
    label.textContent = selectedTheme === "dark" ? "Tema claro" : "Tema escuro";
  }

  if (button) {
    button.setAttribute(
      "aria-label",
      selectedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
    );

    button.setAttribute(
      "aria-pressed",
      selectedTheme === "light" ? "true" : "false"
    );
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (metaTheme) {
    metaTheme.setAttribute(
      "content",
      selectedTheme === "dark" ? "#08152F" : "#F3F6FC"
    );
  }
}

function toggleTheme() {
  const currentTheme = document.body.dataset.theme || "dark";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

/* =========================================================
   PROJETOS INICIAIS
========================================================= */

const initialProjects = [
  {
    name: "Descompolítica",
    type: "Comunicação e conhecimento",
    status: "Planejamento",
    goal: "Construir um canal de comunicação no Instagram e YouTube sobre História, Filosofia e Política.",
    next_action: "Consolidar a identidade visual e preparar a primeira publicação.",
    focus: "História • Filosofia • Política • Sociedade",
    color: "blue",
    stages: [
      "Identidade e posicionamento",
      "Padrão editorial e visual",
      "Primeiro carrossel",
      "Canal do YouTube",
      "Rotina de publicação"
    ]
  },
  {
    name: "C.B.Book",
    type: "Editora independente",
    status: "Planejamento",
    goal: "Estruturar uma editora independente e preparar sua primeira publicação.",
    next_action: "Definir a primeira obra editorial.",
    focus: "Livros • Quadrinhos • Autores",
    color: "green",
    stages: [
      "Modelo editorial",
      "Escolha da primeira obra",
      "Preparação editorial",
      "Projeto gráfico e revisão",
      "Publicação"
    ]
  },
  {
    name: "Mandato",
    type: "Jogo de simulação política",
    status: "Em recuperação",
    goal: "Recuperar e desenvolver o jogo, preservando os recursos existentes.",
    next_action: "Auditar a versão atual.",
    focus: "Simulação política • Estratégia • Personagens",
    color: "gold",
    stages: [
      "Inventário da versão atual",
      "Mapeamento de falhas",
      "Correções",
      "Testes",
      "Plano de lançamento"
    ]
  },
  {
    name: "Universo de Aster",
    type: "Universo ficcional autoral",
    status: "Desenvolvimento",
    goal: "Organizar e desenvolver o universo ficcional, seus personagens e sua mitologia.",
    next_action: "Consolidar os materiais canônicos.",
    focus: "Ficção • Personagens • Mitologia",
    color: "blue",
    stages: [
      "Bíblia do universo",
      "Personagens e mitologia",
      "Definição da primeira obra",
      "Preparação para publicação"
    ]
  }
];

/* =========================================================
   UTILITÁRIOS
========================================================= */

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(value + (String(value).length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "Agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function makeProject(data) {
  const now = new Date().toISOString();

  return {
    id: uid(),
    name: data.name || "Novo projeto",
    type: data.type || "Projeto pessoal",
    status: data.status || "Planejamento",
    goal: data.goal || "",
    next_action: data.next_action || "",
    focus: data.focus || "",
    color: data.color || "blue",
    created_at: now,
    updated_at: now,
    stages: (data.stages || []).map((stage) => ({
      id: uid(),
      title: typeof stage === "string" ? stage : stage.title,
      done: typeof stage === "object" ? Boolean(stage.done) : false
    })),
    tasks: [],
    notes: [],
    events: [],
    history: []
  };
}

function normalizeProject(project) {
  project.id ||= uid();
  project.name ||= "Projeto sem nome";
  project.type ||= "Projeto pessoal";
  project.status ||= "Planejamento";
  project.goal ||= "";
  project.next_action ||= "";
  project.focus ||= "";
  project.color ||= "blue";
  project.created_at ||= new Date().toISOString();
  project.updated_at ||= project.created_at;

  project.stages = Array.isArray(project.stages)
    ? project.stages.map((stage) => {
        if (typeof stage === "string") {
          return { id: uid(), title: stage, done: false };
        }
        return {
          id: stage.id || uid(),
          title: stage.title || "Etapa",
          done: Boolean(stage.done)
        };
      })
    : [];

  project.tasks = Array.isArray(project.tasks) ? project.tasks : [];
  project.notes = Array.isArray(project.notes) ? project.notes : [];
  project.events = Array.isArray(project.events) ? project.events : [];
  project.history = Array.isArray(project.history) ? project.history : [];

  return project;
}

/* =========================================================
   ARMAZENAMENTO LOCAL
========================================================= */

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);
      state = {
        initialized: Boolean(parsed.initialized),
        users: Array.isArray(parsed.users) ? parsed.users : [],
        projects: Array.isArray(parsed.projects)
          ? parsed.projects.map(normalizeProject)
          : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    }
  } catch (error) {
    console.error("Erro ao carregar os dados locais:", error);
  }

  if (!state.initialized) {
    state.projects = initialProjects.map(makeProject);
    state.initialized = true;
    state.activity = [{
      id: uid(),
      title: "C.B.Book Studio iniciado",
      description: "Seu espaço de organização está pronto.",
      date: new Date().toISOString()
    }];
    saveState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Não foi possível salvar os dados:", error);
    showToast("Não foi possível salvar. Verifique o espaço do navegador.", "error");
  }
}

function saveSession(user) {
  currentUser = user;

  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

/* =========================================================
   MENSAGENS
========================================================= */

function showToast(message, type = "success") {
  let container = $("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  container.innerHTML = `<div class="toast ${type}">${escapeHTML(message)}</div>`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    container.innerHTML = "";
  }, 3500);
}

function setMessage(id, message, type = "error") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`;
}

function clearMessage(id) {
  const element = $(id);
  if (!element) return;

  element.textContent = "";
  element.className = "message";
}

/* =========================================================
   CORREÇÃO DA EXIBIÇÃO DO LOGIN E CADASTRO
========================================================= */

function showAuthPanel(panel) {
  const login = $("loginPanel");
  const signup = $("signupPanel");

  if (login) {
    login.hidden = panel !== "login";
    login.classList.toggle("hidden", panel !== "login");
  }

  if (signup) {
    signup.hidden = panel !== "signup";
    signup.classList.toggle("hidden", panel !== "signup");
  }
}

function showApp() {
  const loginView = $("loginView");
  const appView = $("appView");

  if (loginView) {
    loginView.hidden = true;
    loginView.classList.add("hidden");
  }

  if (appView) {
    appView.hidden = false;
    appView.classList.remove("hidden");
  }

  const name = currentUser?.name || "Leitor";

  if ($("sidebarUserName")) {
    $("sidebarUserName").textContent = name;
  }

  if ($("userDisplayName")) {
    $("userDisplayName").textContent = name;
  }

  if ($("userAvatar")) {
    $("userAvatar").textContent = name.trim().charAt(0).toUpperCase() || "C";
  }

  renderAll();
  switchSection("overviewSection");
}

function showLogin() {
  const loginView = $("loginView");
  const appView = $("appView");

  if (appView) {
    appView.hidden = true;
    appView.classList.add("hidden");
  }

  if (loginView) {
    loginView.hidden = false;
    loginView.classList.remove("hidden");
  }

  showAuthPanel("login");
}

/* =========================================================
   CADASTRO E ACESSO DEMONSTRATIVOS
========================================================= */

function handleSignup(event) {
  event.preventDefault();

  const name = $("signupName")?.value.trim();
  const email = $("signupEmail")?.value.trim().toLowerCase();
  const password = $("signupPassword")?.value || "";
  const confirmation = $("signupPasswordConfirm")?.value || "";

  clearMessage("signupMessage");

  if (!name || !email || !password || !confirmation) {
    return setMessage("signupMessage", "Preencha todos os campos.");
  }

  if (password.length < 6) {
    return setMessage("signupMessage", "Use uma senha com pelo menos 6 caracteres.");
  }

  if (password !== confirmation) {
    return setMessage("signupMessage", "As senhas não são iguais.");
  }

  if (state.users.some((user) => user.email === email)) {
    return setMessage("signupMessage", "Já existe um acesso de teste com esse e-mail.");
  }

  // A senha não é armazenada nesta versão local.
  const user = { id: uid(), name, email };

  state.users.push(user);
  saveState();
  saveSession(user);

  showToast("Acesso de teste criado.");
  showApp();
}

function handleLogin(event) {
  event.preventDefault();

  const email = $("email")?.value.trim().toLowerCase();
  const password = $("password")?.value || "";

  clearMessage("loginMessage");

  if (!email || !password) {
    return setMessage("loginMessage", "Informe seu e-mail e senha.");
  }

  const user = state.users.find((item) => item.email === email);

  if (!user) {
    return setMessage("loginMessage", "Acesso não encontrado. Crie um acesso de teste primeiro.");
  }

  // A senha é apenas exigida no formulário.
  // Esta versão não oferece autenticação segura.
  saveSession(user);
  showApp();
}

function logout() {
  saveSession(null);
  showLogin();
  showToast("Você saiu do Studio.");
}

/* =========================================================
   NAVEGAÇÃO
========================================================= */

function switchSection(sectionId) {
  document.querySelectorAll(".app-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  const labels = {
    overviewSection: "Visão geral",
    projectsSection: "Projetos",
    documentsSection: "Documentos",
    workspaceSection: "Área de trabalho"
  };

  const breadcrumb = $("pageBreadcrumb");

  if (breadcrumb) {
    breadcrumb.textContent = labels[sectionId] || "C.B.Book Studio";
  }

  $("sidebar")?.classList.remove("open");
}

function openWorkspace(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  activeProjectId = projectId;
  activeWorkspaceTab = "summary";

  switchSection("workspaceSection");
  renderWorkspace();
}

function currentProject() {
  return state.projects.find((project) => project.id === activeProjectId);
}

/* =========================================================
   HISTÓRICO
========================================================= */

function recordHistory(project, title, description = "") {
  const entry = {
    id: uid(),
    title,
    description,
    date: new Date().toISOString()
  };

  if (project) {
    project.history.unshift(entry);
    project.updated_at = entry.date;
  }

  state.activity.unshift({
    id: uid(),
    title,
    description: project
      ? `${project.name} — ${description}`
      : description,
    date: entry.date
  });

  state.activity = state.activity.slice(0, 40);
  saveState();
}

/* =========================================================
   PROJETOS
========================================================= */

function projectProgress(project) {
  const stages = project.stages || [];
  const tasks = project.tasks || [];
  const total = stages.length + tasks.length;

  if (!total) return 0;

  const completed =
    stages.filter((item) => item.done).length +
    tasks.filter((item) => item.done).length;

  return Math.round((completed / total) * 100);
}

function renderProjectCard(project) {
  const progress = projectProgress(project);

  return `
    <article class="project-card color-${escapeHTML(project.color)}">
      <div class="project-top">
        <div>
          <span class="tag">${escapeHTML(project.status)}</span>
          <h3>${escapeHTML(project.name)}</h3>
          <p class="project-type">${escapeHTML(project.type)}</p>
        </div>
        <span class="project-symbol">${escapeHTML(project.name.charAt(0).toUpperCase())}</span>
      </div>

      <p class="project-description">${escapeHTML(project.goal || "Adicione o objetivo deste projeto.")}</p>

      <div class="project-next">
        <strong>Próxima ação</strong>
        <p>${escapeHTML(project.next_action || "Defina a próxima ação.")}</p>
      </div>

      <div class="progress-info">
        <span>Progresso</span>
        <strong>${progress}%</strong>
      </div>

      <div class="progress">
        <span style="width:${progress}%"></span>
      </div>

      <div class="project-focus">${escapeHTML(project.focus)}</div>

      <div class="project-actions">
        <button class="btn primary" data-action="open-project" data-id="${project.id}">
          Abrir projeto
        </button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const grid = $("projectGrid");
  if (!grid) return;

  if (!state.projects.length) {
    grid.innerHTML = `<div class="empty-state">Nenhum projeto cadastrado. Crie seu primeiro projeto.</div>`;
    return;
  }

  grid.innerHTML = state.projects.map(renderProjectCard).join("");
}

function renderSidebarProjects() {
  const container = $("sidebarProjects");
  if (!container) return;

  container.innerHTML = state.projects.map((project) => `
    <button class="sidebar-project" data-action="open-project" data-id="${project.id}">
      <span class="sidebar-project-dot ${escapeHTML(project.color)}"></span>
      <span>${escapeHTML(project.name)}</span>
    </button>
  `).join("");
}

function renderStats() {
  const total = state.projects.length;

  const active = state.projects.filter((project) =>
    !["Concluído", "Concluido", "Arquivado"].includes(project.status)
  ).length;

  const done = state.projects.filter((project) =>
    ["Concluído", "Concluido"].includes(project.status)
  ).length;

  if ($("projectTotal")) $("projectTotal").textContent = total;
  if ($("activeTotal")) $("activeTotal").textContent = active;
  if ($("doneTotal")) $("doneTotal").textContent = done;
  if ($("docTotal")) $("docTotal").textContent = documents.length;
}

function renderOverview() {
  const grid = $("overviewGrid");

  if (grid) {
    grid.innerHTML = state.projects.slice(0, 4).map(renderProjectCard).join("");
  }

  const activity = $("recentActivity");

  if (activity) {
    if (!state.activity.length) {
      activity.innerHTML = `<p class="empty-state">As atividades recentes aparecerão aqui.</p>`;
    } else {
      activity.innerHTML = state.activity.slice(0, 7).map((item) => `
        <div class="activity-item">
          <div class="activity-marker"></div>
          <div>
            <strong>${escapeHTML(item.title)}</strong>
            <p>${escapeHTML(item.description || "")}</p>
            <small>${formatDateTime(item.date)}</small>
          </div>
        </div>
      `).join("");
    }
  }
}

function renderAll() {
  renderStats();
  renderProjects();
  renderSidebarProjects();
  renderOverview();
  renderProjectSelectors();
  refreshDocuments();
}

/* =========================================================
   CRIAR PROJETO
========================================================= */

function handleProjectCreate(event) {
  event.preventDefault();

  const name = $("projectName")?.value.trim();
  const type = $("projectType")?.value || "Projeto pessoal";
  const status = $("projectStatus")?.value || "Planejamento";
  const color = $("projectColor")?.value || "blue";
  const goal = $("projectGoal")?.value.trim() || "";
  const next_action = $("projectNextAction")?.value.trim() || "";

  clearMessage("projectMessage");

  if (!name) {
    return setMessage("projectMessage", "Informe o nome do projeto.");
  }

  const project = makeProject({
    name,
    type,
    status,
    color,
    goal,
    next_action,
    stages: []
  });

  state.projects.unshift(project);

  recordHistory(project, "Projeto criado", "Projeto adicionado ao Studio.");

  $("projectForm")?.reset();
  $("projectCreatePanel")?.classList.add("hidden");

  renderAll();
  openWorkspace(project.id);
  showToast("Projeto criado com sucesso.");
}

function toggleProjectCreate(show) {
  const panel = $("projectCreatePanel");
  if (!panel) return;

  panel.classList.toggle("hidden", !show);

  if (show) $("projectName")?.focus();
}
