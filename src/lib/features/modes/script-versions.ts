/** The fields of a script choice that tell its versions apart (`ScriptChoiceOption`). */
export interface VersionedChoice {
	value: string;
	label: string;
	author?: string;
	version?: string;
}

/**
 * The versions of `chosen` among `choices` (Trevor, 2026-10-19: Custom shows a version
 * drop-down, empty when there is none): scripts of its name and author with a version,
 * each version once, in the order given (most recently used first).
 */
export function scriptVersions<T extends VersionedChoice>(
	choices: readonly T[],
	chosen: T | undefined
): T[] {
	if (!chosen?.version) return [];
	const seen = new Set<string>();
	return choices.filter((c) => {
		if (!c.version || c.label !== chosen.label || c.author !== chosen.author) return false;
		if (seen.has(c.version)) return false;
		seen.add(c.version);
		return true;
	});
}
