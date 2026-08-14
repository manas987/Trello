import { z } from "zod";

export const createIssue = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sectionId: z.int().positive(),
});

export const readIssue = z.object({
  sectionid: z.int().positive(),
});

export const updateIssue = z
  .object({
    Issueid: z.int().positive(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined);

export const moveIssue = z.object({
  newSectionId: z.int().positive(),
  issueId: z.int().positive(),
});

export const deleteIssue = z.object({
  Issueid: z.int().positive(),
});
