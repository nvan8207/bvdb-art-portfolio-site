/**
 * build-works-json.js
 *
 * Netlify build plugin — runs automatically on every deploy.
 * Reads all artwork files saved by Decap CMS from
 * site_files/_artworks/ and compiles them into a single
 * site_files/works.json file that the gallery fetches.
 *
 * HOW TO USE:
 * Place this file at: netlify/build-works-json.js
 * Add the netlify.toml config (see netlify.toml file) to
 * the root of your repository.
 *
 * Decap saves each artwork as a Markdown file with YAML
 * frontmatter, like this:
 *
 *   ---
 *   title: The Empress
 *   medium: Watercolour
 *   year: 2024
 *   width: 38
 *   height: 56
 *   description: A figurative study...
 *   image: /images/works/the-empress.jpg
 *   featured: true
 *   tags:
 *     - watercolour
 *   ---
 *
 * This script parses those files and outputs works.json.
 */

const fs   = require('fs');
const path = require('path');

module.exports = {
  onPreBuild: ({ utils }) => {
    const artworksDir = path.join(__dirname, '..', 'site_files', '_artworks');
    const outputFile  = path.join(__dirname, '..', 'site_files', 'works.json');

    // If no artworks directory exists yet, write an empty array and exit
    if (!fs.existsSync(artworksDir)) {
      console.log('No _artworks directory found — writing empty works.json');
      fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
      return;
    }

    const files = fs.readdirSync(artworksDir)
      .filter(f => f.endsWith('.md') || f.endsWith('.yml') || f.endsWith('.yaml'));

    if (files.length === 0) {
      console.log('No artwork files found — writing empty works.json');
      fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
      return;
    }

    const works = [];

    for (const file of files) {
      const filePath = path.join(artworksDir, file);
      const content  = fs.readFileSync(filePath, 'utf8');

      try {
        // Parse YAML frontmatter (between --- delimiters)
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;

        const yaml    = frontmatterMatch[1];
        const artwork = {};

        // Parse each line of the frontmatter
        const lines = yaml.split('\n');
        let currentKey = null;
        let inList = false;

        for (const line of lines) {
          // List item (e.g. "  - watercolour")
          if (line.trim().startsWith('- ') && inList && currentKey) {
            if (!Array.isArray(artwork[currentKey])) artwork[currentKey] = [];
            artwork[currentKey].push(line.trim().slice(2).trim());
            continue;
          }

          // Key: value pair
          const kvMatch = line.match(/^(\w+):\s*(.*)/);
          if (kvMatch) {
            currentKey = kvMatch[1];
            const val  = kvMatch[2].trim();

            if (val === '') {
              // Empty value — might be start of a list
              artwork[currentKey] = [];
              inList = true;
            } else if (val === 'true') {
              artwork[currentKey] = true;
              inList = false;
            } else if (val === 'false') {
              artwork[currentKey] = false;
              inList = false;
            } else if (!isNaN(val) && val !== '') {
              artwork[currentKey] = Number(val);
              inList = false;
            } else {
              // Strip surrounding quotes if present
              artwork[currentKey] = val.replace(/^["']|["']$/g, '');
              inList = false;
            }
          }
        }

        if (artwork.title) works.push(artwork);

      } catch (err) {
        console.warn(`Could not parse ${file}:`, err.message);
      }
    }

    // Sort: featured first, then by year descending
    works.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return (b.year || 0) - (a.year || 0);
    });

    fs.writeFileSync(outputFile, JSON.stringify(works, null, 2));
    console.log(`✓ works.json written — ${works.length} artwork(s) compiled.`);
  }
};
