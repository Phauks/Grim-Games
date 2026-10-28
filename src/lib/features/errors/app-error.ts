/**
 * One problem the app recorded on this device. Everything here may end up in a GitHub issue
 * the user chooses to open, so it holds only the error itself and where in the app it
 * happened: never game state, scripts, player names or room codes.
 */
export interface AppError {
	/** Same value for repeats of the same problem in the same area (see `errorKey`). */
	key: string;
	/** Where in the app it happened: a short fixed label such as `grimoire` or `scripts`. */
	area: string;
	/** `TypeError`, `SavedGameError`, ... */
	name: string;
	message: string;
	/** Up to `MAX_STACK_LINES` frames, with URLs reduced to their path. */
	stack?: string;
	/** The page path (no query string or hash). */
	page: string;
	firstAt: number;
	lastAt: number;
	count: number;
	/** `false` when nothing in the app caught it (a crash rather than a handled failure). */
	handled: boolean;
}

export const MAX_MESSAGE_LENGTH = 300;
export const MAX_STACK_LINES = 8;

/**
 * Removes the query string and hash from every URL in `text` and drops the origin, so a
 * message or stack never carries a share link, room code or saved script (CLAUDE.md:
 * private state only ever lives in the path or the hash).
 */
export function scrubUrls(text: string): string {
	return maskPathCodes(scrubFullUrls(text));
}

/**
 * Room codes, share codes, shared recap ids and account ids live in the path (/join/<code>,
 * /api/room/<code>, /api/share/<code>, /recap/<id>, /api/recap/<id>,
 * /api/account/sessions/<id>, /api/account/docs/<kind>/<id>), so they
 * are masked wherever a path appears, including the page a problem happened on.
 */
const PATH_CODES =
	/(\/(?:join|api\/room|api\/share|recap|api\/recap|api\/account\/sessions|api\/account\/docs\/[\w-]+)\/)[^/\s?#)'"]+/g;

function maskPathCodes(text: string): string {
	return text.replace(PATH_CODES, '$1••••');
}

function scrubFullUrls(text: string): string {
	return text.replace(/\b(?:https?|wss?|blob):\/\/[^\s)'"]+/g, (url) => {
		const clean = url.replace(/[?#].*$/, '');
		try {
			const parsed = new URL(clean.replace(/^blob:/, ''));
			// Our own files keep their path; anything else keeps host and path for context.
			return typeof location !== 'undefined' && parsed.origin === location.origin
				? parsed.pathname
				: `${parsed.host}${parsed.pathname}`;
		} catch {
			return clean;
		}
	});
}

function clip(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Name, message and stack of anything thrown or rejected. */
export function describeThrown(error: unknown): { name: string; message: string; stack?: string } {
	if (error instanceof Error) {
		const lines = (error.stack ?? '')
			.split('\n')
			.map((line) => line.trim())
			// V8 repeats "Name: message" as the first line; Firefox and Safari don't.
			.filter((line) => line && !line.startsWith(`${error.name}:`) && line !== error.name);
		const stack = lines.slice(0, MAX_STACK_LINES).map(scrubUrls).join('\n');
		return {
			name: error.name || 'Error',
			message: clip(scrubUrls(error.message), MAX_MESSAGE_LENGTH),
			...(stack ? { stack } : {})
		};
	}
	if (typeof error === 'string') {
		return { name: 'Error', message: clip(scrubUrls(error), MAX_MESSAGE_LENGTH) };
	}
	// Rejections with plain objects or other values: keep only their type, never their contents.
	return { name: 'Error', message: `a non-error value was thrown (${typeof error})` };
}

/**
 * Browser warnings that arrive as `error` events but are not bugs: ResizeObserver reports
 * when a resize callback changes layout again within the same frame, and the next frame
 * delivers the rest (Chrome's "loop completed with undelivered notifications", older
 * "loop limit exceeded"). Nothing is lost, so they are never logged.
 */
export function isBenignBrowserError(message: string | undefined): boolean {
	return (
		!!message &&
		/ResizeObserver loop (completed with undelivered notifications|limit exceeded)/.test(message)
	);
}

/** The message to show a person for anything thrown (replaces `e instanceof Error ? ...`). */
export function errorMessage(error: unknown): string {
	return describeThrown(error).message;
}

export function errorKey(area: string, name: string, message: string): string {
	return `${area}|${name}|${message}`;
}

/** Builds a record for `error`, or counts a repeat of `previous`. */
export function recordError(
	error: unknown,
	options: { area: string; page: string; handled: boolean; now: number },
	previous?: AppError
): AppError {
	const { name, message, stack } = describeThrown(error);
	const key = errorKey(options.area, name, message);
	if (previous && previous.key === key) {
		return { ...previous, lastAt: options.now, count: previous.count + 1 };
	}
	return {
		key,
		area: options.area,
		name,
		message,
		...(stack ? { stack } : {}),
		page: maskPathCodes(options.page.replace(/[?#].*$/, '')),
		firstAt: options.now,
		lastAt: options.now,
		count: 1,
		handled: options.handled
	};
}

/** Plain-text details, as copied to the clipboard for a report. */
export function errorDetails(error: AppError): string {
	return [
		`${error.name}: ${error.message}`,
		`Area: ${error.area} (${error.handled ? 'handled' : 'uncaught'})`,
		`Page: ${error.page}`,
		`Seen: ${error.count}× · first ${new Date(error.firstAt).toISOString()}`,
		...(error.stack ? ['', error.stack] : [])
	].join('\n');
}

/** Reads a stored log, dropping anything that isn't a well-formed record. */
export function parseErrorLog(raw: unknown, max: number): AppError[] {
	if (!Array.isArray(raw)) return [];
	return (
		raw
			.filter(
				(e): e is AppError =>
					typeof e === 'object' &&
					e !== null &&
					typeof e.key === 'string' &&
					typeof e.area === 'string' &&
					typeof e.name === 'string' &&
					typeof e.message === 'string' &&
					typeof e.page === 'string' &&
					typeof e.firstAt === 'number' &&
					typeof e.lastAt === 'number' &&
					typeof e.count === 'number' &&
					typeof e.handled === 'boolean' &&
					(e.stack === undefined || typeof e.stack === 'string')
			)
			.slice(0, max)
			// Logs saved by older builds get today's scrubbing too.
			.map((e) => ({
				...e,
				message: scrubUrls(e.message),
				page: maskPathCodes(e.page),
				...(e.stack === undefined ? {} : { stack: scrubUrls(e.stack) })
			}))
	);
}
