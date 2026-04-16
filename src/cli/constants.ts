import { TaskStatus } from '../task/types.js';

export const STATUS_COLORS: Record<TaskStatus, string> = {
  in_progress: 'green',
  completed: 'blue',
  blocked: 'red',
  paused: 'yellow',
};
