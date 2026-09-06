# Broadway Teachers

Static site for the Broadway Ward Teachers Quorum: upcoming events, sacrament
assignments, this week's reading, quorum skill goals, and service projects.

- `index.html` — the page (plain HTML/CSS/JS, no build step)
- `events.json` — event data, kept in sync with the "Teachers Quorum
  Activities" Google Calendar; `index.html` fetches it at load and shows
  whatever falls in the next 14 days

Deployed on Vercel; pushes to `main` redeploy automatically.
