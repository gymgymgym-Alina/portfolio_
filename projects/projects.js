import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { fetchJSON, renderProjects } from "../global.js";

const projects = await fetchJSON("../lib/projects.json");

const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");
const searchBar = document.querySelector(".searchBar");

const svg = d3.select("#projects-pie-plot");
const legend = d3.select(".legend");

const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

let query = "";
let selectedYear = null;

function matchesQuery(project) {
  if (!query) return true;
  return Object.values(project).join("\n").toLowerCase().includes(query.toLowerCase());
}

function renderPieChart(projectsGiven) {
  const data = d3
    .rollups(
      projectsGiven,
      (v) => v.length,
      (d) => d.year
    )
    .sort((a, b) => d3.descending(a[0], b[0]))
    .map(([year, count]) => ({ value: count, label: year }));

  svg.selectAll("path").remove();
  legend.selectAll("li").remove();

  svg
    .selectAll("path")
    .data(sliceGenerator(data))
    .join("path")
    .attr("d", arcGenerator)
    .attr("fill", (d) => colors(d.data.label))
    .attr("class", (d) => (d.data.label === selectedYear ? "selected" : null))
    .on("click", (event, d) => {
      selectedYear = selectedYear === d.data.label ? null : d.data.label;
      applyFilters();
    });

  legend
    .selectAll("li")
    .data(data)
    .join("li")
    .attr("style", (d) => `--color: ${colors(d.label)}`)
    .attr("class", (d) => (d.label === selectedYear ? "selected" : null))
    .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
}

function applyFilters() {
  const searched = projects.filter(matchesQuery);
  const visible =
    selectedYear === null ? searched : searched.filter((p) => p.year === selectedYear);

  renderProjects(visible, projectsContainer, "h2");
  renderPieChart(searched);

  if (projectsTitle) {
    projectsTitle.textContent = `${visible.length} Projects`;
  }
}

searchBar.addEventListener("input", (event) => {
  query = event.target.value;
  applyFilters();
});

applyFilters();
