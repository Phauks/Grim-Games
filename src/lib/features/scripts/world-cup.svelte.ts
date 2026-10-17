/**
 * The World Cup scripts, loaded from BotC Scripts through our Worker when that source is
 * chosen (`world-cup.ts`). Each loaded script is kept for the page visit; one that fails
 * to load is left out and tried again on the next visit.
 */
import { fetchLinkTarget } from './fetch-script.ts';
import { WORLD_CUPS, type WorldCupEntry, type WorldCupYear } from './world-cup.ts';

export interface WorldCupScript {
	entry: WorldCupEntry;
	/** The version BotC Scripts sent (its latest). */
	version: string;
	/** The script in TPI's format. */
	json: unknown[];
}

export type WorldCupStatus = 'idle' | 'loading' | 'ready' | 'error';

/** At most this many requests at once, so the Worker and site aren't flooded. */
const AT_ONCE = 4;

const lists = $state<Record<WorldCupYear, WorldCupScript[]>>({ '2023': [], '2025': [] });
const statuses = $state<Record<WorldCupYear, WorldCupStatus>>({ '2023': 'idle', '2025': 'idle' });

async function loadOne(entry: WorldCupEntry): Promise<WorldCupScript | undefined> {
	try {
		const fetched = await fetchLinkTarget(
			{ kind: 'botcscripts', ref: { kind: 'script', scriptId: entry.scriptId } },
			''
		);
		const json: unknown = JSON.parse(fetched.text);
		if (!Array.isArray(json)) return undefined;
		const version = fetched.source.kind === 'botcscripts' ? fetched.source.version : '';
		return { entry, version, json };
	} catch {
		// The site being down or a script removed is expected: that script is left out.
		return undefined;
	}
}

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
		const entries = WORLD_CUPS[year].entries;
		const found: (WorldCupScript | undefined)[] = [];
		for (let i = 0; i < entries.length; i += AT_ONCE) {
			found.push(...(await Promise.all(entries.slice(i, i + AT_ONCE).map(loadOne))));
			lists[year] = found.filter((s) => s !== undefined);
		}
		statuses[year] = lists[year].length > 0 ? 'ready' : 'error';
	}
};
