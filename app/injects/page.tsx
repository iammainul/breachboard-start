import { redirect } from "next/navigation";

export default function InjectsPage() {
  redirect("/generate?mode=inject");
}
