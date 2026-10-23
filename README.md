# z5-uptime

The status page for [z5.gg](https://z5.gg), live at [status.z5.gg](https://status.z5.gg). It runs on
GitHub, separate from the z5.gg servers, so it keeps working when they don't.

`.github/workflows/uptime.yml` runs `scripts/check.mjs` on a 5-minute schedule (GitHub can run
scheduled workflows late, or skip them when busy). Each run:

- checks `https://z5.gg/api/health` from outside, three tries before it counts as down
- reads each part of the platform from `https://z5.gg/api/status`: its state, node latency, and block and confirm times measured from z5.gg's own chain readings, hourly for a week
- adds the result to `history.json`: checks per part per UTC day for 90 days, and incidents
- publishes `site/` to GitHub Pages when something changed, when the last publish is 15 minutes
  old, or when the last publish didn't go through

`history.json` lives in the Actions cache between runs. If the cache is lost, the copy on the
published page is restored; if that can't be read either, the run fails instead of starting over.
`.github/workflows/keepalive.yml` re-enables both workflows monthly, so GitHub doesn't switch the
schedule off.

## The page

A React app in `app/`. The workflow builds it into `site/` (with the latest `history.json`) each
time it publishes, so a push to `app/` is live a minute or two later. `site/` isn't committed.

```sh
cd app
pnpm install
pnpm dev     # needs a history.json in app/public to show anything
pnpm build   # writes ../site, to check the build locally
```

`shared/history.mjs` validates `history.json` and is used by both the check script and the page.
`app/src/vendor/` holds two background components from React Bits, as used on z5.gg.

## Alerts

`worker/alerts.js` is a Cloudflare Worker on a one-minute cron that checks `/api/health` (three
tries) and sends the Telegram down and back-up messages, since GitHub's schedule can run 10-20
minutes late. It keeps what Telegram last heard in a KV namespace bound as `STATE`, written only on
a change, and needs the Worker secrets `TG_TOKEN` and `TG_CHAT` (set in Cloudflare, not here). Test it locally with
`pnpm dlx wrangler dev --test-scheduled` and a `.dev.vars` pointing `SITE` and `TG_API` at a mock.
