/**
 * The World Cup scripts, from our own copy (`worker/world-cups.ts`, refreshed nightly from
 * BotC Scripts) when that source is chosen. Kept for the page visit.
 */
import { withTimeout } from './fetch-script.ts';
import {
	readWorldCupAnswer,
	WORLD_CUPS,
	WORLD_CUPS_API,
	type StoredWorldCupScript,
	type WorldCupEntry,
	type WorldCupYear
} from './world-cup.ts';

export interface WorldCupScript {
	entry: WorldCupEntry;
	/** The version BotC Scripts sent (its latest). */
	version: string;
	/** The script in TPI's format. */
	json: unknown[];
}

export type WorldCupStatus = 'idle' | 'loading' | 'ready' | 'error';

const lists = $state<Record<WorldCupYear, WorldCupScript[]>>({ '2023': [], '2025': [] });
const statuses = $state<Record<WorldCupYear, WorldCupStatus>>({ '2023': 'idle', '2025': 'idle' });

export const worldCupScripts = {
	list(year: WorldCupYear): WorldCupScript[] {
		return lists[year];
	},
	status(year: WorldCupYear): WorldCupStatus {
		return statuses[year];
	},

	/** Loads a year's scripts once per page visit, in the World Cup's order. */
	async load(year: WorldCupYear): Promise<void> {
		if (statuses[year] !== 'idle' && statuses[year] !== 'error') return;
		statuses[year] = 'loading';
		let stored: StoredWorldCupScript[] | undefined;
		try {
			const response = await fetch(`${WORLD_CUPS_API}/${year}`, { signal: withTimeout() });
			stored = response.ok
				? readWorldCupAnswer(await response.json().catch(() => undefined))
				: undefined;
		} catch {
			// Offline, or our copy isn't there yet: expected.
		}
		lists[year] = WORLD_CUPS[year].entries.flatMap((entry) => {
			const script = stored?.find((s) => s.scriptId === entry.scriptId);
			return script ? [{ entry, version: script.version, json: script.json }] : [];
		});
		statuses[year] = lists[year].length > 0 ? 'ready' : 'error';
	}
};
