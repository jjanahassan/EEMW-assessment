import { z } from "zod";

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