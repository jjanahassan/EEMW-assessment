export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = "APP_ERROR",
    public details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", details?: unknown) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, message, "UNAUTHORIZED");
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(403, message, "FORBIDDEN");
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}
export class PayloadTooLargeError extends AppError {
  constructor(message = "File is too large") {
    super(413, message, "PAYLOAD_TOO_LARGE");
  }
}
export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "File type is not allowed") {
    super(415, message, "UNSUPPORTED_MEDIA_TYPE");
  }
}