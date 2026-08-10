// ---------------------------------------------------------------------------
// Criptografia das credenciais em repouso.
// ---------------------------------------------------------------------------
// Antes: as credenciais ficavam em texto puro no Firestore, protegidas só
// pelas regras de segurança (ninguém do lado do cliente consegue ler, mas um
// vazamento de configuração das regras, ou acesso administrativo indevido,
// exporia tudo em texto puro). Isso adiciona uma segunda camada: mesmo quem
// tiver acesso de administrador ao banco de dados não lê a chave sem também
// ter a chave mestra do servidor (guardada como Secret do Cloud Functions,
// nunca no código nem no Firestore).
const crypto = require('crypto');

function getMasterKey() {
  const raw = process.env.BOLETO_VAULT_KEY;
  if (!raw) {
    throw new Error(
      'BOLETO_VAULT_KEY não configurada. Rode: firebase functions:secrets:set BOLETO_VAULT_KEY'
    );
  }
  // Deriva uma chave de 32 bytes (AES-256) a partir do segredo configurado,
  // não importa o tamanho original digitado.
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plainText) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Empacota tudo num único texto Base64: iv + authTag + dados cifrados
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(packedBase64) {
  const key = getMasterKey();
  const packed = Buffer.from(packedBase64, 'base64');
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
