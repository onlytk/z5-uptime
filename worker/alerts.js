// Every minute: is z5.gg answering? Telegram hears when it goes down and when it's back.
// KV is only written when the state changes (the free plan allows 1,000 writes a day, and the
// five-minute check already takes 288 of them).

const SITE = "https://z5.gg/api/health";
const PAGE = "https://status.z5.gg";
const TRIES = 3;
const RETRY_MS = 10_000;
const TIMEOUT_MS = 10_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Three tries, ten seconds apart: one slow answer or a deploy's restart isn't an outage. */
async function check(env) {
  let code = 0;
  let detail = "";
  for (let i = 0; i < TRIES; i++) {
    try {
      const res = await fetch(env.SITE ?? SITE, { headers: { "user-agent": "z5-uptime-alerts" }, signal: AbortSignal.timeout(TIMEOUT_MS), cf: { cacheTtl: 0 } });
      code = res.status;
      if (res.ok) return { up: true, code };
      detail = (await res.text()).slice(0, 160);
    } catch (err) {
      code = 0;
      detail = String(err?.message ?? err).slice(0, 160);
    }
    if (i < TRIES - 1) await sleep(RETRY_MS);
  }
  return { up: false, code, detail };
}

const clean = (s) => s.replace(/[<>&]/g, "");

async function telegram(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) {
    console.error("TG_TOKEN or TG_CHAT isn't set; no alert sent");
    return false;
  }
  const res = await fetch(`${env.TG_API ?? "https://api.telegram.org"}/bot${env.TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  return !!res?.ok;
}

export async function alert(env) {
  const site = await check(env);
  const state = site.up ? "up" : "down";
  // what Telegram last heard; unset counts as up, so a first run while it's down still alerts
  const told = (await env.STATE.get("notified")) ?? "up";
  if (told === state) return;
  const text = site.up
    ? `<b>zerofive: z5.gg is back up</b>\nHealth check answers 200 again.\n${PAGE}`
    : `<b>zerofive: z5.gg is down</b>\nHealth check answered ${site.code || "nothing"}, three times in a row. ${clean(site.detail)}\nChecked from Cloudflare, outside our server.\n${PAGE}`;
  // only remembered once Telegram took it, so a failed send is tried again next minute
  if (await telegram(env, text)) await env.STATE.put("notified", state);
}
