// netlify/functions/scheduled-deploy.js
// Runs at midnight UTC every day.
// Only triggers a deploy if Decap CMS artwork files
// have changed in GitHub since the last Netlify deploy.

const { schedule } = require("@netlify/functions");

const handler = schedule("0 0 * * *", async () => {
  const GITHUB_REPO  = process.env.GITHUB_REPO;       // e.g. "nvan8207/bvdb-art-portfolio-site"
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;       // personal access token
  const BUILD_HOOK   = process.env.BUILD_HOOK_URL;     // netlify build hook URL
  const NETLIFY_SITE = process.env.NETLIFY_SITE_ID;    // netlify site ID
  const NETLIFY_TOKEN= process.env.NETLIFY_TOKEN;      // netlify personal access token

  try {
    // Step 1 — get the timestamp of the last successful Netlify production deploy
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE}/deploys?per_page=5`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );
    const deploys = await deployRes.json();
    const lastDeploy = deploys.find(d => d.state === 'ready' && d.context === 'production');

    if (!lastDeploy) {
      // No previous deploy found — deploy anyway to be safe
      console.log('No previous deploy found — triggering deploy.');
      await fetch(BUILD_HOOK, { method: 'POST' });
      return { statusCode: 200 };
    }

    const lastDeployTime = new Date(lastDeploy.created_at).toISOString();
    console.log('Last deploy:', lastDeployTime);

    // Step 2 — check GitHub for any commits touching _artworks/ since last deploy
    const commitsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits?path=site_files/_artworks&since=${lastDeployTime}&per_page=1`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'netlify-function' } }
    );
    const commits = await commitsRes.json();

    if (Array.isArray(commits) && commits.length > 0) {
      // Changes found — deploy
      console.log(`${commits.length} artwork change(s) found since last deploy — triggering deploy.`);
      await fetch(BUILD_HOOK, { method: 'POST' });
    } else {
      // No changes — skip
      console.log('No artwork changes since last deploy — skipping.');
    }

    return { statusCode: 200 };

  } catch (err) {
    console.error('Scheduled deploy check failed:', err);
    return { statusCode: 500 };
  }
});

module.exports = { handler };
