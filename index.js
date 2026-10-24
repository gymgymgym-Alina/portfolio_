import { fetchJSON, renderProjects, fetchGitHubData } from "./global.js";

/* Step 2: the three most recent projects */
const projects = await fetchJSON("./lib/projects.json");
const latestProjects = Array.isArray(projects) ? projects.slice(0, 3) : [];

renderProjects(latestProjects, document.querySelector(".projects"), "h2");

/* Step 3: GitHub profile stats */
const githubData = await fetchGitHubData("gymgymgym-Alina");
const profileStats = document.querySelector("#profile-stats");

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers</dt><dd>${githubData.followers}</dd>
      <dt>Following</dt><dd>${githubData.following}</dd>
    </dl>
  `;
} else if (profileStats) {
  profileStats.innerHTML = `<p class="placeholder">GitHub stats are unavailable right now.</p>`;
}
