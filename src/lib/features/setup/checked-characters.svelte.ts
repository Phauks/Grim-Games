import { readStored, writeStored } from '#lib/ui/stored.ts';

/**
 * The script characters the Storyteller marked as checked on this device (M85), by
 * `checkKey`: a check holds on every game with that character as written, and lapses once the
 * character changes. The newest are kept first, up to `LIMIT`.
 */
const KEY = 'grim-games:checked-characters:v1';
const VERSION = 1;
const LIMIT = 300;

interface Stored {
	version: typeof VERSION;
	keys: string[];
}

function read(): string[] {
	const raw = readStored<Partial<Stored>>(KEY);
	if (raw?.version !== VERSION || !Array.isArray(raw.keys)) return [];
	return raw.keys.filter((k): k is string => typeof k === 'string');
}

class CheckedCharacters {
	#keys = $state<string[]>(read());

	has(key: string): boolean {
		return this.#keys.includes(key);
	}

	set(key: string, checked: boolean): void {
		const rest = this.#keys.filter((k) => k !== key);
		this.#keys = checked ? [key, ...rest].slice(0, LIMIT) : rest;
		writeStored(KEY, { version: VERSION, keys: this.#keys } satisfies Stored);
	}
}

export const checkedCharacters = new CheckedCharacters();
