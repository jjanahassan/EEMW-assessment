import bcrypt from "bcryptjs";
import type { UserRepository } from "./user.repository";
import type { DepartmentRepository } from "../departments/department.repository";
import { ConflictError, UnauthorizedError, ValidationError } from "../../errors/AppError";
import { LoginInput, RegisterInput } from "./auth.schemas";
import { signToken } from "./token";

const BCRYPT_ROUNDS = 10;
// compared against when the email is unknown, so timing doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync("timing-attack-protection", BCRYPT_ROUNDS);

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === "23505";

export class AuthService {
  constructor(
    private users: UserRepository,
    private departments: DepartmentRepository,
  ) {}

  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();

    if (!(await this.departments.exists(input.departmentId))) {
      throw new ValidationError("Invalid input", [{ path: "departmentId", message: "Department does not exist" }]);
    }
    if (await this.users.emailExists(email)) {
      throw new ConflictError("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    try {
      const user = await this.users.create({
        name: input.name,
        email,
        passwordHash,
        departmentId: input.departmentId,
      });
      return { user, token: signToken(user.id) };
    } catch (err) {
      // two simultaneous registrations can pass the check above; the DB index is the final guard
      if (isUniqueViolation(err)) throw new ConflictError("Email is already registered");
      throw err;
    }
  }

  async login(input: LoginInput) {
    const record = await this.users.findCredentialsByEmail(input.email.toLowerCase());
    const passwordOk = await bcrypt.compare(input.password, record?.passwordHash ?? DUMMY_HASH);

    if (!record || !passwordOk) throw new UnauthorizedError("Invalid email or password");
    return { user: record.user, token: signToken(record.user.id) };
  }
}