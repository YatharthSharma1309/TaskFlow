export type Priority = 'Low' | 'Medium' | 'High';

export type Task = {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  priority: Priority;
  position: number;
  created_at: string;
  column_name?: string;
};

export type Column = {
  id: number;
  board_id: number;
  name: string;
  position: number;
  task_count: number;
  tasks: Task[];
};

export type Board = {
  id: number;
  name: string;
  created_at: string;
  columns: Column[];
};

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];
export const DEFAULT_BOARD_ID = 1;
