import { z } from "zod";

export const genreListItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  count: z.number().int().nonnegative().optional(),
});

export type GenreListItem = z.infer<typeof genreListItemSchema>;
