# z5-uptime

The status page for [z5.gg](https://z5.gg), live at [status.z5.gg](https://status.z5.gg). It runs as
a Cloudflare Worker (`worker/`), separate from the z5.gg servers, so it keeps working when they don't.

Every five minutes `worker/check.js`:

- checks `https://z5.gg/api/health` from outside, three tries before it counts as down
- reads each part of the platform from `https://z5.gg/api/status`: its state, node latency, and block and confirm times measured from z5.gg's own chain readings, hourly for a week
- adds the result to the history: checks per part per UTC day for 90 days, and incidents

The history is one JSON value in the KV namespace bound as `STATE`, under `history`, and the Worker
serves it as `status.z5.gg/history.json`, so the page is current as soon as a check finishes. If the
value is missing or malformed the check fails instead of starting over, and `/history.json` answers
503. A fresh setup needs it seeded by hand:

```sh
echo '{"components":{},"incidents":[],"last":null}' > history.json   # or a saved copy
cf kv keys update history --namespace-id 2510a660cf7f478384fdaece6dd42f50 --file history.json
```

## The page

A React app in `app/`, built into `site/` and deployed as the Worker's static assets. `site/` isn't
committed.

```sh
cd app
pnpm install
pnpm dev     # needs a history.json in app/public to show anything
pnpm build   # writes ../site
```

`shared/history.mjs` validates `history.json` and is used by both the check and the page.
`app/src/vendor/` holds two background components from React Bits, as used on z5.gg.

## Alerts

Every minute `worker/alerts.js` checks `/api/health` (three tries) and sends the Telegram down and
back-up messages. It keeps what Telegram last heard in `STATE` under `notified`, written only on a
change, and needs the Worker secrets `TG_TOKEN` and `TG_CHAT` (set in Cloudflare, not here).

## Deploying

`.github/workflows/deploy.yml` builds the page and runs `wrangler deploy` on every push to `app/`,
`shared/` or `worker/`. It needs the repo secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts and KV edit,
plus Workers Routes on z5.gg for the custom domain) and `CLOUDFLARE_ACCOUNT_ID`. Nothing on GitHub is
scheduled; the checks run on the Worker's cron.

Test locally after `pnpm build` in `app/`:

```sh
cd worker
pnpm dlx wrangler dev --test-scheduled
curl "localhost:8787/__scheduled?time=1767225600000"   # a minute divisible by five: alerts and a check
curl localhost:8787/history.json
```

The local KV starts empty; seed it first with
`pnpm dlx wrangler kv key put history --path ../history.json --binding STATE --local`.
A `.dev.vars` can point `SITE` and `TG_API` at mocks.
