import { z } from "zod";
import { describe } from "zod/v4/core";

export const createOrg = z.object({
  name: z.string().min(1),
  description: z.string,
});

