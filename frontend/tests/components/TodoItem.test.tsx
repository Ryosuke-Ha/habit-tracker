import { render, screen, fireEvent } from "@testing-library/react";
import TodoItem, { HabitEntry, PersistentEntry } from "@/components/TodoItem";

// fetch はサブタスク取得時のみ使用されるためモック
global.fetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve([]) } as Response)
);

const habitItem: HabitEntry = {
  kind: "habit",
  id: 1,
  logId: 10,
  title: "朝の筋トレ",
  scheduledTime: "07:00",
  location: "ジム",
  isChecked: false,
};

const checkedHabitItem: HabitEntry = {
  ...habitItem,
  isChecked: true,
};

const persistentItem: PersistentEntry = {
  kind: "persistent",
  id: 2,
  title: "持ち越しタスク",
  scheduledTime: "09:00",
  location: "自宅",
  isCompleted: false,
};

describe("TodoItem", () => {
  const noop = jest.fn();
  const noopAsync = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => jest.clearAllMocks());

  test("習慣アイテムのタイトル・時刻・場所が表示される", () => {
    render(<TodoItem item={habitItem} onToggle={noop} onDelete={noop} onEdit={noopAsync} />);
    expect(screen.getByText("朝の筋トレ")).toBeInTheDocument();
    expect(screen.getByText(/07:00/)).toBeInTheDocument();
    expect(screen.getByText(/ジム/)).toBeInTheDocument();
  });

  test("チェックボタンをクリックするとonToggleが呼ばれる", () => {
    const onToggle = jest.fn();
    const { container } = render(
      <TodoItem item={habitItem} onToggle={onToggle} onDelete={noop} onEdit={noopAsync} />
    );

    // チェックボタンは rounded-full クラスを持つ最初のボタン
    const checkButton = container.querySelector("button.rounded-full")!;
    fireEvent.click(checkButton);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("チェック済みの場合タイトルに取り消し線クラスが付与される", () => {
    render(<TodoItem item={checkedHabitItem} onToggle={noop} onDelete={noop} onEdit={noopAsync} />);
    const title = screen.getByText("朝の筋トレ");
    expect(title).toHaveClass("line-through");
  });

  test("持ち越しTODOは amber 背景で表示される", () => {
    const { container } = render(
      <TodoItem item={persistentItem} onToggle={noop} onDelete={noop} onEdit={noopAsync} />
    );
    const card = container.querySelector("li");
    expect(card?.className).toContain("amber");
  });
});
