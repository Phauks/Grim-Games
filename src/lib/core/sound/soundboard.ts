/**
 * The Storyteller's soundboard (plan U6) and the sounds tied to their actions (plan U7),
 * Trevor 2026-10-26: "bells should be useful to storyteller and initiate bell sounds upon
 * pressing", and "connect certain sounds to their actions (such as an execution sound)". These
 * are the sounds he kept from a listening page of real recordings, each public domain or CC0
 * and credited in About. The files live in `static/sounds/board/` and are fetched when first
 * played.
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
	sse('heartbeat', 'Heartbeat', 'HUMAN'),
	sse('fast-heartbeat', 'Fast heartbeat', 'HUMAN')
];

/** A sound's URL. */
export function boardSoundUrl(sound: BoardSound): string {
	return `${BOARD_SOUND_PATH}/${sound.id}.mp3`;
}

export function boardSound(id: string): BoardSound | undefined {
	return BOARD_SOUNDS.find((sound) => sound.id === id);
}

/** The Storyteller's actions a sound can follow. */
export const SOUND_ACTIONS = ['dusk', 'dawn', 'execution', 'gameEnd'] as const;
export type SoundAction = (typeof SOUND_ACTIONS)[number];

/** A sound's id, or none for an action that plays nothing. */
export type ActionSound = string | 'none';

/** What a new device plays for each action, once action sounds are turned on. */
export const DEFAULT_ACTION_SOUNDS: Readonly<Record<SoundAction, ActionSound>> = {
	dusk: 'temple-bell',
	dawn: 'morning-bell',
	execution: 'gallows',
	gameEnd: 'remembrance-bells'
};

/** Each action's sound as any build stored it; an unknown sound becomes the default. */
export function parseActionSounds(raw: unknown): Record<SoundAction, ActionSound> {
	const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const sounds = { ...DEFAULT_ACTION_SOUNDS };
	for (const action of SOUND_ACTIONS) {
		const value = stored[action];
		if (value === 'none' || (typeof value === 'string' && boardSound(value))) {
			sounds[action] = value;
		}
	}
	return sounds;
}

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
 * How one sound plays from the soundboard (Trevor 2026-10-27: "more mixing controls"): its
 * own volume, under the soundboard's, and whether it loops until stopped.
 */
export interface BoardSoundMix {
	volume: number;
	loop: boolean;
}

export const DEFAULT_SOUND_MIX: Readonly<BoardSoundMix> = { volume: 1, loop: false };

/** A sound's volume range: silent to full. */
export const SOUND_MIX_VOLUME = { min: 0, max: 1, step: 0.05 } as const;

/** Each sound's mix as any build stored it; unknown sounds and the defaults are left out. */
export function parseSoundMixes(raw: unknown): Record<string, BoardSoundMix> {
	const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const mixes: Record<string, BoardSoundMix> = {};
	for (const [id, value] of Object.entries(stored)) {
		if (!boardSound(id) || !value || typeof value !== 'object') continue;
		const { volume, loop } = value as Record<string, unknown>;
		const mix = {
			volume:
				typeof volume === 'number' && Number.isFinite(volume)
					? Math.min(SOUND_MIX_VOLUME.max, Math.max(SOUND_MIX_VOLUME.min, volume))
					: DEFAULT_SOUND_MIX.volume,
			loop: loop === true
		};
		if (mix.volume !== DEFAULT_SOUND_MIX.volume || mix.loop !== DEFAULT_SOUND_MIX.loop) {
			mixes[id] = mix;
		}
	}
	return mixes;
}

/** A sound's mix, or the default for one never changed. */
export function soundMix(mixes: Record<string, BoardSoundMix>, id: string): BoardSoundMix {
	return mixes[id] ?? DEFAULT_SOUND_MIX;
}

/**
 * A place on the soundboard (Trevor 2026-10-27: "perhaps a storyteller only wants access to
 * some. We could have some hot spots where storytellers could place sounds and mixes"): one
 * sound, or a mix that plays several sounds together, each at its own volume and loop.
 */
export type SoundPad = { sound: string } | { mix: string; name: string; sounds: string[] };

/** A new device's soundboard: every sound, in the library's order. */
export const DEFAULT_PADS: readonly SoundPad[] = BOARD_SOUNDS.map((sound) => ({
	sound: sound.id
}));

/** The longest name a mix keeps. */
export const MIX_NAME_MAX = 40;

/** The sounds a pad plays. */
export function padSounds(pad: SoundPad): string[] {
	return 'sound' in pad ? [pad.sound] : pad.sounds;
}

/** A pad's name: its sound's, or the mix's own. */
export function padName(pad: SoundPad): string {
	return 'sound' in pad ? (boardSound(pad.sound)?.name ?? pad.sound) : pad.name;
}

/** A pad's id, unique on a soundboard. */
export function padId(pad: SoundPad): string {
	return 'sound' in pad ? pad.sound : pad.mix;
}

/**
 * The soundboard's pads as any build stored them: unknown sounds, repeats and empty mixes
 * are left out, and a device that never stored any gets every sound.
 */
export function parsePads(raw: unknown): SoundPad[] {
	if (!Array.isArray(raw)) return DEFAULT_PADS.map((pad) => ({ ...pad }));
	const pads: SoundPad[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const value = item as Record<string, unknown>;
		let pad: SoundPad | undefined;
		if (typeof value.sound === 'string' && boardSound(value.sound)) {
			pad = { sound: value.sound };
		} else if (typeof value.mix === 'string' && value.mix && typeof value.name === 'string') {
			const name = value.name.trim().slice(0, MIX_NAME_MAX);
			const sounds = Array.isArray(value.sounds)
				? [
						...new Set(
							value.sounds.filter((id): id is string => typeof id === 'string' && !!boardSound(id))
						)
					]
				: [];
			if (name && sounds.length) pad = { mix: value.mix, name, sounds };
		}
		if (!pad || seen.has(padId(pad))) continue;
		seen.add(padId(pad));
		pads.push(pad);
	}
	return pads;
}

/** Where the soundboard plays while the board has a room (plan U10). */
export const SOUND_OUTPUTS = ['device', 'town', 'both'] as const;
export type SoundOutput = (typeof SOUND_OUTPUTS)[number];
