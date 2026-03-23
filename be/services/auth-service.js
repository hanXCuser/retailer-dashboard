const crypto = require("crypto");

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return { supabaseUrl, supabaseKey };
}

async function fetchSupabase(path) {
  const config = getSupabaseConfig();
  if (!config) {
    return [];
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase auth request failed for ${path} with status ${response.status}`);
  }

  return response.json();
}

async function getStoreName(storeId) {
  if (!storeId) {
    return null;
  }

  try {
    const rows = await fetchSupabase(`stores?select=store_name&store_id=eq.${encodeURIComponent(storeId)}&limit=1`);
    return rows[0]?.store_name || null;
  } catch (error) {
    return null;
  }
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password || "")).digest("hex");
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "retail-dashboard-dev-secret";
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySession(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  if (signature !== expected) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function parseCookies(request) {
  const raw = request.headers.cookie || "";
  const pairs = raw.split(/;\s*/).filter(Boolean);
  const cookies = {};

  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function getSessionFromRequest(request) {
  const cookies = parseCookies(request);
  return verifySession(cookies.store_session);
}

function serializeSessionCookie(sessionToken) {
  return `store_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`;
}

function clearSessionCookie() {
  return "store_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

async function authenticateStoreUser(email, password) {
  if (!email || !password) {
    return null;
  }

  const safeEmail = encodeURIComponent(String(email).trim());
  const rows = await fetchSupabase(
    `store_users?select=*&email=eq.${safeEmail}&limit=1`
  );

  const user = rows[0];
  if (!user || user.is_active === false) {
    return null;
  }

  const hashedInput = hashPassword(password);
  const matchesHashed = user.password_hash && user.password_hash === hashedInput;
  const matchesPlain = user.password && user.password === password;

  if (!matchesHashed && !matchesPlain) {
    return null;
  }

  return {
    userId: user.user_id || user.email,
    email: user.email,
    storeId: Number(user.store_id),
    storeName: user.store_name || await getStoreName(user.store_id) || `Store ${user.store_id}`,
    role: user.role || "manager"
  };
}

module.exports = {
  authenticateStoreUser,
  getSessionFromRequest,
  serializeSessionCookie,
  clearSessionCookie,
  signSession
};
