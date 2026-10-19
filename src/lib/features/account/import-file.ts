/**
 * Reading a "Download my data" file back into an account (Trevor, 2026-10-18: "we have the
 * ability to export user data, we should allow the import as well"). Only the account's
 * documents come back (scripts, and later kinds); the account's details, devices and policy
 * acceptance belong to the account it was made from.
 *
 * Nothing already in the account is replaced: an item that is the same is skipped, and one
 * that differs is added beside it under a new id, the sync plan's keep-both rule.
 */
import { DOC_KINDS, type DocKind, type ProfileDoc } from './account-protocol.ts';

/** The export's format, written by the Worker since this version (worker/account/routes.ts). */
export const EXPORT_FORMAT = 'grimbinder-account';
export const EXPORT_VERSION = 1;

export interface ImportDoc {
	kind: DocKind;
	id: string;
	body: unknown;
}

export type ReadResult =
	{ ok: true; docs: ImportDoc[]; unknown: number } | { ok: false; reason: 'not-export' | 'newer' };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The documents in an exported file. Files from before the format was named have no
 * `format`; a file from a newer version is refused rather than half read.
 */
export function readAccountExport(raw: unknown): ReadResult {
	if (!isObject(raw) || !Array.isArray(raw.docs)) return { ok: false, reason: 'not-export' };
	if (raw.format !== undefined && raw.format !== EXPORT_FORMAT) {
		return { ok: false, reason: 'not-export' };
	}
	if (typeof raw.version === 'number' && raw.version > EXPORT_VERSION) {
		return { ok: false, reason: 'newer' };
	}
	const docs: ImportDoc[] = [];
	let unknown = 0;
	for (const doc of raw.docs) {
		if (!isObject(doc) || typeof doc.id !== 'string' || doc.deleted === true) continue;
		if (!(DOC_KINDS as readonly unknown[]).includes(doc.kind) || doc.body === undefined) {
			unknown++;
			continue;
		}
		docs.push({ kind: doc.kind as DocKind, id: doc.id, body: doc.body });
	}
	return { ok: true, docs, unknown };
}

export interface ImportPlan {
	/** Items to save, each under its own id or, when that id holds something else, a new one. */
	add: ImportDoc[];
	/** Items the account already has, as they are. */
	same: number;
}

const sameBody = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What importing `docs` into an account that holds `existing` would do. A kind with a
 * `merge` (Library labels: one document per account) is combined with the item of the same
 * id rather than added beside it.
 */
export function planImport(
	docs: readonly ImportDoc[],
	existing: (kind: DocKind) => readonly ProfileDoc[],
	newId: () => string,
	merge?: (kind: DocKind) => ((mine: unknown, theirs: unknown) => unknown) | undefined
): ImportPlan {
	const add: ImportDoc[] = [];
	let same = 0;
	for (const doc of docs) {
		const have = existing(doc.kind);
		if (have.some((other) => sameBody(other.body, doc.body))) {
			same++;
			continue;
		}
		const combine = merge?.(doc.kind);
		const mine = combine && have.find((other) => other.id === doc.id);
		if (combine && mine) {
			const body = combine(mine.body, doc.body);
			if (sameBody(body, mine.body)) same++;
			else add.push({ ...doc, body });
			continue;
		}
		const taken = have.some((other) => other.id === doc.id) || add.some((a) => a.id === doc.id);
		add.push(taken ? { ...doc, id: newId() } : doc);
	}
	return { add, same };
}
