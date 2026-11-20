import type { Player } from 'tone';
import {
	BOARD_SOUNDS,
	boardSound,
	boardSoundUrl,
	isGameSound,
	isMadeSound,
	soundLoops
} from '#lib/core/sound/soundboard.ts';
import type { TownSoundCommand } from '#lib/core/sync/room-sound.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { ambience } from './ambience.ts';
import { recording } from './recording.ts';
import { audio, claimSpeaker, playSound, stopSound, unlockSound, vibrate } from './sound.ts';

/**
 * Plays the game's sounds in the room (Trevor, 2026-11-19: the full sound flow): the sound each
 * moment of a game plays by itself (Dusk, Dawn, an execution, the game's end; the day timer's
 * own are sent with the timer and Back to town), and the one the Storyteller plays from the
 * pane's Sounds. One sound plays at a time, a new one cutting off the one before, and a second
 * tap stops it. A recording that loops (a heartbeat) plays until stopped. Pause (Trevor,
 * 2026-10-27) holds the sound where it is and silences day and night sound until Resume;
 * playing another sound ends the pause. Recordings play on Tone.js, loaded the first time one
 * plays; the made sounds (bell, chime, clock tower, buzzer) are `playSound`'s.
 *
 * None of them sound on the Storyteller's own device (Trevor, 2026-10-30: it "identifies where
 * a storyteller is in a room. Only play remote on other devices"). Play on (plan U10) sends
 * each to the Public Town tablet, the players' phones or both, through the room: the board's
 * room connects `town`, and those devices play them with `fromStoryteller`. A recording still
 * runs here, silent, so the pane shows what is playing; without a room nothing is heard. A
 * preview in Settings is the one sound heard on the device it is chosen on.
 */

type Tone = typeof import('tone');

/** Seconds a stopped sound takes to fade out. */
const FADE = 0.3;

interface Voice {
	id: string;
	player: Player;
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

class Soundboard {
	/** The recording playing now, or held by Pause, for the pane's Play and Stop. */
	playing = $state<string | undefined>();
	paused = $state(false);
	/**
	 * Sends a command to the devices Play on names, while this device's board has a room;
	 * false when the room can't be reached.
	 */
	town: ((command: TownSoundCommand) => boolean) | undefined;
	#voice: Voice | undefined;
	/** A recording asked for and still loading, so a stop before it loads cancels it. */
	#pending: string | undefined;
	#held: Held | undefined;
	#bus: import('tone').Gain | undefined;
	#keptOffline = false;
	/** Sounds here are heard: they came from the Storyteller, or are a preview in Settings. */
	#heard = false;

	isPlaying(id: string): boolean {
		return this.playing === id;
	}

	/** Plays a sound, stops it when it is playing, or resumes it when paused. */
	toggle(id: string): void {
		if (this.isPlaying(id)) {
			if (this.paused) this.resume();
			else this.stop();
		} else this.play(id);
	}

	/** Plays a sound in the room, cutting off the one before. */
	play(id: string): void {
		if (!isGameSound(id)) return;
		this.#hear(false);
		this.town?.({ command: 'play', id });
		this.#endPause();
		void this.#play(id);
	}

	/** Plays a sound on this device alone, as chosen in Settings, so it can be heard. */
	preview(id: string): void {
		this.#hear(true);
		this.#endPause();
		void this.#play(id);
	}

	/** Plays what the Storyteller sent the room (plan U10). */
	fromStoryteller(command: TownSoundCommand): void {
		this.#hear(true);
		if (command.command === 'play') {
			this.#endPause();
			void this.#play(command.id);
		} else if (command.command === 'stop') this.#stopHere();
		else if (command.command === 'pause') this.#pauseHere();
		else this.#resumeHere();
	}

	/** Whether sounds here are heard, cutting off any of the other kind still playing. */
	#hear(heard: boolean): void {
		if (this.#heard === heard) return;
		this.#stopHere();
		this.#heard = heard;
		this.applyVolume();
	}

	#level(): number {
		return this.#heard ? preferences.current.soundVolume : 0;
	}

	async #play(id: string): Promise<void> {
		this.#stopHere();
		if (isMadeSound(id)) {
			if (this.#heard) playSound(id);
			return;
		}
		const sound = boardSound(id);
		const ctx = audio();
		if (!sound || !ctx || (this.#level() <= 0 && this.#heard)) return;
		if (this.#heard) claimSpeaker();
		unlockSound();
		if (!this.#keptOffline) {
			// Every sound, so a game later on with no signal can still play them all.
			this.#keptOffline = true;
			keepOffline(BOARD_SOUNDS.map(boardSoundUrl));
		}
		this.#pending = id;
		this.#mark();
		const [Tone, data] = await Promise.all([tone(ctx), recording(ctx, boardSoundUrl(sound))]);
		if (this.#pending !== id || !Tone || !data) {
			if (this.#pending === id) this.#pending = undefined;
			this.#mark();
			return;
		}
		this.#pending = undefined;
		this.#start(Tone, ctx, { id, data, at: 0 });
	}

	#start(Tone: Tone, ctx: AudioContext, { id, data, at }: Held): void {
		this.#bus ??= new Tone.Gain(this.#level()).toDestination();
		const player = new Tone.Player(data).connect(this.#bus);
		player.loop = soundLoops(id);
		player.fadeOut = FADE;
		const voice: Voice = { id, player, data, startedAt: ctx.currentTime - at };
		player.onstop = () => {
			if (this.#voice === voice) {
				this.#voice = undefined;
				this.#mark();
			}
			// After the fade, so the end isn't cut short.
			setTimeout(() => player.dispose(), FADE * 1000);
		};
		this.#voice = voice;
		player.start(undefined, at);
		this.#mark();
	}

	/** Follows a change of the device's volume, or of Play on, while a sound plays. */
	applyVolume(): void {
		const ctx = audio();
		if (!ctx) return;
		this.#bus?.gain.setTargetAtTime(this.#level(), ctx.currentTime, 0.05);
	}

	/** Holds the sound where it is, and day and night sound, until resumed. */
	pause(): void {
		if (this.paused) return;
		this.town?.({ command: 'pause' });
		this.#pauseHere();
	}

	#pauseHere(): void {
		const ctx = audio();
		if (this.paused || !ctx) return;
		const voice = this.#voice;
		let held: Held | undefined;
		if (voice) {
			const elapsed = ctx.currentTime - voice.startedAt;
			const at = voice.player.loop ? elapsed % voice.data.duration : elapsed;
			if (at < voice.data.duration) held = { id: voice.id, data: voice.data, at };
		}
		this.#stopHere();
		this.#held = held;
		this.paused = true;
		ambience.setPaused(true);
		this.#mark();
	}

	/** Carries on from where Pause held everything. */
	resume(): void {
		if (this.paused) this.town?.({ command: 'resume' });
		this.#resumeHere();
	}

	#resumeHere(): void {
		const held = this.#held;
		const ctx = audio();
		this.#endPause();
		if (!held || !ctx) return;
		if (this.#heard) claimSpeaker();
		unlockSound();
		void tone(ctx).then((Tone) => {
			if (!Tone || this.paused) return;
			this.#start(Tone, ctx, held);
		});
	}

	/** Ends a pause without resuming, as when another sound plays. */
	#endPause(): void {
		if (!this.paused) return;
		this.paused = false;
		this.#held = undefined;
		ambience.setPaused(false);
		this.#mark();
	}

	/** Stops the sound playing, with a short fade. */
	stop(): void {
		this.town?.({ command: 'stop' });
		this.#stopHere();
	}

	#stopHere(): void {
		const voice = this.#voice;
		this.#voice = undefined;
		voice?.player.stop();
		stopSound();
		this.#pending = undefined;
		this.#held = undefined;
		this.#mark();
	}

	/** Updates what the pane shows playing. */
	#mark(): void {
		this.playing = this.#voice?.id ?? this.#pending ?? this.#held?.id;
	}
}

export const soundboard = new Soundboard();

/**
 * A sound the Storyteller's room sent with the timer running out or Back to town: played here
 * as any other of their sounds, after a vibration where the phone's settings allow it.
 */
export function hearGameSound(id: string | undefined, { buzz = false } = {}): void {
	if (buzz && preferences.current.timerVibrate) vibrate();
	if (id && isGameSound(id)) soundboard.fromStoryteller({ command: 'play', id });
}

/** Plays a sound on this device alone, as it is chosen in Settings. */
export function previewSound(id: string): void {
	if (isGameSound(id)) soundboard.preview(id);
}
