const SHEET_CONFIG = {
  title: "Рабочая таблица расписания",
  spreadsheetId: "1j80t7W_-ouSPeGQoEUMu-o4RUBXw1VjcB3zIR-ym8fo",
  gid: "133047740",
  url: "https://docs.google.com/spreadsheets/d/1j80t7W_-ouSPeGQoEUMu-o4RUBXw1VjcB3zIR-ym8fo/edit?gid=133047740#gid=133047740"
};

const DAY_ORDER = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
];

const DAY_PATTERNS = [
  ["Понедельник", /(^|\s)(понедельник|пн\.?|monday|mon)(\s|$)/i],
  ["Вторник", /(^|\s)(вторник|вт\.?|tuesday|tue)(\s|$)/i],
  ["Среда", /(^|\s)(среда|ср\.?|wednesday|wed)(\s|$)/i],
  ["Четверг", /(^|\s)(четверг|чт\.?|thursday|thu)(\s|$)/i],
  ["Пятница", /(^|\s)(пятница|пт\.?|friday|fri)(\s|$)/i],
  ["Суббота", /(^|\s)(суббота|сб\.?|saturday|sat)(\s|$)/i],
  ["Воскресенье", /(^|\s)(воскресенье|вс\.?|sunday|sun)(\s|$)/i]
];

const HEADER_ALIASES = {
  day: ["день", "дата", "weekday", "day"],
  time: ["время", "интервал", "часы", "time", "начало"],
  coach: ["тренер", "педагог", "преподаватель", "coach", "trainer"],
  group: ["группа", "команда", "класс", "group", "team"],
  room: ["зал", "аудитория", "площадка", "место", "room", "location"],
  note: ["комментарий", "примечание", "заметка", "note", "comment"]
};

const state = {
  data: null,
  rawRows: [],
  lessons: [],
  conflicts: [],
  filters: {
    coach: "all",
    day: "all",
    search: ""
  },
  view: "week"
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  const data = window.COACH_SCHEDULE_DATA || emptyData();
  loadSchedule(data, "ready");
});

function bindElements() {
  [
    "statusDot",
    "sourceStatus",
    "updatedAt",
    "metricLessons",
    "metricCoaches",
    "metricHours",
    "metricConflicts",
    "coachFilter",
    "dayFilter",
    "searchInput",
    "scheduleGrid",
    "coachBoard",
    "issuesPanel",
    "rawTable",
    "refreshButton"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.coachFilter.addEventListener("change", () => {
    state.filters.coach = els.coachFilter.value;
    render();
  });

  els.dayFilter.addEventListener("change", () => {
    state.filters.day = els.dayFilter.value;
    render();
  });

  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim().toLowerCase();
    render();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      document.getElementById(`${state.view}View`).classList.add("active");
      render();
    });
  });

  els.refreshButton.addEventListener("click", refreshFromGoogleSheet);
}

function loadSchedule(data, statusType) {
  state.data = data;
  state.rawRows = sanitizeRows(data.rawRows || []);
  state.lessons = normalizeSchedule(state.rawRows);
  state.conflicts = detectConflicts(state.lessons);
  updateStatus(statusType, sourceLabel(data), formatDateTime(data.updatedAt));
  hydrateFilters();
  render();
}

function emptyData() {
  return {
    source: SHEET_CONFIG,
    updatedAt: new Date().toISOString(),
    rawRows: []
  };
}

function sourceLabel(data) {
  const rows = data.rawRows?.length || 0;
  const title = data.source?.title || SHEET_CONFIG.title;
  return `${title}: ${rows} строк`;
}

function updateStatus(type, text, dateText) {
  els.statusDot.className = `status-dot ${type === "error" ? "error" : type === "ready" ? "ready" : ""}`;
  els.sourceStatus.textContent = text;
  els.updatedAt.textContent = dateText || "-";
}

function hydrateFilters() {
  const currentCoach = state.filters.coach;
  const currentDay = state.filters.day;
  const coaches = unique(state.lessons.map((lesson) => lesson.coach).filter(Boolean)).sort(localeSort);
  const days = unique(state.lessons.map((lesson) => lesson.day).filter(Boolean)).sort(sortDays);

  fillSelect(els.coachFilter, [["all", "Все тренеры"], ...coaches.map((coach) => [coach, coach])], currentCoach);
  fillSelect(els.dayFilter, [["all", "Все дни"], ...days.map((day) => [day, day])], currentDay);

  if (!coaches.includes(currentCoach) && currentCoach !== "all") {
    state.filters.coach = "all";
    els.coachFilter.value = "all";
  }

  if (!days.includes(currentDay) && currentDay !== "all") {
    state.filters.day = "all";
    els.dayFilter.value = "all";
  }
}

function fillSelect(select, options, selectedValue) {
  select.replaceChildren();
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  select.value = options.some(([value]) => value === selectedValue) ? selectedValue : "all";
}

function render() {
  const filtered = getFilteredLessons();
  renderMetrics(filtered);
  renderWeek(filtered);
  renderCoachBoard(filtered);
  renderIssues();
  renderRawTable();
}

function getFilteredLessons() {
  const search = state.filters.search;
  return state.lessons.filter((lesson) => {
    if (state.filters.coach !== "all" && lesson.coach !== state.filters.coach) return false;
    if (state.filters.day !== "all" && lesson.day !== state.filters.day) return false;
    if (!search) return true;
    return [
      lesson.title,
      lesson.coach,
      lesson.group,
      lesson.room,
      lesson.note,
      lesson.day,
      lesson.time
    ].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function renderMetrics(lessons) {
  const coaches = unique(lessons.map((lesson) => lesson.coach).filter(Boolean));
  const hours = lessons.reduce((sum, lesson) => sum + (lesson.durationHours || 0), 0);
  const visibleConflicts = detectConflicts(lessons).length;

  els.metricLessons.textContent = String(lessons.length);
  els.metricCoaches.textContent = String(coaches.length);
  els.metricHours.textContent = formatHours(hours);
  els.metricConflicts.textContent = String(visibleConflicts);
}

function renderWeek(lessons) {
  els.scheduleGrid.replaceChildren();
  if (!lessons.length) {
    els.scheduleGrid.append(emptyState("Нет занятий под выбранные фильтры"));
    return;
  }

  const grouped = groupBy(lessons, (lesson) => lesson.day || "Без дня");
  const days = Object.keys(grouped).sort(sortDays);

  days.forEach((day) => {
    const column = document.createElement("article");
    column.className = "day-column";

    const header = document.createElement("div");
    header.className = "day-header";
    const title = document.createElement("h2");
    title.textContent = day;
    const count = document.createElement("span");
    count.textContent = `${grouped[day].length} зан.`;
    header.append(title, count);

    const list = document.createElement("div");
    list.className = "lesson-list";
    grouped[day].sort(sortLessons).forEach((lesson) => list.append(lessonCard(lesson)));

    column.append(header, list);
    els.scheduleGrid.append(column);
  });
}

function lessonCard(lesson) {
  const card = document.createElement("article");
  card.className = "lesson-card";

  const top = document.createElement("div");
  top.className = "lesson-top";
  const time = document.createElement("span");
  time.className = "lesson-time";
  time.textContent = lesson.time || "Без времени";
  const duration = document.createElement("span");
  duration.className = "lesson-duration";
  duration.textContent = lesson.durationHours ? `${formatHours(lesson.durationHours)} ч` : "";
  top.append(time, duration);

  const title = document.createElement("p");
  title.className = "lesson-title";
  title.textContent = lesson.title || lesson.group || "Занятие";

  const meta = document.createElement("div");
  meta.className = "lesson-meta";
  if (lesson.coach) meta.append(pill(lesson.coach, "coach"));
  if (lesson.group && lesson.group !== lesson.title) meta.append(pill(lesson.group, ""));
  if (lesson.room) meta.append(pill(lesson.room, "room"));
  if (lesson.note) meta.append(pill(lesson.note, ""));

  card.append(top, title, meta);
  return card;
}

function pill(text, className) {
  const item = document.createElement("span");
  item.className = `pill ${className || ""}`.trim();
  item.textContent = text;
  return item;
}

function renderCoachBoard(lessons) {
  els.coachBoard.replaceChildren();
  if (!lessons.length) {
    els.coachBoard.append(emptyState("Нет данных по нагрузке"));
    return;
  }

  const grouped = groupBy(lessons, (lesson) => lesson.coach || "Без тренера");
  Object.entries(grouped)
    .sort((a, b) => totalHours(b[1]) - totalHours(a[1]) || localeSort(a[0], b[0]))
    .forEach(([coach, coachLessons]) => {
      const card = document.createElement("article");
      card.className = "coach-card";

      const title = document.createElement("h2");
      title.textContent = coach;

      const summary = document.createElement("div");
      summary.className = "coach-summary";
      summary.append(textSpan(`${coachLessons.length} занятий`), textSpan(`${formatHours(totalHours(coachLessons))} ч`));

      const rows = document.createElement("div");
      rows.className = "mini-bars";
      const byDay = groupBy(coachLessons, (lesson) => lesson.day || "Без дня");
      const maxDayHours = Math.max(1, ...Object.values(byDay).map(totalHours));
      Object.keys(byDay).sort(sortDays).forEach((day) => {
        const hours = totalHours(byDay[day]);
        rows.append(miniBar(day, hours, maxDayHours));
      });

      card.append(title, summary, rows);
      els.coachBoard.append(card);
    });
}

function miniBar(day, hours, max) {
  const row = document.createElement("div");
  row.className = "mini-row";
  const label = document.createElement("span");
  label.textContent = shortDay(day);
  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  fill.style.width = `${Math.max(5, Math.round((hours / max) * 100))}%`;
  track.append(fill);
  const value = document.createElement("span");
  value.textContent = formatHours(hours);
  row.append(label, track, value);
  return row;
}

function renderIssues() {
  els.issuesPanel.replaceChildren();
  const issues = [];
  state.conflicts.forEach((conflict) => {
    issues.push(`${conflict.coach}: ${conflict.day}, ${conflict.a.time} пересекается с ${conflict.b.time}`);
  });

  const incomplete = state.lessons.filter((lesson) => !lesson.day || !lesson.time || !lesson.coach);
  if (incomplete.length) {
    issues.push(`Неполные записи: ${incomplete.length}`);
  }

  if (!issues.length) {
    const item = document.createElement("div");
    item.className = "issue-item ok";
    item.textContent = "Критичных пересечений не найдено";
    els.issuesPanel.append(item);
    return;
  }

  issues.forEach((text) => {
    const item = document.createElement("div");
    item.className = "issue-item";
    item.textContent = text;
    els.issuesPanel.append(item);
  });
}

function renderRawTable() {
  els.rawTable.replaceChildren();
  if (!state.rawRows.length) {
    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = "Нет строк";
    row.append(cell);
    tbody.append(row);
    els.rawTable.append(tbody);
    return;
  }

  const width = Math.max(...state.rawRows.map((row) => row.length));
  const headerIndex = detectHeaderRow(state.rawRows);
  const header = state.rawRows[headerIndex] || [];
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (let col = 0; col < width; col += 1) {
    const th = document.createElement("th");
    th.textContent = header[col] || `Колонка ${col + 1}`;
    headerRow.append(th);
  }
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  state.rawRows.slice(headerIndex + 1, headerIndex + 151).forEach((rawRow) => {
    const row = document.createElement("tr");
    for (let col = 0; col < width; col += 1) {
      const td = document.createElement("td");
      td.textContent = rawRow[col] || "";
      row.append(td);
    }
    tbody.append(row);
  });

  els.rawTable.append(thead, tbody);
}

async function refreshFromGoogleSheet() {
  updateStatus("loading", "Обновление из Google Sheets", "");
  els.refreshButton.disabled = true;

  try {
    const csv = await fetchSheetCsv();
    const rawRows = parseCsv(csv);
    const nextData = {
      source: SHEET_CONFIG,
      updatedAt: new Date().toISOString(),
      rawRows
    };
    loadSchedule(nextData, "ready");
  } catch (error) {
    updateStatus("error", `Не удалось обновить: ${error.message}`, "");
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function fetchSheetCsv() {
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&gid=${SHEET_CONFIG.gid}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (/^\s*</.test(text)) throw new Error("получен HTML вместо CSV");
      return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("нет ответа");
}

function normalizeSchedule(rows) {
  if (!rows.length) return [];
  const headerIndex = detectHeaderRow(rows);
  const headerMap = mapHeaders(rows[headerIndex] || []);
  const hasTableHeaders = Number.isInteger(headerMap.day) || Number.isInteger(headerMap.time) || Number.isInteger(headerMap.coach);

  if (hasTableHeaders) {
    return normalizeTableRows(rows, headerIndex, headerMap);
  }

  return normalizeMatrixRows(rows);
}

function normalizeTableRows(rows, headerIndex, headerMap) {
  const lessons = [];
  let lastDay = "";
  let lastCoach = "";

  rows.slice(headerIndex + 1).forEach((row, index) => {
    if (!row.some(Boolean)) return;

    const fallback = row.filter(Boolean).join(" · ");
    const day = normalizeDay(valueAt(row, headerMap.day)) || lastDay || findDayInValues(row);
    const time = normalizeTime(valueAt(row, headerMap.time)) || findTimeInValues(row);
    const coach = cleanValue(valueAt(row, headerMap.coach)) || lastCoach || extractLabel(fallback, "тренер");
    const group = cleanValue(valueAt(row, headerMap.group)) || extractLabel(fallback, "группа");
    const room = cleanValue(valueAt(row, headerMap.room)) || extractLabel(fallback, "зал");
    const note = cleanValue(valueAt(row, headerMap.note));

    if (day) lastDay = day;
    if (coach) lastCoach = coach;

    const title = group || fallback;
    lessons.push(buildLesson({
      id: `row-${headerIndex + index + 2}`,
      day,
      time,
      coach,
      group,
      room,
      note,
      title,
      source: { row: headerIndex + index + 2 }
    }));
  });

  return lessons.filter((lesson) => lesson.title || lesson.time || lesson.coach);
}

function normalizeMatrixRows(rows) {
  const lessons = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const value = cleanValue(cell);
      if (!value || isSkippableMatrixCell(value)) return;

      const rowPrefix = row.slice(0, colIndex).filter(Boolean);
      const colPrefix = rows.slice(0, rowIndex).map((item) => item[colIndex]).filter(Boolean);
      const context = [...rowPrefix, ...colPrefix];
      const joined = [value, ...context].join(" · ");

      const day = findDayInValues([value, ...context]);
      const time = normalizeTime(value) || findTimeInValues(context);
      const coach = extractLabel(joined, "тренер") || inferCoach(context);
      const room = extractLabel(joined, "зал");
      const group = extractLabel(joined, "группа") || value.split(/\r?\n/)[0];

      lessons.push(buildLesson({
        id: `cell-${rowIndex + 1}-${colIndex + 1}`,
        day,
        time,
        coach,
        group,
        room,
        note: "",
        title: value,
        source: { row: rowIndex + 1, col: colIndex + 1 }
      }));
    });
  });

  return lessons;
}

function buildLesson(input) {
  const range = parseTimeRange(input.time);
  return {
    ...input,
    day: input.day || "",
    time: input.time || "",
    coach: input.coach || "",
    group: input.group || "",
    room: input.room || "",
    note: input.note || "",
    title: input.title || input.group || "Занятие",
    startMinutes: range?.start ?? null,
    endMinutes: range?.end ?? null,
    durationHours: range ? Math.max(0, (range.end - range.start) / 60) : 0
  };
}

function detectHeaderRow(rows) {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, index) => {
    const score = Object.values(mapHeaders(row)).filter(Number.isInteger).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore > 0 ? bestIndex : 0;
}

function mapHeaders(row) {
  const map = {};
  row.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key && !Number.isInteger(map[key])) map[key] = index;
  });
  return map;
}

function headerKey(value) {
  const normalized = cleanValue(value).toLowerCase();
  if (!normalized) return "";
  return Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))?.[0] || "";
}

function sanitizeRows(rows) {
  return rows
    .map((row) => (Array.isArray(row) ? row : [row]).map(cleanValue))
    .filter((row) => row.some(Boolean));
}

function cleanValue(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function valueAt(row, index) {
  return Number.isInteger(index) ? row[index] : "";
}

function normalizeDay(value) {
  const text = cleanValue(value);
  return DAY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function normalizeTime(value) {
  const text = cleanValue(value).replace(/[–—−]/g, "-").replace(/\./g, ":");
  const match = text.match(/(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return "";
  const start = `${match[1].padStart(2, "0")}:${match[2]}`;
  if (!match[3]) return start;
  return `${start}-${match[3].padStart(2, "0")}:${match[4]}`;
}

function parseTimeRange(value) {
  const normalized = normalizeTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  let end = Number(match[3]) * 60 + Number(match[4]);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function findDayInValues(values) {
  return values.map(normalizeDay).find(Boolean) || "";
}

function findTimeInValues(values) {
  return values.map(normalizeTime).find(Boolean) || "";
}

function extractLabel(text, label) {
  const pattern = new RegExp(`${label}\\s*[:=-]\\s*([^;\\n·]+)`, "i");
  return cleanValue(text.match(pattern)?.[1] || "");
}

function inferCoach(context) {
  const candidates = context.map(cleanValue).filter((value) => {
    if (!value || normalizeDay(value) || normalizeTime(value)) return false;
    if (headerKey(value)) return false;
    return /^[А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+){0,2}$/.test(value);
  });
  return candidates.at(-1) || "";
}

function isSkippableMatrixCell(value) {
  if (headerKey(value)) return true;
  if (normalizeDay(value) === value) return true;
  if (normalizeTime(value) === value) return true;
  return value.length <= 2;
}

function detectConflicts(lessons) {
  const conflicts = [];
  const grouped = groupBy(
    lessons.filter((lesson) => lesson.coach && lesson.day && Number.isFinite(lesson.startMinutes) && Number.isFinite(lesson.endMinutes)),
    (lesson) => `${lesson.coach}__${lesson.day}`
  );

  Object.values(grouped).forEach((items) => {
    const sorted = [...items].sort(sortLessons);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.startMinutes < previous.endMinutes) {
        conflicts.push({
          coach: current.coach,
          day: current.day,
          a: previous,
          b: current
        });
      }
    }
  });

  return conflicts;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return sanitizeRows(rows);
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortDays(a, b) {
  const aIndex = DAY_ORDER.indexOf(a);
  const bIndex = DAY_ORDER.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return localeSort(a, b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function sortLessons(a, b) {
  return (a.startMinutes ?? 99999) - (b.startMinutes ?? 99999) || localeSort(a.title, b.title);
}

function localeSort(a, b) {
  return String(a).localeCompare(String(b), "ru");
}

function totalHours(lessons) {
  return lessons.reduce((sum, lesson) => sum + (lesson.durationHours || 0), 0);
}

function formatHours(value) {
  if (!value) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function shortDay(day) {
  const map = {
    "Понедельник": "Пн",
    "Вторник": "Вт",
    "Среда": "Ср",
    "Четверг": "Чт",
    "Пятница": "Пт",
    "Суббота": "Сб",
    "Воскресенье": "Вс"
  };
  return map[day] || day;
}

function textSpan(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function emptyState(text) {
  const item = document.createElement("div");
  item.className = "empty-state";
  item.textContent = text;
  return item;
}
