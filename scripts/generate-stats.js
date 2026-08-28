const fs = require('fs');

const GITHUB_USERNAME = 'andrip8';

async function fetchGitHubStats(token) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.cloak-preview+json',
  };

  // 1. Fetch commits count (REST search)
  const commitsRes = await fetch(`https://api.github.com/search/commits?q=author:${GITHUB_USERNAME}`, { headers });
  const commitsData = await commitsRes.json();
  const commits = commitsData.total_count || 0;

  // 2. Fetch PRs count
  const prsRes = await fetch(`https://api.github.com/search/issues?q=author:${GITHUB_USERNAME}+type:pr`, { headers });
  const prsData = await prsRes.json();
  const prs = prsData.total_count || 0;

  // 3. Fetch Issues count
  const issuesRes = await fetch(`https://api.github.com/search/issues?q=author:${GITHUB_USERNAME}+type:issue`, { headers });
  const issuesData = await issuesRes.json();
  const issues = issuesData.total_count || 0;

  // 4. Fetch Stars count
  let stars = 0;
  let page = 1;
  while (true) {
    const reposRes = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&page=${page}`, { headers });
    const repos = await reposRes.json();
    if (!repos || repos.length === 0) break;
    stars += repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    if (repos.length < 100) break;
    page++;
  }

  return { commits, prs, stars, issues };
}

async function fetchWakaTimeStats(apiKey) {
  if (!apiKey) return null;
  const auth = Buffer.from(apiKey).toString('base64');
  const res = await fetch('https://wakatime.com/api/v1/users/current/stats/all_time', {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function generateSVG(github, waka) {
  const wakaTitle = waka ? `All time · ${waka.human_readable_total}` : 'Coding time stats currently unavailable';
  const wakaLangs = waka ? waka.languages.slice(0, 8) : [];
  
  let langRows = '';
  let y = 135;
  wakaLangs.forEach(lang => {
    const percentage = lang.percent.toFixed(1);
    const barWidth = Math.round((lang.percent / 100) * 200);
    langRows += `
    <!-- ${lang.name} -->
    <text x="20" y="${y + 12}" class="monospace font-normal text-main">${lang.name}</text>
    <rect x="150" y="${y + 3}" width="200" height="10" rx="5" ry="5" class="progress-bg" />
    <rect x="150" y="${y + 3}" width="${barWidth}" height="10" rx="5" ry="5" class="progress-bar" />
    <text x="365" y="${y + 12}" class="monospace font-normal text-percentage">${percentage}%</text>
    `;
    y += 26;
  });

  const svgHeight = y + 20;

  return `<svg width="450" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .monospace { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }
    .font-normal { font-weight: 400; }
    .text-title { font-size: 24px; }
    .text-label { font-size: 13px; }
    .text-main { font-size: 13px; }
    .text-percentage { font-size: 13px; }
    
    @media (prefers-color-scheme: dark) {
      .text-title { fill: #c9d1d9; }
      .text-label { fill: #8b949e; }
      .text-main { fill: #c9d1d9; }
      .text-percentage { fill: #8b949e; }
      .progress-bg { fill: #21262d; }
      .progress-bar { fill: #c9d1d9; }
    }
    @media (prefers-color-scheme: light) {
      .text-title { fill: #24292f; }
      .text-label { fill: #57606a; }
      .text-main { fill: #24292f; }
      .text-percentage { fill: #57606a; }
      .progress-bg { fill: #afb8c1; fill-opacity: 0.2; }
      .progress-bar { fill: #24292f; }
    }
  </style>
  
  <!-- Column 1: Commits -->
  <text x="20" y="45" class="monospace font-bold text-title">${formatNumber(github.commits)}</text>
  <text x="20" y="65" class="monospace font-normal text-label">commits</text>
  
  <!-- Column 2: PRs -->
  <text x="140" y="45" class="monospace font-bold text-title">${formatNumber(github.prs)}</text>
  <text x="140" y="65" class="monospace font-normal text-label">prs</text>
  
  <!-- Column 3: Stars -->
  <text x="250" y="45" class="monospace font-bold text-title">${formatNumber(github.stars)}</text>
  <text x="250" y="65" class="monospace font-normal text-label">stars</text>
  
  <!-- Column 4: Issues -->
  <text x="350" y="45" class="monospace font-bold text-title">${formatNumber(github.issues)}</text>
  <text x="350" y="65" class="monospace font-normal text-label">issues</text>
  
  <!-- WakaTime Title -->
  <text x="20" y="110" class="monospace font-bold text-main">${wakaTitle}</text>
  
  ${langRows}
</svg>`;
}

async function main() {
  const ghToken = process.env.GH_TOKEN;
  const wakaKey = process.env.WAKATIME_API_KEY;

  if (!ghToken) {
    console.error('Error: GH_TOKEN secret is required');
    process.exit(1);
  }

  try {
    console.log('Fetching GitHub stats...');
    const github = await fetchGitHubStats(ghToken);
    
    console.log('Fetching WakaTime stats...');
    const waka = await fetchWakaTimeStats(wakaKey);
    
    console.log('Generating SVG...');
    const svg = generateSVG(github, waka);
    
    fs.writeFileSync('stats.svg', svg);
    console.log('Success! stats.svg generated.');
  } catch (error) {
    console.error('Execution failed:', error);
    process.exit(1);
  }
}

main();
