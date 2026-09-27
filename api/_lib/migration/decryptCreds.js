import crypto from "crypto";
import { extractKey } from "../../migration/creds-key.js";

// Decrypts a credentials object that was encrypted client-side with AES-256-GCM.
// Envelope format: { token, iv, tag, data } — token is a signed key-wrap
// token from GET /api/migration/creds-key; iv/tag/data are hex strings.
export function decryptCreds(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw Object.assign(new Error("Missing credentials envelope."), { userFacing: true });
  }
  const { token, iv, tag, data } = envelope;
  if (!token || !iv || !tag || !data) {
    throw Object.assign(new Error("Malformed credentials envelope."), { userFacing: true });
  }

  const key = extractKey(token);
  if (!key) {
    throw Object.assign(
      new Error("Credential token expired or invalid — please re-submit the form."),
      { userFacing: true },
    );
  }

  let plain;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    plain = decipher.update(Buffer.from(data, "hex")) + decipher.final("utf8");
  } catch {
    throw Object.assign(new Error("Credential decryption failed — data may be tampered."), { userFacing: true });
  }

  try {
    return JSON.parse(plain);
  } catch {
    throw Object.assign(new Error("Decrypted credentials are not valid JSON."), { userFacing: true });
  }
}
