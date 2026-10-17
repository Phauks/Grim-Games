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
	stage: WorldCupStage
): WorldCupEntry => ({ scriptId, name, author, stage });

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
			entry(6687, 'The Ballad of Seat 7', 'TrashWarlock', 'winner'),
			entry(6716, "Buyer's Remorse", 'Mist', 'semiFinal'),
			entry(6714, 'Stowed Away', 'Caffeine', 'semiFinal'),
			entry(6717, 'The Phantom Detectives', 'Schnauzer', 'semiFinal'),
			entry(6705, 'Trained Killer', 'Ekin', 'quarterFinal'),
			entry(6146, "The Djinn's Bargain", 'phillyCHEEEEEZ', 'quarterFinal'),
			entry(6457, 'Binary Supernovae', 'Hystrex', 'quarterFinal'),
			entry(6026, 'The River Styx', 'Rhea', 'finalist'),
			entry(6407, 'Witch Hunt', 'Nick B', 'finalist'),
			entry(6741, 'One Day More', 'Robe', 'finalist'),
			entry(6742, 'Council of the Dead', 'Ember', 'finalist'),
			entry(6799, 'I see dead people', 'A Terrifying Wizard', 'finalist'),
			entry(6707, 'This Is Not My Beautiful House', 'JC', 'finalist'),
			entry(6773, 'The Warrens', 'Zets', 'finalist'),
			entry(6779, 'Show Me Wonders', 'DinosaurSatan', 'finalist'),
			entry(6679, 'Off to see the Wizard', 'CrispyDuck', 'finalist')
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
