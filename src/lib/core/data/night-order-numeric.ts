/**
 * Numeric night positions for official characters (`static/data/night-order-provisional.json`).
 *
 * TPI's `nightsheet.json` gives the official order as plain lists. Homebrew characters in
 * scripts carry numbers instead (`firstNight: 37`), so to slot them between official
 * characters we need a number for each official step. The only source today is a one-off
 * snapshot of Official-Data-Sync, marked provisional (05-spike-results.md S8): it is to be
 * replaced, not maintained, so nothing outside this file and `rules/night-order.ts` should
 * depend on its shape.
 */
import type { CharacterId } from './types.ts';
import { describe, Issues, isObject } from './validate.ts';

export interface NumericNightOrder {
	/** `provisional` for the Official-Data-Sync snapshot. */
	status: string;
	/** Where the numbers came from, for display ("Official-Data-Sync @ fa269d8"). */
	source?: string;
	firstNight: ReadonlyMap<CharacterId, number>;
	otherNight: ReadonlyMap<CharacterId, number>;
}

/** Parses `night-order-provisional.json`: `{ _meta, <id>: { firstNight?, otherNight? } }`. */
export function parseNumericNightOrder(json: unknown): NumericNightOrder {
	const issues = new Issues();
	if (!isObject(json)) {
		issues.add('', `expected object, got ${describe(json)}`);
		issues.throwIfAny('numeric night order');
	}
	const { _meta, ...entries } = json as Record<string, unknown>;
	const meta = isObject(_meta) ? _meta : {};
	const status = typeof meta.status === 'string' ? meta.status : 'unknown';
	const src = isObject(meta.source) ? meta.source : {};
	const source =
		typeof src.repository === 'string'
			? `${src.repository}${typeof src.commit === 'string' ? ` @ ${src.commit.slice(0, 7)}` : ''}`
			: undefined;
	const firstNight = new Map<CharacterId, number>();
	const otherNight = new Map<CharacterId, number>();
	for (const [id, entry] of Object.entries(entries)) {
		if (!isObject(entry)) {
			issues.add(id, `expected object, got ${describe(entry)}`);
			continue;
		}
		for (const [key, map] of [
			['firstNight', firstNight],
			['otherNight', otherNight]
		] as const) {
			const value = entry[key];
			if (value === undefined) continue;
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				issues.add(`${id}.${key}`, `expected number, got ${describe(value)}`);
			} else if (value > 0) map.set(id, value);
		}
	}
	issues.throwIfAny('numeric night order');
	return { status, source, firstNight, otherNight };
}
