import { UserRepository } from "./modules/auth/user.repository";
import { DepartmentRepository } from "./modules/departments/department.repository";
import { AuthService } from "./modules/auth/auth.service";

export const userRepository = new UserRepository();
export const departmentRepository = new DepartmentRepository();

export const authService = new AuthService(userRepository, departmentRepository);