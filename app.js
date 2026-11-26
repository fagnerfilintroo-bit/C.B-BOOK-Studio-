
import { supabase } from "./supabase.js";

import {
  uploadDocument,
  listDocuments,
  openDocument,
  deleteDocument
} from "./documents.js";

const $ = id => document.getElementById(id);

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

let projects = [];
let documents = [];

function message(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#C44D5A" : "#168A65";
}

async function seedProjects() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const { data, error } = await supabase
    .from("studio_projects")
    .select("id")
    .limit(1);

  if (error) throw error;
  if (data.length) return;

  const rows = initialProjects.map(p => ({
    user_id: user.id,
    ...p
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
    .order("created_at");

  if (error) throw error;

  projects = data || [];
  render();
}

function renderCard(p) {
  const stages = p.stages || [];
  const done = stages.filter(s => s[1]).length;
  const percent = stages.length
    ? Math.round(done / stages.length * 100)
    : 0;

  return `
    <article class="project">
      <div class="project-top">
        <div>
          <h3>${escapeHTML(p.name)}</h3>
          <small>${escapeHTML(p.type)}</small>
        </div>
        <span class="tag">${escapeHTML(p.status)}</span>
      </div>

      <p>${escapeHTML(p.goal)}</p>
      <div class="progress">
        <span style="width:${percent}%"></span>
      </div>
      <div class="meta">
        <span>${done}/${stages.length} etapas</span>
        <b>${percent}%</b>
      </div>

      <p><b>Próxima ação:</b><br>
      ${escapeHTML(p.next_action)}</p>

      <button class="btn outline" data-edit="${p.id}">
        Gerenciar projeto
      </button>

      <div class="detail" id="detail-${p.id}">
        <label>Situação</label>
        <select id="status-${p.id}">
          ${[
            "Planejamento",
            "Em desenvolvimento",
            "Em recuperação",
            "Em pausa",
            "Concluído"
          ].map(v => `
            <option ${p.status === v ? "selected" : ""}>
              ${v}
            </option>
          `).join("")}
        </select>

        <label>Objetivo</label>
        <textarea id="goal-${p.id}">${escapeHTML(p.goal)}</textarea>

        <label>Próxima ação</label>
        <textarea id="next-${p.id}">${escapeHTML(p.next_action)}</textarea>

        <label>Etapas</label>
        ${stages.map((s,i) => `
          <label class="stage">
            <input type="checkbox"
              data-stage="${p.id}"
              data-index="${i}"
              ${s[1] ? "checked" : ""}>
            ${escapeHTML(s[0])}
          </label>
        `).join("")}

        <button class="btn yellow" data-save="${p.id}">
          Salvar alterações
        </button>
      </div>
    </article>
  `;
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

function render() {
  const totalDone = projects.reduce(
    (sum,p) => sum + (p.stages || []).filter(s => s[1]).length,
    0
  );

  $("total").textContent = projects.length;
  $("active").textContent = projects.filter(
    p => ["Em desenvolvimento","Em recuperação"].includes(p.status)
  ).length;
  $("done").textContent = totalDone;
  $("docTotal").textContent = documents.length;

  $("overviewGrid").innerHTML = projects.map(renderCard).join("");
  $("projectGrid").innerHTML = projects.map(renderCard).join("");

  const options = projects.map(p =>
    `<option value="${p.id}">${escapeHTML(p.name)}</option>`
  ).join("");

  $("uploadProject").innerHTML = options;
  $("filterProject").innerHTML =
    `<option value="">Todos os projetos</option>` + options;
}

async function saveProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;

  const stages = [...p.stages];

  document.querySelectorAll(`[data-stage="${id}"]`)
    .forEach(el => {
      stages[Number(el.dataset.index)][1] = el.checked;
    });

  const updates = {
    status: $(`status-${id}`).value,
    goal: $(`goal-${id}`).value,
    next_action: $(`next-${id}`).value,
    stages
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
  $("docTotal").textContent = documents.length;
}

function renderDocuments() {
  $("documentList").innerHTML = documents.length
    ? documents.map(d => `
      <div class="document-item">
        <div>
          <strong>${escapeHTML(d.file_name)}</strong>
          <small>${escapeHTML(d.category)} •
          ${new Date(d.created_at).toLocaleDateString("pt-BR")}</small>
        </div>
        <div>
          <button class="btn outline" data-open="${d.id}">Abrir</button>
          <button class="btn outline" data-delete="${d.id}">Excluir</button>
        </div>
      </div>
    `).join("")
    : "<p>Nenhum documento cadastrado.</p>";
}

async function refresh() {
  await loadProjects();
  await loadDocuments();
}

function showApp(session) {
  $("loginView").classList.toggle("hidden", !!session);
  $("appView").classList.toggle("hidden", !session);
  $("logoutBtn").classList.toggle("hidden", !session);
}

async function initialize() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    showApp(null);
    return;
  }

  showApp(data.session);

  try {
    await seedProjects();
    await refresh();
  } catch (error) {
    console.error(error);
    alert("Erro ao carregar os dados: " + error.message);
  }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  message("loginMessage", "Entrando...");

  const { error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    message("loginMessage", error.message, true);
    return;
  }

  await initialize();
});

$("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  projects = [];
  documents = [];
  showApp(null);
});

$("refreshBtn").addEventListener("click", async () => {
  try {
    await refresh();
  } catch (error) {
    alert(error.message);
  }
});

$("filterProject").addEventListener("change", async () => {
  try {
    await loadDocuments();
  } catch (error) {
    alert(error.message);
  }
});

$("uploadBtn").addEventListener("click", async () => {
  const file = $("fileInput").files[0];

  $("uploadBtn").disabled = true;
  message("uploadMessage", "Enviando arquivo...");

  try {
    await uploadDocument(
      file,
      $("uploadProject").value,
      $("uploadCategory").value
    );

    $("fileInput").value = "";
    message("uploadMessage", "Documento enviado com sucesso!");
    await loadDocuments();
  } catch (error) {
    message("uploadMessage", error.message, true);
  } finally {
    $("uploadBtn").disabled = false;
  }
});

document.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const save = e.target.closest("[data-save]");
  const open = e.target.closest("[data-open]");
  const remove = e.target.closest("[data-delete]");

  if (edit) {
    $(`detail-${edit.dataset.edit}`).classList.toggle("open");
  }

  if (save) {
    try {
      await saveProject(save.dataset.save);
      alert("Projeto atualizado!");
    } catch (error) {
      alert(error.message);
    }
  }

  if (open) {
    const doc = documents.find(d => d.id === open.dataset.open);
    if (doc) {
      try { await openDocument(doc.storage_path); }
      catch (error) { alert(error.message); }
    }
  }

  if (remove) {
    const doc = documents.find(d => d.id === remove.dataset.delete);

    if (doc && confirm("Deseja excluir este documento?")) {
      try {
        await deleteDocument(doc);
        await loadDocuments();
      } catch (error) {
        alert(error.message);
      }
    }
  }
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
  });
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") showApp(null);
});

initialize();
