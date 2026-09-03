import { z } from "zod";

export const createInvite = z.object({
  orgid: z.int().positive(),
  userEmail: z.email(),
  role: z.enum(["admin", "member"]),
});

export const readSentInvite = z.object({
  orgid: z.int().positive(),
});

export const acceptInvite = z.object({
  inviteId: z.int().positive(),
});

export const deleteInvite = z.object({
  inviteId: z.int().positive(),
});
