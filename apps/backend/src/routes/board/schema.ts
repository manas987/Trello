import { z } from "zod";

export const createBoard = z.object({
  name: z.string().min(1),
  organizationId: z.int().positive(),
});

export const readBoard = z.object({
  orgid: z.int().positive(),
});

export const updateBoard = z.object({
  boardid: z.int().positive(),
  name: z.string(),
});

export const deleteBoard = z.object({
  boardid: z.int().positive(),
});
