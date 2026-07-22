import { redirect } from "next/navigation";

/** middleware에서도 / 를 처리하지만, 직접 렌더 시 폴백 */
export default function HomePage() {
  redirect("/dashboard");
}
