const fs   = require('fs');
const path = require('path');

const artworksDir = path.join(__dirname, '..', 'site_files', '_artworks');
const outputFile  = path.join(__dirname, '..', 'site_files', 'works.json');

// If no artworks directory exists yet, write empty array and exit
if (!fs.existsSync(artworksDir)) {
  console.log('No _artworks directory — writing empty works.json');
  fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
  process.exit(0);
}

const files = fs.readdirSync(artworksDir)
  .filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.log('No artwork files yet — writing empty works.json');
  fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
  process.exit(0);
}

const works = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(artworksDir, file), 'utf8');
  try {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const artwork = {};
    const lines = match[1].split('\n');
    let currentKey = null;

    for (const line of lines) {
      if (line.trim().startsWith('- ') && currentKey) {
        if (!Array.isArray(artwork[currentKey])) artwork[currentKey] = [];
        artwork[currentKey].push(line.trim().slice(2).trim());
        continue;
      }
      const kv = line.match(/^(\w+):\s*(.*)/);
      if (kv) {
        currentKey = kv[1];
        const val  = kv[2].trim();
        if      (val === '')      { artwork[currentKey] = []; }
        else if (val === 'true')  { artwork[currentKey] = true; }
        else if (val === 'false') { artwork[currentKey] = false; }
        else if (!isNaN(val))    { artwork[currentKey] = Number(val); }
        else                      { artwork[currentKey] = val.replace(/^["']|["']$/g, ''); }
      }
    }

    if (artwork.title) works.push(artwork);
  } catch(e) {
    console.warn(`Skipping ${file}:`, e.message);
  }
}

// Sort: featured first, then newest first
works.sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return (b.year || 0) - (a.year || 0);
});

fs.writeFileSync(outputFile, JSON.stringify(works, null, 2));
console.log(`✓ works.json — ${works.length} artwork(s) compiled.`);
