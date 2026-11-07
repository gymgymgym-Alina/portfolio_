import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

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
function renderStats() {
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
    ["Commits", commits.length],
    ["Files", d3.group(data, (d) => d.file).size],
    ["Total LOC", data.length],
    ["Avg file length", d3.mean(fileLengths, (d) => d[1]).toFixed(0)],
    ["Longest line", d3.max(data, (d) => d.length)],
    ["Most active", d3.greatest(workByPeriod, (d) => d[1])[0]],
  ];

  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  for (const [label, value] of stats) {
    dl.append("dt").text(label);
    dl.append("dd").text(value);
  }
}

renderStats();

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

  const rScale = d3
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
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

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

  const sorted = d3.sort(commits, (a, b) => d3.descending(a.totalLines, b.totalLines));

  svg
    .append("g")
    .attr("class", "dots")
    .selectAll("circle")
    .data(sorted)
    .join("circle")
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
  const selected = commits.filter(isCommitSelected);

  document.getElementById("selection-count").textContent = selected.length
    ? `${selected.length} commit${selected.length === 1 ? "" : "s"} selected`
    : "No commits selected";

  return selected;
}

function renderLanguageBreakdown(selected) {
  const container = document.getElementById("language-breakdown");
  const lines = (selected.length ? selected : commits).flatMap((d) => d.lines);

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

renderScatterPlot();
renderLanguageBreakdown([]);
