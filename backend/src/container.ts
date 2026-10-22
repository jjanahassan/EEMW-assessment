import { UserRepository } from "./modules/auth/user.repository";
import { DepartmentRepository } from "./modules/departments/department.repository";
import { AuthService } from "./modules/auth/auth.service";
import { env } from "./config/env";
import { LocalStorageProvider } from "./storage/LocalStorageProvider";
import type { StorageProvider } from "./storage/StorageProvider";
import { DocumentRepository } from "./modules/documents/document.repository";
import { DocumentService } from "./modules/documents/document.service";

export const userRepository = new UserRepository();
export const departmentRepository = new DepartmentRepository();

export const authService = new AuthService(userRepository, departmentRepository);

export const storage: StorageProvider = new LocalStorageProvider(env.UPLOAD_DIR); // swap point for S3
export const documentRepository = new DocumentRepository();
export const documentService = new DocumentService(documentRepository, departmentRepository, storage);