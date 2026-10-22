import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "../src/modules/auth/auth.service";

const user = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Test User",
  email: "test@company.com",
  role: "employee" as const,
  departmentId: 1,
  departmentName: "Finance",
};

function makeService(usersOverrides: Record<string, unknown> = {}, deptExists = true) {
  const users = {
    emailExists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(user),
    findCredentialsByEmail: vi.fn().mockResolvedValue(null),
    ...usersOverrides,
  };
  const departments = { exists: vi.fn().mockResolvedValue(deptExists) };
  return { service: new AuthService(users as never, departments as never), users };
}

const registerInput = { name: "Test User", email: "Test@Company.com", password: "Password123!", departmentId: 1 };

describe("AuthService.register", () => {
  it("creates a user with a lowercase email and returns a token without the password hash", async () => {
    const { service, users } = makeService();
    const result = await service.register(registerInput);

    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email: "test@company.com" }));
    expect(result.token).toEqual(expect.any(String));
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("rejects an email that is already registered with 409", async () => {
    const { service } = makeService({ emailExists: vi.fn().mockResolvedValue(true) });
    await expect(service.register(registerInput)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects an unknown department with 400", async () => {
    const { service } = makeService({}, false);
    await expect(service.register(registerInput)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("AuthService.login", () => {
  it("returns a token for correct credentials", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 4);
    const { service } = makeService({
      findCredentialsByEmail: vi.fn().mockResolvedValue({ user, passwordHash }),
    });
    const result = await service.login({ email: "test@company.com", password: "Password123!" });
    expect(result.user.id).toBe(user.id);
    expect(result.token).toEqual(expect.any(String));
  });

  it("rejects a wrong password with 401", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 4);
    const { service } = makeService({
      findCredentialsByEmail: vi.fn().mockResolvedValue({ user, passwordHash }),
    });
    await expect(service.login({ email: "test@company.com", password: "wrong-pass1" })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("gives the same 401 message for an unknown email", async () => {
    const { service } = makeService();
    await expect(service.login({ email: "nobody@company.com", password: "Password123!" })).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid email or password",
    });
  });
});