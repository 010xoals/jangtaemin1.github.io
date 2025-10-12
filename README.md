
# Music Portal — Data Pipeline

This toolkit fetches **real data** and writes JSON files the static site can read:
- `data/artists.json`
- `data/songs.json`
- `data/releases.json`

## Sources
- **YouTube**: Playlist items → artists/songs
- **Spotify**: Artists/Tracks by ID (Client Credentials)
- **Google Sheets**: Published CSV → releases.json

## Setup (GitHub Actions, recommended)
1. Copy this folder into your **site repository root** (same repo that has index.html).
2. Commit & push.
3. In GitHub: **Settings → Secrets and variables → Actions → New Repository Secret** and add:
   - `YT_API_KEY`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SHEETS_RELEASES_CSV_URL` (CSV publish URL)
4. (Optional) Edit `config/config.json` to add YouTube playlist IDs and Spotify IDs.
5. Go to **Actions** tab → enable workflows. It will run every 2 hours (and on manual dispatch).

## Local Run (optional)
```bash
npm i
export YT_API_KEY=xxx
export SPOTIFY_CLIENT_ID=xxx
export SPOTIFY_CLIENT_SECRET=yyy
export SHEETS_RELEASES_CSV_URL='https://docs.google.com/spreadsheets/d/.../export?format=csv'
node scripts/build_all.js
```

## Mapping to Site
The static site reads JSON at `/data/*.json`. After workflow runs, the updated files are committed, so Pages redeploy picks them up.
