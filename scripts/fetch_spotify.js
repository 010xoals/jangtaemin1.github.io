// Fetch artists/tracks via Spotify Client Credentials
// Env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(await fs.readFile(path.join(ROOT, 'config', 'config.json'), 'utf-8'));

const CID = process.env.SPOTIFY_CLIENT_ID;
const SECRET = process.env.SPOTIFY_CLIENT_SECRET;
if (!CID || !SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  process.exit(1);
}

async function getToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CID, client_secret: SECRET })
  });
  const data = await res.json();
  return data.access_token;
}

const token = await getToken();
const H = { 'Authorization': `Bearer ${token}` };

function sanitizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/\-+/g, '-').replace(/^\-|\-$/g, '');
}

async function getArtists(ids) {
  if (ids.length === 0) return [];
  const url = `https://api.spotify.com/v1/artists?ids=${ids.join(',')}`;
  const res = await fetch(url, { headers: H });
  const data = await res.json();
  return (data.artists||[]).map(a => ({
    id: sanitizeId(a.name),
    name: a.name,
    country: '', // unknown from Spotify
    debut_date: '', labels: [],
    slug: sanitizeId(a.name),
    spotify_id: a.id,
    genres: a.genres
  }));
}

async function getTracks(ids) {
  if (ids.length === 0) return [];
  const url = `https://api.spotify.com/v1/tracks?ids=${ids.join(',')}`;
  const res = await fetch(url, { headers: H });
  const data = await res.json();
  return (data.tracks||[]).map(t => ({
    id: sanitizeId(t.name),
    artist_id: sanitizeId(t.artists?.[0]?.name || 'unknown'),
    title: t.name,
    release_date: (t.album?.release_date)||'',
    yt_url: '', // can be filled via YouTube later
    slug: sanitizeId(t.name),
    spotify_id: t.id
  }));
}

const artists = await getArtists(CONFIG.spotify.artist_ids || []);
const tracks = await getTracks(CONFIG.spotify.track_ids || []);

await fs.mkdir(path.join(ROOT, 'data'), {recursive:true});
async function mergeWrite(file, incoming, key='id') {
  const full = path.join(ROOT, 'data', file);
  let base = [];
  try { base = JSON.parse(await fs.readFile(full, 'utf-8')); } catch {}
  const map = new Map(base.map(x=>[x[key], x]));
  for (const obj of incoming) map.set(obj[key], {...map.get(obj[key]) , ...obj});
  const out = Array.from(map.values());
  return fs.writeFile(full, JSON.stringify(out, null, 2));
}

await mergeWrite('artists.json', artists, 'id');
await mergeWrite('songs.json', tracks, 'id');

console.log(`Spotify: wrote ${artists.length} artists, ${tracks.length} tracks (merged).`);
