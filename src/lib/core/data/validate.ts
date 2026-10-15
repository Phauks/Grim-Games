/**
 * Small hand-written validation helpers for the JSON data files. Each check records an
 * issue with a JSON path instead of throwing at the first problem, so a schema change
 * upstream is reported in full.
 */

export class DataError extends Error {
	readonly issues: readonly string[];

	constructor(what: string, issues: readonly string[]) {
		const shown = issues.slice(0, 20).map((issue) => `  - ${issue}`);
		if (issues.length > shown.length) shown.push(`  ... and ${issues.length - shown.length} more`);
		super(`Invalid ${what}:\n${shown.join('\n')}`);
		this.name = 'DataError';
		this.issues = issues;
	}
}

export class Issues {
	readonly list: string[] = [];

	add(path: string, message: string): void {
		this.list.push(`${path || '(root)'}: ${message}`);
	}

	throwIfAny(what: string): void {
		if (this.list.length > 0) throw new DataError(what, this.list);
	}
}

export type Json = Record<string, unknown>;

export function isObject(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describe(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	return typeof value;
}

/** Reports keys of `obj` that are not in `known`. */
export function checkKeys(obj: Json, known: readonly string[], path: string, issues: Issues): void {
	for (const key of Object.keys(obj)) {
		if (!known.includes(key)) issues.add(`${path}.${key}`, 'unknown field');
	}
}

export function readString(
	obj: Json,
	key: string,
	path: string,
	issues: Issues,
	required: boolean
): string | undefined {
	const value = obj[key];
	if (value === undefined) {
		if (required) issues.add(`${path}.${key}`, 'missing');
		return undefined;
	}
	if (typeof value !== 'string') {
		issues.add(`${path}.${key}`, `expected string, got ${describe(value)}`);
		return undefined;
	}
	return value;
}

export function readBoolean(
	obj: Json,
	key: string,
	path: string,
	issues: Issues
): boolean | undefined {
	const value = obj[key];
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') {
		issues.add(`${path}.${key}`, `expected boolean, got ${describe(value)}`);
		return undefined;
	}
	return value;
}

export function readNumber(
	obj: Json,
	key: string,
	path: string,
	issues: Issues
): number | undefined {
	const value = obj[key];
	if (value === undefined) return undefined;
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		issues.add(`${path}.${key}`, `expected number, got ${describe(value)}`);
		return undefined;
	}
	return value;
}

export function readStringArray(
	obj: Json,
	key: string,
	path: string,
	issues: Issues
): string[] | undefined {
	const value = obj[key];
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) {
		issues.add(`${path}.${key}`, `expected array, got ${describe(value)}`);
		return undefined;
	}
	const out: string[] = [];
	value.forEach((item, i) => {
		if (typeof item === 'string') out.push(item);
		else issues.add(`${path}.${key}[${i}]`, `expected string, got ${describe(item)}`);
	});
	return out;
}

export function readEnum<T extends string>(
	obj: Json,
	key: string,
	allowed: readonly T[],
	path: string,
	issues: Issues,
	required: boolean
): T | undefined {
	const value = readString(obj, key, path, issues, required);
	if (value === undefined) return undefined;
	if (!(allowed as readonly string[]).includes(value)) {
		issues.add(`${path}.${key}`, `unknown value ${JSON.stringify(value)}`);
		return undefined;
	}
	return value as T;
}
