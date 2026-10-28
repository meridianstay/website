/**
 * An error with an HTTP status and a message that is safe to show to users.
 * Services throw these; the app turns them into JSON responses.
 */
export class AppError extends Error {
  constructor(
    /** 402 is 'you need a plan for that': the client is signed in, but hasn't paid for this part. */
    public status: 400 | 401 | 402 | 403 | 404 | 409 | 429 | 502 | 503,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new AppError(404, `We couldn’t find that ${what}.`)
