import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/category/$slug")({
  validateSearch: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/blogs",
      search: { category: params.slug, page: search.page } as any,
    });
  },
});
