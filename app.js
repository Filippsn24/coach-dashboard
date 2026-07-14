const SHEET_CONFIG = {
  title: "Учебный год 26/27",
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

const SHORT_DAY_HEADERS = {
  "пн": "Понедельник",
  "вт": "Вторник",
  "ср": "Среда",
  "чт": "Четверг",
  "пт": "Пятница",
  "сб": "Суббота",
  "вс": "Воскресенье"
};

const HEADER_ALIASES = {
  day: ["день", "дата", "weekday", "day"],
  time: ["время", "интервал", "часы", "time", "начало"],
  coach: ["тренер", "педагог", "преподаватель", "coach", "trainer"],
  group: ["тренировка", "занятие", "урок", "группа", "команда", "класс", "schedule", "lesson", "training", "group", "team"],
  room: ["зал", "аудитория", "площадка", "место", "адрес", "школа", "филиал", "room", "location"],
  note: ["комментарий", "примечание", "заметка", "note", "comment"],
  district: ["округ", "ао", "district"]
};

const LOCATION_MARKERS = [
  "адрес",
  "школ",
  "гимназ",
  "лицей",
  "корпус",
  "строение",
  "стр.",
  "улица",
  "ул.",
  "проспект",
  "пр-т",
  "проезд",
  "переулок",
  "пер.",
  "шоссе",
  "бульвар",
  "наб.",
  "набереж",
  "площадь",
  "метро",
  "м.",
  "район",
  "зал",
  "аудитория",
  "кабинет",
  "гбоу",
  "маоу",
  "мбоу"
];

const DISTRICT_MARKERS = [
  "округ",
  "цао",
  "сао",
  "свао",
  "вао",
  "ювао",
  "юао",
  "юзао",
  "зао",
  "сзао",
  "зелао",
  "тинао"
];

const state = {
  data: null,
  rawRows: [],
  lessons: [],
  conflicts: [],
  filters: {
    coach: "all",
    days: [],
    lesson: "all",
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
    "lessonFilter",
    "searchInput",
    "scheduleGrid",
    "coachBoard",
    "targetLessonBadge",
    "targetLessonSummary",
    "freeCoachList",
    "conflictList",
    "refreshButton"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.coachFilter.addEventListener("change", () => {
    state.filters.coach = els.coachFilter.value;
    state.filters.days = [];
    state.filters.lesson = "all";
    hydrateDependentFilters();
    render();
  });

  els.dayFilter.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-day]");
    if (!button || button.disabled) return;

    if (button.dataset.day === "all") {
      state.filters.days = [];
    } else {
      const selected = new Set(state.filters.days);
      if (selected.has(button.dataset.day)) {
        selected.delete(button.dataset.day);
      } else {
        selected.add(button.dataset.day);
      }
      state.filters.days = [...selected].sort(sortDays);
    }

    state.filters.lesson = "all";
    hydrateDependentFilters();
    render();
  });

  els.lessonFilter.addEventListener("change", () => {
    state.filters.lesson = els.lessonFilter.value;
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
  const coaches = unique(state.lessons.map((lesson) => lesson.coach).filter(Boolean)).sort(localeSort);

  fillSelect(els.coachFilter, [["all", "Выберите тренера"], ...coaches.map((coach) => [coach, coach])], currentCoach);

  if (!coaches.includes(currentCoach) && currentCoach !== "all") {
    state.filters.coach = "all";
    els.coachFilter.value = "all";
  }

  hydrateDependentFilters();
}

function hydrateDependentFilters() {
  const currentLesson = state.filters.lesson;
  const coachScoped = state.lessons.filter((lesson) => state.filters.coach === "all" || lesson.coach === state.filters.coach);
  const days = unique(coachScoped.map((lesson) => lesson.day).filter(Boolean)).sort(sortDays);
  const validDays = state.filters.days.filter((day) => days.includes(day));
  if (validDays.length !== state.filters.days.length) {
    state.filters.days = validDays;
  }

  const dayScoped = coachScoped.filter((lesson) => !state.filters.days.length || state.filters.days.includes(lesson.day));
  const lessonOptions = dayScoped
    .slice()
    .sort(sortLessons)
    .map((lesson) => [lesson.id, lessonOptionLabel(lesson)]);

  renderDayFilter(days);
  fillSelect(els.lessonFilter, [["all", "Все тренировки"], ...lessonOptions], currentLesson);

  if (!lessonOptions.some(([id]) => id === currentLesson) && currentLesson !== "all") {
    state.filters.lesson = "all";
    els.lessonFilter.value = "all";
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

function renderDayFilter(days) {
  const available = new Set(days);
  const selected = new Set(state.filters.days);
  const options = [["all", "Все"], ...DAY_ORDER.map((day) => [day, shortDay(day)])];

  els.dayFilter.replaceChildren();
  options.forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-toggle";
    button.dataset.day = value;
    button.textContent = label;
    button.title = value === "all" ? "Вся неделя" : value;
    const isActive = value === "all" ? !selected.size : selected.has(value);
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = value !== "all" && !available.has(value);
    els.dayFilter.append(button);
  });
}

function render() {
  const filtered = getFilteredLessons();
  renderMetrics(filtered);
  renderWeek(filtered);
  renderReplacementTools();
  renderCoachBoard(filtered);
}

function getFilteredLessons() {
  if (state.filters.coach === "all") return [];

  const search = state.filters.search;
  return state.lessons.filter((lesson) => {
    if (state.filters.coach !== "all" && lesson.coach !== state.filters.coach) return false;
    if (state.filters.days.length && !state.filters.days.includes(lesson.day)) return false;
    if (state.filters.lesson !== "all" && lesson.id !== state.filters.lesson) return false;
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
  els.scheduleGrid.classList.toggle("coach-selected", state.filters.coach !== "all");
  if (!lessons.length) {
    els.scheduleGrid.append(emptyState(state.filters.coach === "all" ? "Выберите тренера, чтобы увидеть расписание на неделю" : "Нет занятий под выбранные фильтры"));
    return;
  }

  const grouped = groupBy(lessons, (lesson) => lesson.day || "Без дня");
  const days = state.filters.coach !== "all"
    ? (state.filters.days.length ? state.filters.days : DAY_ORDER)
    : Object.keys(grouped).sort(sortDays);

  days.forEach((day) => {
    const column = document.createElement("article");
    column.className = "day-column";

    const header = document.createElement("div");
    header.className = "day-header";
    const title = document.createElement("h2");
    title.textContent = day;
    const count = document.createElement("span");
    count.textContent = `${grouped[day]?.length || 0} зан.`;
    header.append(title, count);

    const list = document.createElement("div");
    list.className = "lesson-list";
    if (grouped[day]?.length) {
      grouped[day].sort(sortLessons).forEach((lesson) => list.append(lessonCard(lesson)));
    } else {
      list.append(emptyState("Нет тренировок"));
    }

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
  title.textContent = lesson.group || lesson.title || "Тренировка";

  const meta = document.createElement("div");
  meta.className = "lesson-meta";
  if (lesson.coach) meta.append(pill(lesson.coach, "coach"));
  if (lesson.title && lesson.group && lesson.group !== lesson.title) meta.append(pill(lesson.title, ""));
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
    els.coachBoard.append(emptyState(state.filters.coach === "all" ? "Выберите тренера, чтобы увидеть нагрузку по дням" : "Нет данных по нагрузке"));
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

function renderReplacementTools() {
  renderFreeCoaches();
  renderConflictList();
}

function renderFreeCoaches() {
  const target = selectedLesson();
  els.targetLessonSummary.replaceChildren();
  els.freeCoachList.replaceChildren();

  if (!target) {
    els.targetLessonBadge.textContent = "Выберите тренировку";
    els.targetLessonSummary.append(summaryLine("Чтобы найти замену, выберите тренера и конкретную тренировку в фильтре сверху."));
    els.freeCoachList.append(emptyState("После выбора тренировки здесь появятся свободные тренеры."));
    return;
  }

  els.targetLessonBadge.textContent = `${shortDay(target.day)} ${target.time}`;
  els.targetLessonSummary.append(
    summaryLine(`${target.coach}: ${target.group || target.title}`),
    summaryLine(`${target.day}, ${target.time}`),
    summaryLine(target.room || "Адрес не указан")
  );

  if (!Number.isFinite(target.startMinutes) || !Number.isFinite(target.endMinutes)) {
    els.freeCoachList.append(emptyState("Для этой тренировки не удалось распознать время."));
    return;
  }

  const free = availableCoachesFor(target);
  if (!free.length) {
    els.freeCoachList.append(emptyState("Свободных тренеров на это время не найдено."));
    return;
  }

  free.forEach(({ coach, dayLessons, weekLessons, weekHours }) => {
    const item = document.createElement("article");
    item.className = "free-coach-item";
    const name = document.createElement("strong");
    name.textContent = coach;
    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = `${dayLessons.length} занятий в этот день, ${weekLessons.length} в неделю, ${formatHours(weekHours)} ч`;
    item.append(name, meta);
    els.freeCoachList.append(item);
  });
}

function renderConflictList() {
  els.conflictList.replaceChildren();

  const target = selectedLesson();
  if (target) {
    if (!Number.isFinite(target.startMinutes) || !Number.isFinite(target.endMinutes)) {
      els.conflictList.append(summaryLine("Для выбранной тренировки не удалось распознать время."));
      return;
    }

    const overlaps = overlappingCoachesFor(target);
    if (!overlaps.length) {
      els.conflictList.append(summaryLine("В это время другие тренеры не заняты."));
      return;
    }

    overlaps.forEach(({ coach, lessons }) => {
      const item = document.createElement("article");
      item.className = "conflict-item";
      const title = document.createElement("strong");
      title.textContent = coach;
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = lessons
        .map((lesson) => `${lesson.time} ${lesson.group || lesson.title}${lesson.room ? ` · ${lesson.room}` : ""}`)
        .join("; ");
      item.append(title, meta);
      els.conflictList.append(item);
    });
    return;
  }

  if (!state.conflicts.length) {
    els.conflictList.append(summaryLine("Выберите конкретную тренировку, чтобы увидеть занятых тренеров на это же время."));
    return;
  }

  state.conflicts
    .slice()
    .sort((a, b) => localeSort(a.coach, b.coach) || sortDays(a.day, b.day) || sortLessons(a.a, b.a))
    .forEach((conflict) => {
      const item = document.createElement("article");
      item.className = "conflict-item";
      const title = document.createElement("strong");
      title.textContent = `${conflict.coach} · ${conflict.day}`;
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = `${conflict.a.time} ${conflict.a.group || conflict.a.title} пересекается с ${conflict.b.time} ${conflict.b.group || conflict.b.title}`;
      item.append(title, meta);
      els.conflictList.append(item);
    });
}

function selectedLesson() {
  if (state.filters.lesson === "all") return null;
  return state.lessons.find((lesson) => lesson.id === state.filters.lesson) || null;
}

function availableCoachesFor(target) {
  return unique(state.lessons.map((lesson) => lesson.coach).filter(Boolean))
    .filter((coach) => coach !== target.coach)
    .map((coach) => {
      const weekLessons = state.lessons.filter((lesson) => lesson.coach === coach);
      const dayLessons = weekLessons.filter((lesson) => lesson.day === target.day);
      const busy = dayLessons.some((lesson) => lessonsOverlap(target, lesson));
      return {
        coach,
        dayLessons,
        weekLessons,
        weekHours: totalHours(weekLessons),
        busy
      };
    })
    .filter((item) => !item.busy)
    .sort((a, b) => a.dayLessons.length - b.dayLessons.length || a.weekHours - b.weekHours || localeSort(a.coach, b.coach));
}

function overlappingCoachesFor(target) {
  return unique(state.lessons.map((lesson) => lesson.coach).filter(Boolean))
    .filter((coach) => coach !== target.coach)
    .map((coach) => {
      const lessons = state.lessons
        .filter((lesson) => lesson.coach === coach && lesson.day === target.day && lessonsOverlap(target, lesson))
        .sort(sortLessons);
      return { coach, lessons };
    })
    .filter((item) => item.lessons.length)
    .sort((a, b) => sortLessons(a.lessons[0], b.lessons[0]) || localeSort(a.coach, b.coach));
}

function lessonsOverlap(a, b) {
  if (!Number.isFinite(a.startMinutes) || !Number.isFinite(a.endMinutes)) return false;
  if (!Number.isFinite(b.startMinutes) || !Number.isFinite(b.endMinutes)) return false;
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function summaryLine(text) {
  const item = document.createElement("div");
  item.className = "summary-line";
  item.textContent = text;
  return item;
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
  const trainerSchedule = detectTrainerScheduleTable(rows);
  if (trainerSchedule) return normalizeTrainerScheduleTable(rows, trainerSchedule);

  const headerIndex = detectHeaderRow(rows);
  const headerMap = mapHeaders(rows[headerIndex] || []);
  const hasTableHeaders = Number.isInteger(headerMap.day) || Number.isInteger(headerMap.time) || Number.isInteger(headerMap.coach);

  if (hasTableHeaders) {
    return normalizeTableRows(rows, headerIndex, headerMap);
  }

  return normalizeMatrixRows(rows);
}

function detectTrainerScheduleTable(rows) {
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => cleanValue(cell).toLowerCase());
    return normalized.includes("адрес") &&
      normalized.includes("куратор") &&
      normalized.includes("отделение") &&
      ["пн", "вт", "ср", "чт", "пт", "сб", "вс"].every((day) => normalized.includes(day));
  });

  if (headerIndex === -1) return null;

  const header = rows[headerIndex].map((cell) => cleanValue(cell).toLowerCase());
  const dayColumns = header
    .map((cell, index) => [cell, index])
    .filter(([cell]) => SHORT_DAY_HEADERS[cell])
    .map(([cell, index]) => ({ day: SHORT_DAY_HEADERS[cell], index }));

  return {
    headerIndex,
    addressIndex: header.indexOf("адрес"),
    metroIndex: header.indexOf("метро"),
    curatorIndex: header.indexOf("куратор"),
    schoolIndex: header.indexOf("школа"),
    coachIndex: 5,
    groupCountIndex: header.indexOf("групп"),
    departmentIndex: header.indexOf("отделение"),
    commentIndex: 15,
    statusIndex: header.indexOf("статус"),
    dayColumns
  };
}

function normalizeTrainerScheduleTable(rows, config) {
  const lessons = [];

  rows.slice(config.headerIndex + 1).forEach((row, offset) => {
    const coach = cleanExplicitCoach(valueAt(row, config.coachIndex));
    if (!coach) return;

    const address = cleanPlaceValue(valueAt(row, config.addressIndex));
    const metro = cleanPlaceValue(valueAt(row, config.metroIndex));
    const school = cleanValue(valueAt(row, config.schoolIndex));
    const groupCount = cleanValue(valueAt(row, config.groupCountIndex));
    const department = cleanValue(valueAt(row, config.departmentIndex));
    const comment = cleanValue(valueAt(row, config.commentIndex));
    const status = cleanValue(valueAt(row, config.statusIndex));

    config.dayColumns.forEach(({ day, index }) => {
      const cell = cleanValue(valueAt(row, index));
      const time = normalizeTime(cell);
      if (!time) return;

      const rowNumber = config.headerIndex + offset + 2;
      lessons.push(buildLesson({
        id: `row-${rowNumber}-day-${index + 1}`,
        day,
        time,
        coach,
        group: trainingTitle({ department, school, groupCount }),
        room: [address, metro ? `м. ${metro}` : ""].filter(Boolean).join(" · "),
        note: [status, comment].filter(Boolean).join(" · "),
        title: department || school || "Тренировка",
        source: { row: rowNumber, col: index + 1 }
      }));
    });
  });

  return lessons.sort((a, b) => localeSort(a.coach, b.coach) || sortDays(a.day, b.day) || sortLessons(a, b));
}

function trainingTitle({ department, school, groupCount }) {
  const parts = [];
  if (department) parts.push(department);
  if (school) parts.push(`школа ${school}`);
  if (groupCount) parts.push(`${groupCount} гр.`);
  return parts.join(" · ") || "Тренировка";
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
    const coach = cleanExplicitCoach(valueAt(row, headerMap.coach)) || lastCoach || cleanExplicitCoach(extractLabel(fallback, "тренер"));
    const group = cleanTrainingName(valueAt(row, headerMap.group)) || extractLabel(fallback, "тренировка") || extractLabel(fallback, "занятие") || extractLabel(fallback, "группа");
    const room = cleanValue(valueAt(row, headerMap.room)) || inferRoom("", row);
    const note = cleanValue(valueAt(row, headerMap.note));

    if (isDistrictValue(fallback) || (!coach && !time && isLocationOnlyCell(fallback))) return;
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
      const coach = cleanCoach(extractLabel(joined, "тренер")) || inferCoach([value, ...context]);
      const room = inferRoom(value, context);
      const group = extractLabel(joined, "тренировка") || extractLabel(joined, "занятие") || extractLabel(joined, "урок") || extractLabel(joined, "группа") || cleanTrainingName(value);

      if (!isUsefulLessonCandidate({ value, day, time, coach, group, room })) return;

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
  const text = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text === "#N/A" ? "" : text;
}

function valueAt(row, index) {
  return Number.isInteger(index) ? row[index] : "";
}

function cleanPlaceValue(value) {
  return cleanValue(value)
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
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
  const candidates = context.map(cleanValue).filter(isLikelyCoachName);
  return candidates.at(-1) || "";
}

function cleanCoach(value) {
  const coach = cleanValue(value);
  if (isLikelyLocation(coach) || isDistrictValue(coach)) return "";
  return isLikelyCoachName(coach) ? coach : "";
}

function cleanExplicitCoach(value) {
  const coach = cleanValue(value);
  if (!coach || normalizeDay(coach) || normalizeTime(coach)) return "";
  if (headerKey(coach) || isLikelyLocation(coach) || isDistrictValue(coach)) return "";
  return coach;
}

function inferRoom(value, context) {
  const joined = [value, ...context].join(" · ");
  const labeledRoom =
    extractLabel(joined, "зал") ||
    extractLabel(joined, "адрес") ||
    extractLabel(joined, "школа") ||
    extractLabel(joined, "место");

  if (labeledRoom) return labeledRoom;

  return [value, ...context].map(cleanValue).find((item) => isLikelyLocation(item)) || "";
}

function isLikelyCoachName(value) {
  const text = cleanValue(value);
  if (!text || normalizeDay(text) || normalizeTime(text)) return false;
  if (headerKey(text) || isLikelyLocation(text) || isDistrictValue(text)) return false;
  if (/[0-9,@/#№]/.test(text)) return false;
  if (text.length > 48) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;

  return words.every((word) => /^[А-ЯЁA-Z][а-яёa-z-]+$/.test(word));
}

function cleanTrainingName(value) {
  const lines = cleanValue(value)
    .split(/\r?\n|·/)
    .map(cleanValue)
    .filter(Boolean)
    .filter((line) => !normalizeTime(line))
    .filter((line) => !normalizeDay(line))
    .filter((line) => !isLikelyCoachName(line))
    .filter((line) => !isLikelyLocation(line))
    .filter((line) => !isDistrictValue(line))
    .filter((line) => !headerKey(line));

  return lines[0] || "";
}

function isLikelyLocation(value) {
  const text = cleanValue(value).toLowerCase();
  if (!text) return false;
  return LOCATION_MARKERS.some((marker) => text.includes(marker));
}

function isDistrictValue(value) {
  const text = cleanValue(value).toLowerCase();
  if (!text) return false;
  return DISTRICT_MARKERS.some((marker) => text === marker || text.includes(marker));
}

function isLocationOnlyCell(value) {
  const text = cleanValue(value);
  if (!isLikelyLocation(text)) return false;
  if (normalizeTime(text) || extractLabel(text, "тренер") || extractLabel(text, "группа")) return false;
  return /[0-9№,]/.test(text) || text.length > 28;
}

function isUsefulLessonCandidate({ value, day, time, coach, group, room }) {
  const text = cleanValue(value);
  if (!text || isDistrictValue(text) || isLocationOnlyCell(text)) return false;
  if (isLikelyCoachName(text) && !time && !group) return false;
  if (!coach && !time) return false;
  return Boolean(day || time || coach || group || room);
}

function isSkippableMatrixCell(value) {
  if (headerKey(value)) return true;
  if (normalizeDay(value) === value) return true;
  if (normalizeTime(value) === value) return true;
  if (isDistrictValue(value)) return true;
  if (isLocationOnlyCell(value)) return true;
  return value.length <= 2;
}

function lessonOptionLabel(lesson) {
  const parts = [shortDay(lesson.day), lesson.time, lesson.group || lesson.title, lesson.room].filter(Boolean);
  return parts.join(" · ");
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
