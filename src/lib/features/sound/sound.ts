import { preferences } from '#lib/ui/preferences.svelte.ts';
import type { TimerSound } from '#lib/ui/preferences.ts';

/**
 * Every sound the app makes, in one place (plan U1, Trevor 2026-10-26: "consolidation of
 * sound features"): one audio context, one unlock, one volume (Settings > Sound), and never
 * two sounds at once. The sounds are made with the Web Audio API on the device, so there are
 * no audio files to bundle or licence. The clock tower chimes play the Westminster Quarters,
 * a 1793 melody in the public domain, on synthesised bells. Browsers only allow sound after a
 * tap, so `unlockSound` runs on a tap (the timer's Start) and the sound can play later.
 */
let context: AudioContext | undefined;

/** The app's one audio context, which day and night sound shares; none where unsupported. */
export function audio(): AudioContext | undefined {
	if (context) return context;
	const Ctor =
		globalThis.AudioContext ??
		(globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return undefined;
	try {
		context = new Ctor();
	} catch {
		return undefined;
	}
	return context;
}

const VIBRATION = [300, 150, 300, 150, 300];

/**
 * Whether this device can vibrate. Safari on iPhone and iPad has no Vibration
 * API; desktop Chrome and Edge have it with no motor behind it (Trevor, 2026-10-18: Vibrate
 * looked usable on his laptop), so a touch-first screen is required too. A touchscreen
 * laptop whose main pointer is coarse can still pass: browsers don't say whether a motor exists.
 */
export function canVibrate(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		typeof navigator.vibrate === 'function' &&
		typeof matchMedia === 'function' &&
		matchMedia('(pointer: coarse)').matches
	);
}

/** The app's vibration, where the device has one. */
export function vibrate(): void {
	if (canVibrate()) navigator.vibrate(VIBRATION);
}

/** Call from a tap, so a later sound is allowed. */
export function unlockSound(): void {
	const ctx = audio();
	if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
}

/** What the sound now playing is made of, so the next one can cut it off. */
let playing: { output: GainNode; voices: OscillatorNode[] } | undefined;

/** Stops the sound now playing, so two never overlap (Trevor, 2026-10-17). */
export function stopSound(): void {
	if (!playing) return;
	const { output, voices } = playing;
	playing = undefined;
	for (const voice of voices) {
		try {
			voice.stop();
		} catch {
			// Already stopped.
		}
	}
	output.disconnect();
}

/** One note: a wave at `hz` from `at` seconds, fading out over `length`. */
function note(
	ctx: AudioContext,
	hz: number,
	at: number,
	length: number,
	wave: OscillatorType = 'sine',
	volume = 0.3
): void {
	if (!playing) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = wave;
	osc.frequency.value = hz;
	const start = ctx.currentTime + at;
	gain.gain.setValueAtTime(volume, start);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(gain).connect(playing.output);
	osc.start(start);
	osc.stop(start + length);
	playing.voices.push(osc);
}

/**
 * A struck tower bell: a fundamental with a bell's partials (hum an octave below, a minor
 * third, a fifth, the octave above), each dying away at its own rate.
 */
function towerBell(ctx: AudioContext, hz: number, at: number, length: number, volume = 0.22): void {
	const partials: [ratio: number, gain: number, decay: number][] = [
		[0.5, 0.5, 1],
		[1, 1, 0.8],
		[1.2, 0.35, 0.6],
		[1.5, 0.25, 0.5],
		[2, 0.4, 0.45],
		[2.5, 0.15, 0.3],
		[3, 0.1, 0.25]
	];
	for (const [ratio, gain, decay] of partials) {
		note(ctx, hz * ratio, at, length * decay, 'sine', volume * gain);
	}
}

/**
 * The Westminster Quarters (1793, long in the public domain), as a clock tower plays them
 * on the hour: four changes of four bells, then the hour bell. Pitches in E major.
 */
const E4 = 329.63;
const FS4 = 369.99;
const GS4 = 415.3;
const B3 = 246.94;
const WESTMINSTER_HOUR: number[][] = [
	[E4, GS4, FS4, B3],
	[E4, FS4, GS4, E4],
	[GS4, E4, FS4, B3],
	[B3, FS4, GS4, E4]
];

/** Plays a sound at the device's volume, cutting off any still playing. */
export function playSound(sound: TimerSound, volume = preferences.current.soundVolume): void {
	stopSound();
	if (sound === 'none' || volume <= 0) return;
	const ctx = audio();
	if (!ctx) return;
	unlockSound();
	const output = ctx.createGain();
	output.gain.value = volume;
	output.connect(ctx.destination);
	playing = { output, voices: [] };
	switch (sound) {
		case 'bell':
			// Three strikes, each a note and a softer overtone ringing out.
			for (const at of [0, 0.9, 1.8]) {
				note(ctx, 880, at, 1.6);
				note(ctx, 2200, at, 0.8, 'sine', 0.1);
			}
			return;
		case 'chime':
			// A rising three-note figure, twice.
			for (const [i, hz] of [1047, 1319, 1568, 1047, 1319, 1568].entries()) {
				note(ctx, hz, i * 0.22 + (i >= 3 ? 0.4 : 0), 0.7);
			}
			return;
		case 'clocktower': {
			const beat = 0.5;
			let at = 0;
			for (const change of WESTMINSTER_HOUR) {
				for (const hz of change) {
					towerBell(ctx, hz, at, 2.4);
					at += beat;
				}
				at += beat;
			}
			// The hour bell, low and slow.
			for (let i = 0; i < 3; i++) towerBell(ctx, E4 / 2, at + i * 1.6, 3, 0.3);
			return;
		}
		case 'buzzer':
			for (const at of [0, 0.5, 1]) note(ctx, 220, at, 0.4, 'square', 0.15);
			return;
	}
}

/**
 * The Storyteller called everyone back to town (plan U2): this phone plays its Back to town
 * sound and vibrates, as its settings say.
 */
export function hearCallTown(): void {
	if (preferences.current.timerVibrate) vibrate();
	playSound(preferences.current.callSound);
}

/**
 * Browsers only let a page make a sound it wasn't tapped for once it has been tapped. A
 * phone in a room may sound at any time, so the first tap anywhere unlocks it.
 */
export function unlockOnFirstTap(): void {
	if (typeof window === 'undefined') return;
	window.addEventListener('pointerdown', unlockSound, { once: true, capture: true });
}
