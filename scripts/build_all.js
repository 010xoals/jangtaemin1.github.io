// scripts/build_all.js
import { exec as _exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const exec = promisify(_exec);

async function run(cmd){
  console.log('> ' + cmd);
  const { stdout, stderr } = await exec(cmd, { env: process.env });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

const config = JSON.parse(await fs.readFile('config/config.json','utf-8'));
const hasYoutubePlaylists = Array.isArray(config.youtube?.playlists) && config.youtube.playlists.length > 0;
const hasYTKey = !!process.env.YT_API_KEY;

// ▶ YouTube: 플레이리스트가 없거나 키가 없으면 건너뜀
if (hasYoutubePlaylists && hasYTKey) {
  await run('node scripts/fetch_youtube.js');
} else {
  console.log('Skip YouTube fetch: no playlists or YT_API_KEY missing');
}

// ▶ Spotify: 키 없으면 건너뜀
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
  await run('node scripts/fetch_spotify.js');
} else {
  console.log('Skip Spotify fetch: no credentials');
}

// ▶ Sheets: 반드시 실행 (우리는 이걸로 releases.json 갱신)
await run('node scripts/fetch_sheets.js');

console.log('Build complete: data/*.json refreshed (conditional).');
