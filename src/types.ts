export type ItemType = "task" | "event";

export interface AgendaItem {

	id: string;
	type: ItemType;
	title: string;
	date: string;
	time?: string;
	done: boolean;
	filePath: string;
	line: number; 
	completedOn?: string; 
}
