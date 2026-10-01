export type ItemType = "task" | "event";

export interface AgendaItem {
  id: string;
  type: "task";
  title: string;
  date: string;  
  time?: string;
  done: boolean;
  completedOn?: string;
  filePath: string;
  line: number;
}
