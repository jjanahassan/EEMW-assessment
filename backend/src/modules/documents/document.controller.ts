import { Request, Response } from "express";
import { ValidationError } from "../../errors/AppError";
import type { DocumentService } from "./document.service";
import type { DocumentSearchService } from "./document.search.service";
import { documentIdSchema, searchQuerySchema } from "./document.schemas";

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
}