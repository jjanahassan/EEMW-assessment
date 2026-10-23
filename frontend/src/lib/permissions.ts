import type { DocumentDetail, User } from "./types";

// UI convenience only. The API enforces the real rule (backend document.policy.ts).
export function canModifyDocument(user: User | null, doc: Pick<DocumentDetail, "uploader">): boolean {
  if (!user) return false;
  if (user.role === "admin" || doc.uploader.id === user.id) return true;
  return user.role === "manager" && doc.uploader.departmentId === user.departmentId;
}