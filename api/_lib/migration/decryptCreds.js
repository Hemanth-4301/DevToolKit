import crypto from "crypto";
import { consumeKey } from "../../migration/creds-key.js";

// Decrypts a credentials object that was encrypted client-side with AES-256-GCM.
// Envelope format: { keyId, iv, tag, data } — all hex strings.
// Returns the decrypted creds object, or throws a userFacing error.
export function decryptCreds(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw Object.assign(new Error("Missing credentials envelope."), { userFacing: true });
  }
  const { keyId, iv, tag, data } = envelope;
  if (!keyId || !iv || !tag || !data) {
    throw Object.assign(new Error("Malformed credentials envelope."), { userFacing: true });
  }

  const key = consumeKey(keyId);
  if (!key) {
    throw Object.assign(
      new Error("Credential key expired or already used — please re-submit the form."),
      { userFacing: true },
    );
  }

  let plain;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "hex"),
    );
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
