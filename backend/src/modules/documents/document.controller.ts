import { Request, Response } from "express";
import { pipeline } from "stream/promises";
import { UnsupportedMediaTypeError, ValidationError } from "../../errors/AppError";
import { contentDisposition } from "../../utils/http";
import type { DocumentSearchService } from "./document.search.service";
import type { DocumentService } from "./document.service";
import {
  documentIdSchema,
  searchQuerySchema,
  versionNumberSchema,
  versionQuerySchema,
} from "./document.schemas";
import { PREVIEWABLE_MIME_TYPES } from "./fileTypes";

const isClientAbort = (err: unknown) =>
  ["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET"].includes((err as NodeJS.ErrnoException)?.code ?? "");

export class DocumentsController {
  constructor(
    private service: DocumentService,
    private searchService: DocumentSearchService,
  ) {}

  create = async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError("A file is required", [{ path: "file", message: "Send the file in the multipart field named 'file'" }]);
    }
    const document = await this.service.upload(req.user!, req.body, {
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
    });
    res.status(201).json({ document });
  };

  getById = async (req: Request, res: Response) => {
    const id = documentIdSchema.parse(req.params.id);
    res.json({ document: await this.service.getById(req.user!, id) });
  };

  search = async (req: Request, res: Response) => {
    const params = searchQuerySchema.parse(req.query);
    const { value, cached } = await this.searchService.search(req.user!, params);
    res.setHeader("X-Cache", cached ? "HIT" : "MISS");
    res.json(value);
  };

  // ---------- versions ----------

  listVersions = async (req: Request, res: Response) => {
    const id = documentIdSchema.parse(req.params.id);
    res.json({ versions: await this.service.listVersions(req.user!, id) });
  };

  addVersion = async (req: Request, res: Response) => {
    const id = documentIdSchema.parse(req.params.id);
    if (!req.file) {
      throw new ValidationError("A file is required", [{ path: "file", message: "Send the file in the multipart field named 'file'" }]);
    }
    const document = await this.service.addVersion(
      req.user!,
      id,
      { path: req.file.path, originalName: req.file.originalname, size: req.file.size },
      req.body.changeNote,
    );
    res.status(201).json({ document });
  };

  restoreVersion = async (req: Request, res: Response) => {
    const id = documentIdSchema.parse(req.params.id);
    const versionNumber = versionNumberSchema.parse(req.params.versionNumber);
    res.status(201).json({ document: await this.service.restoreVersion(req.user!, id, versionNumber) });
  };

  // ---------- download / view ----------

  download = (req: Request, res: Response) => this.sendFile(req, res, "attachment");
  view = (req: Request, res: Response) => this.sendFile(req, res, "inline");

  private sendFile = async (req: Request, res: Response, disposition: "attachment" | "inline") => {
    const id = documentIdSchema.parse(req.params.id);
    const { version } = versionQuerySchema.parse(req.query);

    const file = await this.service.getFile(req.user!, id, version); // permission + version lookup

    if (disposition === "inline" && !PREVIEWABLE_MIME_TYPES.has(file.mimeType)) {
      throw new UnsupportedMediaTypeError("This file type cannot be previewed in the browser; use /download instead");
    }

    // The checksum identifies the content. "private, no-cache" means the browser must ask us every
    // time (so permissions are re-checked) but can skip re-downloading with a 304.
    const etag = `"${file.checksumSha256}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    const stream = await this.service.openFile(file);
    res.setHeader("Content-Type", file.mimeType === "text/plain" ? "text/plain; charset=utf-8" : file.mimeType);
    res.setHeader("Content-Length", String(file.sizeBytes));
    res.setHeader("Content-Disposition", contentDisposition(disposition, file.fileName));

    try {
      await pipeline(stream, res);
    } catch (err) {
      if (isClientAbort(err)) return; // the user cancelled the download: not an error
      throw err;
    }

    if (disposition === "attachment") await this.service.recordDownload(id);
  };
}