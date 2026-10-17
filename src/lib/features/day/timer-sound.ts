import type { TimerSound } from '#lib/ui/preferences.ts';

/**
 * The day timer's finishing sounds (Trevor, 2026-10-17), made with the Web Audio API on the
 * device, so there are no audio files to bundle or licence. Browsers only allow sound after
 * a tap, so `unlockTimerSound` runs on the Start tap and the sound can play later.
 */
let context: AudioContext | undefined;

function audio(): AudioContext | undefined {
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

/** Call from a tap, so a later sound is allowed. */
export function unlockTimerSound(): void {
	const ctx = audio();
	if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
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
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = wave;
	osc.frequency.value = hz;
	const start = ctx.currentTime + at;
	gain.gain.setValueAtTime(volume, start);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(gain).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + length);
}

export function playTimerSound(sound: TimerSound): void {
	if (sound === 'none') return;
	const ctx = audio();
	if (!ctx) return;
	unlockTimerSound();
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
		case 'buzzer':
			for (const at of [0, 0.5, 1]) note(ctx, 220, at, 0.4, 'square', 0.15);
			return;
	}
}
