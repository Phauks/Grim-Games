/**
 * `/api/world-cups/<year>`: a Script World Cup's scripts, each its latest version on BotC
 * Scripts, served from our own copy (`mirror.ts`) so the source doesn't fetch every
 * finalist from the site on each visit.
 */
import {
	WORLD_CUPS,
	type StoredWorldCupScript,
	type WorldCupYear
} from '../src/lib/features/scripts/world-cup.ts';
import { fetchLatestVersion } from './botcscripts.ts';
import type { MirroredSource } from './mirror.ts';

/** At most this many requests to the site at once. */
const AT_ONCE = 4;

async function readOne(scriptId: number): Promise<StoredWorldCupScript | string> {
	try {
		const version = await fetchLatestVersion(scriptId);
		return Array.isArray(version.content)
			? { scriptId, version: version.version, json: version.content }
			: `${scriptId}: not a script`;
	} catch (error) {
		return `${scriptId}: ${error instanceof Error ? error.message : String(error)}`;
	}
}

export function worldCupSource(year: WorldCupYear): MirroredSource {
	return {
		id: `worldcup:${year}`,
		async build(previous) {
			const entries = WORLD_CUPS[year].entries;
			const found: (StoredWorldCupScript | string)[] = [];
			for (let i = 0; i < entries.length; i += AT_ONCE) {
				const batch = entries.slice(i, i + AT_ONCE).map((e) => readOne(e.scriptId));
				found.push(...(await Promise.all(batch)));
			}
			const failed = found.filter((s) => typeof s === 'string');
			if (failed.length) console.warn('world cup', year, failed.slice(0, 5));
			// A script the site fails to send keeps its last stored version.
			const kept = new Map(
				(Array.isArray(previous?.scripts) ? (previous.scripts as StoredWorldCupScript[]) : []).map(
					(s) => [s.scriptId, s]
				)
			);
			const scripts = entries.flatMap((entry, i) => {
				const got = found[i];
				const script = typeof got === 'string' ? kept.get(entry.scriptId) : got;
				return script ? [script] : [];
			});
			if (!scripts.length)
				throw new Error(`No scripts from BotC Scripts. ${failed.slice(0, 3).join(' ')}`);
			return { scripts };
		}
	};
}

export function isWorldCupYear(year: string): year is WorldCupYear {
	return Object.hasOwn(WORLD_CUPS, year);
}
