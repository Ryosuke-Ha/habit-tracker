import TodoItem, { TodoEntry } from "./TodoItem";

export interface DailyLogEntry {
  logId: number;
  habitId: number | null;
  title: string;
  scheduledTime: string;
  location: string;
  isChecked: boolean;
}

interface PersistentTodo {
  id: number;
  title: string;
  scheduled_time: string | null;
  location: string | null;
  is_completed: boolean;
}

interface HabitListProps {
  dailyLogs: DailyLogEntry[];
  persistentTodos: PersistentTodo[];
  onToggleLog: (logId: number) => void;
  onDeleteLog: (logId: number) => void;
  onEditLog: (logId: number, habitId: number | null, data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
  onTogglePersistent: (id: number) => void;
  onDeletePersistent: (id: number) => void;
  onEditPersistent: (id: number, data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
}

export default function HabitList({
  dailyLogs,
  persistentTodos,
  onToggleLog,
  onDeleteLog,
  onEditLog,
  onTogglePersistent,
  onDeletePersistent,
  onEditPersistent,
}: HabitListProps) {
  type UnifiedItem =
    | { kind: "log"; log: DailyLogEntry }
    | { kind: "persistent"; todo: PersistentTodo };

  const items: UnifiedItem[] = [
    ...dailyLogs.map((log) => ({ kind: "log" as const, log })),
    ...persistentTodos.map((t) => ({ kind: "persistent" as const, todo: t })),
  ].sort((a, b) => {
    const timeA = a.kind === "log" ? a.log.scheduledTime : (a.todo.scheduled_time ?? "99:99");
    const timeB = b.kind === "log" ? b.log.scheduledTime : (b.todo.scheduled_time ?? "99:99");
    return timeA.localeCompare(timeB);
  });

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 py-8 text-sm">
        TODOがまだありません。上の「+ TODOを追加」から追加してください。
      </p>
    );
  }

  const doneCount = items.filter((item) =>
    item.kind === "log" ? item.log.isChecked : item.todo.is_completed
  ).length;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3 text-right">
        {doneCount} / {items.length} 完了
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          if (item.kind === "log") {
            const { log } = item;
            const entry: TodoEntry = {
              kind: "habit",
              logId: log.logId,
              habitId: log.habitId,
              title: log.title,
              scheduledTime: log.scheduledTime,
              location: log.location,
              isChecked: log.isChecked,
            };
            return (
              <TodoItem
                key={`log-${log.logId}`}
                item={entry}
                onToggle={() => onToggleLog(log.logId)}
                onDelete={() => onDeleteLog(log.logId)}
                onEdit={(data) => onEditLog(log.logId, log.habitId, data)}
              />
            );
          } else {
            const { todo } = item;
            const entry: TodoEntry = {
              kind: "persistent",
              id: todo.id,
              title: todo.title,
              scheduledTime: todo.scheduled_time,
              location: todo.location,
              isCompleted: todo.is_completed,
            };
            return (
              <TodoItem
                key={`persistent-${todo.id}`}
                item={entry}
                onToggle={() => onTogglePersistent(todo.id)}
                onDelete={() => onDeletePersistent(todo.id)}
                onEdit={(data) => onEditPersistent(todo.id, data)}
              />
            );
          }
        })}
      </ul>
    </div>
  );
}
