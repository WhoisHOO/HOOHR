import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { hasAnyUser } from "@/lib/bootstrap";

export default async function Home() {
  if (!(await hasAnyUser())) redirect("/setup");
  const session = await getSession();
  redirect(session?.userId ? "/hoohr" : "/login");
}
