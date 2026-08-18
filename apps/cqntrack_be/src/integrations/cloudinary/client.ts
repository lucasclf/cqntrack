export class CloudinaryUploadError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Upload pro Cloudinary falhou (status ${status}): ${body}`);
    this.name = "CloudinaryUploadError";
  }
}

interface CloudinaryUploadResponse {
  secure_url: string;
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// public_id determinístico por usuário (não um valor aleatório do
// Cloudinary) + overwrite: true — o upload seguinte substitui o anterior
// no mesmo asset, em vez de acumular um novo a cada troca. Não precisa de
// uma chamada de delete separada (nem do risco de "upload deu certo mas o
// delete do antigo falhou" que duas chamadas trariam).
export async function uploadAvatar(env: Env, userId: string, file: File): Promise<{ url: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `avatars/${userId}`;
  const overwrite = "true";
  const transformation = "c_fill,w_512,h_512";

  // Assinatura do Cloudinary: todo parâmetro do upload (exceto file/api_key/
  // signature) ordenado alfabeticamente, concatenado "chave=valor&...", com
  // o api_secret colado direto no fim (sem separador) — depois SHA-1 hex.
  const paramsToSign =
    `overwrite=${overwrite}&public_id=${publicId}&timestamp=${timestamp}` +
    `&transformation=${transformation}`;
  const signature = await sha1Hex(`${paramsToSign}${env.CLOUDINARY_API_SECRET}`);

  const form = new FormData();
  form.set("file", file);
  form.set("api_key", env.CLOUDINARY_API_KEY);
  form.set("timestamp", timestamp);
  form.set("public_id", publicId);
  form.set("overwrite", overwrite);
  form.set("transformation", transformation);
  form.set("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );

  if (!res.ok) {
    throw new CloudinaryUploadError(res.status, await res.text());
  }

  const body = (await res.json()) as CloudinaryUploadResponse;
  return { url: body.secure_url };
}
