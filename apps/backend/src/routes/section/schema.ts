import { z } from "zod";

export const createSection = z.object({
  name: z.string().min(1),
  boardId: z.int().positive(),
});

export const readSection = z.object({
  boardid: z.int().positive(),
});

export const updateSection = z.object({
  sectionid: z.int().positive(),
  name: z.string().min(1),
});

export const deleteSection = z.object({
  sectionid: z.int().positive(),
});
