import { PersonCreditsResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { getPersonDetail, PersonNotFoundError } from "./people.service";

export const peopleRouter = new Hono<AuthedEnv>();

peopleRouter.use("*", requireSession);

function parsePersonId(c: { req: { param: (name: string) => string } }): number | null {
  const personId = Number(c.req.param("personId"));
  return Number.isInteger(personId) ? personId : null;
}

peopleRouter.get("/:personId", async (c) => {
  const personId = parsePersonId(c);
  if (personId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  try {
    const detail = await getPersonDetail(c.env, personId);
    return c.json(PersonCreditsResponseSchema.parse(detail));
  } catch (error) {
    if (error instanceof PersonNotFoundError) {
      return c.json({ error: "person_not_found" }, 404);
    }
    throw error;
  }
});
