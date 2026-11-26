
import { supabase } from "./supabase.js";

const BUCKET = "studio-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml"
];

export async function uploadDocument(file, projectId, category) {
  if (!file) throw new Error("Selecione um arquivo.");

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("O arquivo ultrapassa o limite de 25 MB.");
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Formato de arquivo não permitido.");
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) throw new Error("Faça login novamente.");

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const path = `${user.id}/${projectId}/${category}/${crypto.randomUUID()}-${safeName}`;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (storageError) throw storageError;

  const { data, error } = await supabase
    .from("studio_documents")
    .insert({
      user_id: user.id,
      project_id: projectId,
      category,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return data;
}

export async function listDocuments(projectId = "") {
  let query = supabase
    .from("studio_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function openDocument(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);

  if (error) throw error;

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function deleteDocument(document) {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([document.storage_path]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from("studio_documents")
    .delete()
    .eq("id", document.id);

  if (error) throw error;
}
