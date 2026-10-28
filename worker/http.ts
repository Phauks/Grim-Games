/** Responses the Worker's own routes share. */

/** Answers that depend on who asks, or change at once, are never cached. */
export const noStore = { 'Cache-Control': 'no-store' };

/** A plain-text answer, usually an error, that is never cached. */
export function text(message: string, status: number): Response {
	return new Response(message, { status, headers: noStore });
}
