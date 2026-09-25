import sql from "mssql";

// Unlike api/_lib/mongodb.js's cached client, connections here are opened
// fresh per request and closed at the end — the target server, database,
// and credentials differ on every call (whatever the user typed into the
// form), so there's nothing safe to reuse across requests.
export async function withConnection(creds, fn) {
  const config = {
    server: creds.server,
    database: creds.database,
    user: creds.username,
    password: creds.password,
    port: Number(creds.port) || 1433,
    connectionTimeout: 5000,
    requestTimeout: 30000,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    return await fn(pool);
  } finally {
    await pool.close().catch(() => {});
  }
}

// Maps common driver failures to messages safe to show the user — avoids
// leaking raw driver stack traces (hostnames, internal error codes) back
// to the browser.
export function friendlyConnectionError(err) {
  const code = err?.code || "";
  const message = err?.message || "";

  if (code === "ETIMEOUT" || code === "ESOCKET") {
    return "Could not reach the server — check the host/port and that you're on the VPN.";
  }
  if (/login failed/i.test(message)) {
    return "Login failed — check the username and password.";
  }
  if (/cannot open database/i.test(message)) {
    return "Could not open that database — check the database name and that the user has access.";
  }
  return "Connection failed. Please check the connection details and try again.";
}

export { sql };
