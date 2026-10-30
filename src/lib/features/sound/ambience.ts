import { ambienceMix, ambienceUrl, type AmbienceMix } from '#lib/core/sound/ambience.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { recording } from './recording.ts';
import { audio, unlockOnFirstTap } from './sound.ts';

/**
 * Plays day and night sound (plan U3, Trevor 2026-10-26): the recording the Storyteller chose
 * for the scene, looped (`#lib/core/sound/ambience.ts`). Never on the Storyteller's own device
 * (Trevor, 2026-10-30): the public table names it (`PublicSound`), and the Public Town tablet
 * and players' phones play it. One plays at a time; a new scene or a new choice fades in over
 * the old one. A recording is fetched when first played, so a device that never plays one
 * never downloads one; a missing one is left out.
 */

/** Seconds a recording takes to fade in or out. */
const FADE = 3;

interface Playing {
	id: string;
	gain: GainNode;
	source?: AudioBufferSourceNode;
}

/** A recording, decoded once per page; undefined when it can't be fetched or decoded. */
function buffer(ctx: AudioContext, mix: AmbienceMix): Promise<AudioBuffer | undefined> {
	return recording(ctx, ambienceUrl(mix));
}

/** The level day and night sound previews at, under the device's volume. */
function busLevel(): number {
	return preferences.current.ambienceLevel * preferences.current.soundVolume;
}

/** A recording and the Storyteller's level for it, as the public table sends them. */
export interface AmbienceCue {
	id: string;
	level: number;
}

class Ambience {
	#bus: GainNode | undefined;
	#playing: Playing | undefined;
	#kept = new Set<string>();
	#paused = false;
	#cue: AmbienceCue | undefined;

	/**
	 * Holds day and night sound silent until resumed, from the soundboard's Pause. A looped
	 * recording has no place to keep, so it fades out and back in.
	 */
	setPaused(paused: boolean): void {
		if (this.#paused === paused) return;
		this.#paused = paused;
		this.follow(this.#cue);
	}

	/**
	 * Plays the recording the Storyteller's game names, at their level under this device's
	 * volume, fading out the one before; undefined stops it.
	 */
	follow(cue: AmbienceCue | undefined): void {
		this.#cue = cue;
		const mix = cue && ambienceMix(cue.id);
		const level = this.#paused || !cue ? 0 : cue.level * preferences.current.soundVolume;
		if (this.#playing && this.#playing.id !== mix?.id) this.#fadeOut(this.#playing);
		if (!mix) return;
		const ctx = audio();
		if (!ctx) return;
		// A phone or the town may get it before any tap, as after a reload.
		if (ctx.state === 'suspended') unlockOnFirstTap();
		this.#keepOffline(mix);
		if (!this.#bus) {
			this.#bus = ctx.createGain();
			this.#bus.connect(ctx.destination);
		}
		this.#bus.gain.setTargetAtTime(level, ctx.currentTime, 0.1);
		if (this.#playing?.id !== mix.id) this.#start(ctx, this.#bus, mix);
	}

	/** Stores the recording, so it plays again later on with no signal. */
	#keepOffline(mix: AmbienceMix): void {
		const url = ambienceUrl(mix);
		if (this.#kept.has(url)) return;
		this.#kept.add(url);
		keepOffline([url]);
	}

	#start(ctx: AudioContext, bus: GainNode, mix: AmbienceMix): void {
		const gain = ctx.createGain();
		gain.connect(bus);
		const playing: Playing = { id: mix.id, gain };
		this.#playing = playing;
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);
		void buffer(ctx, mix).then((data) => {
			if (!data || this.#playing !== playing) return;
			const source = ctx.createBufferSource();
			source.buffer = data;
			source.loop = true;
			source.connect(gain);
			// From a random point, so the same recording never starts the same way.
			source.start(0, Math.random() * data.duration);
			playing.source = source;
		});
	}

	#fadeOut(playing: Playing): void {
		if (this.#playing === playing) this.#playing = undefined;
		const ctx = audio();
		if (!ctx) return;
		playing.gain.gain.cancelScheduledValues(ctx.currentTime);
		playing.gain.gain.setValueAtTime(playing.gain.gain.value, ctx.currentTime);
		playing.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
		setTimeout(() => {
			playing.source?.stop();
			playing.gain.disconnect();
		}, FADE * 1000);
	}
}

export const ambience = new Ambience();

let preview: { source: AudioBufferSourceNode; gain: GainNode } | undefined;

/**
 * Plays a few seconds of a recording, as chosen in Settings, so a storyteller hears what they
 * picked. Cuts off the one before.
 */
export async function previewAmbience(id: string): Promise<void> {
	stopPreview();
	const mix = ambienceMix(id);
	const ctx = audio();
	if (!mix || !ctx) return;
	if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
	const data = await buffer(ctx, mix);
	if (!data) return;
	stopPreview();
	const source = ctx.createBufferSource();
	const gain = ctx.createGain();
	source.buffer = data;
	const level = busLevel();
	const length = Math.min(6, data.duration);
	gain.gain.setValueAtTime(0, ctx.currentTime);
	gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.5);
	gain.gain.setValueAtTime(level, ctx.currentTime + length - 1);
	gain.gain.linearRampToValueAtTime(0, ctx.currentTime + length);
	source.connect(gain).connect(ctx.destination);
	source.start(0, Math.random() * Math.max(0, data.duration - length));
	source.stop(ctx.currentTime + length);
	preview = { source, gain };
}

/** Stops a preview still playing. */
function stopPreview(): void {
	if (!preview) return;
	try {
		preview.source.stop();
	} catch {
		// Already stopped.
	}
	preview.gain.disconnect();
	preview = undefined;
}
