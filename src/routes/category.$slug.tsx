import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/category/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/blogs",
      search: { category: params.slug } as any,
    });
  },
});
