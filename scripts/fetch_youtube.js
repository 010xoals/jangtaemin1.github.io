// Fetch videos from specified playlists and map to songs.json schema
// Uses simple fetch; run on GitHub Actions (no CORS issues).
// Env: YT_API_KEY
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(await fs.readFile(path.join(ROOT, 'config', 'config.json'), 'utf-8'));
const API_KEY = process.env.YT_API_KEY;

if (!API_KEY) {
  console.error('Missing YT_API_KEY');
  process.exit(1);
}

async function fetchPlaylistItems(playlistId, max=50) {
  let items = [];
  let pageToken = '';
  while (items.length < max) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('playlistId', playlistId);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    url.searchParams.set('key', API_KEY);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    const data = await res.json();
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return items;
}

function sanitizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/\-+/g, '-').replace(/^\-|\-$/g, '');
}

const artistsMap = new Map(); // name -> id
const artists = [];
const songs = [];

for (const pl of CONFIG.youtube.playlists) {
  const vids = await fetchPlaylistItems(pl.id, 100);
  for (const it of vids) {
    const sn = it.snippet;
    if (!sn || sn.title === 'Private video' || sn.title === 'Deleted video') continue;
    const title = sn.title;
    // Heuristic: Try to split "Artist - Song"
    let artistName = 'Unknown';
    let songTitle = title;
    const dash = title.indexOf(' - ');
    if (dash > 0) {
      artistName = title.slice(0, dash).trim();
      songTitle = title.slice(dash + 3).trim();
    }

    if (!artistsMap.has(artistName)) {
      const id = sanitizeId(artistName);
      artistsMap.set(artistName, id);
      artists.push({
        id,
        name: artistName,
        country: '', debut_date: '', labels: [], slug: id
      });
    }
    const artist_id = artistsMap.get(artistName);
    const videoId = sn.resourceId?.videoId || sn.videoId || '';
    const publishedAt = sn.publishedAt?.slice(0,10) || '';

    songs.push({
      id: sanitizeId(songTitle) || videoId,
      artist_id,
      title: songTitle,
      release_date: publishedAt,
      yt_url: `https://www.youtube.com/watch?v=${videoId}`,
      slug: sanitizeId(songTitle) || videoId
    });
  }
}

// Merge with existing data if present
function mergeWrite(file, incoming, key='id') {
  const full = path.join(ROOT, 'data', file);
  let base = [];
  try { base = JSON.parse(fs.readFileSync(full, 'utf-8')); } catch {}
  const map = new Map(base.map(x=>[x[key], x]));
  for (const obj of incoming) map.set(obj[key], {...map.get(obj[key]) , ...obj});
  const out = Array.from(map.values());
  return fs.writeFile(full, JSON.stringify(out, null, 2));
}

await fs.mkdir(path.join(ROOT, 'data'), {recursive:true});
await mergeWrite('artists.json', artists, 'id');
await mergeWrite('songs.json', songs, 'id');

console.log(`YouTube: wrote ${artists.length} artists, ${songs.length} songs (merged).`);
