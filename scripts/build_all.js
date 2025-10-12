import { exec as _exec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(_exec);

async function run(cmd){
  console.log('> ' + cmd);
  const { stdout, stderr } = await exec(cmd, { env: process.env });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

await run('node scripts/fetch_youtube.js');
await run('node scripts/fetch_spotify.js');
await run('node scripts/fetch_sheets.js');
console.log('Build complete: data/*.json refreshed.');
