// scripts/fetch_sheets.js
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

// naive but robust-ish CSV: supports comma/semicolon/tab, quoted fields
function smartSplit(line, sep) {
  const out = [];
  let cur = '', inQ = false;
  for (let i=0;i<line.length;i++){
    const c = line[i];
    if (c === '"'){ inQ = !inQ; cur += c; continue; }
    if (!inQ && c === sep){ out.push(cur.trim()); cur=''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out.map(s => {
    // strip quotes
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1,-1);
    return s;
  });
}

function detectSep(firstLine){
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
  return ','; // default
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length>0);
  if (!lines.length) return [];
  const sep = detectSep(lines[0]);
  const header = smartSplit(lines[0], sep).map(h => h.toLowerCase().trim());
  const rows = lines.slice(1).map(line => {
    const cols = smartSplit(line, sep);
    const obj = {};
    header.forEach((h,i) => obj[h] = cols[i] ?? '');
    return obj;
  });
  return rows;
}

function mapHeader(obj){
  // support Korean headers too
  const out = {
    song_id: obj.song_id ?? obj['곡id'] ?? obj['곡 id'] ?? obj['곡'] ?? '',
    region: obj.region ?? obj['지역'] ?? '',
    release_at: obj.release_at ?? obj['발매일'] ?? obj['발매 일'] ?? obj['출시일'] ?? ''
  };
  return out;
}

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error('Failed to fetch sheet CSV');
const text = await res.text();
const rawRows = parseCSV(text);
const releases = rawRows.map(mapHeader).filter(r => r.song_id || r.region || r.release_at);

await fs.mkdir(path.join(ROOT, 'data'), {recursive:true});
await fs.writeFile(path.join(ROOT,'data','releases.json'), JSON.stringify(releases, null, 2));

console.log(`Sheets: wrote ${releases.length} releases.`);
