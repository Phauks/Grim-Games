import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import { dayTimers } from '#lib/core/rules/index.ts';
import { ambienceMix } from '#lib/core/sound/ambience.ts';
import { hearsSound, type SoundListener } from '#lib/core/sound/soundboard.ts';
import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
import {
	parsePublicSound,
	type PublicSound,
	type TownSoundCommand
} from '#lib/core/sync/room-sound.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { TIMER_SOUNDS, type TimerSound } from '#lib/ui/preferences.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { ambience } from './ambience.ts';
import { soundboard } from './soundboard.svelte.ts';
import { audio, playSound, unlockOnFirstTap } from './sound.ts';

/**
 * The Storyteller's sounds never play on the Storyteller's own device (Trevor, 2026-10-30: "Do
 * not play audio from storytellers device ... it identifies where a storyteller is in a room.
 * Only play remote on other devices"). The board names them, and the Public Town tablet and
 * players' phones play them, as Play on chooses (`SoundOutput`).
 */

/**
 * What the room's devices play for the board's game now: the day or night recording, unless
 * the soundboard is paused, and the sound the day timer ends with. Read in an effect, so the
 * public table follows Settings > Sound.
 */
export function gameSound(phase: PlayersPhase | undefined): PublicSound {
	const prefs = preferences.current;
	const scene =
		phase?.kind === 'night'
			? 'night'
			: phase?.kind === 'day' || phase?.kind === 'town'
				? 'day'
				: undefined;
	const mix =
		scene && prefs.ambienceOn && !soundboard.paused
			? ambienceMix(scene === 'night' ? prefs.nightAmbience : prefs.dayAmbience)
			: undefined;
	return {
		on: prefs.soundOutput,
		...(mix ? { ambience: { id: mix.id, level: prefs.ambienceLevel } } : {}),
		...(prefs.timerSound !== 'none' ? { timerSound: prefs.timerSound } : {})
	};
}

/**
 * A Public Town tablet's or a player's phone's side: plays the soundboard commands the room
 * passes on (plan U10), the day or night recording the public table names, and the timer's
 * sound when the Storyteller's day timer runs out. A browser plays nothing until the page is
 * tapped, so the first sound that arrives before a tap asks for one, once.
 */
export class RoomSounds {
	readonly #listener: SoundListener;
	#asked = false;
	/** The running timer the bell is set for, so a copy of the same one doesn't move it. */
	#bellFor: string | undefined;
	#bell: ReturnType<typeof setTimeout> | undefined;

	constructor(listener: SoundListener) {
		this.#listener = listener;
		unlockOnFirstTap();
	}

	/** A soundboard command from the Storyteller. */
	hear(command: TownSoundCommand): void {
		if (command.command === 'play') this.#askForTap();
		soundboard.fromStoryteller(command);
	}

	/** Follows the public table as each copy arrives; undefined when there is none. */
	follow(table: PublicGameState | undefined): void {
		const sound = parsePublicSound(table?.sound);
		const heard = !!sound && hearsSound(sound.on, this.#listener);
		const cue = heard ? sound.ambience : undefined;
		if (cue) this.#askForTap();
		ambience.follow(cue);
		this.#setBell(heard ? dayTimers.parsePublicTimer(table?.timer) : undefined, sound?.timerSound);
	}

	/** Leaving the room: everything it started stops. */
	stop(): void {
		ambience.follow(undefined);
		soundboard.fromStoryteller({ command: 'stop' });
		this.#setBell(undefined, undefined);
	}

	/** Rings when a running countdown reaches 0:00, once; a stopwatch has no sound. */
	#setBell(timer: dayTimers.PublicDayTimer | undefined, sound: string | undefined): void {
		const known = TIMER_SOUNDS.find((name) => name === sound) as TimerSound | undefined;
		const running = timer && timer.mode === 'down' && dayTimers.isRunning(timer);
		const key = running && known ? JSON.stringify([timer, known]) : undefined;
		if (key === this.#bellFor) return;
		clearTimeout(this.#bell);
		this.#bell = undefined;
		this.#bellFor = key;
		if (!key || !timer || !known) return;
		const left = dayTimers.remaining(timer, Date.now());
		if (left > 0) this.#bell = setTimeout(() => playSound(known), left);
	}

	#askForTap(): void {
		if (this.#asked || audio()?.state !== 'suspended') return;
		this.#asked = true;
		toast(t('settings.soundOutputTownHeard'));
	}
}
