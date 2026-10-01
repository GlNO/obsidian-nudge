import { AgendaItem } from "./types";

const TASK_RE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
const TABLE_RE = /^\s*\|\s*(.*?)\s*\|\s*(\d{4}-\d{1,2}-\d{1,2})\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/;
const DUE_RE  = /(?:^|\s)@(\d{4}-\d{1,2}-\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/;
const DONE_RE = /(?:^|\s)done:(\d{4}-\d{1,2}-\d{1,2})/;

function pad(s: string): string {
  return s.padStart(2, "0");
}
function normalizeDate(s: string | undefined): string {
  if (!s) return "";
  const parts = s.split("-");
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

function normalizeTime(s: string | undefined): string {
  if (!s) return "";
  const [h, m] = s.split(":");
  if (!h || !m) return "";
  return `${pad(h)}:${m}`;
}

function isValidDate(s: string | undefined): boolean {
  if (!s) return false;
  const parts = s.split("-");
  const [y, m, d] = parts;

  if (!y || !m || !d) return false;  
  const nums = parts.map(Number);
  if (nums.length !== 3 || nums.some(isNaN)) return false;
  const [yNum, mNum, dNum] = nums;
  if (yNum === undefined || mNum === undefined || dNum === undefined) return false;
  const dt = new Date(yNum, mNum - 1, dNum);
  return (
    dt.getFullYear() === yNum &&
    dt.getMonth() === mNum - 1 &&
    dt.getDate() === dNum
  );
}


export function parseLine(
  text: string,
  filePath: string,
  line: number
): AgendaItem | null {
  const table = TABLE_RE.exec(text);
  if (table) {
    const title = table[1]?.trim() ?? "";
    const dateStr = table[2]?.trim();
    if (!dateStr) return null;
    
    const date = normalizeDate(dateStr);
    if (!title || !isValidDate(date) || /^[-:]+$/.test(title)) return null;

    const time = table[3]?.trim() || undefined;
    const completedOn = table[4]?.trim() || undefined;
    return {
      id: `${filePath}:${line}`,
      type: "task",
      title,
      date,
      time,
      done: completedOn !== undefined,
      completedOn,
      filePath,
      line,
    };
  }

  const task = TASK_RE.exec(text);
  if (!task) return null;

  const body = task[2];
  if (body === undefined) return null;


  const due = DUE_RE.exec(body);
  if (!due || !due[1]) return null; 

  const date = normalizeDate(due[1]);
  if (!isValidDate(date)) return null;

  const time = due[2] ? normalizeTime(due[2]) : undefined;

  const completed = DONE_RE.exec(body);
  const completedOn = completed && completed[1] ? normalizeDate(completed[1]) : undefined; 

  const done = task[1]?.toLowerCase?.() === "x" || completedOn !== undefined; 

  const title = body
    .replace(DUE_RE, "")
    .replace(new RegExp(DONE_RE.source, "g"), "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: `${filePath}:${line}`,
    type: "task",
    title,
    date,
    time,
    done,
    completedOn,
    filePath,
    line,
  };
}