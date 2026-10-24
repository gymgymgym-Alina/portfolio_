import { fetchJSON, renderProjects } from "../global.js";

const projects = await fetchJSON("../lib/projects.json");
const projectsContainer = document.querySelector(".projects");

renderProjects(projects, projectsContainer, "h2");

/* Step 1.6: show how many projects there are */
const projectsTitle = document.querySelector(".projects-title");

if (projectsTitle) {
  const count = Array.isArray(projects) ? projects.length : 0;
  projectsTitle.textContent = `${count} Projects`;
}
