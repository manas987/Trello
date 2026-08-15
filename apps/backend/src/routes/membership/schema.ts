import { z } from "zod";

export const leaveMembership = z.object({
  orgId: z.int().positive(),
});
