// scripts/fetch_youtube.js (강화판)
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

function sanitizeId(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');
}

// 채널별 기본 지역/장르 추정 매핑(원하면 config로 분리 가능)
const CHANNEL_HINTS = {
  'jypentertainment': { region: 'KR', genre: 'K-POP' },
  'smtown': { region: 'KR', genre: 'K-POP' },
  '1thek': { region: 'KR', genre: 'K-POP' },
  'hybe-labels': { region: 'KR', genre: 'K-POP' },
  'ado': { region: 'JP', genre: 'J-POP' },
  'ayase-yoasobi': { region: 'JP', genre: 'J-POP' },
  'yoasobi': { region: 'JP', genre: 'J-POP' },
  'taylorswift': { region: 'US', genre: 'POP' },
  'edsheeran': { region: 'US', genre: 'POP' },
  'arianagrande': { region: 'US', genre: 'POP' }
};

async function fetchAllPlaylistItems(playlistId, max = 200) {
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
    if (!res.ok) throw new Error(`YouTube API error (playlistItems): ${res.status}`);
    const data = await res.json();
    const batch = (data.items || []).filter(x => {
      const t = x?.snippet?.title || '';
      return t && t !== 'Private video' && t !== 'Deleted video';
    });
    items = items.concat(batch);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return items;
}

async function fetchVideosMeta(videoIds) {
  const chunk = (arr, n) => arr.length ? [arr.slice(0, n), ...chunk(arr.slice(n), n)] : [];
  const chunks = chunk(videoIds, 50);
  const out = {};
  for (const c of chunks) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails,statistics,snippet');
    url.searchParams.set('id', c.join(','));
    url.searchParams.set('key', API_KEY);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API error (videos): ${res.status}`);
    const data = await res.json();
    for (const v of (data.items || [])) {
      out[v.id] = v;
    }
  }
  return out;
}

function parseTitle(snTitle, channelTitle) {
  let artistName = '';
  let songTitle = snTitle.trim();

  const dash = snTitle.indexOf(' - ');
  if (dash > 0) {
    artistName = snTitle.slice(0, dash).trim();
    songTitle = snTitle.slice(dash + 3).trim();
  } else {
    // fallback: 채널명을 아티스트로 추정
    artistName = channelTitle || 'Unknown';
  }

  // 괄호/공식표기 제거(간단화)
  songTitle = songTitle.replace(/\[(Official|MV|M\/V|Music Video)[^\]]*\]/ig, '').trim();
  songTitle = songTitle.replace(/\((Official|MV|M\/V|Music Video)[^\)]*\)/ig, '').trim();

  return { artistName, songTitle };
}

function isoDurationToSec(iso) {
  // PT#M#S 등 → 초
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  const h = parseInt(m[1] || 0, 10);
  const mi = parseInt(m[2] || 0, 10);
  const s = parseInt(m[3] || 0, 10);
  return h * 3600 + mi * 60 + s;
}

const artistsMap = new Map(); // name -> id
const artists = [];
const songs = [];
const releases = [];

for (const pl of (CONFIG.youtube?.playlists || [])) {
  const items = await fetchAllPlaylistItems(pl.id, 200);

  // 비디오 메타 추가
  const ids = items.map(it => it.contentDetails?.videoId).filter(Boolean);
  const meta = await fetchVideosMeta(ids);

  for (const it of items) {
    const sn = it.snippet || {};
    const videoId = it.contentDetails?.videoId || '';
    const channelTitle = sn.channelTitle || '';
    const { artistName, songTitle } = parseTitle(sn.title || '', channelTitle);

    const artistKey = sanitizeId(artistName);
    if (artistKey && !artistsMap.has(artistName)) {
      artistsMap.set(artistName, artistKey);
      // region/genre 힌트
      const hintKey = sanitizeId(channelTitle).replace(/-official|official|channel/g, '').trim();
      const hint = CHANNEL_HINTS[hintKey] || {};
      artists.push({
        id: artistKey,
        name: artistName,
        country: hint.region || '',
        debut_date: '',
        labels: [],
        slug: artistKey,
        channel: channelTitle
      });
    }

    const aId = artistsMap.get(artistName) || sanitizeId(artistName) || 'unknown';
    const publishedAt = (sn.publishedAt || '').slice(0,10);

    const v = meta[videoId] || {};
    const durSec = isoDurationToSec(v?.contentDetails?.duration);
    const viewCount = Number(v?.statistics?.viewCount || 0);
    const thumbs = v?.snippet?.thumbnails || sn.thumbnails || {};

    const songId = sanitizeId(songTitle) || videoId;

    songs.push({
      id: songId,
      artist_id: aId,
      title: songTitle || sn.title || videoId,
      release_date: publishedAt,
      yt_url: `https://www.youtube.com/watch?v=${videoId}`,
      slug: songId,
      duration_sec: durSec,
      views: viewCount,
      thumbnail: thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || ''
    });

    // releases 자동 생성(시트 보정 없이도 달력에 표시되도록)
    const hintKey = sanitizeId(channelTitle).replace(/-official|official|channel/g, '').trim();
    const region = (CHANNEL_HINTS[hintKey]?.region) || '';
    releases.push({
      song_id: songId,
      region,
      release_at: publishedAt
    });
  }
}

// merge-write helper
async function mergeWrite(file, incoming, key='id') {
  const full = path.join(ROOT, 'data', file);
  let base = [];
  try { base = JSON.parse(await fs.readFile(full, 'utf-8')); } catch {}
  const map = new Map(base.map(x => [x[key], x]));
  for (const obj of incoming) {
    const k = obj[key];
    if (!k) continue;
    map.set(k, { ...map.get(k), ...obj });
  }
  const out = Array.from(map.values());
  await fs.mkdir(path.join(ROOT, 'data'), {recursive:true});
  await fs.writeFile(full, JSON.stringify(out, null, 2));
}

await mergeWrite('artists.json', artists, 'id');
await mergeWrite('songs.json', songs, 'id');

// releases는 song_id+release_at 기준으로 병합
async function mergeReleases(incoming) {
  const full = path.join(ROOT, 'data', 'releases.json');
  let base = [];
  try { base = JSON.parse(await fs.readFile(full, 'utf-8')); } catch {}
  const key = r => `${r.song_id}|${r.release_at}`;
  const map = new Map(base.map(r => [key(r), r]));
  for (const r of incoming) {
    if (!r.song_id || !r.release_at) continue;
    const k = key(r);
    map.set(k, { ...map.get(k), ...r });
  }
  const out = Array.from(map.values());
  await fs.writeFile(full, JSON.stringify(out, null, 2));
}
await mergeReleases(releases);

console.log(`YouTube: ${artists.length} artists, ${songs.length} songs, ${releases.length} releases (merged).`);
