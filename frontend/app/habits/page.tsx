import { redirect } from "next/navigation";

// habits ページは廃止。/ に統合済み。
export default function HabitsPage() {
  redirect("/");
}
