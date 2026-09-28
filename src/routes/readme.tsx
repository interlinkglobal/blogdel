import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/readme")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
