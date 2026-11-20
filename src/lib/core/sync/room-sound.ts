import { ambienceMix } from '#lib/core/sound/ambience.ts';
import { parseSoundOutput, type SoundOutput } from '#lib/core/sound/soundboard.ts';

/**
 * The Storyteller's sounds played in the room (plan U10, Trevor 2026-10-27: "Soundboard should
 * have options for output (eg device speakers, external speakers, town square, multiple)"):
 * the moments' sounds and those played from the pane's Sounds. The Storyteller's device sends
 * what to play; the room passes it to the Public Town and phones there now and keeps nothing,
 * and each plays its own copy of the sound.
 */

export type TownSoundCommand =
	/** Plays this sound, cutting off the one playing. */
	| { command: 'play'; id: string }
	/** Stops whatever plays. */
	| { command: 'stop' }
	| { command: 'pause' }
	| { command: 'resume' };

/** The longest sound id kept; the device playing it knows the ids. */
const ID_MAX = 64;

function soundId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
}

/** A town sound command as anyone sent it; anything malformed is null and ignored. */
export function parseTownSound(raw: unknown): TownSoundCommand | null {
	if (!raw || typeof raw !== 'object') return null;
	const message = raw as Record<string, unknown>;
	switch (message.command) {
		case 'play':
			return soundId(message.id) ? { command: 'play', id: message.id } : null;
		case 'stop':
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
	if (soundId(timerSound)) sound.timerSound = timerSound;
	return sound;
}

/** Back to town calls closer together than this are dropped, so phones don't keep ringing. */
export const CALL_TOWN_GAP_MS = 5000;

/** Whether a Back to town call at `now` goes out, given when the last one did. */
export function canCallTown(last: number | undefined, now: number): boolean {
	return last === undefined || now - last >= CALL_TOWN_GAP_MS;
}
