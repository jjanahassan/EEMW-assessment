import { describe, expect, it } from "vitest";
import { canAccessDocument, canModifyDocument } from "../src/modules/documents/document.policy";
import type { AuthUser } from "../src/modules/auth/auth.types";

const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: "u-1", name: "U", email: "u@x.com", role: "employee", departmentId: 1, departmentName: "Finance", ...over,
});
const doc = (over = {}) => ({
  uploader: { id: "owner", name: "O", departmentId: 3 },
  visibility: "restricted" as const,
  allowedDepartmentIds: [2],
  ...over,
});

describe("canAccessDocument", () => {
  it("lets an admin see anything", () => {
    expect(canAccessDocument(user({ role: "admin" }), doc())).toBe(true);
  });
  it("lets the uploader see their own restricted document", () => {
    expect(canAccessDocument(user({ id: "owner", departmentId: 9 }), doc())).toBe(true);
  });
  it("lets anyone see a public document", () => {
    expect(canAccessDocument(user(), doc({ visibility: "public", allowedDepartmentIds: [] }))).toBe(true);
  });
  it("lets a listed department see a restricted document", () => {
    expect(canAccessDocument(user({ departmentId: 2 }), doc())).toBe(true);
  });
  it("blocks other departments, even managers", () => {
    expect(canAccessDocument(user({ departmentId: 1, role: "manager" }), doc())).toBe(false);
  });
});

describe("canModifyDocument", () => {
  const d = { uploader: { id: "owner", name: "O", departmentId: 3 } };
  it("lets an admin modify anything", () => {
    expect(canModifyDocument(user({ role: "admin" }), d)).toBe(true);
  });
  it("lets the uploader modify their own document", () => {
    expect(canModifyDocument(user({ id: "owner" }), d)).toBe(true);
  });
  it("lets a manager of the uploader's department modify it", () => {
    expect(canModifyDocument(user({ role: "manager", departmentId: 3 }), d)).toBe(true);
  });
  it("blocks managers of other departments and ordinary colleagues", () => {
    expect(canModifyDocument(user({ role: "manager", departmentId: 1 }), d)).toBe(false);
    expect(canModifyDocument(user({ role: "employee", departmentId: 3 }), d)).toBe(false);
  });
});