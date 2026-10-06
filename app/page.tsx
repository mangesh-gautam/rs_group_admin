import { redirect } from "next/navigation";

// Entry point: send users to the (dummy) auth screen.
export default function Home() {
  redirect("/login");
}
