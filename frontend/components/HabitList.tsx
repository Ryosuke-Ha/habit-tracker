import TodoItem, { TodoEntry } from "./TodoItem";

interface Habit {
  id: number;
  title: string;
  scheduled_time: string;
  location: string;
}

interface HabitLog {
  logId: number;
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
  habits: Habit[];
  habitLogs: Record<number, HabitLog>;
  persistentTodos: PersistentTodo[];
  onToggleHabit: (habitId: number) => void;
  onDeleteHabit: (habitId: number) => void;
  onEditHabit: (habitId: number, data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
  onTogglePersistent: (id: number) => void;
  onDeletePersistent: (id: number) => void;
  onEditPersistent: (id: number, data: { title: string; scheduled_time: string; location: string }) => Promise<void>;
}

export default function HabitList({
  habits,
  habitLogs,
  persistentTodos,
  onToggleHabit,
  onDeleteHabit,
  onEditHabit,
  onTogglePersistent,
  onDeletePersistent,
  onEditPersistent,
}: HabitListProps) {
  // Build unified sorted list
  type UnifiedItem =
    | { kind: "habit"; habit: Habit; log: HabitLog }
    | { kind: "persistent"; todo: PersistentTodo };

  const items: UnifiedItem[] = [
    ...habits.map((h) => ({
      kind: "habit" as const,
      habit: h,
      log: habitLogs[h.id] ?? { logId: 0, isChecked: false },
    })),
    ...persistentTodos.map((t) => ({ kind: "persistent" as const, todo: t })),
  ].sort((a, b) => {
    const timeA = a.kind === "habit" ? a.habit.scheduled_time : (a.todo.scheduled_time ?? "99:99");
    const timeB = b.kind === "habit" ? b.habit.scheduled_time : (b.todo.scheduled_time ?? "99:99");
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
    item.kind === "habit" ? item.log.isChecked : item.todo.is_completed
  ).length;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3 text-right">
        {doneCount} / {items.length} 完了
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          if (item.kind === "habit") {
            const entry: TodoEntry = {
              kind: "habit",
              id: item.habit.id,
              logId: item.log.logId,
              title: item.habit.title,
              scheduledTime: item.habit.scheduled_time,
              location: item.habit.location,
              isChecked: item.log.isChecked,
            };
            return (
              <TodoItem
                key={`habit-${item.habit.id}`}
                item={entry}
                onToggle={() => onToggleHabit(item.habit.id)}
                onDelete={() => onDeleteHabit(item.habit.id)}
                onEdit={(data) => onEditHabit(item.habit.id, data)}
              />
            );
          } else {
            const entry: TodoEntry = {
              kind: "persistent",
              id: item.todo.id,
              title: item.todo.title,
              scheduledTime: item.todo.scheduled_time,
              location: item.todo.location,
              isCompleted: item.todo.is_completed,
            };
            return (
              <TodoItem
                key={`persistent-${item.todo.id}`}
                item={entry}
                onToggle={() => onTogglePersistent(item.todo.id)}
                onDelete={() => onDeletePersistent(item.todo.id)}
                onEdit={(data) => onEditPersistent(item.todo.id, data)}
              />
            );
          }
        })}
      </ul>
    </div>
  );
}
