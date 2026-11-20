/**
 * The game's sounds (Trevor, 2026-11-19: "lets identify the full sound flow and what it should
 * do"): the moments of a game play a sound by themselves (Dusk, Dawn, an execution, time up,
 * Back to town, the game's end), and the Storyteller can play any of them at a tap from the
 * pane's Sounds. One list serves both: the four sounds made on the device and the recordings
 * Trevor kept from a listening page (2026-10-26), each public domain or CC0 and credited in
 * About. The recordings live in `static/sounds/board/` and are fetched when first played.
 */

export interface BoardSound {
	/** Also its file name in `BOARD_SOUND_PATH`, with `.mp3`. */
	id: string;
	/** What it is, as its button and the drop-downs show it. */
	name: string;
	/** Where it was recorded, when the source says. */
	place?: string;
	/** Who recorded it, when the source names them. */
	recordist?: string;
	source: 'Internet Archive' | 'SSE Library';
	page: string;
	licence: 'Public domain' | 'CC0';
	/** Plays until stopped, as a heartbeat does. */
	loop?: boolean;
}

const BOARD_SOUND_PATH = '/sounds/board';

const ARCHIVE = 'https://archive.org/details/';

/** A Radio Aporee recording on the Internet Archive, marked public domain by its recordist. */
function aporee(
	id: string,
	name: string,
	place: string,
	item: string,
	recordist: string
): BoardSound {
	return {
		id,
		name,
		place,
		recordist,
		source: 'Internet Archive',
		page: ARCHIVE + item,
		licence: 'Public domain'
	};
}

/** A sound effect from USC's film collection, released as CC0 in the SSE Library. */
function sse(id: string, name: string, collection: string): BoardSound {
	return {
		id,
		name,
		source: 'SSE Library',
		page: `${ARCHIVE}SSE_Library_${collection}`,
		licence: 'CC0'
	};
}

export const BOARD_SOUNDS: readonly BoardSound[] = [
	aporee(
		'village-bell',
		'Village church bell',
		'Bastendorf, Luxembourg',
		'aporee_14369_16722',
		'Frank Schulte'
	),
	aporee(
		'morning-bell',
		'Morning church bell',
		'Stalos, Crete',
		'aporee_44696_50799',
		'alas23/sala'
	),
	aporee(
		'remembrance-bells',
		'Cathedral bells',
		'Worcester Cathedral, England',
		'aporee_52873_60406',
		'David J. Pitt'
	),
	aporee('temple-bell', 'Temple bell', 'Guryongsa, Korea', 'aporee_54764_62624', 'abyssence'),
	aporee(
		'shipyard-gong',
		'Shipyard gong',
		'Dunkirk, France',
		'aporee_63069_72550',
		'Jean-François Cavro'
	),
	sse('hand-bell', 'Hand bell', 'BELLS'),
	sse('ships-bells', "Ship's bells", 'BELLS'),
	sse('train-bell', 'Train bell', 'BELLS'),
	sse('gallows', 'Gallows trap', 'WOOD'),
	sse('horrified-crowd', 'Horrified crowd', 'CROWDS'),
	{ ...sse('heartbeat', 'Heartbeat', 'HUMAN'), loop: true },
	{ ...sse('fast-heartbeat', 'Fast heartbeat', 'HUMAN'), loop: true }
];

/** A sound's URL. */
export function boardSoundUrl(sound: BoardSound): string {
	return `${BOARD_SOUND_PATH}/${sound.id}.mp3`;
}

export function boardSound(id: string): BoardSound | undefined {
	return BOARD_SOUNDS.find((sound) => sound.id === id);
}

/**
 * The sounds made on the device with the Web Audio API (plan U1), so no file is fetched: a
 * bell, a chime, the Westminster Quarters on clock tower bells, and a buzzer.
 */
export const MADE_SOUNDS = ['bell', 'chime', 'clocktower', 'buzzer'] as const;
export type MadeSound = (typeof MADE_SOUNDS)[number];

export function isMadeSound(id: unknown): id is MadeSound {
	return (MADE_SOUNDS as readonly unknown[]).includes(id);
}

/** A sound the game can play, made or recorded. */
export function isGameSound(id: unknown): id is string {
	return isMadeSound(id) || (typeof id === 'string' && !!boardSound(id));
}

/** Every sound, made first, as the drop-downs list them. */
export const GAME_SOUNDS: readonly string[] = [
	...MADE_SOUNDS,
	...BOARD_SOUNDS.map((sound) => sound.id)
];

/** Whether a sound plays until stopped. */
export function soundLoops(id: string): boolean {
	return boardSound(id)?.loop === true;
}

/** The moments of a game that play a sound by themselves. */
export const SOUND_MOMENTS = [
	'dusk',
	'dawn',
	'execution',
	'timeUp',
	'townCall',
	'gameEnd'
] as const;
export type SoundMoment = (typeof SOUND_MOMENTS)[number];

/** A moment's sound, or none for a moment kept silent. */
export type MomentSound = string | 'none';

/** What each moment plays on a new device: every one on (Trevor, 2026-11-19). */
export const DEFAULT_MOMENT_SOUNDS: Readonly<Record<SoundMoment, MomentSound>> = {
	dusk: 'temple-bell',
	dawn: 'morning-bell',
	execution: 'gallows',
	timeUp: 'bell',
	townCall: 'clocktower',
	gameEnd: 'remembrance-bells'
};

/** Each moment's sound as stored; an unknown sound becomes the default. */
export function parseMomentSounds(raw: unknown): Record<SoundMoment, MomentSound> {
	const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const sounds = { ...DEFAULT_MOMENT_SOUNDS };
	for (const moment of SOUND_MOMENTS) {
		const value = stored[moment];
		if (value === 'none' || isGameSound(value)) sounds[moment] = value;
	}
	return sounds;
}

/** The moments the board's own changes start; time up and Back to town come from the timer. */
export type SoundAction = Extract<SoundMoment, 'dusk' | 'dawn' | 'execution' | 'gameEnd'>;

/** What the board knows of the game, for telling which action was just taken. */
export interface ActionState {
	/** Setup, a night or a day. */
	phase: 'setup' | 'night' | 'day';
	/** How many executions today's log holds. */
	executions: number;
	ended: boolean;
}

/**
 * The action that moved the board from one state to the next, if one did: the game ending,
 * an execution, a night beginning (Dusk) or a day beginning (Dawn). Undoing one is not an
 * action, so fewer executions or a game reopened play nothing.
 */
export function actionTaken(before: ActionState, after: ActionState): SoundAction | undefined {
	if (after.ended) return before.ended ? undefined : 'gameEnd';
	if (before.ended) return undefined;
	if (after.executions > before.executions && after.phase === before.phase) return 'execution';
	if (after.phase === before.phase) return undefined;
	if (after.phase === 'night') return 'dusk';
	if (after.phase === 'day' && before.phase === 'night') return 'dawn';
	return undefined;
}

/**
 * Which devices in the room play the Storyteller's sounds (plan U10). Never the Storyteller's
 * own device (Trevor, 2026-10-30: a sound from there gives away where the Storyteller sits):
 * the Public Town tablet, the players' phones, or both.
 */
export const SOUND_OUTPUTS = ['all', 'phones', 'town'] as const;
export type SoundOutput = (typeof SOUND_OUTPUTS)[number];

/** Who hears the Storyteller's sounds: a Public Town tablet or a player's phone. */
export type SoundListener = 'town' | 'phones';

/** Whether a listener plays the Storyteller's sounds, as Play on chooses. */
export function hearsSound(output: SoundOutput, listener: SoundListener): boolean {
	return output === 'all' || output === listener;
}

/**
 * Whether a listener plays the day or night recording. Every phone playing the same recording
 * a moment apart from the others smears it into an echo across the table (audio audit,
 * 2026-11-12), so it plays on the Town Square when Play on includes it, and on phones only
 * when Play on is phones alone.
 */
export function hearsAmbience(output: SoundOutput, listener: SoundListener): boolean {
	return output === 'phones' ? listener === 'phones' : listener === 'town';
}

/**
 * A saved or sent Play on. Builds before 2026-10-30 also offered "This device" (now the
 * default, everywhere) and "This device and Town Square" (now Town Square alone).
 */
export function parseSoundOutput(value: unknown): SoundOutput | undefined {
	if (value === 'both') return 'town';
	return (SOUND_OUTPUTS as readonly unknown[]).includes(value) ? (value as SoundOutput) : undefined;
}

/**
 * A player's answer to whether their phone plays the Storyteller's sounds (Trevor, 2026-11-14:
 * players opt in or out, "it could be seen as somewhat invasive"); undefined until they answer.
 */
export type StorytellerSoundsAnswer = 'on' | 'off';

/** A stored answer; anything else is no answer yet. */
export function parseStorytellerSounds(raw: unknown): StorytellerSoundsAnswer | undefined {
	return raw === 'on' || raw === 'off' ? raw : undefined;
}
