import type { Gain, Player } from 'tone';
import { BOARD_SOUNDS, boardSound, boardSoundUrl, soundMix } from '#lib/core/sound/soundboard.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { ambience } from './ambience.ts';
import { recording } from './recording.ts';
import { audio, unlockSound } from './sound.ts';

/**
 * Plays the soundboard's recordings (plan U6) and the sounds tied to the Storyteller's
 * actions (plan U7). Built on Tone.js (Trevor 2026-10-27: "more mixing controls", size is no
 * concern "if it builds a better tool"), loaded the first time a sound plays.
 *
 * The mix: the device's volume, then the soundboard's level, then each sound's own volume,
 * with a sound looping until stopped if its Loop is on. One sound plays at a time, a new one
 * cutting off the one before, unless "Let sounds overlap" is on. Tapping a sound playing
 * stops it. Pause (Trevor, 2026-10-27) holds every sound where it is and silences day and
 * night sound until Resume; playing another sound ends the pause.
 */

type Tone = typeof import('tone');

/** Seconds a stopped sound takes to fade out. */
const FADE = 0.3;

interface Voice {
	id: string;
	player: Player;
	gain: Gain;
	data: AudioBuffer;
	/** When the recording began, on the audio clock, for where to pause. */
	startedAt: number;
}

interface Held {
	id: string;
	data: AudioBuffer;
	/** Seconds into the recording where it was paused. */
	at: number;
}

let loading: Promise<Tone | undefined> | undefined;

/** Tone.js on the app's one audio context, so it shares its volume and output. */
function tone(ctx: AudioContext): Promise<Tone | undefined> {
	loading ??= import('tone')
		.then((Tone) => {
			Tone.setContext(ctx);
			// Sound at the tap, not a tenth of a second after.
			Tone.getContext().lookAhead = 0;
			return Tone;
		})
		.catch(() => {
			loading = undefined;
			return undefined;
		});
	return loading;
}

/** The soundboard's level under the device's volume. */
function busLevel(): number {
	return preferences.current.soundVolume * preferences.current.soundboardLevel;
}

class Soundboard {
	/** The sounds playing now, for their buttons' pressed state; kept while paused. */
	playing = $state<string[]>([]);
	paused = $state(false);
	/** The sound the mixer's per-sound rows change. */
	mixing = $state(BOARD_SOUNDS[0].id);
	#voices = new Map<string, Voice>();
	/** Sounds asked for and still loading, so a stop before they load cancels them. */
	#pending = new Set<string>();
	#held: Held[] = [];
	#bus: Gain | undefined;
	#keptOffline = false;

	isPlaying(id: string): boolean {
		return this.playing.includes(id);
	}

	/** Plays a sound, stops it when it is playing, or resumes everything when paused. */
	toggle(id: string): void {
		if (this.isPlaying(id)) {
			if (this.paused) this.resume();
			else this.stop(id);
		} else void this.play(id);
	}

	async play(id: string): Promise<void> {
		const sound = boardSound(id);
		const ctx = audio();
		this.#endPause();
		if (preferences.current.soundboardOverlap) this.stop(id);
		else this.stop();
		if (!sound || !ctx || busLevel() <= 0) return;
		unlockSound();
		if (!this.#keptOffline) {
			// Every sound, so a game later on with no signal can still play them all.
			this.#keptOffline = true;
			keepOffline(BOARD_SOUNDS.map(boardSoundUrl));
		}
		this.#pending.add(id);
		this.#mark();
		const [Tone, data] = await Promise.all([tone(ctx), recording(ctx, boardSoundUrl(sound))]);
		if (!this.#pending.delete(id) || !Tone || !data) {
			this.#mark();
			return;
		}
		this.#start(Tone, ctx, id, data, 0);
	}

	#start(Tone: Tone, ctx: AudioContext, id: string, data: AudioBuffer, at: number): void {
		this.#bus ??= new Tone.Gain(busLevel()).toDestination();
		const mix = soundMix(preferences.current.soundMixes, id);
		const gain = new Tone.Gain(mix.volume).connect(this.#bus);
		const player = new Tone.Player(data).connect(gain);
		player.loop = mix.loop;
		player.fadeOut = FADE;
		const voice: Voice = { id, player, gain, data, startedAt: ctx.currentTime - at };
		player.onstop = () => {
			if (this.#voices.get(id) === voice) {
				this.#voices.delete(id);
				this.#mark();
			}
			// After the fade, so the end isn't cut short.
			setTimeout(() => {
				player.dispose();
				gain.dispose();
			}, FADE * 1000);
		};
		this.#voices.set(id, voice);
		player.start(undefined, at);
		this.#mark();
	}

	/** Follows a change of level or of a sound's mix while it plays. */
	applyMix(): void {
		const ctx = audio();
		if (!ctx) return;
		this.#bus?.gain.setTargetAtTime(busLevel(), ctx.currentTime, 0.05);
		for (const voice of this.#voices.values()) {
			const mix = soundMix(preferences.current.soundMixes, voice.id);
			voice.gain.gain.setTargetAtTime(mix.volume, ctx.currentTime, 0.05);
			voice.player.loop = mix.loop;
		}
	}

	/** Holds every sound where it is, and day and night sound, until resumed. */
	pause(): void {
		const ctx = audio();
		if (this.paused || !ctx) return;
		this.#held = [...this.#voices.values()].map((voice) => {
			const elapsed = ctx.currentTime - voice.startedAt;
			const at = voice.player.loop ? elapsed % voice.data.duration : elapsed;
			return { id: voice.id, data: voice.data, at };
		});
		this.#held = this.#held.filter((held) => held.at < held.data.duration);
		const held = this.#held;
		this.stop();
		this.#held = held;
		this.paused = true;
		ambience.setPaused(true);
		this.#mark();
	}

	/** Carries on from where Pause held everything. */
	resume(): void {
		const held = this.#held;
		const ctx = audio();
		this.#endPause();
		if (!held.length || !ctx) return;
		unlockSound();
		void tone(ctx).then((Tone) => {
			if (!Tone || this.paused) return;
			for (const { id, data, at } of held) this.#start(Tone, ctx, id, data, at);
		});
	}

	#endPause(): void {
		if (!this.paused) return;
		this.paused = false;
		this.#held = [];
		ambience.setPaused(false);
		this.#mark();
	}

	/** Stops one sound with a short fade, or every sound when none is named. */
	stop(id?: string): void {
		for (const voice of [...this.#voices.values()]) {
			if (id !== undefined && voice.id !== id) continue;
			this.#voices.delete(voice.id);
			voice.player.stop();
		}
		if (id === undefined) {
			this.#pending.clear();
			this.#held = [];
		} else {
			this.#pending.delete(id);
			this.#held = this.#held.filter((held) => held.id !== id);
		}
		this.#mark();
	}

	/** Updates which buttons show pressed. */
	#mark(): void {
		this.playing = [
			...new Set([...this.#voices.keys(), ...this.#pending, ...this.#held.map((held) => held.id)])
		];
	}
}

export const soundboard = new Soundboard();
