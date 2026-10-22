import type { AuthUser } from "../auth/auth.types";
import type { DocumentDetail } from "./document.types";

type Accessible = Pick<DocumentDetail, "uploader" | "visibility" | "allowedDepartmentIds">;

export function canAccessDocument(user: AuthUser, doc: Accessible): boolean {
  if (user.role === "admin") return true;
  if (doc.uploader.id === user.id) return true;
  if (doc.visibility === "public") return true;
  return doc.allowedDepartmentIds.includes(user.departmentId);
}