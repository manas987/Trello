import { positive, z } from "zod";

export const readMembership = z.object({
  orgid: z.int().positive(),
});

export const changeMembership = z.object({
  orgId: z.int().positive(),
  userId: z.int().positive(),
  role: z.enum(["admin", "member"]),
});

export const kickMembership = z.object({
  orgId: z.int().positive(),
  userId: z.int().positive(),
});

export const leaveMembership = z.object({
  orgId: z.int().positive(),
});
