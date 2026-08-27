import { redirect } from "next/navigation";

// Login has been intentionally removed for this deployment — see README.
// Anyone landing here is sent straight into the auto-authenticated dashboard.
export default function LoginPage() {
  redirect("/dashboard");
}
