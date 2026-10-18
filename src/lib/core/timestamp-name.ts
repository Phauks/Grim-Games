/**
 * A name for something saved without one (Trevor, 2026-10-18: nothing is saved without a
 * name; with none, it gets a timestamp). Local time, newest sorting last: "2026-10-18 19:51".
 */
export function timestampName(when: Date = new Date()): string {
	const two = (n: number) => String(n).padStart(2, '0');
	return (
		`${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())} ` +
		`${two(when.getHours())}:${two(when.getMinutes())}`
	);
}

/** The name as given, or a timestamp name when it is blank. */
export function nameOrTimestamp(name: string | undefined, when: Date = new Date()): string {
	return name?.trim() || timestampName(when);
}
