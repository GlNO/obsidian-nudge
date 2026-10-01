export type ItemType = "task" | "event";

export interface AgendaItem {

	id: string;
	type: ItemType;
	title: string;
	data: string;
	time?: string;
	done: boolean;
	filePath: string;
	line: number; 
	completedOn?: string; 
}
