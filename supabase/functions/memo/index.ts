// memo Edge Function — 게시/삭제 + 스팸 방지 3종
//   1) Cloudflare Turnstile 시크릿 검증 (봇 판별)
//   2) 한국(KR) IP 아니면 게시 금지
//   3) Turnstile 챌린지 통과 후 3초 이내 게시 → 봇으로 간주
//
// 배포:  supabase functions deploy memo
// 시크릿: supabase secrets set TURNSTILE_SECRET=... MEMO_MASTER_PASSWORD=...
import { createClient } from "jsr:@supabase/supabase-js@2";

const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";
const MASTER_PASSWORD = Deno.env.get("MEMO_MASTER_PASSWORD") ?? "dnjsejfoqwhrjsgml";
const IP_PEPPER = Deno.env.get("MEMO_IP_PEPPER") ?? "onetheutil-memo";
const MIN_COMPOSE_MS = 3000;   // 3초 미만 = 봇
const MAX_PER_IP_HOUR = 20;    // 같은 IP 시간당 게시 상한

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

const fail = (code: string, message: string, status = 400) =>
  json({ ok: false, code, message }, status);

const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

// ───────── 비밀번호 해시 (PBKDF2-SHA256) ─────────
const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return hex(bits);
}

async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

// 타이밍 공격 방지 비교
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ───────── 클라이언트 IP / 국가 ─────────
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return (req.headers.get("cf-connecting-ip") ?? xff.split(",")[0] ?? "").trim();
}

function isPrivateIp(ip: string): boolean {
  return !ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") ||
    ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

/** "KR" | "XX"(판별불가) — 헤더 우선, 없으면 공개 GeoIP 2곳 순차 조회 */
async function countryOf(req: Request, ip: string): Promise<string> {
  const header = req.headers.get("cf-ipcountry");
  if (header && header !== "XX" && header !== "T1") return header.toUpperCase();
  if (isPrivateIp(ip)) return "XX";

  for (const [url, pick] of [
    [`https://ipwho.is/${ip}?fields=country_code`, (j: any) => j?.country_code],
    [`https://api.country.is/${ip}`, (j: any) => j?.country],
  ] as const) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const code = pick(await res.json());
      if (typeof code === "string" && code.length === 2) return code.toUpperCase();
    } catch { /* 다음 provider */ }
  }
  return "XX";
}

// ───────── Turnstile ─────────
type Verdict = { ok: true; challengeTs: number } | { ok: false; code: string; message: string };

async function verifyTurnstile(token: string, ip: string): Promise<Verdict> {
  if (!TURNSTILE_SECRET) {
    return { ok: false, code: "server_misconfig", message: "TURNSTILE_SECRET 미설정" };
  }
  if (!token) return { ok: false, code: "bot_suspected", message: "봇 판별 토큰이 없습니다." };

  const form = new FormData();
  form.append("secret", TURNSTILE_SECRET);
  form.append("response", token);
  if (ip && !isPrivateIp(ip)) form.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.success) {
    return {
      ok: false,
      code: "bot_suspected",
      message: `봇 판별 실패 (${(data["error-codes"] ?? []).join(",") || "unknown"})`,
    };
  }
  const ts = Date.parse(data.challenge_ts ?? "");
  return { ok: true, challengeTs: Number.isNaN(ts) ? 0 : ts };
}

// ───────── 핸들러 ─────────
async function handleCreate(req: Request, body: any) {
  const content = String(body.content ?? "").trim();
  const password = String(body.password ?? "");

  if (!content) return fail("empty_content", "내용을 입력하세요.");
  if (content.length > 2000) return fail("too_long", "내용은 2000자까지입니다.");
  if (password.length < 1) return fail("empty_password", "비밀번호를 입력하세요.");

  const ip = clientIp(req);

  // (1) 봇 판별
  const verdict = await verifyTurnstile(String(body.token ?? ""), ip);
  if (!verdict.ok) {
    return fail(verdict.code, verdict.message, verdict.code === "server_misconfig" ? 500 : 403);
  }

  // (3) 3초 이내 작성 → 봇 추정 (Turnstile 챌린지 통과 시각 기준, 서버 판정)
  if (verdict.challengeTs) {
    const elapsed = Date.now() - verdict.challengeTs;
    if (elapsed < MIN_COMPOSE_MS) {
      return fail("too_fast", "작성이 너무 빠릅니다. 3초 이상 지난 뒤 게시하세요.", 429);
    }
  }

  // (2) 한국 IP 외 게시 금지
  const country = await countryOf(req, ip);
  if (country !== "KR") {
    return fail(
      "not_kr",
      country === "XX"
        ? "IP 국가를 확인할 수 없어 게시할 수 없습니다."
        : `한국(KR) IP 에서만 게시할 수 있습니다. (감지: ${country})`,
      403,
    );
  }

  const sb = db();
  const ipHash = await sha256(IP_PEPPER + "|" + ip);

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb
    .from("memos")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_IP_HOUR) {
    return fail("rate_limited", "게시 한도를 초과했습니다. 잠시 후 다시 시도하세요.", 429);
  }

  const saltHex = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const { data, error } = await sb
    .from("memos")
    .insert({
      content,
      pw_salt: saltHex,
      pw_hash: await pbkdf2(password, saltHex),
      ip_hash: ipHash,
    })
    .select("id, content, created_at")
    .single();

  if (error) return fail("db_error", error.message, 500);
  return json({ ok: true, memo: data });
}

async function handleDelete(body: any) {
  const id = String(body.id ?? "");
  const password = String(body.password ?? "");
  if (!id || !password) return fail("bad_request", "id/비밀번호가 필요합니다.");

  const sb = db();
  const { data: memo, error } = await sb
    .from("memos")
    .select("id, pw_salt, pw_hash")
    .eq("id", id)
    .maybeSingle();

  if (error) return fail("db_error", error.message, 500);
  if (!memo) return fail("not_found", "이미 삭제된 메모입니다.", 404);

  const isMaster = equals(password, MASTER_PASSWORD);
  const isOwner = equals(await pbkdf2(password, memo.pw_salt), memo.pw_hash);
  if (!isMaster && !isOwner) return fail("wrong_password", "비밀번호가 틀렸습니다.", 403);

  const { error: delErr } = await sb.from("memos").delete().eq("id", id);
  if (delErr) return fail("db_error", delErr.message, 500);
  return json({ ok: true, id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method_not_allowed", "POST 만 지원합니다.", 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("bad_json", "잘못된 요청입니다.");
  }

  try {
    if (body.action === "create") return await handleCreate(req, body);
    if (body.action === "delete") return await handleDelete(body);
    return fail("unknown_action", "알 수 없는 action 입니다.");
  } catch (e) {
    return fail("internal_error", String(e?.message ?? e), 500);
  }
});
