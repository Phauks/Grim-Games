/**
 * Day and night sound (plan U3, Trevor 2026-10-26): recorded parts the app mixes. Loops play
 * under the scene; calls drop in at random times, each a little different, so a night never
 * sounds the same twice. Every recording is public domain or CC0 (Trevor's pick on
 * 2026-10-26: the repository is public, so nothing with a licence that bars sharing the raw
 * files), and each is credited in About. The files live in `static/sounds/ambience/` and are
 * stored on a device only once day and night sound is turned on.
 */

/** When a sound plays: in the night, in the day, or both (weather and fire). */
export type AmbienceScene = 'night' | 'day' | 'weather';
export const AMBIENCE_SCENES: readonly AmbienceScene[] = ['night', 'day', 'weather'];

/** How often a call drops in. */
export const AMBIENCE_RATES = ['rare', 'sometimes', 'often'] as const;
export type AmbienceRate = (typeof AMBIENCE_RATES)[number];

/** A loop is on or off; a call is off or comes at a rate. */
export type AmbienceChoice = 'off' | 'on' | AmbienceRate;

export interface AmbienceSound {
	id: string;
	scene: AmbienceScene;
	/** A loop plays the whole time; a call plays now and then. */
	kind: 'loop' | 'call';
	/** File names in `AMBIENCE_PATH`; a call picks one each time. */
	files: readonly string[];
	/** Its level in the mix, 0 to 1. */
	level: number;
	/** What a new device has chosen. */
	choice: AmbienceChoice;
}

export const AMBIENCE_PATH = '/sounds/ambience';

export const AMBIENCE_SOUNDS: readonly AmbienceSound[] = [
	{
		id: 'crickets',
		scene: 'night',
		kind: 'loop',
		files: ['crickets.mp3'],
		level: 0.5,
		choice: 'on'
	},
	{
		id: 'treefrogs',
		scene: 'night',
		kind: 'loop',
		files: ['treefrogs.mp3'],
		level: 0.35,
		choice: 'off'
	},
	{ id: 'nightWind', scene: 'night', kind: 'loop', files: ['wind.mp3'], level: 0.4, choice: 'on' },
	{ id: 'owl', scene: 'night', kind: 'call', files: ['owl.mp3'], level: 0.8, choice: 'sometimes' },
	{
		id: 'poorwill',
		scene: 'night',
		kind: 'call',
		files: ['poorwill.mp3'],
		level: 0.6,
		choice: 'off'
	},
	{ id: 'wolf', scene: 'night', kind: 'call', files: ['wolf.mp3'], level: 0.7, choice: 'rare' },
	{
		id: 'coyotes',
		scene: 'night',
		kind: 'call',
		files: ['coyotes.mp3'],
		level: 0.6,
		choice: 'off'
	},
	{
		id: 'pigFrogs',
		scene: 'night',
		kind: 'call',
		files: ['pig-frog.mp3'],
		level: 0.5,
		choice: 'off'
	},
	{
		id: 'songbirds',
		scene: 'day',
		kind: 'call',
		files: ['robin.mp3', 'hermit-thrush.mp3', 'sparrow.mp3', 'warbler.mp3', 'nuthatch.mp3'],
		level: 0.6,
		choice: 'often'
	},
	{
		id: 'raven',
		scene: 'day',
		kind: 'call',
		files: ['raven.mp3'],
		level: 0.6,
		choice: 'sometimes'
	},
	{ id: 'hens', scene: 'day', kind: 'call', files: ['hens.mp3'], level: 0.5, choice: 'off' },
	{ id: 'bell', scene: 'day', kind: 'call', files: ['bell.mp3'], level: 0.5, choice: 'rare' },
	{ id: 'stream', scene: 'day', kind: 'loop', files: ['stream.mp3'], level: 0.4, choice: 'on' },
	{ id: 'breeze', scene: 'day', kind: 'loop', files: ['wind.mp3'], level: 0.2, choice: 'on' },
	{ id: 'rain', scene: 'weather', kind: 'loop', files: ['rain.mp3'], level: 0.5, choice: 'off' },
	{
		id: 'thunder',
		scene: 'weather',
		kind: 'call',
		files: ['thunder.mp3'],
		level: 0.6,
		choice: 'off'
	},
	{ id: 'fire', scene: 'weather', kind: 'loop', files: ['fire.mp3'], level: 0.5, choice: 'off' }
];

/** Where a recording came from, for About's credits. */
export interface AmbienceCredit {
	file: string;
	/** What it is and where it was recorded, as its source names it. */
	title: string;
	source: 'NPS Sound Gallery' | 'Wikimedia Commons';
	page: string;
	licence: 'Public domain' | 'CC0';
}

const NPS = 'https://www.nps.gov/subjects/sound';
const COMMONS = 'https://commons.wikimedia.org/wiki/File:';

export const AMBIENCE_CREDITS: readonly AmbienceCredit[] = [
	{
		file: 'crickets.mp3',
		title: 'Crickets',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-crickets.htm`,
		licence: 'Public domain'
	},
	{
		file: 'treefrogs.mp3',
		title: 'Green tree frog, Everglades National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-green-treefrog.htm`,
		licence: 'Public domain'
	},
	{
		file: 'owl.mp3',
		title: 'Spotted owl, Yosemite National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-spotted-owl.htm`,
		licence: 'Public domain'
	},
	{
		file: 'poorwill.mp3',
		title: 'Common poorwill, Great Basin National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-common-poorwill.htm`,
		licence: 'Public domain'
	},
	{
		file: 'wolf.mp3',
		title: 'Wolf, Denali National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-wolf.htm`,
		licence: 'Public domain'
	},
	{
		file: 'coyotes.mp3',
		title: 'Coyotes, Mojave National Preserve',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-coyotes.htm`,
		licence: 'Public domain'
	},
	{
		file: 'pig-frog.mp3',
		title: 'Pig frog, Everglades National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-pigfrog.htm`,
		licence: 'Public domain'
	},
	{
		file: 'robin.mp3',
		title: 'American robin, Yellowstone National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-american-robin.htm`,
		licence: 'Public domain'
	},
	{
		file: 'hermit-thrush.mp3',
		title: 'Hermit thrush, Yosemite National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-hermit-thrush.htm`,
		licence: 'Public domain'
	},
	{
		file: 'sparrow.mp3',
		title: 'White-crowned sparrow, Grand Teton National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-white-crowned-sparrow.htm`,
		licence: 'Public domain'
	},
	{
		file: 'warbler.mp3',
		title: 'Yellow-rumped warbler, Grand Teton National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-yellow-rumped-warbler.htm`,
		licence: 'Public domain'
	},
	{
		file: 'nuthatch.mp3',
		title: 'Red-breasted nuthatch, Yosemite National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-nuthatch.htm`,
		licence: 'Public domain'
	},
	{
		file: 'raven.mp3',
		title: 'Common raven, Grand Teton National Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-common-raven.htm`,
		licence: 'Public domain'
	},
	{
		file: 'hens.mp3',
		title: 'Chickens, Minute Man National Historical Park',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-chickens.htm`,
		licence: 'Public domain'
	},
	{
		file: 'thunder.mp3',
		title: 'Thunder',
		source: 'NPS Sound Gallery',
		page: `${NPS}/sounds-thunder.htm`,
		licence: 'Public domain'
	},
	{
		file: 'wind.mp3',
		title: 'Howling wind',
		source: 'Wikimedia Commons',
		page: `${COMMONS}Howling_wind.ogg`,
		licence: 'CC0'
	},
	{
		file: 'stream.mp3',
		title: 'Hemlock stream',
		source: 'Wikimedia Commons',
		page: `${COMMONS}Hemlock_stream.ogg`,
		licence: 'Public domain'
	},
	{
		file: 'rain.mp3',
		title: 'Rain',
		source: 'Wikimedia Commons',
		page: `${COMMONS}Rain_(1).ogg`,
		licence: 'Public domain'
	},
	{
		file: 'fire.mp3',
		title: 'Dry grass burning in an open fireplace',
		source: 'Wikimedia Commons',
		page: `${COMMONS}Dry_grass_burning_in_open_fireplace.ogg`,
		licence: 'Public domain'
	},
	{
		file: 'bell.mp3',
		title: 'Bell ring',
		source: 'Wikimedia Commons',
		page: `${COMMONS}Bell-ring.flac`,
		licence: 'CC0'
	}
];

/** Every file the sounds use, as URLs, for storing them offline. */
export function ambienceFiles(sounds: readonly AmbienceSound[] = AMBIENCE_SOUNDS): string[] {
	return [...new Set(sounds.flatMap((sound) => sound.files))].map(
		(file) => `${AMBIENCE_PATH}/${file}`
	);
}

/** The choices a sound allows: on or off for a loop, off or a rate for a call. */
export function ambienceChoices(sound: AmbienceSound): readonly AmbienceChoice[] {
	return sound.kind === 'loop' ? ['off', 'on'] : ['off', ...AMBIENCE_RATES];
}

/** Each sound's choice, as stored by any build: unknown sounds dropped, bad values defaulted. */
export function parseAmbienceChoices(raw: unknown): Record<string, AmbienceChoice> {
	const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const choices: Record<string, AmbienceChoice> = {};
	for (const sound of AMBIENCE_SOUNDS) {
		const value = stored[sound.id];
		choices[sound.id] = (ambienceChoices(sound) as readonly unknown[]).includes(value)
			? (value as AmbienceChoice)
			: sound.choice;
	}
	return choices;
}

/** What a new device has chosen for each sound. */
export function defaultAmbienceChoices(): Record<string, AmbienceChoice> {
	return parseAmbienceChoices(undefined);
}

/** The sounds that play in a night or a day: that scene's and the weather's, not off. */
export function ambienceFor(
	scene: 'night' | 'day',
	choices: Readonly<Record<string, AmbienceChoice>>
): AmbienceSound[] {
	return AMBIENCE_SOUNDS.filter(
		(sound) =>
			(sound.scene === scene || sound.scene === 'weather') &&
			(choices[sound.id] ?? sound.choice) !== 'off'
	);
}

/** The average wait between calls at each rate, in seconds. */
export const RATE_SECONDS: Readonly<Record<AmbienceRate, number>> = {
	rare: 60,
	sometimes: 25,
	often: 9
};

/** Seconds until a call's next turn: half to one and a half times its average wait. */
export function nextCallDelay(rate: AmbienceRate, random: () => number = Math.random): number {
	return RATE_SECONDS[rate] * (0.5 + random());
}

/** How a call differs from the last time: speed (and so pitch), loudness and side. */
export function callVariation(random: () => number = Math.random): {
	speed: number;
	gain: number;
	pan: number;
} {
	return { speed: 0.94 + random() * 0.12, gain: 0.6 + random() * 0.4, pan: random() * 1.4 - 0.7 };
}

/** One of a call's files, never the one it played last when it has others. */
export function pickFile(
	files: readonly string[],
	last: string | undefined,
	random: () => number = Math.random
): string {
	const choices = files.length > 1 ? files.filter((file) => file !== last) : files;
	return choices[Math.floor(random() * choices.length)] ?? files[0];
}
