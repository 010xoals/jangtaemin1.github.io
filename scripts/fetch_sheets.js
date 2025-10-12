// Fetch releases from a published Google Sheets CSV and convert to releases.json
// Env: SHEETS_RELEASES_CSV_URL
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const URL_CSV = process.env.SHEETS_RELEASES_CSV_URL;

if (!URL_CSV) {
  console.error('Missing SHEETS_RELEASES_CSV_URL');
  process.exit(1);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(s=>s.trim());
  const rows = lines.slice(1).map(line=>{
    // naive split; assumes commas not in fields
    const cols = line.split(',').map(s=>s.trim());
    const obj = {};
    header.forEach((h,i)=>obj[h] = cols[i] || '');
    return obj;
  });
  return rows;
}

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error('Failed to fetch sheet CSV');
const text = await res.text();
const rows = parseCSV(text);

// Expect columns: song_id, region, release_at
const releases = rows.map(r => ({
  song_id: r.song_id, region: r.region, release_at: r.release_at
}));

await fs.mkdir(path.join(ROOT, 'data'), {recursive:true});
await fs.writeFile(path.join(ROOT,'data','releases.json'), JSON.stringify(releases, null, 2));

console.log(`Sheets: wrote ${releases.length} releases.`);
