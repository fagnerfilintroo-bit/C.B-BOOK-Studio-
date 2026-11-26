
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

/* =========================================================
   ÁREA DE TRABALHO
========================================================= */

function renderWorkspace() {
  const project = currentProject();
  const content = $("workspaceContent");

  if (!project || !content) return;

  document.querySelectorAll(".workspace-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.workspace === activeWorkspaceTab);
  });

  const progress = projectProgress(project);

  if ($("workspaceProjectName")) {
    $("workspaceProjectName").textContent = project.name;
  }

  if ($("workspaceProjectDescription")) {
    $("workspaceProjectDescription").textContent = project.goal || project.type;
  }

  if ($("workspaceProjectStatus")) {
    $("workspaceProjectStatus").textContent = project.status;
  }

  if ($("workspaceProgressBar")) {
    $("workspaceProgressBar").style.width = `${progress}%`;
  }

  if ($("workspaceProgressText")) {
    $("workspaceProgressText").textContent = `${progress}% concluído`;
  }

  if (activeWorkspaceTab === "summary") renderWorkspaceSummary(project, content);
  if (activeWorkspaceTab === "tasks") renderWorkspaceTasks(project, content);
  if (activeWorkspaceTab === "notes") renderWorkspaceNotes(project, content);
  if (activeWorkspaceTab === "calendar") renderWorkspaceCalendar(project, content);
  if (activeWorkspaceTab === "history") renderWorkspaceHistory(project, content);
  if (activeWorkspaceTab === "files") renderWorkspaceFiles(project, content);
}

function renderWorkspaceSummary(project, content) {
  const doneTasks = project.tasks.filter((task) => task.done).length;

  content.innerHTML = `
    <div class="workspace-grid">
      <section class="content-card workspace-panel">
        <h3>Visão do projeto</h3>
        <p class="muted">${escapeHTML(project.goal || "O objetivo ainda não foi definido.")}</p>

        <div class="summary-field">
          <small>Próxima ação</small>
          <strong>${escapeHTML(project.next_action || "Nenhuma ação definida.")}</strong>
        </div>

        <div class="summary-field">
          <small>Área de atuação</small>
          <strong>${escapeHTML(project.focus || "Não definida")}</strong>
        </div>

        <div class="summary-field">
          <small>Tipo de projeto</small>
          <strong>${escapeHTML(project.type)}</strong>
        </div>

        <div class="summary-field">
          <small>Status</small>
          <strong>${escapeHTML(project.status)}</strong>
        </div>
      </section>

      <section class="content-card workspace-panel">
        <h3>Indicadores</h3>
        <div class="mini-stats">
          <div><strong>${project.tasks.length}</strong><span>Tarefas</span></div>
          <div><strong>${doneTasks}</strong><span>Concluídas</span></div>
          <div><strong>${project.notes.length}</strong><span>Anotações</span></div>
          <div><strong>${project.events.length}</strong><span>Eventos</span></div>
        </div>
      </section>
    </div>

    <section class="content-card workspace-panel">
      <div class="section-heading">
        <div>
          <h3>Etapas do projeto</h3>
          <p>Marque cada etapa conforme avançar.</p>
        </div>
      </div>

      ${project.stages.length ? project.stages.map((stage) => `
        <label class="stage-item">
          <input type="checkbox" data-action="toggle-stage" data-id="${stage.id}" ${stage.done ? "checked" : ""}>
          <span>${escapeHTML(stage.title)}</span>
          <button type="button" class="icon-button" data-action="delete-stage" data-id="${stage.id}" title="Excluir etapa">×</button>
        </label>
      `).join("") : `<p class="empty-state">Este projeto ainda não possui etapas.</p>`}

      <form id="stageForm" class="inline-form">
        <input id="stageTitle" type="text" placeholder="Adicionar uma etapa..." required>
        <button class="btn primary" type="submit">Adicionar</button>
      </form>
    </section>

    <section class="content-card workspace-panel">
      <h3>Editar informações</h3>

      <form id="projectEditForm" class="form-grid">
        <label>Nome do projeto
          <input id="editProjectName" value="${escapeHTML(project.name)}" required>
        </label>

        <label>Tipo
          <input id="editProjectType" value="${escapeHTML(project.type)}">
        </label>

        <label>Status
          <select id="editProjectStatus">
            ${["Planejamento", "Desenvolvimento", "Em andamento", "Em recuperação", "Pausado", "Concluído", "Arquivado"].map((status) =>
              `<option ${project.status === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </label>

        <label>Cor de identificação
          <select id="editProjectColor">
            <option value="blue" ${project.color === "blue" ? "selected" : ""}>Azul</option>
            <option value="green" ${project.color === "green" ? "selected" : ""}>Verde</option>
            <option value="gold" ${project.color === "gold" ? "selected" : ""}>Dourado</option>
            <option value="purple" ${project.color === "purple" ? "selected" : ""}>Roxo</option>
          </select>
        </label>

        <label class="full-field">Objetivo
          <textarea id="editProjectGoal" rows="3">${escapeHTML(project.goal)}</textarea>
        </label>

        <label class="full-field">Próxima ação
          <textarea id="editProjectNext" rows="2">${escapeHTML(project.next_action)}</textarea>
        </label>

        <label class="full-field">Foco / áreas
          <input id="editProjectFocus" value="${escapeHTML(project.focus)}">
        </label>

        <div class="full-field">
          <button class="btn primary" type="submit">Salvar alterações</button>
        </div>
      </form>
    </section>
  `;
}

function renderWorkspaceTasks(project, content) {
  const tasks = [...project.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.due || "9999").localeCompare(b.due || "9999");
  });

  content.innerHTML = `
    <section class="content-card workspace-panel">
      <h3>Adicionar tarefa</h3>

      <form id="taskForm" class="form-grid">
        <label class="full-field">O que precisa ser feito?
          <input id="taskTitle" placeholder="Ex.: Preparar primeira publicação" required>
        </label>

        <label>Prazo
          <input id="taskDue" type="date">
        </label>

        <label>Prioridade
          <select id="taskPriority">
            <option value="Normal">Normal</option>
            <option value="Alta">Alta</option>
            <option value="Baixa">Baixa</option>
          </select>
        </label>

        <div class="full-field">
          <button class="btn primary" type="submit">Adicionar tarefa</button>
        </div>
      </form>
    </section>

    <section class="content-card workspace-panel">
      <div class="section-heading">
        <div>
          <h3>Lista de tarefas</h3>
          <p>${tasks.filter((task) => task.done).length} de ${tasks.length} concluídas</p>
        </div>
      </div>

      ${tasks.length ? tasks.map((task) => `
        <div class="task-item ${task.done ? "completed" : ""}">
          <input type="checkbox" data-action="toggle-task" data-id="${task.id}" ${task.done ? "checked" : ""}>
          <div class="task-main">
            <strong>${escapeHTML(task.title)}</strong>
            <small>${task.due ? `Prazo: ${formatDate(task.due)}` : "Sem prazo"} · Prioridade: ${escapeHTML(task.priority || "Normal")}</small>
          </div>
          <button class="icon-button" data-action="delete-task" data-id="${task.id}" title="Excluir tarefa">×</button>
        </div>
      `).join("") : `<p class="empty-state">Nenhuma tarefa cadastrada. Adicione a primeira acima.</p>`}
    </section>
  `;
}

function renderWorkspaceNotes(project, content) {
  content.innerHTML = `
    <section class="content-card workspace-panel">
      <h3>Nova anotação</h3>

      <form id="noteForm" class="form-grid">
        <label class="full-field">Título
          <input id="noteTitle" placeholder="Título da anotação" required>
        </label>

        <label class="full-field">Conteúdo
          <textarea id="noteContent" rows="5" placeholder="Registre ideias, decisões e informações importantes..." required></textarea>
        </label>

        <div class="full-field">
          <button class="btn primary" type="submit">Salvar anotação</button>
        </div>
      </form>
    </section>

    <section class="content-card workspace-panel">
      <h3>Anotações do projeto</h3>

      ${project.notes.length ? project.notes.map((note) => `
        <article class="note-item">
          <div class="note-header">
            <strong>${escapeHTML(note.title)}</strong>
            <button class="icon-button" data-action="delete-note" data-id="${note.id}" title="Excluir anotação">×</button>
          </div>
          <p>${escapeHTML(note.content).replace(/\n/g, "<br>")}</p>
          <small>${formatDateTime(note.date)}</small>
        </article>
      `).join("") : `<p class="empty-state">As anotações deste projeto aparecerão aqui.</p>`}
    </section>
  `;
}

function renderWorkspaceCalendar(project, content) {
  const events = [...project.events].sort((a, b) => a.date.localeCompare(b.date));

  content.innerHTML = `
    <section class="content-card workspace-panel">
      <h3>Adicionar compromisso</h3>

      <form id="eventForm" class="form-grid">
        <label class="full-field">Título
          <input id="eventTitle" placeholder="Ex.: Reunião de planejamento" required>
        </label>

        <label>Data
          <input id="eventDate" type="date" required>
        </label>

        <label class="full-field">Descrição
          <textarea id="eventDescription" rows="2" placeholder="Detalhes do compromisso (opcional)"></textarea>
        </label>

        <div class="full-field">
          <button class="btn primary" type="submit">Adicionar ao calendário</button>
        </div>
      </form>
    </section>

    <section class="content-card workspace-panel">
      <h3>Agenda do projeto</h3>

      ${events.length ? events.map((event) => `
        <div class="calendar-item">
          <div class="calendar-date">
            <strong>${new Date(event.date + "T12:00:00").getDate()}</strong>
            <small>${new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}</small>
          </div>

          <div class="calendar-main">
            <strong>${escapeHTML(event.title)}</strong>
            <p>${escapeHTML(event.description || "")}</p>
            <small>${formatDate(event.date)}</small>
          </div>

          <button class="icon-button" data-action="delete-event" data-id="${event.id}" title="Excluir evento">×</button>
        </div>
      `).join("") : `<p class="empty-state">Nenhum compromisso cadastrado.</p>`}
    </section>
  `;
}

function renderWorkspaceHistory(project, content) {
  content.innerHTML = `
    <section class="content-card workspace-panel">
      <h3>Histórico de atividades</h3>

      ${project.history.length ? project.history.map((item) => `
        <div class="history-item">
          <div class="activity-marker"></div>
          <div>
            <strong>${escapeHTML(item.title)}</strong>
            <p>${escapeHTML(item.description || "")}</p>
            <small>${formatDateTime(item.date)}</small>
          </div>
        </div>
      `).join("") : `<p class="empty-state">As alterações e atividades deste projeto aparecerão aqui.</p>`}
    </section>
  `;
}

function renderWorkspaceFiles(project, content) {
  const projectDocs = documents.filter((doc) => doc.project_id === project.id);

  content.innerHTML = `
    <section class="content-card workspace-panel">
      <h3>Adicionar documento</h3>

      <form id="workspaceUploadForm" class="form-grid">
        <label class="full-field">Selecionar arquivo
          <input id="workspaceFileInput" type="file" required accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp,.svg">
        </label>

        <label class="full-field">Categoria
          <select id="workspaceFileCategory">
            <option value="Geral">Geral</option>
            <option value="Referências">Referências</option>
            <option value="Planejamento">Planejamento</option>
            <option value="Produção">Produção</option>
            <option value="Final">Final</option>
          </select>
        </label>

        <div class="full-field">
          <button class="btn primary" type="submit">Enviar documento</button>
        </div>
      </form>
    </section>

    <section class="content-card workspace-panel">
      <h3>Documentos deste projeto</h3>
      ${renderDocumentItems(projectDocs)}
    </section>
  `;
}

/* =========================================================
   FORMULÁRIOS DO WORKSPACE
========================================================= */

function handleTaskCreate(event) {
  event.preventDefault();

  const project = currentProject();
  const title = $("taskTitle")?.value.trim();

  if (!project || !title) return;

  project.tasks.push({
    id: uid(),
    title,
    due: $("taskDue")?.value || "",
    priority: $("taskPriority")?.value || "Normal",
    done: false,
    created_at: new Date().toISOString()
  });

  recordHistory(project, "Tarefa adicionada", title);
  renderAll();
  renderWorkspace();
  showToast("Tarefa adicionada.");
}

function handleNoteCreate(event) {
  event.preventDefault();

  const project = currentProject();
  const title = $("noteTitle")?.value.trim();
  const content = $("noteContent")?.value.trim();

  if (!project || !title || !content) return;

  project.notes.unshift({
    id: uid(),
    title,
    content,
    date: new Date().toISOString()
  });

  recordHistory(project, "Anotação criada", title);
  renderAll();
  renderWorkspace();
  showToast("Anotação salva.");
}

function handleEventCreate(event) {
  event.preventDefault();

  const project = currentProject();
  const title = $("eventTitle")?.value.trim();
  const date = $("eventDate")?.value;

  if (!project || !title || !date) return;

  project.events.push({
    id: uid(),
    title,
    date,
    description: $("eventDescription")?.value.trim() || ""
  });

  recordHistory(project, "Compromisso adicionado", `${title} — ${formatDate(date)}`);
  renderAll();
  renderWorkspace();
  showToast("Compromisso adicionado.");
}

function handleStageCreate(event) {
  event.preventDefault();

  const project = currentProject();
  const title = $("stageTitle")?.value.trim();

  if (!project || !title) return;

  project.stages.push({
    id: uid(),
    title,
    done: false
  });

  recordHistory(project, "Etapa adicionada", title);
  renderAll();
  renderWorkspace();
  showToast("Etapa adicionada.");
}

function handleProjectEdit(event) {
  event.preventDefault();

  const project = currentProject();
  if (!project) return;

  project.name = $("editProjectName")?.value.trim() || project.name;
  project.type = $("editProjectType")?.value.trim() || project.type;
  project.status = $("editProjectStatus")?.value || project.status;
  project.color = $("editProjectColor")?.value || project.color;
  project.goal = $("editProjectGoal")?.value.trim() || "";
  project.next_action = $("editProjectNext")?.value.trim() || "";
  project.focus = $("editProjectFocus")?.value.trim() || "";

  recordHistory(project, "Informações atualizadas", "Dados gerais do projeto foram modificados.");

  renderAll();
  renderWorkspace();
  showToast("Projeto atualizado.");
}

/* =========================================================
   AÇÕES DO WORKSPACE
========================================================= */

function handleAction(action, id, element) {
  if (action === "open-project") {
    openWorkspace(id);
    return;
  }

  const project = currentProject();

  if (action === "open-doc") {
    const doc = documents.find((item) => String(item.id) === String(id));
    if (doc) openDocument(doc);
    return;
  }

  if (action === "delete-doc") {
    const doc = documents.find((item) => String(item.id) === String(id));
    if (doc) removeDocument(doc);
    return;
  }

  if (!project) return;

  if (action === "toggle-task") {
    const task = project.tasks.find((item) => item.id === id);
    if (!task) return;

    task.done = element.checked;
    recordHistory(project, task.done ? "Tarefa concluída" : "Tarefa reaberta", task.title);
    renderAll();
    renderWorkspace();
  }

  if (action === "toggle-stage") {
    const stage = project.stages.find((item) => item.id === id);
    if (!stage) return;

    stage.done = element.checked;
    recordHistory(project, stage.done ? "Etapa concluída" : "Etapa reaberta", stage.title);
    renderAll();
    renderWorkspace();
  }

  if (action === "delete-task") {
    const task = project.tasks.find((item) => item.id === id);

    if (!task || !confirm(`Excluir a tarefa "${task.title}"?`)) return;

    project.tasks = project.tasks.filter((item) => item.id !== id);
    recordHistory(project, "Tarefa excluída", task.title);
    renderAll();
    renderWorkspace();
  }

  if (action === "delete-note") {
    const note = project.notes.find((item) => item.id === id);

    if (!note || !confirm(`Excluir a anotação "${note.title}"?`)) return;

    project.notes = project.notes.filter((item) => item.id !== id);
    recordHistory(project, "Anotação excluída", note.title);
    renderAll();
    renderWorkspace();
  }

  if (action === "delete-event") {
    const item = project.events.find((event) => event.id === id);

    if (!item || !confirm(`Excluir o compromisso "${item.title}"?`)) return;

    project.events = project.events.filter((event) => event.id !== id);
    recordHistory(project, "Compromisso excluído", item.title);
    renderAll();
    renderWorkspace();
  }

  if (action === "delete-stage") {
    const stage = project.stages.find((item) => item.id === id);

    if (!stage || !confirm(`Excluir a etapa "${stage.title}"?`)) return;

    project.stages = project.stages.filter((item) => item.id !== id);
    recordHistory(project, "Etapa excluída", stage.title);
    renderAll();
    renderWorkspace();
  }
}

/* =========================================================
   DOCUMENTOS
========================================================= */

function documentName(doc) {
  return doc.original_name ||
    doc.file_name ||
    doc.name ||
    doc.filename ||
    "Documento";
}

function renderDocumentItems(items) {
  if (!items.length) {
    return `<p class="empty-state">Nenhum documento adicionado.</p>`;
  }

  return items.map((doc) => `
    <div class="document-item">
      <div class="document-icon">▤</div>

      <div class="document-info">
        <strong>${escapeHTML(documentName(doc))}</strong>
        <small>
          ${escapeHTML(doc.category || "Geral")} ·
          ${formatBytes(doc.size)} ·
          ${formatDate(doc.created_at)}
        </small>
      </div>

      <div class="document-actions">
        <button class="btn outline small" data-action="open-doc" data-id="${escapeHTML(doc.id)}">
          Abrir
        </button>

        <button class="icon-button" data-action="delete-doc" data-id="${escapeHTML(doc.id)}" title="Excluir documento">
          ×
        </button>
      </div>
    </div>
  `).join("");
}

function renderDocuments() {
  const list = $("documentList");
  if (!list) return;

  const selectedProject = $("filterProject")?.value || "all";

  const filtered = selectedProject === "all"
    ? documents
    : documents.filter((doc) => doc.project_id === selectedProject);

  list.innerHTML = renderDocumentItems(filtered);
  renderStats();
}

function renderProjectSelectors() {
  ["uploadProject", "filterProject"].forEach((id) => {
    const select = $(id);
    if (!select) return;

    const previous = select.value;
    const isFilter = id === "filterProject";

    select.innerHTML = isFilter
      ? `<option value="all">Todos os projetos</option>`
      : `<option value="">Selecionar projeto</option>`;

    state.projects.forEach((project) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${escapeHTML(project.id)}">${escapeHTML(project.name)}</option>`
      );
    });

    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  });
}

async function refreshDocuments() {
  try {
    const result = await listDocuments();
    documents = Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Erro ao carregar documentos:", error);
    documents = [];
  }

  renderDocuments();

  if ($("workspaceSection")?.classList.contains("active")) {
    renderWorkspace();
  }
}

async function handleDocumentUpload(file, projectId, category) {
  if (!file) {
    showToast("Selecione um arquivo.", "error");
    return false;
  }

  if (!projectId) {
    showToast("Selecione o projeto ao qual o arquivo pertence.", "error");
    return false;
  }

  try {
    await uploadDocument(file, projectId, category || "Geral");

    const project = state.projects.find((item) => item.id === projectId);

    if (project) {
      recordHistory(project, "Documento adicionado", file.name);
    } else {
      state.activity.unshift({
        id: uid(),
        title: "Documento adicionado",
        description: file.name,
        date: new Date().toISOString()
      });
      saveState();
    }

    await refreshDocuments();
    renderAll();

    showToast("Documento salvo no navegador.");
    return true;
  } catch (error) {
    console.error("Erro ao enviar documento:", error);
    showToast(error.message || "Não foi possível salvar o documento.", "error");
    return false;
  }
}

async function removeDocument(doc) {
  const name = documentName(doc);

  if (!confirm(`Excluir "${name}"?`)) return;

  try {
    await deleteDocument(doc);

    const project = state.projects.find((item) => item.id === doc.project_id);

    if (project) {
      recordHistory(project, "Documento excluído", name);
    }

    await refreshDocuments();
    renderAll();

    showToast("Documento excluído.");
  } catch (error) {
    console.error("Erro ao excluir documento:", error);
    showToast(error.message || "Não foi possível excluir o documento.", "error");
  }
}

/* =========================================================
   EVENTOS DA INTERFACE
========================================================= */

function bindEvents() {
  $("themeToggle")?.addEventListener("click", toggleTheme);

  $("loginForm")?.addEventListener("submit", handleLogin);
  $("signupForm")?.addEventListener("submit", handleSignup);

  $("showSignupBtn")?.addEventListener("click", () => {
    showAuthPanel("signup");
    clearMessage("signupMessage");
  });

  $("showLoginBtn")?.addEventListener("click", () => {
    showAuthPanel("login");
    clearMessage("loginMessage");
  });

  $("logoutBtn")?.addEventListener("click", logout);

  $("newProjectBtn")?.addEventListener("click", () => {
    toggleProjectCreate(true);
  });

  $("heroNewProjectBtn")?.addEventListener("click", () => {
    switchSection("projectsSection");
    toggleProjectCreate(true);
  });

  $("cancelProjectBtn")?.addEventListener("click", () => {
    toggleProjectCreate(false);
  });

  $("cancelProjectBtn2")?.addEventListener("click", () => {
    toggleProjectCreate(false);
  });

  $("projectForm")?.addEventListener("submit", handleProjectCreate);

  $("backToProjectsBtn")?.addEventListener("click", () => {
    switchSection("projectsSection");
  });

  $("workspaceTabs")?.addEventListener("click", (event) => {
    const tab = event.target.closest(".workspace-tab");
    if (!tab) return;

    activeWorkspaceTab = tab.dataset.workspace;
    renderWorkspace();
  });

  $("uploadForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = $("fileInput")?.files?.[0];
    const projectId = $("uploadProject")?.value;
    const category = $("uploadCategory")?.value || "Geral";

    const success = await handleDocumentUpload(file, projectId, category);

    if (success) {
      $("uploadForm")?.reset();
      setMessage("uploadMessage", "Documento salvo com sucesso.", "success");
    } else {
      setMessage("uploadMessage", "Não foi possível salvar o documento.");
    }
  });

  $("filterProject")?.addEventListener("change", renderDocuments);

  $("menuToggle")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    const nav = event.target.closest(".nav-item, [data-section]");

    if (nav?.dataset.section) {
      switchSection(nav.dataset.section);
      return;
    }

    const actionElement = event.target.closest("[data-action]");

    if (actionElement) {
      handleAction(
        actionElement.dataset.action,
        actionElement.dataset.id,
        actionElement
      );
    }
  });

  document.addEventListener("submit", async (event) => {
    switch (event.target.id) {
      case "taskForm":
        handleTaskCreate(event);
        break;

      case "noteForm":
        handleNoteCreate(event);
        break;

      case "eventForm":
        handleEventCreate(event);
        break;

      case "stageForm":
        handleStageCreate(event);
        break;

      case "projectEditForm":
        handleProjectEdit(event);
        break;

      case "workspaceUploadForm": {
        event.preventDefault();

        const file = $("workspaceFileInput")?.files?.[0];
        const project = currentProject();
        const category = $("workspaceFileCategory")?.value || "Geral";

        if (project) {
          const success = await handleDocumentUpload(file, project.id, category);
          if (success) renderWorkspace();
        }

        break;
      }
    }
  });
}
