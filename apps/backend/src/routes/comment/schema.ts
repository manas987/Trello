import { z } from "zod";

export const createComment = z.object({
  issueId: z.int().positive(),
  comment: z.string().min(1),
});

export const readComment = z.object({
  issueId: z.int().positive(),
});

export const updateComment = z.object({
  commentId: z.int().positive(),
  comment: z.string().min(1),
});

export const deleteComment = z.object({
  commentId: z.int().positive(),
});
