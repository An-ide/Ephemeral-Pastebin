// Convert ArrayBuffer to Base64 URL‑safe (without padding)
function arrayBufferToBase64Url(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToArrayBuffer(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) base64 += '='.repeat(padding);
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

// Derive a key from a password (PBKDF2)
async function getKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext with password
export async function encryptWithPassword(plainText, password) {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getKeyFromPassword(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );
  const payload = {
    salt: arrayBufferToBase64Url(salt),
    iv: arrayBufferToBase64Url(iv),
    data: arrayBufferToBase64Url(encrypted),
  };
  return JSON.stringify(payload);
}

// Decrypt with password
export async function decryptWithPassword(encryptedJson, password) {
  const payload = JSON.parse(encryptedJson);
  const salt = base64UrlToArrayBuffer(payload.salt);
  const iv = base64UrlToArrayBuffer(payload.iv);
  const data = base64UrlToArrayBuffer(payload.data);
  const key = await getKeyFromPassword(password, new Uint8Array(salt));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}