import { describe, expect, it } from "vitest";
import { searchQuerySchema } from "../src/modules/documents/document.schemas";
import { buildSearchQuery } from "../src/modules/documents/document.search.sql";
import type { AuthUser } from "../src/modules/auth/auth.types";

const employee: AuthUser = {
  id: "u-1", name: "E", email: "e@x.com", role: "employee", departmentId: 1, departmentName: "Finance",
};
const admin: AuthUser = { ...employee, role: "admin" };
const parse = (query: Record<string, unknown> = {}) => searchQuerySchema.parse(query);

describe("searchQuerySchema", () => {
  it("applies defaults", () => {
    expect(parse()).toMatchObject({ page: 1, limit: 10, tagMode: "all", tags: [] });
  });
  it("splits, lowercases and de-duplicates tags", () => {
    expect(parse({ tags: "Finance, HR,finance" }).tags).toEqual(["finance", "hr"]);
  });
  it("treats an empty q as no query", () => {
    expect(parse({ q: "   " }).q).toBeUndefined();
  });
  it("rejects bad values", () => {
    expect(() => parse({ limit: "1000" })).toThrow();
    expect(() => parse({ sort: "banana" })).toThrow();
    expect(() => parse({ page: "0" })).toThrow();
    expect(() => parse({ fileType: "exe" })).toThrow();
    expect(() => parse({ from: "2026-12-01", to: "2026-01-01" })).toThrow();
  });
});

describe("buildSearchQuery", () => {
    it("adds the permission clause for employees but not for admins", () => {
    const forEmployee = buildSearchQuery(employee, parse());
    const forAdmin = buildSearchQuery(admin, parse());

    // the filter is the only place that contains this condition
    expect(forEmployee.sql).toContain("d.visibility = 'public'");
    expect(forEmployee.values).toEqual(expect.arrayContaining(["u-1", 1])); // user id and department id

    expect(forAdmin.sql).not.toContain("d.visibility = 'public'");
    expect(forAdmin.values).not.toContain("u-1");
  });
  it("never puts user input into the SQL text", () => {
    const evil = "x'; DROP TABLE documents;--";
    const { sql, values } = buildSearchQuery(employee, parse({ q: evil }));
    expect(sql).not.toContain("DROP TABLE");
    expect(values).toContain(evil);
  });
  it("escapes LIKE wildcards", () => {
    const { values } = buildSearchQuery(employee, parse({ q: "100%" }));
    expect(values).toContain("%100\\%%");
  });
  it("falls back to newest when relevance is requested without q", () => {
    const { sql } = buildSearchQuery(employee, parse({ sort: "relevance" }));
    expect(sql).not.toContain("ts_rank");
  });
  it("computes limit and offset from page and size", () => {
    const { values } = buildSearchQuery(employee, parse({ page: "3", limit: "10" }));
    expect(values.at(-2)).toBe(10);
    expect(values.at(-1)).toBe(20);
  });
});