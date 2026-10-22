import type { AuthUser } from "../auth/auth.types";
import type { SearchParams } from "./document.schemas";
import type { DocumentSearchRepository } from "./document.search.repository";
import type { SearchCache } from "./document.search.cache";
import type { SearchResult } from "./document.types";

export class DocumentSearchService {
  constructor(
    private repository: DocumentSearchRepository,
    private cache: SearchCache,
  ) {}

  search(user: AuthUser, params: SearchParams) {
    // Results differ per user (own restricted documents, department), so the scope is part of the key
    const scope = user.role === "admin" ? "admin" : `u:${user.id}:d:${user.departmentId}`;
    return this.cache.getOrCompute<SearchResult>(scope, params, () => this.repository.search(user, params));
  }
}