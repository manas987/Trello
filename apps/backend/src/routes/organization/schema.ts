import { z } from "zod";

export const createOrg = z.object({
  name: z.string().min(1),
  description: z.string(),
});

export const updateOrg = z
  .object({
    orgid:z.int().positive(),
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined);

export const deleteOrg=z.object({
    orgid:z.int().positive(),
})