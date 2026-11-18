// Encode every captured clip (frames + timestamps JSON) to OUT_DIR/<name>.mp4
const fs = require('fs'); const path = require('path');
const { encode } = require('./recorder.cjs');
const only = process.argv.slice(2);
const names = fs.readdirSync(process.env.FRAMES_ROOT).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  .filter((n) => !only.length || only.includes(n)).sort((a, b) => Number(a) - Number(b));
for (const n of names) {
  if (fs.existsSync(path.join(process.env.OUT_DIR, `${n}.mp4`)) && !only.length) { console.log(`skip ${n} (exists)`); continue; }
  encode(n, JSON.parse(fs.readFileSync(path.join(process.env.FRAMES_ROOT, `${n}.json`))));
}
