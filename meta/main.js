import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

const REPO_URL = "https://github.com/gymgymgym-Alina/portfolio_";

const data = await d3.csv("loc.csv", (row) => ({
  ...row,
  line: Number(row.line),
  depth: Number(row.depth),
  length: Number(row.length),
  date: new Date(row.date + "T00:00" + row.timezone),
  datetime: new Date(row.datetime),
}));

function processCommits(rows) {
  return d3
    .groups(rows, (d) => d.commit)
    .map(([commit, lines]) => {
      const { author, date, time, timezone, datetime } = lines[0];

      const ret = {
        id: commit,
        url: `${REPO_URL}/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

const commits = processCommits(data);

/* ---------- Step 1.3: summary stats ---------- */
function renderStats(commitList) {
  const data = commitList.flatMap((d) => d.lines);

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file
  );

  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString("en", { dayPeriod: "short" })
  );

  const stats = [
    ["Commits", commitList.length],
    ["Files", d3.group(data, (d) => d.file).size],
    ["Total LOC", data.length],
    ["Avg file length", d3.mean(fileLengths, (d) => d[1]).toFixed(0)],
    ["Longest line", d3.max(data, (d) => d.length)],
    ["Most active", d3.greatest(workByPeriod, (d) => d[1])[0]],
  ];

  const dl = d3
    .select("#stats")
    .selectAll("dl")
    .data([null])
    .join("dl")
    .attr("class", "stats");

  dl.selectAll("*").remove();

  for (const [label, value] of stats) {
    dl.append("dt").text(label);
    dl.append("dd").text(value);
  }
}

/* ---------- Step 2: scatterplot ---------- */
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 50 };

const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
};
usableArea.width = usableArea.right - usableArea.left;
usableArea.height = usableArea.bottom - usableArea.top;

let xScale;
let yScale;
let rScale;

const colorScale = d3
  .scaleLinear()
  .domain([0, 6, 12, 18, 24])
  .range(["#2b3a8f", "#5a8fd6", "#f0932b", "#5a8fd6", "#2b3a8f"]);

function renderScatterPlot() {
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  rScale = d3
    .scaleSqrt()
    .domain(d3.extent(commits, (d) => d.totalLines))
    .range([4, 28]);

  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${usableArea.bottom})`);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, "0") + ":00")
    );

  svg
    .append("g")
    .attr("class", "brush")
    .call(
      d3
        .brush()
        .extent([
          [usableArea.left, usableArea.top],
          [usableArea.right, usableArea.bottom],
        ])
        .on("start brush end", brushed)
    );

  svg.append("g").attr("class", "dots");

  updateScatterPlot(commits);
}

function updateScatterPlot(commitList) {
  const svg = d3.select("#chart").select("svg");

  xScale.domain(d3.extent(commitList, (d) => d.datetime)).nice();

  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  const sorted = d3.sort(commitList, (a, b) => d3.descending(a.totalLines, b.totalLines));

  svg
    .select("g.dots")
    .selectAll("circle")
    .data(sorted, (d) => d.id)
    .join("circle")
    .classed("selected", (d) => isCommitSelected(d))
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", (d) => colorScale(d.hourFrac))
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", updateTooltipPosition)
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });
}

/* ---------- Step 3: tooltip ---------- */
const tooltip = document.getElementById("commit-tooltip");

function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");

  link.href = commit.url;
  link.textContent = commit.id;
  document.getElementById("commit-date").textContent = commit.datetime.toLocaleString("en", {
    dateStyle: "full",
  });
  document.getElementById("commit-time").textContent = commit.datetime.toLocaleString("en", {
    timeStyle: "short",
  });
  document.getElementById("commit-author").textContent = commit.author;
  document.getElementById("commit-lines").textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

/* ---------- Step 5: brushing ---------- */
let brushSelection = null;

function isCommitSelected(commit) {
  if (!brushSelection) return false;

  const [[x0, y0], [x1, y1]] = brushSelection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount() {
  const selected = filteredCommits.filter(isCommitSelected);

  document.getElementById("selection-count").textContent = selected.length
    ? `${selected.length} commit${selected.length === 1 ? "" : "s"} selected`
    : "No commits selected";

  return selected;
}

function renderLanguageBreakdown(selected) {
  const container = document.getElementById("language-breakdown");
  const lines = (selected.length ? selected : filteredCommits).flatMap((d) => d.lines);

  const breakdown = d3.rollups(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  const format = d3.format(".1~%");

  container.innerHTML = "";

  for (const [language, count] of d3.sort(breakdown, (a, b) => d3.descending(a[1], b[1]))) {
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines<br><small>(${format(count / lines.length)})</small></dd>
    `;
  }
}

function brushed(event) {
  brushSelection = event.selection;

  d3.select("#chart").selectAll("circle").classed("selected", (d) => isCommitSelected(d));
  renderLanguageBreakdown(renderSelectionCount());
}

/* ---------- Lab 8, Step 2: file unit visualization ---------- */
const typeColors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(commitList) {
  const lines = commitList.flatMap((d) => d.lines);

  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const rows = d3
    .select("#files")
    .selectAll("div.file")
    .data(files, (d) => d.name)
    .join((enter) =>
      enter
        .append("div")
        .attr("class", "file")
        .call((div) => {
          const dt = div.append("dt");
          dt.append("code");
          dt.append("small");
          div.append("dd");
        })
    )
    .order();

  rows.select("dt > code").text((d) => d.name);
  rows.select("dt > small").text((d) => `${d.lines.length} lines`);

  rows
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .style("--color", (d) => typeColors(d.type));
}

/* ---------- Lab 8, Step 1: filtering by time ---------- */
const timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);

let commitProgress = 100;
let commitMaxTime = timeScale.invert(commitProgress);
let filteredCommits = commits;

const progressSlider = document.getElementById("commit-progress");
const commitTimeLabel = document.getElementById("commit-time");

function showCommitsUntil(maxTime) {
  commitMaxTime = maxTime;
  commitProgress = timeScale(maxTime);
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  progressSlider.value = commitProgress;
  commitTimeLabel.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  renderStats(filteredCommits);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
  renderLanguageBreakdown(renderSelectionCount());
}

function onTimeSliderChange() {
  showCommitsUntil(timeScale.invert(Number(progressSlider.value)));
}

renderScatterPlot();
progressSlider.addEventListener("input", onTimeSliderChange);
onTimeSliderChange();

/* ---------- Lab 8, Step 3: scrollytelling ---------- */
const formatLines = d3.format(",");

d3.select("#scatter-story")
  .selectAll(".step")
  .data(commits)
  .join("div")
  .attr("class", "step")
  .html((d, i) => {
    const date = d.datetime.toLocaleString("en", { dateStyle: "full" });
    const time = d.datetime.toLocaleString("en", { timeStyle: "short" });
    const files = d3.rollups(d.lines, (v) => v.length, (line) => line.file).length;
    const label = i === 0 ? "my first commit" : "another commit";

    return `
      <p class="step-date">${date}, ${time}</p>
      <p>
        I made <a href="${d.url}" target="_blank" rel="noopener">${label}</a>.
        It edited ${formatLines(d.totalLines)} line${d.totalLines === 1 ? "" : "s"}
        across ${files} file${files === 1 ? "" : "s"}.
      </p>
    `;
  });

function onStepEnter(response) {
  d3.selectAll("#scatter-story .step").classed("is-active", false);
  response.element.classList.add("is-active");
  showCommitsUntil(response.element.__data__.datetime);
}

scrollama()
  .setup({
    container: "#scrolly-1",
    step: "#scrolly-1 .step",
  })
  .onStepEnter(onStepEnter);
