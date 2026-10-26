// The status page for z5.gg, on Cloudflare so it doesn't depend on z5.gg's servers or GitHub's schedule.
//
//   every minute       alerts.js: health check, Telegram when z5.gg goes down or comes back
//   every five minutes check.js: full check, written to KV as the history the page reads
//   status.z5.gg       the built page from ../site, and /history.json straight from KV
//
// Bindings: KV namespace STATE, assets ASSETS, secrets TG_TOKEN and TG_CHAT.
// SITE and TG_API can point elsewhere, for testing.
import { alert } from "./alerts.js";
import { check, HISTORY } from "./check.js";

const CHECK_EVERY_MIN = 5;

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/history.json") return env.ASSETS.fetch(request);
    const history = await env.STATE.get(HISTORY);
    if (history === null) return new Response("history unavailable", { status: 503, headers: { "cache-control": "no-store" } });
    return new Response(history, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  },

  // one cron, every minute: with a second "*/5" cron, Cloudflare only ran one of them on the minutes both matched
  async scheduled(event, env, ctx) {
    ctx.waitUntil(alert(env));
    if (new Date(event.scheduledTime).getUTCMinutes() % CHECK_EVERY_MIN === 0) ctx.waitUntil(check(env));
  },
};
