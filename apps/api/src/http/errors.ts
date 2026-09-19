/**
 * An error with an HTTP status and a message that is safe to show to users.
 * Services throw these; the app turns them into JSON responses.
 */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new AppError(404, `We couldn’t find that ${what}.`)
