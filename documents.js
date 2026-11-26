
const DB_NAME = "cbbook_studio_local";
const DB_VERSION = 1;
const STORE_NAME = "documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const allowedTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml"
};

function getExtension(filename) {
  return filename.split(".").pop().toLowerCase();
}

function getMimeType(file) {
  const extension = getExtension(file.name);
  return file.type || allowedTypes[extension] || "";
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return "doc-" + Date.now() + "-" +
    Math.random().toString(36).slice(2);
}

/* =================================
   BANCO DE DADOS LOCAL
================================= */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece suporte ao armazenamento local."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id"
        });

        store.createIndex("project_id", "project_id", {
          unique: false
        });

        store.createIndex("created_at", "created_at", {
          unique: false
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      reject(new Error("Não foi possível abrir o armazenamento de documentos."));
    };

    request.onblocked = () => {
      reject(new Error("Feche outras abas do Studio e tente novamente."));
    };
  });
}

async function getDocumentRecord(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);

    request.onerror = () => {
      reject(new Error("Não foi possível localizar o documento."));
    };

    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

/* =================================
   ENVIAR DOCUMENTO
================================= */

export async function uploadDocument(file, projectId, category = "Geral") {
  if (!file) {
    throw new Error("Selecione um arquivo.");
  }

  if (!projectId) {
    throw new Error("Selecione o projeto ao qual o arquivo pertence.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("O arquivo ultrapassa o limite de 25 MB.");
  }

  const extension = getExtension(file.name);
  const mimeType = getMimeType(file);

  if (!allowedTypes[extension] || !mimeType) {
    throw new Error("Formato de arquivo não permitido.");
  }

  const database = await openDatabase();

  const document = {
    id: createId(),
    project_id: projectId,
    category: category || "Geral",
    file_name: file.name,
    mime_type: mimeType,
    file_size: file.size,
    created_at: new Date().toISOString(),
    storage_path: "",
    file: file
  };

  document.storage_path = document.id;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.add(document);

    transaction.oncomplete = () => {
      database.close();

      const { file: storedFile, ...metadata } = document;
      resolve(metadata);
    };

    transaction.onerror = () => {
      database.close();
      reject(new Error("Não foi possível salvar o arquivo no navegador."));
    };

    transaction.onabort = () => {
      database.close();
      reject(new Error("O armazenamento do arquivo foi cancelado."));
    };
  });
}

/* =================================
   LISTAR DOCUMENTOS
================================= */

export async function listDocuments(projectId = "") {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const request = projectId
      ? store.index("project_id").getAll(projectId)
      : store.getAll();

    request.onsuccess = () => {
      const documents = (request.result || [])
        .sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        )
        .map(({ file, ...metadata }) => metadata);

      resolve(documents);
    };

    request.onerror = () => {
      reject(new Error("Não foi possível listar os documentos."));
    };

    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

/* =================================
   ABRIR OU BAIXAR DOCUMENTO
================================= */

export async function openDocument(documentOrId) {
  const id = typeof documentOrId === "string"
    ? documentOrId
    : documentOrId?.id || documentOrId?.storage_path;

  if (!id) {
    throw new Error("Documento não identificado.");
  }

  // Abrimos a janela antes da consulta para reduzir
  // o risco de bloqueio de pop-ups pelo navegador.
  const previewWindow = window.open("about:blank", "_blank");

  if (previewWindow) {
    previewWindow.opener = null;
  }

  try {
    const document = await getDocumentRecord(id);

    if (!document || !document.file) {
      throw new Error("Arquivo não encontrado no armazenamento local.");
    }

    const blob = document.file instanceof Blob
      ? document.file
      : new Blob([document.file], {
          type: document.mime_type
        });

    const objectUrl = URL.createObjectURL(blob);
    const extension = getExtension(document.file_name);

    const previewable = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain"
    ].includes(document.mime_type);

    if (previewable && previewWindow) {
      previewWindow.location.href = objectUrl;
      return;
    }

    if (previewWindow) {
      previewWindow.close();
    }

    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = document.file_name || `documento.${extension}`;
    link.style.display = "none";

    window.document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

  } catch (error) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.close();
    }

    throw error;
  }
}

/* =================================
   EXCLUIR DOCUMENTO
================================= */

export async function deleteDocument(documentOrId) {
  const id = typeof documentOrId === "string"
    ? documentOrId
    : documentOrId?.id || documentOrId?.storage_path;

  if (!id) {
    throw new Error("Documento não identificado para exclusão.");
  }

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.delete(id);

    transaction.oncomplete = () => {
      database.close();
      resolve(true);
    };

    transaction.onerror = () => {
      database.close();
      reject(new Error("Não foi possível excluir o documento."));
    };

    transaction.onabort = () => {
      database.close();
      reject(new Error("A exclusão do documento foi cancelada."));
    };
  });
}
