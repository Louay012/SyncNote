import { redirect } from "next/navigation";

export const metadata = {
  title: "Auth | SyncNote"
};

export default function LoginPage() {
  redirect("/auth");
}
