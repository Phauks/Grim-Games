import type { Gain, Player } from 'tone';
import {
	BOARD_SOUNDS,
	boardSound,
	boardSoundUrl,
	padSounds,
	soundMix,
	type BoardSoundMix,
	type SoundPad
} from '#lib/core/sound/soundboard.ts';
import type { TownSoundCommand, TownSoundPlay } from '#lib/core/sync/room-sound.ts';
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
 *
 * Play on (plan U10, Trevor 2026-10-27) sends each of these to the Public Town tablet too,
 * through the room, or only there: the board's room connects `town`, and the tablet plays
 * them with `fromStoryteller`. Sent only there, sounds still run here, silent, so the pads
 * show what is playing.
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
	/** The Storyteller's mix, for a sound sent to the Public Town; the device's own otherwise. */
	fixed?: BoardSoundMix;
}

interface Held {
	id: string;
	data: AudioBuffer;
	/** Seconds into the recording where it was paused. */
	at: number;
	fixed?: BoardSoundMix;
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

/** What a sound plays at here: the device's own mix, or the one the Storyteller sent. */
function mixOf(voice: { id: string; fixed?: BoardSoundMix }): BoardSoundMix {
	return voice.fixed ?? soundMix(preferences.current.soundMixes, voice.id);
}

class Soundboard {
	/** The sounds playing now, for their buttons' pressed state; kept while paused. */
	playing = $state<string[]>([]);
	paused = $state(false);
	/** The sound the mixer's per-sound rows change. */
	mixing = $state(BOARD_SOUNDS[0].id);
	/**
	 * Sends a command to the Public Town tablet, while this device's board has a room; false
	 * when the room can't be reached.
	 */
	town: ((command: TownSoundCommand) => boolean) | undefined;
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
		return this.playAll([id]);
	}

	/** Plays a pad: its sound, or every sound in its mix at once. */
	togglePad(pad: SoundPad): void {
		const ids = padSounds(pad);
		if (ids.length === 1) return this.toggle(ids[0]);
		if (this.isPadPlaying(pad)) {
			if (this.paused) this.resume();
			else for (const id of ids) this.stop(id);
		} else void this.playAll(ids);
	}

	/** Every sound in the pad is playing, or held by Pause. */
	isPadPlaying(pad: SoundPad): boolean {
		return padSounds(pad).every((id) => this.isPlaying(id));
	}

	/** Plays sounds together, cutting off the others unless sounds may overlap. */
	async playAll(ids: string[]): Promise<void> {
		const sounds = ids
			.filter((id) => boardSound(id))
			.map((id) => ({ id, ...soundMix(preferences.current.soundMixes, id) }));
		const cut = !preferences.current.soundboardOverlap;
		if (this.#toTown() && sounds.length) this.town?.({ command: 'play', sounds, cut });
		this.#endPause();
		await this.#play(sounds, cut, false);
	}

	/** Plays what the Storyteller's soundboard sent the Public Town (plan U10). */
	fromStoryteller(command: TownSoundCommand): void {
		if (command.command === 'play') {
			this.#endPause();
			void this.#play(command.sounds, command.cut, true);
		} else if (command.command === 'stop') {
			if (command.ids) for (const id of command.ids) this.#stopHere(id);
			else this.#stopHere();
		} else if (command.command === 'pause') this.#pauseHere();
		else this.#resumeHere();
	}

	/** Play on sends to the Public Town, and the board has a room to send it through. */
	#toTown(): boolean {
		return !!this.town && preferences.current.soundOutput !== 'device';
	}

	/** Play on keeps this device's speaker silent, sending only to the Public Town. */
	#silentHere(): boolean {
		return !!this.town && preferences.current.soundOutput === 'town';
	}

	#level(): number {
		return this.#silentHere() ? 0 : busLevel();
	}

	async #play(sounds: TownSoundPlay[], cut: boolean, fixed: boolean): Promise<void> {
		const ctx = audio();
		if (cut) this.#stopHere();
		else for (const { id } of sounds) this.#stopHere(id);
		const known = sounds.filter(({ id }) => boardSound(id));
		if (!known.length || !ctx || (busLevel() <= 0 && !this.#toTown())) return;
		unlockSound();
		if (!this.#keptOffline) {
			// Every sound, so a game later on with no signal can still play them all.
			this.#keptOffline = true;
			keepOffline(BOARD_SOUNDS.map(boardSoundUrl));
		}
		for (const { id } of known) this.#pending.add(id);
		this.#mark();
		await Promise.all(
			known.map(async ({ id, volume, loop }) => {
				const sound = boardSound(id);
				if (!sound) return;
				const [Tone, data] = await Promise.all([tone(ctx), recording(ctx, boardSoundUrl(sound))]);
				if (!this.#pending.delete(id) || !Tone || !data) {
					this.#mark();
					return;
				}
				this.#start(Tone, ctx, { id, data, at: 0, fixed: fixed ? { volume, loop } : undefined });
			})
		);
	}

	#start(Tone: Tone, ctx: AudioContext, { id, data, at, fixed }: Held): void {
		this.#bus ??= new Tone.Gain(this.#level()).toDestination();
		const mix = mixOf({ id, fixed });
		const gain = new Tone.Gain(mix.volume).connect(this.#bus);
		const player = new Tone.Player(data).connect(gain);
		player.loop = mix.loop;
		player.fadeOut = FADE;
		const voice: Voice = { id, player, gain, data, startedAt: ctx.currentTime - at, fixed };
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

	/** Follows a change of level, of Play on or of a sound's mix while it plays. */
	applyMix(): void {
		const ctx = audio();
		if (!ctx) return;
		this.#bus?.gain.setTargetAtTime(this.#level(), ctx.currentTime, 0.05);
		for (const voice of this.#voices.values()) {
			const mix = mixOf(voice);
			voice.gain.gain.setTargetAtTime(mix.volume, ctx.currentTime, 0.05);
			voice.player.loop = mix.loop;
		}
	}

	/** Holds every sound where it is, and day and night sound, until resumed. */
	pause(): void {
		if (this.paused) return;
		if (this.#toTown()) this.town?.({ command: 'pause' });
		this.#pauseHere();
	}

	#pauseHere(): void {
		const ctx = audio();
		if (this.paused || !ctx) return;
		const held = [...this.#voices.values()]
			.map((voice) => {
				const elapsed = ctx.currentTime - voice.startedAt;
				const at = voice.player.loop ? elapsed % voice.data.duration : elapsed;
				return { id: voice.id, data: voice.data, at, fixed: voice.fixed };
			})
			.filter((held) => held.at < held.data.duration);
		this.#stopHere();
		this.#held = held;
		this.paused = true;
		ambience.setPaused(true);
		this.#mark();
	}

	/** Carries on from where Pause held everything. */
	resume(): void {
		if (this.paused && this.#toTown()) this.town?.({ command: 'resume' });
		this.#resumeHere();
	}

	#resumeHere(): void {
		const held = this.#held;
		const ctx = audio();
		this.#endPause();
		if (!held.length || !ctx) return;
		unlockSound();
		void tone(ctx).then((Tone) => {
			if (!Tone || this.paused) return;
			for (const sound of held) this.#start(Tone, ctx, sound);
		});
	}

	/** Ends a pause without resuming, as when another sound plays. */
	#endPause(): void {
		if (!this.paused) return;
		this.paused = false;
		this.#held = [];
		ambience.setPaused(false);
		this.#mark();
	}

	/** Stops one sound with a short fade, or every sound when none is named. */
	stop(id?: string): void {
		if (this.#toTown())
			this.town?.(id === undefined ? { command: 'stop' } : { command: 'stop', ids: [id] });
		this.#stopHere(id);
	}

	#stopHere(id?: string): void {
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
