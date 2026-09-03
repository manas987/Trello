import { z } from "zod";

export const readMembership = z.object({
  orgid: z.int().positive(),
});

export const kickMembership = z.object({
  orgId: z.int().positive(),
  userId: z.int().positive(),
});

export const leaveMembership = z.object({
  orgId: z.int().positive(),
});
