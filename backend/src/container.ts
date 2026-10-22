import { env } from "./config/env";
import { redis } from "./config/redis";
import { EventBus } from "./events/eventBus";
import { UserRepository } from "./modules/auth/user.repository";
import { AuthService } from "./modules/auth/auth.service";
import { DepartmentRepository } from "./modules/departments/department.repository";
import { DocumentRepository } from "./modules/documents/document.repository";
import { DocumentService } from "./modules/documents/document.service";
import { DocumentSearchRepository } from "./modules/documents/document.search.repository";
import { DocumentSearchService } from "./modules/documents/document.search.service";
import { SearchCache } from "./modules/documents/document.search.cache";
import { TagRepository } from "./modules/tags/tag.repository";
import { LocalStorageProvider } from "./storage/LocalStorageProvider";
import type { StorageProvider } from "./storage/StorageProvider";

export const userRepository = new UserRepository();
export const departmentRepository = new DepartmentRepository();
export const tagRepository = new TagRepository();
export const documentRepository = new DocumentRepository();

export const storage: StorageProvider = new LocalStorageProvider(env.UPLOAD_DIR); // swap point for S3
export const eventBus = new EventBus();
export const searchCache = new SearchCache(redis);

export const authService = new AuthService(userRepository, departmentRepository);
export const documentService = new DocumentService(documentRepository, departmentRepository, storage, eventBus);
export const documentSearchService = new DocumentSearchService(new DocumentSearchRepository(), searchCache);

// Observer: any document change invalidates cached searches
eventBus.subscribe(async (event) => {
  if (event.type.startsWith("document.")) await searchCache.invalidateAll();
});