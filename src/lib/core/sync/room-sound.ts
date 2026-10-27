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
