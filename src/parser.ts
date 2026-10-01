import { AgendaItem } from "./types";

const TASK_RE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
const DUE_RE  = /(?:^|\s)@(\d{4}-\d{1,2}-\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/;
const DONE_RE = /(?:^|\s)done:(\d{4}-\d{1,2}-\d{1,2})/;

function pad(s: string): string {
  return s.padStart(2, "0");
}

function normalizeDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function normalizeTime(s: string): string {
  const [h, m] = s.split(":");
  return `${pad(h)}:${m}`;
}


function isValidDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}



export function parseLine(
  text: string,
  filePath: string,
  line: number
): AgendaItem | null {
  const task = TASK_RE.exec(text);
  if (!task) return null;

  const done = task[1].toLowerCase() === "x";
  const body = task[2];

  const due = DUE_RE.exec(body);
  if (!due) return null;

  const date = normalizeDate(due[1]);
  if (!isValidDate(date)) return null;

  const time = due[2] ? normalizeTime(due[2]) : undefined;

  const completed = DONE_RE.exec(body);
  const completedOn = completed ? normalizeDate(completed[1]) : undefined;

  const title = body
    .replace(DUE_RE, "")
    .replace(DONE_RE, "")
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