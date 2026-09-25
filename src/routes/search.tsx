import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  category: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/blogs",
      search: {
        q: search.q || undefined,
        category: search.category,
      } as any,
    });
  },
});
