import { ambienceMix } from '#lib/core/sound/ambience.ts';
import { parseSoundOutput, type SoundOutput } from '#lib/core/sound/soundboard.ts';

/**
 * The soundboard played on the Public Town tablet (plan U10, Trevor 2026-10-27: "Soundboard
 * should have options for output (eg device speakers, external speakers, town square,
 * multiple)"). The Storyteller's device sends what to play; the room passes it to every
 * Public Town display there now and keeps nothing, and the tablet plays its own copy of the
 * sounds. Older apps ignore it.
 */

/** One soundboard sound for the town to play, at the Storyteller's mix. */
export interface TownSoundPlay {
	id: string;
	/** 0 to 1, under the tablet's own volume. */
	volume: number;
	loop: boolean;
}

export type TownSoundCommand =
	/** Plays these sounds together; `cut` stops the ones already playing first. */
	| { command: 'play'; sounds: TownSoundPlay[]; cut: boolean }
	/** Stops these sounds, or every sound when none are named. */
	| { command: 'stop'; ids?: string[] }
	| { command: 'pause' }
	| { command: 'resume' };

/** The most sounds one command plays, so a bad message can't flood the tablet. */
export const TOWN_SOUND_MAX = 24;
/** The longest sound id kept. */
const ID_MAX = 64;

function soundId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
}

/** A town sound command as anyone sent it; anything malformed is null and ignored. */
export function parseTownSound(raw: unknown): TownSoundCommand | null {
	if (!raw || typeof raw !== 'object') return null;
	const message = raw as Record<string, unknown>;
	switch (message.command) {
		case 'play': {
			if (!Array.isArray(message.sounds)) return null;
			const sounds: TownSoundPlay[] = [];
			for (const item of message.sounds.slice(0, TOWN_SOUND_MAX)) {
				if (!item || typeof item !== 'object') continue;
				const { id, volume, loop } = item as Record<string, unknown>;
				if (!soundId(id)) continue;
				sounds.push({
					id,
					volume:
						typeof volume === 'number' && Number.isFinite(volume)
							? Math.min(1, Math.max(0, volume))
							: 1,
					loop: loop === true
				});
			}
			return sounds.length ? { command: 'play', sounds, cut: message.cut === true } : null;
		}
		case 'stop': {
			if (message.ids === undefined) return { command: 'stop' };
			if (!Array.isArray(message.ids)) return null;
			return { command: 'stop', ids: message.ids.filter(soundId).slice(0, TOWN_SOUND_MAX) };
		}
		case 'pause':
		case 'resume':
			return { command: message.command };
		default:
			return null;
	}
}

/**
 * The sounds that follow the game, in the public table (Trevor, 2026-10-30: "Do not play audio
 * from storytellers device ... Only play remote on other devices"): the Storyteller's device
 * plays none, so the devices `on` names play the day or night recording and ring when the day
 * timer runs out. Left out by older apps, whose devices then play neither.
 */
export interface PublicSound {
	on: SoundOutput;
	/** The day or night recording playing now, at the Storyteller's level (0 to 1). */
	ambience?: { id: string; level: number };
	/** What the day timer plays when it runs out; left out for none. */
	timerSound?: string;
}

/** The longest timer sound name kept; the device playing it knows the names. */
const TIMER_SOUND_MAX = 32;

/** The sounds in a public table as anyone sent them; undefined when missing or malformed. */
export function parsePublicSound(raw: unknown): PublicSound | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const { on, ambience, timerSound } = raw as Record<string, unknown>;
	const output = parseSoundOutput(on);
	if (!output) return undefined;
	const sound: PublicSound = { on: output };
	if (ambience && typeof ambience === 'object') {
		const { id, level } = ambience as Record<string, unknown>;
		if (
			typeof id === 'string' &&
			ambienceMix(id) &&
			typeof level === 'number' &&
			Number.isFinite(level)
		)
			sound.ambience = { id, level: Math.min(1, Math.max(0, level)) };
	}
	if (
		typeof timerSound === 'string' &&
		timerSound.length > 0 &&
		timerSound.length <= TIMER_SOUND_MAX
	)
		sound.timerSound = timerSound;
	return sound;
}

/** Back to town calls closer together than this are dropped, so phones don't keep ringing. */
export const CALL_TOWN_GAP_MS = 5000;

/** Whether a Back to town call at `now` goes out, given when the last one did. */
export function canCallTown(last: number | undefined, now: number): boolean {
	return last === undefined || now - last >= CALL_TOWN_GAP_MS;
}
