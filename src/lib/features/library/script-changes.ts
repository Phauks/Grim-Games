/**
 * What a variation changed from the script it was made from (Trevor, 2026-10-17: an edited
 * script is marked as a variation, and anyone can see what the variation is). Works on the
 * scripts' JSON, so the original's stored copy is enough even when the original is gone.
 */

export interface ScriptChanges {
	/** Set when the name differs. */
	name?: { from: string; to: string };
	/** Set when the author differs. */
	author?: { from: string; to: string };
	/** Other script details (logo, almanac, rules and so on) differ. */
	otherDetails: boolean;
	/** Character ids on the variation only, in its order. */
	added: string[];
	/** Character ids on the original only, in its order. */
	removed: string[];
	/** Characters on both whose own definition (a homebrew character's ability, etc.) differs. */
	edited: string[];
}

interface Entry {
	id: string;
	/** A stable text of the whole entry when it defines more than its id. */
	body?: string;
}

/** Ids compared the way script tools spell them differently ("fortune_teller", "Fortuneteller"). */
function sameId(id: string): string {
	return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** JSON with object keys sorted, so key order never counts as a change. */
function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

function read(json: readonly unknown[]): { meta: Record<string, unknown>; entries: Entry[] } {
	let meta: Record<string, unknown> = {};
	const entries: Entry[] = [];
	for (const item of json) {
		if (typeof item === 'string') {
			entries.push({ id: item });
		} else if (
			item &&
			typeof item === 'object' &&
			typeof (item as { id?: unknown }).id === 'string'
		) {
			const object = item as Record<string, unknown> & { id: string };
			if (object.id === '_meta') {
				meta = object;
			} else {
				const rest = Object.keys(object).filter((k) => k !== 'id');
				entries.push(rest.length ? { id: object.id, body: stable(object) } : { id: object.id });
			}
		}
	}
	return { meta, entries };
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function scriptChanges(
	original: readonly unknown[],
	variation: readonly unknown[]
): ScriptChanges {
	const before = read(original);
	const after = read(variation);
	const beforeIds = new Map(before.entries.map((e) => [sameId(e.id), e]));
	const afterIds = new Map(after.entries.map((e) => [sameId(e.id), e]));

	const changes: ScriptChanges = {
		otherDetails: false,
		added: after.entries.filter((e) => !beforeIds.has(sameId(e.id))).map((e) => e.id),
		removed: before.entries.filter((e) => !afterIds.has(sameId(e.id))).map((e) => e.id),
		edited: after.entries
			.filter((e) => {
				const old = beforeIds.get(sameId(e.id));
				return old && (old.body || e.body) && old.body !== e.body;
			})
			.map((e) => e.id)
	};

	const [fromName, toName] = [text(before.meta.name), text(after.meta.name)];
	if (fromName !== toName) changes.name = { from: fromName, to: toName };
	const [fromAuthor, toAuthor] = [text(before.meta.author), text(after.meta.author)];
	if (fromAuthor !== toAuthor) changes.author = { from: fromAuthor, to: toAuthor };
	const rest = (meta: Record<string, unknown>) => {
		const others = { ...meta };
		delete others.name;
		delete others.author;
		return stable(others);
	};
	changes.otherDetails = rest(before.meta) !== rest(after.meta);
	return changes;
}

/** Whether the variation differs from the original at all. */
export function hasChanges(changes: ScriptChanges): boolean {
	return (
		!!changes.name ||
		!!changes.author ||
		changes.otherDetails ||
		changes.added.length > 0 ||
		changes.removed.length > 0 ||
		changes.edited.length > 0
	);
}
