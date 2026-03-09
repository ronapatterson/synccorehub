import { redirect } from "next/navigation";

// Root redirect → /dashboard (middleware handles auth)
export default function HomePage() {
  redirect("/dashboard");
}
