import { BOARD_SOUNDS, boardSound, boardSoundUrl } from '#lib/core/sound/soundboard.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { ambience } from './ambience.ts';
import { recording } from './recording.ts';
import { audio, unlockSound } from './sound.ts';

/**
 * Plays the soundboard's recordings (plan U6) and the sounds tied to the Storyteller's
 * actions (plan U7), at the device's volume. One plays at a time: a new one cuts off the one
 * before, and tapping the one playing stops it. Pause (Trevor, 2026-10-27: "Also needs a
 * pause button") holds the sound where it is and silences day and night sound until Resume;
 * playing another sound ends the pause.
 */

/** Seconds a cut-off sound takes to fade out. */
const FADE = 0.3;

interface Held {
	id: string;
	data: AudioBuffer;
	/** Seconds into the recording where it was paused. */
	at: number;
}

class Soundboard {
	/** The sound playing now, for its button's pressed state; kept while paused. */
	playing = $state<string | undefined>();
	paused = $state(false);
	#source: AudioBufferSourceNode | undefined;
	#gain: GainNode | undefined;
	/** When the playing sound's recording began, on the audio clock, for where to pause. */
	#startedAt = 0;
	#data: AudioBuffer | undefined;
	#held: Held | undefined;
	#keptOffline = false;

	/** Plays a sound, stops it when it is the one playing, or resumes it when it is paused. */
	toggle(id: string): void {
		if (this.playing === id) {
			if (this.paused) this.resume();
			else this.stop();
		} else void this.play(id);
	}

	async play(id: string): Promise<void> {
		const sound = boardSound(id);
		const ctx = audio();
		this.stop();
		this.#endPause();
		if (!sound || !ctx || preferences.current.soundVolume <= 0) return;
		unlockSound();
		if (!this.#keptOffline) {
			// Every sound, so a game later on with no signal can still play them all.
			this.#keptOffline = true;
			keepOffline(BOARD_SOUNDS.map(boardSoundUrl));
		}
		this.playing = id;
		const data = await recording(ctx, boardSoundUrl(sound));
		if (!data || this.playing !== id || this.paused) {
			if (this.playing === id && !this.paused) this.playing = undefined;
			return;
		}
		this.#start(ctx, id, data, 0);
	}

	#start(ctx: AudioContext, id: string, data: AudioBuffer, at: number): void {
		const source = ctx.createBufferSource();
		const gain = ctx.createGain();
		source.buffer = data;
		gain.gain.value = preferences.current.soundVolume;
		source.connect(gain).connect(ctx.destination);
		source.onended = () => {
			if (this.#source !== source) return;
			this.#source = undefined;
			this.playing = undefined;
		};
		source.start(0, at);
		this.playing = id;
		this.#source = source;
		this.#gain = gain;
		this.#data = data;
		this.#startedAt = ctx.currentTime - at;
	}

	/** Holds the playing sound where it is, and day and night sound, until resumed. */
	pause(): void {
		const ctx = audio();
		if (this.paused || !ctx) return;
		const id = this.playing;
		const data = this.#data;
		const at = ctx.currentTime - this.#startedAt;
		const playing = this.#source !== undefined;
		this.stop();
		if (playing && id && data && at < data.duration) {
			this.#held = { id, data, at };
			this.playing = id;
		}
		this.paused = true;
		ambience.setPaused(true);
	}

	/** Carries on from where Pause held everything. */
	resume(): void {
		const held = this.#held;
		const ctx = audio();
		this.#endPause();
		if (!held || !ctx) return;
		unlockSound();
		this.#start(ctx, held.id, held.data, held.at);
	}

	#endPause(): void {
		if (!this.paused) return;
		this.paused = false;
		this.#held = undefined;
		ambience.setPaused(false);
	}

	stop(): void {
		const source = this.#source;
		const gain = this.#gain;
		this.#source = undefined;
		this.#gain = undefined;
		this.#data = undefined;
		this.playing = undefined;
		if (this.paused) this.#held = undefined;
		const ctx = audio();
		if (!source || !gain || !ctx) return;
		gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
		source.stop(ctx.currentTime + FADE);
	}
}

export const soundboard = new Soundboard();
