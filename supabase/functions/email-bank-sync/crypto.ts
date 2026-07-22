const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Ensure the secret is exactly 32 bytes (256 bits)
  const normalizedSecret = enc.encode(secret.padEnd(32, "x").substring(0, 32));
  return await crypto.subtle.importKey(
    "raw",
    normalizedSecret,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(text: string, secret: string): Promise<string> {
  if (!text) return "";
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(text)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptText(encryptedBase64: string, secret: string): Promise<string> {
  if (!encryptedBase64) return "";
  const key = await getCryptoKey(secret);
  const combined = new Uint8Array(
    atob(encryptedBase64).split("").map((c) => c.charCodeAt(0))
  );

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
