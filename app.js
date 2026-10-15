const API_URL = "/api";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");
const sendButton = document.querySelector("#send-button");
const clearChat = document.querySelector("#clear-chat");
const promptButtons = document.querySelectorAll(".prompt");

function addMessage(text, role, meta = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const hasAgentTrace = Array.isArray(meta.agentTrace) && meta.agentTrace.length > 0;
  const hasSources = Array.isArray(meta.sources) && meta.sources.length > 0;
  const hasComplianceContext = Array.isArray(meta.complianceContext) && meta.complianceContext.length > 0;
  if (role === "assistant" && (hasAgentTrace || hasSources || hasComplianceContext)) {
    bubble.append(createFlowDetails(meta.agentTrace || [], meta.sources || [], meta.complianceContext || []));
  }
  if (role === "assistant" && Array.isArray(meta.charts) && meta.charts.length) {
    meta.charts.forEach((spec) => bubble.append(createChatChart(spec)));
  }
  if (role === "assistant" && meta.tables?.length) {
    meta.tables.forEach((table) => bubble.append(createChatTable(table)));
  }

  message.append(avatar, bubble);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

function createChatChart(spec) {
  const card = document.createElement("section");
  card.className = "chat-chart";
  const heading = document.createElement("div");
  heading.className = "chat-chart-heading";
  const title = document.createElement("strong");
  title.textContent = spec.title || "Historical data";
  const kind = document.createElement("span");
  kind.textContent = chartTypeLabel(spec.type);
  heading.append(title, kind);
  const canvas = document.createElement("canvas");
  canvas.className = "chat-chart-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${title.textContent}, ${chartTypeLabel(spec.type)}`);
  card.append(heading, canvas);
  if (spec.summary) {
    const summary = document.createElement("p");
    summary.className = "chat-chart-summary";
    summary.textContent = spec.summary;
    card.append(summary);
  }
  const details = document.createElement("details");
  const toggle = document.createElement("summary");
  toggle.textContent = "View values";
  details.append(toggle, createChartDataTable(spec));
  card.append(details);
  requestAnimationFrame(() => drawChatChart(canvas, spec));
  return card;
}

function chartTypeLabel(type) {
  return ({ line: "Trend", bar: "Comparison", horizontalBar: "Ranked comparison", donut: "Proportion" })[type] || "Data chart";
}

function createChartDataTable(spec) {
  const table = document.createElement("table");
  table.className = "chart-data-table";
  const series = Array.isArray(spec.series) ? spec.series : [];
  const head = table.createTHead().insertRow();
  ["Period / device", ...series.map((item) => `${item.name || "Value"}${item.unit ? ` (${item.unit})` : ""}`)].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    head.append(cell);
  });
  const body = table.createTBody();
  (spec.labels || []).forEach((label, index) => {
    const row = body.insertRow();
    const labelCell = row.insertCell();
    labelCell.textContent = label;
    series.forEach((item) => {
      const cell = row.insertCell();
      const value = item.data?.[index];
      cell.textContent = value == null ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
    });
  });
  return table;
}

function createChatTable(spec) {
  const section = document.createElement("section");
  section.className = "chat-chart chat-table-card";
  const title = document.createElement("strong");
  title.textContent = spec.title || "Returned data";
  section.append(title);
  const table = document.createElement("table");
  table.className = "chart-data-table";
  const columns = Array.isArray(spec.columns) ? spec.columns : [];
  const head = table.createTHead().insertRow();
  columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column.label || column.key || "Data";
    head.append(cell);
  });
  const body = table.createTBody();
  (spec.rows || []).slice(0, 30).forEach((item) => {
    const row = body.insertRow();
    columns.forEach((column) => {
      const cell = row.insertCell();
      const value = item?.[column.key];
      cell.textContent = value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
    });
  });
  section.append(table);
  return section;
}

const CHART_PALETTE = ["#0f766e", "#0284c7", "#7c3aed", "#ea580c", "#db2777", "#65a30d", "#d97706", "#2563eb"];

function drawChatChart(canvas, spec) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect.width));
  const height = 250;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  const labels = spec.labels || [];
  const series = (spec.series || []).filter((item) => Array.isArray(item.data));
  if (!labels.length || !series.length) return;
  if (spec.type === "donut") return drawDonut(ctx, width, height, labels, series[0]);
  if (spec.type === "horizontalBar") return drawHorizontalBars(ctx, width, height, labels, series[0]);
  if (spec.type === "line") return drawLineChart(ctx, width, height, labels, series);
  return drawBarChart(ctx, width, height, labels, series);
}

function chartNumber(value) { return value == null || !Number.isFinite(Number(value)) ? null : Number(value); }

function drawLineChart(ctx, width, height, labels, series) {
  const values = series.flatMap((item) => item.data.map(chartNumber).filter((value) => value != null));
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const floor = min >= 0 ? 0 : min;
  const range = max - floor || 1;
  const pad = { left: 48, right: 16, top: 20, bottom: 48 };
  drawGrid(ctx, width, height, pad, floor, max);
  series.forEach((item, seriesIndex) => {
    const color = CHART_PALETTE[seriesIndex % CHART_PALETTE.length];
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    let started = false;
    item.data.forEach((raw, index) => {
      const value = chartNumber(raw);
      if (value == null) { started = false; return; }
      const x = pad.left + (labels.length <= 1 ? 0 : index * (width - pad.left - pad.right) / (labels.length - 1));
      const y = height - pad.bottom - ((value - floor) / range) * (height - pad.top - pad.bottom);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      ctx.save(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    });
    ctx.stroke();
  });
  drawXAxis(ctx, width, height, labels, pad);
  drawLegend(ctx, width, series);
}

function drawBarChart(ctx, width, height, labels, series) {
  const max = Math.max(...series.flatMap((item) => item.data.map(chartNumber).filter((value) => value != null)), 0) || 1;
  const pad = { left: 48, right: 14, top: 18, bottom: 45 };
  drawGrid(ctx, width, height, pad, 0, max);
  const groupWidth = (width - pad.left - pad.right) / labels.length;
  const barWidth = Math.max(4, Math.min(30, groupWidth * 0.72 / series.length));
  labels.forEach((label, index) => series.forEach((item, seriesIndex) => {
    const value = chartNumber(item.data[index]);
    if (value == null) return;
    const barHeight = (value / max) * (height - pad.top - pad.bottom);
    const x = pad.left + groupWidth * index + (groupWidth - barWidth * series.length) / 2 + seriesIndex * barWidth;
    const y = height - pad.bottom - barHeight;
    ctx.fillStyle = CHART_PALETTE[seriesIndex % CHART_PALETTE.length];
    roundedRect(ctx, x, y, barWidth - 2, barHeight, Math.min(5, barWidth / 2));
    ctx.fill();
  }));
  drawXAxis(ctx, width, height, labels, pad);
  if (series.length > 1) drawLegend(ctx, width, series);
}

function drawHorizontalBars(ctx, width, height, labels, series) {
  const rows = labels.slice(0, 12);
  const values = rows.map((_, index) => chartNumber(series.data[index]) ?? 0);
  const max = Math.max(...values, 0) || 1;
  const left = Math.min(150, Math.max(82, width * 0.37));
  const right = 58;
  const top = 12;
  const rowHeight = Math.min(30, (height - 24) / Math.max(rows.length, 1));
  ctx.font = "11px system-ui, sans-serif";
  rows.forEach((label, index) => {
    const y = top + index * rowHeight;
    ctx.fillStyle = "#475569";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label).length > 24 ? `${String(label).slice(0, 22)}…` : label, left - 9, y + rowHeight * 0.48);
    const barWidth = Math.max(2, (width - left - right) * values[index] / max);
    const color = CHART_PALETTE[index % CHART_PALETTE.length];
    ctx.fillStyle = color;
    roundedRect(ctx, left, y + 4, barWidth, Math.max(8, rowHeight - 8), 5);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#334155";
    ctx.fillText(`${values[index].toLocaleString(undefined, { maximumFractionDigits: 2 })}${series.unit ? ` ${series.unit}` : ""}`, Math.min(left + barWidth + 6, width - right + 3), y + rowHeight * 0.48);
  });
}

function drawDonut(ctx, width, height, labels, series) {
  const values = labels.map((_, index) => Math.max(0, chartNumber(series.data[index]) ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return;
  const cx = width * 0.34;
  const cy = height * 0.5;
  const radius = Math.min(height * 0.36, width * 0.22);
  let angle = -Math.PI / 2;
  values.forEach((value, index) => {
    const next = angle + value / total * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, angle, next); ctx.arc(cx, cy, radius * 0.58, next, angle, true); ctx.closePath();
    ctx.fillStyle = CHART_PALETTE[index % CHART_PALETTE.length]; ctx.fill();
    angle = next;
  });
  ctx.fillStyle = "#0f172a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 17px system-ui, sans-serif"; ctx.fillText(total.toLocaleString(), cx, cy - 4);
  ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#64748b"; ctx.fillText(series.unit || "total", cx, cy + 14);
  ctx.textAlign = "left"; ctx.font = "12px system-ui, sans-serif";
  labels.forEach((label, index) => {
    const y = 44 + index * 26;
    ctx.fillStyle = CHART_PALETTE[index % CHART_PALETTE.length]; ctx.fillRect(width * 0.62, y - 7, 10, 10);
    ctx.fillStyle = "#334155"; ctx.fillText(`${label}: ${values[index]}${series.unit ? ` ${series.unit}` : ""}`, width * 0.62 + 16, y);
  });
}

function drawGrid(ctx, width, height, pad, min, max) {
  const range = max - min || 1;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let index = 0; index <= 4; index++) {
    const value = min + range * index / 4;
    const y = height - pad.bottom - (height - pad.top - pad.bottom) * index / 4;
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillStyle = "#64748b"; ctx.fillText(value.toLocaleString(undefined, { maximumFractionDigits: 2 }), pad.left - 7, y);
  }
}

function drawXAxis(ctx, width, height, labels, pad) {
  const count = Math.min(labels.length, 6);
  ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#64748b"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let index = 0; index < count; index++) {
    const sourceIndex = count === 1 ? 0 : Math.round(index * (labels.length - 1) / (count - 1));
    const x = pad.left + (labels.length <= 1 ? 0 : sourceIndex * (width - pad.left - pad.right) / (labels.length - 1));
    const label = String(labels[sourceIndex]);
    ctx.save(); ctx.translate(x, height - pad.bottom + 7); if (labels.length > 12) ctx.rotate(-0.35); ctx.fillText(label.length > 18 ? `${label.slice(0, 16)}…` : label, 0, 0); ctx.restore();
  }
}

function drawLegend(ctx, width, series) {
  let x = 52;
  ctx.font = "10px system-ui, sans-serif"; ctx.textBaseline = "middle";
  series.forEach((item, index) => {
    ctx.fillStyle = CHART_PALETTE[index % CHART_PALETTE.length]; ctx.fillRect(x, 8, 9, 9);
    ctx.fillStyle = "#475569"; const label = `${item.name || "Value"}${item.unit ? ` (${item.unit})` : ""}`; ctx.fillText(label, x + 13, 13);
    x += 20 + ctx.measureText(label).width;
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
}

function createFlowDetails(agentTrace, sources = [], complianceContext = []) {
  const details = document.createElement("details");
  details.className = "flow-details";

  const summary = document.createElement("summary");
  summary.textContent = agentTrace.length > 0 ? "System flow" : "Details";
  details.append(summary);

  const list = document.createElement("ol");
  list.className = "flow-list";

  agentTrace.forEach((step) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = `${step.agent}: ${step.status}`;
    const detail = document.createElement("span");
    detail.textContent = step.detail;
    item.append(title, detail);
    list.append(item);
  });

  if (agentTrace.length > 0) {
    details.append(list);
  }

  if (Array.isArray(complianceContext) && complianceContext.length > 0) {
    const complianceTitle = document.createElement("p");
    complianceTitle.className = "flow-source-title";
    complianceTitle.textContent = "Compliance context";
    details.append(complianceTitle);

    const complianceList = document.createElement("ul");
    complianceList.className = "source-list";
    complianceContext.forEach((item) => {
      const row = document.createElement("li");
      const label = item.label || "Context";
      const standard = item.standard || "standard not specified";
      const note = item.note || "";
      row.textContent = `${label}: ${standard}${note ? ` - ${note}` : ""}`;
      complianceList.append(row);
    });
    details.append(complianceList);
  }

  if (Array.isArray(sources) && sources.length > 0) {
    const sourceTitle = document.createElement("p");
    sourceTitle.className = "flow-source-title";
    sourceTitle.textContent = "Sources";
    details.append(sourceTitle);

    const sourceList = document.createElement("ul");
    sourceList.className = "source-list";
    sources.forEach((source) => {
      const item = document.createElement("li");
      const score = Number(source.score || 0).toFixed(2);
      item.textContent = `${source.title || "EMS Library"} (${source.standard_name || "general"}, score ${score})`;
      sourceList.append(item);
    });
    details.append(sourceList);
  }

  return details;
}

function setBusy(isBusy) {
  input.disabled = isBusy;
  sendButton.disabled = isBusy;
  sendButton.textContent = isBusy ? "Sending" : "Send";
}

function setStatus(state, label) {
  status.textContent = label;
  statusDot.className = `status-dot ${state}`;
}

function resizeComposer() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error("Service unavailable");
    setStatus("online", "AI-Server online");
  } catch {
    setStatus("offline", "AI-Server offline");
  }
}

async function sendMessage(message) {
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  resizeComposer();
  setBusy(true);
  const typing = addMessage("Thinking...", "assistant typing");

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    typing.remove();
    addMessage(data.reply, "assistant", {
      agentTrace: data.agent_trace,
      sources: data.sources,
      complianceContext: data.compliance_context,
      charts: data.charts,
      tables: data.tables,
    });
  } catch (error) {
    typing.remove();
    addMessage(`Could not reach AI-Server: ${error.message}`, "error");
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value.trim());
});

input.addEventListener("input", resizeComposer);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

clearChat.addEventListener("click", () => {
  messages.innerHTML = "";
  addMessage("Chat cleared. Send a fresh message whenever you are ready.", "assistant");
  input.focus();
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.textContent;
    resizeComposer();
    input.focus();
  });
});

checkHealth();
