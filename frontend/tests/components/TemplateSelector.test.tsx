import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TemplateSelector from "@/components/TemplateSelector";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTemplates = [
  { id: 1, name: "平日" },
  { id: 2, name: "休日" },
];

describe("TemplateSelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockTemplates),
      } as Response)
    );
  });

  test("テンプレート一覧が表示される", async () => {
    render(<TemplateSelector />);

    await waitFor(() => {
      expect(screen.getByText("平日")).toBeInTheDocument();
      expect(screen.getByText("休日")).toBeInTheDocument();
    });
  });

  test("テンプレートをクリックするとrouter.pushが呼ばれる", async () => {
    render(<TemplateSelector />);

    await waitFor(() => screen.getByText("平日"));
    fireEvent.click(screen.getByText("平日"));

    expect(mockPush).toHaveBeenCalledWith("/habits?template_id=1");
  });
});
