import { Router } from "express";
import { documentSearchService, documentService } from "../../container";
import { authenticate } from "../../middleware/authenticate";
import { cleanupUploadedFile, upload } from "../../middleware/upload";
import { validateBody } from "../../middleware/validate";
import { DocumentsController } from "./document.controller";
import { addVersionSchema, uploadDocumentSchema } from "./document.schemas";


const router = Router();
const controller = new DocumentsController(documentService, documentSearchService);

// order matters: authenticate BEFORE multer, so anonymous requests never write to disk
router.post(
  "/",
  authenticate,
  cleanupUploadedFile,
  upload.single("file"),
  validateBody(uploadDocumentSchema),
  controller.create,
);

router.get("/", authenticate, controller.search);

router.get("/:id", authenticate, controller.getById);

router.get("/:id/versions", authenticate, controller.listVersions);
router.post(
  "/:id/versions",
  authenticate,
  cleanupUploadedFile,
  upload.single("file"),
  validateBody(addVersionSchema),
  controller.addVersion,
);
router.post("/:id/versions/:versionNumber/restore", authenticate, controller.restoreVersion);
router.get("/:id/download", authenticate, controller.download);
router.get("/:id/view", authenticate, controller.view);

export { router as documentsRouter };