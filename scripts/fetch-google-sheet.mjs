import { mkdir, writeFile } from "node:fs/promises";

const source = {
  title: "Рабочая таблица расписания",
  spreadsheetId: "1j80t7W_-ouSPeGQoEUMu-o4RUBXw1VjcB3zIR-ym8fo",
  gid: "133047740",
  url: "https://docs.google.com/spreadsheets/d/1j80t7W_-ouSPeGQoEUMu-o4RUBXw1VjcB3zIR-ym8fo/edit?gid=133047740#gid=133047740"
};

const csvUrls = [
  `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/gviz/tq?tqx=out:csv&gid=${source.gid}`,
  `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/export?format=csv&gid=${source.gid}`
];

const csv = await fetchFirstCsv(csvUrls);
const rawRows = parseCsv(csv);

if (!rawRows.length) {
  throw new Error("Google Sheets returned an empty CSV.");
}

const data = {
  source,
  updatedAt: new Date().toISOString(),
  rawRows
};

await mkdir("data", { recursive: true });
await writeFile("data/schedule.json", `${JSON.stringify(data, null, 2)}\n`, "utf8");
await writeFile("data/schedule.js", `window.COACH_SCHEDULE_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");

console.log(`Imported ${rawRows.length} rows from Google Sheets.`);

async function fetchFirstCsv(urls) {
  let lastError;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "coach-dashboard/1.0"
        }
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (/^\s*</.test(text)) {
        throw new Error("received HTML instead of CSV");
      }

      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No CSV endpoint responded.");
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
  return rows
    .map((item) => item.map(cleanValue))
    .filter((item) => item.some(Boolean));
}

function cleanValue(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
