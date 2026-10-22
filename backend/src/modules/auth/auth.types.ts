export type UserRole = "admin" | "manager" | "employee";

// what the rest of the app is allowed to see about a user
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: number;
  departmentName: string;
}