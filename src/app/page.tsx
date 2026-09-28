import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";

export default async function Home() {
  const session = await getSession();
  redirect(session?.userId ? "/hoohr" : "/login");
}
