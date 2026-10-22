import { Router } from "express";
import { departmentRepository } from "../../container";

const router = Router();

router.get("/", async (_req, res) => {
  res.json({ departments: await departmentRepository.list() });
});

export { router as departmentsRouter };