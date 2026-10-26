# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Organizer:** a club member running a match day or league. Sets up the event on a phone, then keeps score at the court between points, often one-handed, outdoors, in sun.
- **Players and followers:** open the shared view link on their own phones to check the schedule, live scores and standings.
- Primary group is Tennis Klab Wimblebronx (the Bronx group). Other tennis groups should be able to pick it up from a shared link with no sign-up.

## Product Purpose

Run tennis match days and leagues for any group, with no accounts: create an event, share the link. Success means a match day runs from first rotation to final podium on phones alone, and the results end up shared on Instagram.

## Positioning

No sign-up and link-based access: a view link for everyone and an organizer link (key) for scorers. Americano rotation, point-by-point live scoring on many courts at once, and an Instagram story of the results drawn over the group's own photo.

## Operating Context

- Used at the court on phones, installed as a home-screen PWA or opened from a shared link (often inside WhatsApp or Instagram browsers).
- Several phones watch the same event live; only organizer-key holders can write.
- End of day: the organizer makes the IG story and posts it.

## Capabilities and Constraints

- **Match day (Americano):** partners rotate every round, fair sit-outs, multiple courts, live leaderboard.
- **League:** seasons, 3/1 points table, doubles randomizer, history.
- **Live scoring:** point by point, serve/break/deuce stats, momentum chart; quick score as an alternative.
- **Instagram story:** podium, standings and scores over a user photo, several layouts.
- **Stack:** static HTML/CSS/vanilla JS in `app/`, no build step; Supabase (Postgres RPC `admin_op`, realtime); deployed by Netlify on push to `main`.
- **Access:** view link `#/e/<code>`, organizer link `#/e/<code>?k=<key>`; only the key hash is stored.

## Brand Commitments

- **Name:** Wimblebronx (club: Tennis Klab Wimblebronx).
- **Logo:** always the club badge (`app/icon-512.png`, `app/icon-192.png`) wherever the brand appears. No emoji or text-only logo.
- **Home tagline:** "Tennis Tracker for Bronxpeople!" stays exactly as written.

## Evidence on Hand

- Club badge PNGs in `app/`.
- Real league history imported from the original Wimblebronx league (`supabase/002_import_legacy.sql`).
- No testimonials, user counts or press exist; do not invent any.

## Product Principles

1. Courtside first: every scoring action works fast on a phone, in sunlight, mid-match.
2. Zero friction to join: a link is enough; never add sign-up walls.
3. Fair and transparent: rotations, sit-outs and standings must be easy to trust at a glance.
4. Club pride travels: the badge and the shared results carry the group's identity outward.

## Accessibility & Inclusion

Outdoor phone use: strong contrast in bright light, large tap targets, and pinch-zoom allowed (double-tap zoom blocked to protect fast scoring).
