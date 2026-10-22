import { Router } from "express";
import { z } from "zod";
import { tagRepository } from "../../container";
import { authenticate } from "../../middleware/authenticate";

const querySchema = z.object({ q: z.string().trim().max(50).optional() });
const router = Router();

router.get("/", authenticate, async (req, res) => {
  const { q } = querySchema.parse(req.query);
  res.json({ tags: await tagRepository.suggest(q) });
});

export { router as tagsRouter };