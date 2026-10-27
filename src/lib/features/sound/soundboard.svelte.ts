import { BOARD_SOUNDS, boardSound, boardSoundUrl } from '#lib/core/sound/soundboard.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { recording } from './recording.ts';
import { audio, unlockSound } from './sound.ts';

/**
 * Plays the soundboard's recordings (plan U6) and the sounds tied to the Storyteller's
 * actions (plan U7), at the device's volume. One plays at a time: a new one cuts off the one
 * before, and tapping the one playing stops it.
 */

/** Seconds a cut-off sound takes to fade out. */
const FADE = 0.3;

class Soundboard {
	/** The sound playing now, for its button's pressed state. */
	playing = $state<string | undefined>();
	#source: AudioBufferSourceNode | undefined;
	#gain: GainNode | undefined;
	#keptOffline = false;

	/** Plays a sound, or stops it when it is the one playing. */
	toggle(id: string): void {
		if (this.playing === id) this.stop();
		else void this.play(id);
	}

	async play(id: string): Promise<void> {
		const sound = boardSound(id);
		const ctx = audio();
		this.stop();
		if (!sound || !ctx || preferences.current.soundVolume <= 0) return;
		unlockSound();
		if (!this.#keptOffline) {
			// Every sound, so a game later on with no signal can still play them all.
			this.#keptOffline = true;
			keepOffline(BOARD_SOUNDS.map(boardSoundUrl));
		}
		this.playing = id;
		const data = await recording(ctx, boardSoundUrl(sound));
		if (!data || this.playing !== id) {
			if (this.playing === id) this.playing = undefined;
			return;
		}
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
		source.start();
		this.#source = source;
		this.#gain = gain;
	}

	stop(): void {
		const source = this.#source;
		const gain = this.#gain;
		this.#source = undefined;
		this.#gain = undefined;
		this.playing = undefined;
		const ctx = audio();
		if (!source || !gain || !ctx) return;
		gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
		source.stop(ctx.currentTime + FADE);
	}
}

export const soundboard = new Soundboard();
