import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/blogdel/AdminShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Blogdel" }, { name: "robots", content: "noindex,nofollow,noarchive" }] }),
  component: () => <AdminShell><Outlet /></AdminShell>,
});
