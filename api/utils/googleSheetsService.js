
const { google } = require("googleapis");
const fs = require("fs");

// Which source was used (for diagnostics)
let CREDS_SOURCE = "none";

function loadRawCreds() {
  // 1) Inline JSON
  if (process.env.TEDX_GOOGLE_CREDENTIALS) {
    try {
      CREDS_SOURCE = "TEDX_GOOGLE_CREDENTIALS";
      return JSON.parse(process.env.TEDX_GOOGLE_CREDENTIALS);
    } catch (e) {
      throw new Error("Invalid TEDX_GOOGLE_CREDENTIALS JSON: " + e.message);
    }
  }
  // 2) Base64 JSON
  if (process.env.TEDX_GOOGLE_APPLICATION_CREDENTIALS_B64) {
    try {
      CREDS_SOURCE = "TEDX_GOOGLE_APPLICATION_CREDENTIALS_B64";
      const json = Buffer.from(process.env.TEDX_GOOGLE_APPLICATION_CREDENTIALS_B64, "base64").toString("utf-8");
      return JSON.parse(json);
    } catch (e) {
      throw new Error("Invalid TEDX_GOOGLE_APPLICATION_CREDENTIALS_B64: " + e.message);
    }
  }
  // 3) File path (JSON file on disk)
  if (process.env.TEDX_GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.TEDX_GOOGLE_APPLICATION_CREDENTIALS;
    try {
      CREDS_SOURCE = "TEDX_GOOGLE_APPLICATION_CREDENTIALS(file)";
      const json = fs.readFileSync(p, "utf-8");
      return JSON.parse(json);
    } catch (e) {
      throw new Error(`Cannot read creds file at ${p}: ${e.message}`);
    }
  }
  // 4) Email + Key pair
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    CREDS_SOURCE = "GOOGLE_CLIENT_EMAIL+GOOGLE_PRIVATE_KEY";
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY,
    };
  }
  throw new Error("No Google credentials found: set TEDX_GOOGLE_CREDENTIALS (JSON), or *_B64, or TEDX_GOOGLE_APPLICATION_CREDENTIALS (file path), or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.");
}

function normalizeCreds(raw) {
  const client_email = raw.client_email || raw.clientEmail;
  let private_key = raw.private_key || raw.privateKey;
  if (!client_email) throw new Error("Missing client_email in credentials");
  if (!private_key) throw new Error("Missing private_key in credentials");

  // Most hosts store PEM with \n escaped; convert them back
  private_key = String(private_key).replace(/\\n/g, "\n").trim();

  // Some CI systems double-quote the key – strip wrapping quotes if present
  if (private_key.startsWith('"') && private_key.endsWith('"')) {
    private_key = private_key.slice(1, -1);
  }

  if (!private_key.includes("BEGIN PRIVATE KEY") || !private_key.includes("END PRIVATE KEY")) {
    throw new Error("private_key does not look like a PEM key block after normalization");
  }
  return { client_email, private_key };
}

let authClient = null;
let authReady = null;

// Initialize auth lazily so app can boot without crashing
function initAuth() {
  if (authClient) return;
  let raw;
  try {
    raw = loadRawCreds();
    const { client_email, private_key } = normalizeCreds(raw);
    const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
    authClient = new google.auth.JWT({
      email: client_email,
      key: private_key,
      scopes: SCOPES,
    });
    authReady = (async () => {
      try {
        await authClient.authorize();
        console.log("✅ Google Sheets auth OK (source:", CREDS_SOURCE + ")", "as", client_email);
      } catch (e) {
        console.error("❌ Google auth failed:", e?.message || e);
        console.error("Hints: share the Sheet with the service account as Editor; ensure private_key has real newlines; confirm key is active.");
        // Do not throw here; allow app to continue and handle later on first use.
        authClient = null;
      }
    })();
  } catch (e) {
    console.warn("⚠️ No usable Google credentials at startup:", e?.message || e);
    // Leave authClient null; we will attempt again on first append.
  }
}

// Retry helper with exponential backoff
async function withRetry(fn, { retries = 3, baseDelay = 400 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e.code || e.response?.status;
      const reason = String(e?.errors?.[0]?.reason || "");
      const retryable = code === 429 || (code >= 500 && code < 600) || reason.includes("rateLimit");
      if (!retryable || i === retries) break;
      await new Promise(r => setTimeout(r, baseDelay * (2 ** i)));
    }
  }
  throw lastErr;
}

// Ensure header row exists
async function ensureHeaderRow(sheets, sheetId, sheetName, headers) {
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1:Z1`,
  });
  const existing = read?.data?.values?.[0] || [];
  if (!existing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      resource: { values: [headers] },
    });
    console.log("ℹ️ Header row created in Google Sheet");
  }
}

const SHEET_ID = process.env.TEDX_SHEET_ID || "";
const SHEET_NAME = process.env.TEDX_SHEET_NAME || "Sheet1";
const HEADERS = [
  "Name","Email","Phone","Department","Branch","Session","Amount",
  "Razorpay Order ID","Payment ID","Ticket ID","Created At"
];

// Public: verify once (optional caller)
async function verifyAuthOnce() {
  initAuth();
  if (!authClient) throw new Error("Google auth not initialized – credentials missing or invalid");
  await authReady;
  if (!authClient.credentials?.access_token) throw new Error("Google auth failed – no access token");
  return true;
}

// Public: append a row
async function appendRowToSheet(rowData) {
  if (!Array.isArray(rowData)) throw new Error("rowData must be an array");
  initAuth();
  if (!authClient) throw new Error("Google auth not initialized – set credentials in env");

  if (!SHEET_ID) throw new Error("TEDX_SHEET_ID not set");
  await authReady;

  const sheets = google.sheets({ version: "v4", auth: authClient });

  await withRetry(() => ensureHeaderRow(sheets, SHEET_ID, SHEET_NAME, HEADERS));
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [rowData] },
    })
  );

  console.log("✅ Row appended to Google Sheet");
}

module.exports = { appendRowToSheet, verifyAuthOnce };
