# Public tag portals (canonical URLs + Cloudflare)

Postiz can expose **public post feeds** at canonical paths (published posts, and optionally **drafts** on website-only channels — see below):

- **API:** `GET /public/portal/:slug?page=0&limit=20`
- **Web UI:** `https://<FRONTEND_URL>/portal/<slug>`

Which slugs exist and how they filter tags is configured on the **backend** with `PUBLIC_PORTAL_SLUGS` (JSON). See `.env.example`.

## Configure Postiz

Set `PUBLIC_PORTAL_SLUGS` to a JSON object keyed by slug (must match `[a-zA-Z0-9_-]+`):

```json
{
  "social": {
    "organizationId": "YOUR_ORG_UUID",
    "title": "Social"
  },
  "comics": {
    "organizationId": "YOUR_ORG_UUID",
    "tags": ["Comic"],
    "title": "Comics"
  }
}
```

- **`organizationId`:** required; must match the org that owns the posts.
- **`tags`:** optional; if present, posts must include **all** listed tags (names matched case-insensitively within that org).
- **`title`:** optional; shown as the portal heading (defaults to the slug).
- **`draftChannelIds`:** optional; array of **integration** IDs (cuid strings) for channels you treat as “website only” (e.g. a junk Slack/Discord or any connected account you only use for this). **`DRAFT`** posts assigned to one of these integrations are included on the portal **in addition to** normal **`PUBLISHED`** posts. The same **`tags`** rules apply when `tags` is set (the draft must carry all of those org tags). **`QUEUE`** / other states are not exposed.

**Workflow:** connect a channel in Postiz, copy its **integration id** (from API responses, DB, or your team’s tooling), add it to `draftChannelIds` for the right portal slug, restart the backend. Create posts as **drafts** on that channel, add org tags if the portal slug filters by tags. They appear on `/portal/...` without needing to publish to your main social accounts.

**Caution:** Anything listed in `draftChannelIds` can expose **draft** content publicly for that portal. Use a dedicated integration and keep the id out of public repos.

Restart the backend after changing env.

## Cloudflare: vanity hostnames

For the lowest maintenance setup, use **redirects** from friendly domains to the canonical Postiz URL (same path on your main `FRONTEND_URL`).

Examples (replace hosts and apex app URL):

| Source hostname      | Target URL                                      |
|---------------------|-------------------------------------------------|
| `social.co2t.earth` | `https://app.co2t.earth/portal/social`        |
| `comics.co2t.earth` | `https://app.co2t.earth/portal/comics`        |

In **Cloudflare** → your zone → **Rules** → **Redirect Rules** (or **Bulk Redirects**):

1. Create a rule: *If* hostname equals `comics.co2t.earth`, *Then* static redirect to `https://app.co2t.earth/portal/comics` (301 once stable).
2. Repeat per portal hostname.

**Note:** With redirects, the browser address bar will show the target URL (`app.co2t.earth/...`) after navigation. Keeping the vanity host in the bar requires a reverse-proxy rewrite and extra tuning; redirects stay simpler to operate.

## Frontend auth bypass (optional)

If you use Next middleware that redirects unauthenticated users, allow `/portal/*` the same way as `/p/*` (see `apps/frontend/src/proxy.ts` for the intended allowlist pattern).
