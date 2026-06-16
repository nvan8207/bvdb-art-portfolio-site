// netlify/functions/scheduled-deploy.js
// Runs at midnight UTC every day.
// Only triggers a deploy if Decap CMS artwork files
// have changed in GitHub since the last Netlify deploy.

export default async () => {
  const GITHUB_REPO   = process.env.GITHUB_REPO;
  const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
  const BUILD_HOOK    = process.env.BUILD_HOOK_URL;
  const NETLIFY_SITE  = process.env.NETLIFY_SITE_ID;
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;

  try {
    // Step 1 — get timestamp of last successful production deploy
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE}/deploys?per_page=5`,
      { headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` } }
    );
    const deploys = await deployRes.json();
    const lastDeploy = deploys.find(d => d.state === 'ready' && d.context === 'production');

    if (!lastDeploy) {
      console.log('No previous deploy found — triggering deploy.');
      await fetch(BUILD_HOOK, { method: 'POST' });
      return;
    }

    const lastDeployTime = new Date(lastDeploy.created_at).toISOString();
    console.log('Last deploy:', lastDeployTime);

    // Step 2 — check GitHub for artwork commits since last deploy
    const commitsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits?path=site_files/_artworks&since=${lastDeployTime}&per_page=1`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'netlify-function' } }
    );
    const commits = await commitsRes.json();

    if (Array.isArray(commits) && commits.length > 0) {
      console.log(`Artwork changes found — triggering deploy.`);
      await fetch(BUILD_HOOK, { method: 'POST' });
    } else {
      console.log('No artwork changes — skipping deploy.');
    }

  } catch (err) {
    console.error('Scheduled deploy check failed:', err);
  }
};

export const config = {
  schedule: '0 0 * * *'
};
