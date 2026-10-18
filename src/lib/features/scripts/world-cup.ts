/**
 * The Script World Cup finalists (Trevor, 2026-10-17: World Cup 2023 and World Cup 2025 as
 * sources). Each script is loaded from BotC Scripts through our Worker, so only names,
 * authors, stages and script numbers are kept here, never the scripts themselves.
 *
 * - 2023: TPI's first Script World Cup (round of 16 played November 2022, final published
 *   2023-03-23: https://www.youtube.com/watch?v=U8FEYY4mFJ4). Listed on BotC Scripts at
 *   https://www.botcscripts.com/worldcup; placings from the BotC fan wiki
 *   (https://wiki.biligame.com/bloodontheclocktower/BOTC%E4%B8%96%E7%95%8C%E6%9D%AF2022%E5%8F%82%E8%B5%9B%E5%89%A7%E6%9C%AC%E9%9B%86%E9%94%A6).
 *   Only the round of 16 and two round-of-32 scripts are known; the rest of the 64 aren't
 *   published anywhere we can read.
 * - 2025: "Garden of Djinn", 16 finalists
 *   (https://bloodontheclocktower.com/blogs/news/2025-botc-script-world-cup), collected on
 *   BotC Scripts at https://botcscripts.com/collection/61 and listed with authors at
 *   https://beardytas.com/garden-of-djinn/. Winner: The Ballad of Seat 7
 *   (https://www.youtube.com/watch?v=w53JBb7K_Xw); quarter- and semi-finals per
 *   https://www.patreon.com/posts/script-world-cup-131825460.
 */

export type WorldCupYear = '2023' | '2025';

export type WorldCupStage =
	| 'winner'
	| 'runnerUp'
	| 'third'
	| 'fourth'
	| 'semiFinal'
	| 'quarterFinal'
	| 'roundOf16'
	| 'roundOf32'
	| 'finalist';

export interface WorldCupEntry {
	/** The script's number on BotC Scripts (botcscripts.com/script/<n>). */
	scriptId: number;
	name: string;
	/** Empty where BotC Scripts names no author. */
	author: string;
	stage: WorldCupStage;
	/**
	 * The script's logo when its BotC Scripts JSON may lack one: TPI hosts every 2025 finalist's
	 * logo at release.botc.app/wc25/<key>/logo.webp, the address its own copy of the script
	 * (wc25/<key>/script.json in TPI's botc-release repository) names in `_meta.logo`
	 * (findings: /mnt/project-files/script-logos/missing-logos.md). Loaded from there at
	 * runtime, never copied.
	 */
	logo?: string;
}

export interface WorldCup {
	year: WorldCupYear;
	/** The page that lists the event's scripts, credited as the source. */
	page: string;
	entries: readonly WorldCupEntry[];
}

const entry = (
	scriptId: number,
	name: string,
	author: string,
	stage: WorldCupStage,
	logo?: string
): WorldCupEntry => ({ scriptId, name, author, stage, ...(logo ? { logo } : {}) });

/** TPI's logo for a 2025 finalist, by its folder on release.botc.app. */
const wc25Logo = (key: string) => `https://release.botc.app/wc25/${key}/logo.webp`;

export const WORLD_CUPS: Record<WorldCupYear, WorldCup> = {
	'2023': {
		year: '2023',
		page: 'https://www.botcscripts.com/worldcup',
		entries: [
			entry(173, 'Boozling', 'Lau', 'winner'),
			entry(196, 'Outed Evil', 'Manny', 'runnerUp'),
			entry(166, 'Advanced Donjons & Demons', 'Cosmo', 'third'),
			entry(170, 'Bait and Switch', '', 'fourth'),
			entry(215, 'With Great Power', 'Avery', 'quarterFinal'),
			entry(195, 'One Bad Day', '', 'quarterFinal'),
			entry(203, 'Star Pass All Stars', 'Ekin', 'quarterFinal'),
			entry(180, 'Drunk and Disorderly', '', 'quarterFinal'),
			entry(168, 'Are You Evil', '', 'roundOf16'),
			entry(200, 'Roundabout', 'Kyle J', 'roundOf16'),
			entry(177, 'Deep Bluff Nine', 'Henrik', 'roundOf16'),
			entry(69, 'Hide and Seek', 'Narninian & Zaba', 'roundOf16'),
			entry(199, 'Ramsay Street', '', 'roundOf16'),
			entry(197, 'Outed', 'Milk', 'roundOf16'),
			entry(172, 'Birthday Feast!', 'Malashaan', 'roundOf16'),
			entry(66, 'Miss Information', 'OJ', 'roundOf16'),
			entry(87, 'Rochambeau', 'Habby', 'roundOf32'),
			entry(109, 'Clean Sweep', 'Soup', 'roundOf32')
		]
	},
	'2025': {
		year: '2025',
		page: 'https://botcscripts.com/collection/61',
		entries: [
			entry(6687, 'The Ballad of Seat 7', 'TrashWarlock', 'winner', wc25Logo('seat7')),
			entry(6716, "Buyer's Remorse", 'Mist', 'semiFinal', wc25Logo('buyersremorse')),
			entry(6714, 'Stowed Away', 'Caffeine', 'semiFinal', wc25Logo('stowedaway')),
			entry(
				6717,
				'The Phantom Detectives',
				'Schnauzer',
				'semiFinal',
				wc25Logo('phantomdetectives')
			),
			entry(6705, 'Trained Killer', 'Ekin', 'quarterFinal', wc25Logo('trainedkiller')),
			entry(
				6146,
				"The Djinn's Bargain",
				'phillyCHEEEEEZ',
				'quarterFinal',
				wc25Logo('djinnsbargain')
			),
			entry(6457, 'Binary Supernovae', 'Hystrex', 'quarterFinal', wc25Logo('binarysupernovae')),
			entry(6026, 'The River Styx', 'Rhea', 'finalist', wc25Logo('riverstyx')),
			entry(6407, 'Witch Hunt', 'Nick B', 'finalist', wc25Logo('witchhunt')),
			entry(6741, 'One Day More', 'Robe', 'finalist', wc25Logo('1daymore')),
			entry(6742, 'Council of the Dead', 'Ember', 'finalist', wc25Logo('deadcouncil')),
			entry(6799, 'I see dead people', 'A Terrifying Wizard', 'finalist', wc25Logo('deadpeople')),
			entry(6707, 'This Is Not My Beautiful House', 'JC', 'finalist', wc25Logo('beautifulhouse')),
			entry(6773, 'The Warrens', 'Zets', 'finalist', wc25Logo('warrens')),
			entry(6779, 'Show Me Wonders', 'DinosaurSatan', 'finalist', wc25Logo('wonders')),
			entry(6679, 'Off to see the Wizard', 'CrispyDuck', 'finalist', wc25Logo('offwizard'))
		]
	}
};

/** Our copy of a World Cup's scripts (`worker/world-cups.ts`): `/api/world-cups/<year>`. */
export const WORLD_CUPS_API = '/api/world-cups';

/** One World Cup script in our copy: its latest version on BotC Scripts. */
export interface StoredWorldCupScript {
	scriptId: number;
	version: string;
	/** The script in TPI's format. */
	json: unknown[];
}

/** Our answer, checked; undefined when it isn't one. */
export function readWorldCupAnswer(body: unknown): StoredWorldCupScript[] | undefined {
	if (typeof body !== 'object' || body === null || !('scripts' in body)) return undefined;
	const { scripts } = body as { scripts: unknown };
	if (!Array.isArray(scripts)) return undefined;
	return scripts.flatMap((raw: unknown): StoredWorldCupScript[] => {
		if (typeof raw !== 'object' || raw === null) return [];
		const { scriptId, version, json } = raw as Record<string, unknown>;
		return typeof scriptId === 'number' && typeof version === 'string' && Array.isArray(json)
			? [{ scriptId, version, json }]
			: [];
	});
}

/**
 * The script JSON with the entry's logo in its `_meta` when the JSON names none; unchanged
 * otherwise, so an author's own logo always wins.
 */
export function withEntryLogo(json: unknown[], logo: string | undefined): unknown[] {
	if (!logo) return json;
	const at = json.findIndex(
		(item) => typeof item === 'object' && item !== null && (item as { id?: unknown }).id === '_meta'
	);
	if (at < 0) return [{ id: '_meta', logo }, ...json];
	const meta = json[at] as Record<string, unknown>;
	if (typeof meta.logo === 'string' && meta.logo.trim()) return json;
	return json.map((item, i) => (i === at ? { ...meta, logo } : item));
}
