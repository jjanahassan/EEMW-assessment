import { z } from "zod";
import { ALLOWED_EXTENSIONS } from "./fileTypes";

// Multipart text fields arrive as strings. Accept "a, b" or a repeated field (tags=a&tags=b).
const toArray = (v: unknown) => {
  if (v === undefined || v === null || v === "") return [];
  const list = Array.isArray(v) ? v : String(v).split(",");
  return list.map((s) => String(s).trim()).filter(Boolean);
};

const tagName = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[\p{L}\p{N} _.&-]+$/u, "Tags may contain letters, numbers, spaces and - _ . &");

const tagsField = z
  .preprocess(toArray, z.array(tagName).max(10, "At most 10 tags"))
  .transform((tags) => [...new Map(tags.map((t) => [t.toLowerCase(), t])).values()]); // case-insensitive dedupe

const departmentIdsField = z
  .preprocess(toArray, z.array(z.coerce.number().int().positive()).max(20))
  .transform((ids) => [...new Set(ids)]);

export const uploadDocumentSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || undefined),
    tags: tagsField,
    visibility: z.enum(["public", "restricted"]).default("public"),
    departmentIds: departmentIdsField,
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "public" && data.departmentIds.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["departmentIds"],
        message: "departmentIds can only be used when visibility is 'restricted'",
      });
    }
  });

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const documentIdSchema = z.uuid("Invalid document id");

const lowerUnique = (list: string[]) => [...new Set(list.map((s) => s.toLowerCase()))];

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional().transform((v) => v || undefined),
    tags: z.preprocess(toArray, z.array(z.string().max(50)).max(10)).transform(lowerUnique),
    tagMode: z.enum(["all", "any"]).default("all"),
    uploader: z.string().trim().max(100).optional().transform((v) => v || undefined),
    fileType: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => ALLOWED_EXTENSIONS.includes(v), "Unsupported file type")
      .optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.enum(["relevance", "newest", "oldest", "title", "downloads"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "'from' must not be after 'to'" });
    }
  });

export type SearchParams = z.infer<typeof searchQuerySchema>;

export const addVersionSchema = z.object({
  changeNote: z.string().trim().max(500).optional().transform((v) => v || undefined),
});

export const versionQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export const versionNumberSchema = z.coerce.number().int().min(1, "Invalid version number");