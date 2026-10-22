// Escapes % _ and \ so user input is matched literally inside LIKE / ILIKE patterns
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");