# Sheet sync setup

Pulling needs nothing — it reads the sheet's public CSV export. Only **pushing**
needs the steps below, because writing to a Google Sheet requires credentials.

## What you need to do

### 1. Create a service account (Google Cloud console, ~5 min)

1. Go to <https://console.cloud.google.com/> and create a project (any name,
   e.g. `mtg-builder-sync`).
2. **APIs & Services → Library →** search "Google Sheets API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it anything (e.g. `mtg-builder`), skip the optional role/access steps,
   and click Done.
4. Open the service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. Keep it somewhere stable, e.g.
   `~/.config/mtg-builder/service-account.json`. Treat it like a password.

### 2. Share the spreadsheet with the service account

1. Open the JSON key and copy the `client_email` value — it looks like
   `mtg-builder@your-project.iam.gserviceaccount.com`.
2. In the playgroup spreadsheet, click **Share**, paste that address, set the
   role to **Editor**, and send. (This is the one step that needs whoever owns
   the doc; it's the same as adding any collaborator.)

### 3. Point the app at the key

In the app: **Import/Export screen → Playgroup sheet → Set service-account
key**, and pick the JSON file. Confirm "Your name in the sheet" says `Bryan` —
it must match column A exactly (the EDICIONES roster already lists Bryan).

## Using it

- **Pull others' decks** — reads MAZOS and EDICIONES, replaces the local copy of
  everyone else's decks. Available from the sync section or the "Others' Decks"
  view. No credentials needed.
- **Push my decks…** — shows a preview of every row it would add, change, or
  clear. Nothing is written until you press **Write N rows**.

## Safety properties worth knowing

- Only rows whose Jugador is your configured name are ever written, plus new
  rows appended below the last used row. The main process re-checks each target
  row's current contents immediately before writing and aborts if anything moved
  since the preview.
- Only columns A:D of MAZOS are touched. ESTADÍSTICAS, RESUMEN, and EDICIONES
  are never written; they recalculate themselves.
- Rows are never inserted or deleted (that would shift the stats formulas'
  `$2:$2001` ranges) — a removed deck's row is cleared in place.
- Decks whose sets don't match any sheet block are listed as unmapped and
  skipped, with a dropdown to assign the right block. That assignment sticks.

## Limitations

- The sheet stores deck metadata only (player, block, colors, name) — no card
  lists, so pulled decks are read-only entries, not real decks.
- Renaming a deck shows up in the preview as a clear plus an add, because the
  sheet has no deck id to match on. It is visible before you confirm.
- Pulling requires the doc to stay link-viewable ("anyone with the link can
  view"). If the group restricts it, pull will report that clearly.
