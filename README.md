# Wimblebronx

Tennis match days and leagues for any group. No sign-up: create an event, share the link.

- **Match day (Americano):** partners rotate every round, fair sit-outs, multiple courts, live leaderboard.
- **League:** seasons, 3/1 points table, doubles randomizer, history.
- **Live scoring** point by point on any number of courts at once, with serve/break/deuce stats and a momentum chart.
- **Instagram story:** end-of-day results (podium, standings, scores) drawn over your own photo.

## Access model

Each event has a **view link** (`#/e/<code>`) and an **organizer link** (`#/e/<code>?k=<key>`).
Only the key's hash is stored. All writes go through the `admin_op` database function, which checks the key;
the tables themselves are closed to the public key.

## Setup

1. Supabase → SQL Editor → run `supabase/001_events.sql`.
2. (Optional, once) run `supabase/002_import_legacy.sql` to copy the original Wimblebronx league into a v2 league.
   **Save the `key` it prints** — your organizer link is `<site>/#/e/<slug>?k=<key>`.
3. Deploy the `app/` folder. Live site: https://wimblebronx.netlify.app (Netlify, uploaded directly):
   `git archive HEAD app | tar -x -C /tmp && npx netlify-cli deploy --prod --dir /tmp/app --site wimblebronx`
   (archiving from git keeps the untracked `_mock.*` test files out of the deploy).

## Code

| File | What |
| --- | --- |
| `app/js/api.js` | App state, RPC calls, organizer keys, realtime refresh |
| `app/js/app.js` | Router, home, create forms |
| `app/js/day.js` / `league.js` | Match-day and league screens |
| `app/js/scorer.js` | Live point-by-point scorer, quick score |
| `app/js/stats.js` | Point-log replay → serve/break/deuce stats |
| `app/js/americano.js` | Rotation scheduler |
| `app/js/story.js` / `share.js` | Instagram story renderer and screen |

`app/_mock.html` (git-ignored) runs the app against an in-browser Postgres (PGlite) for local testing:
serve the repo root and open `/app/_mock.html`.
