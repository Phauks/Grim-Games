import {
	AMBIENCE_PATH,
	AMBIENCE_SOUNDS,
	ambienceFiles,
	ambienceFor,
	callVariation,
	nextCallDelay,
	pickFile,
	type AmbienceRate,
	type AmbienceSound
} from '#lib/core/sound/ambience.ts';
import { keepOffline } from '#lib/features/offline/keep-offline.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { audio, unlockOnFirstTap } from './sound.ts';

/**
 * Plays day and night sound on the board (plan U3, Trevor 2026-10-26): the recorded loops of
 * the scene under its calls, each call at a random time with a little change of speed,
 * loudness and side (`#lib/core/sound/ambience.ts`). A new scene fades in over the old one.
 * The recordings are fetched when first played, so a device that never turns this on never
 * downloads them; a missing one is left out.
 */

/** Seconds a sound takes to fade in or out. */
const FADE = 3;

interface Layer {
	sound: AmbienceSound;
	gain: GainNode;
	source?: AudioBufferSourceNode;
	timer?: ReturnType<typeof setTimeout>;
	last?: string;
}

const buffers = new Map<string, Promise<AudioBuffer | undefined>>();

/** A recording, decoded once per page; undefined when it can't be fetched or decoded. */
function buffer(ctx: AudioContext, file: string): Promise<AudioBuffer | undefined> {
	const url = `${AMBIENCE_PATH}/${file}`;
	let decoded = buffers.get(url);
	if (!decoded) {
		decoded = fetch(url)
			.then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
			.then((data) => ctx.decodeAudioData(data))
			.catch(() => {
				buffers.delete(url);
				return undefined;
			});
		buffers.set(url, decoded);
	}
	return decoded;
}

/** The level every day and night sound plays at, under the device's volume. */
function busLevel(): number {
	return preferences.current.ambienceLevel * preferences.current.soundVolume;
}

/** A call's rate as chosen now, or undefined when it has been turned off. */
function rateOf(sound: AmbienceSound): AmbienceRate | undefined {
	const choice = preferences.current.ambience[sound.id] ?? sound.choice;
	return choice === 'off' || choice === 'on' ? undefined : choice;
}

/** Plays one of a call's files now, through `output`. */
async function playCall(
	ctx: AudioContext,
	output: AudioNode,
	sound: AmbienceSound,
	last?: string
): Promise<string> {
	const file = pickFile(sound.files, last);
	const data = await buffer(ctx, file);
	if (!data || ctx.state !== 'running') return file;
	const { speed, gain, pan } = callVariation();
	const source = ctx.createBufferSource();
	source.buffer = data;
	source.playbackRate.value = speed;
	const level = ctx.createGain();
	level.gain.value = sound.level * gain;
	let node: AudioNode = source.connect(level);
	// Safari before 14.1 has no stereo panner; the call plays centred there.
	if (typeof ctx.createStereoPanner === 'function') {
		const panner = ctx.createStereoPanner();
		panner.pan.value = pan;
		node = node.connect(panner);
	}
	node.connect(output);
	source.start();
	return file;
}

class Ambience {
	#bus: GainNode | undefined;
	#layers = new Map<string, Layer>();
	#keptOffline = false;

	/**
	 * Plays this scene's sounds as the preferences choose, fading out any that stop; null
	 * stops them all. Reads the preferences, so an effect that calls it follows their changes.
	 */
	sync(scene: 'night' | 'day' | null): void {
		const on = preferences.current.ambienceOn && scene !== null;
		const wanted = on ? ambienceFor(scene, preferences.current.ambience) : [];
		const level = busLevel();
		for (const [id, layer] of this.#layers) {
			if (!wanted.some((sound) => sound.id === id)) this.#fadeOut(id, layer);
		}
		if (wanted.length === 0) return;
		const ctx = audio();
		if (!ctx) return;
		// The board may open before any tap, as after a reload.
		if (ctx.state === 'suspended') unlockOnFirstTap();
		if (!this.#keptOffline) {
			// Every recording, so a game later on with no signal still has them all.
			this.#keptOffline = true;
			keepOffline(ambienceFiles());
		}
		if (!this.#bus) {
			this.#bus = ctx.createGain();
			this.#bus.connect(ctx.destination);
		}
		this.#bus.gain.setTargetAtTime(level, ctx.currentTime, 0.1);
		for (const sound of wanted) {
			if (!this.#layers.has(sound.id)) this.#start(ctx, this.#bus, sound);
		}
	}

	#start(ctx: AudioContext, bus: GainNode, sound: AmbienceSound): void {
		const gain = ctx.createGain();
		gain.connect(bus);
		const layer: Layer = { sound, gain };
		this.#layers.set(sound.id, layer);
		if (sound.kind === 'call') {
			gain.gain.value = 1;
			// The first call comes sooner than the rest, so a new scene is heard to begin.
			const rate = rateOf(sound);
			if (rate) this.#nextCall(ctx, layer, nextCallDelay(rate) / 2);
			return;
		}
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(sound.level, ctx.currentTime + FADE);
		void buffer(ctx, sound.files[0]).then((data) => {
			if (!data || this.#layers.get(sound.id) !== layer) return;
			const source = ctx.createBufferSource();
			source.buffer = data;
			source.loop = true;
			source.connect(gain);
			// From a random point, so the same loop never starts the same way.
			source.start(0, Math.random() * data.duration);
			layer.source = source;
		});
	}

	#nextCall(ctx: AudioContext, layer: Layer, seconds: number): void {
		layer.timer = setTimeout(async () => {
			if (this.#layers.get(layer.sound.id) !== layer) return;
			layer.last = await playCall(ctx, layer.gain, layer.sound, layer.last);
			const rate = rateOf(layer.sound);
			if (rate && this.#layers.get(layer.sound.id) === layer) {
				this.#nextCall(ctx, layer, nextCallDelay(rate));
			}
		}, seconds * 1000);
	}

	#fadeOut(id: string, layer: Layer): void {
		this.#layers.delete(id);
		clearTimeout(layer.timer);
		const ctx = audio();
		if (!ctx) return;
		layer.gain.gain.cancelScheduledValues(ctx.currentTime);
		layer.gain.gain.setValueAtTime(layer.gain.gain.value, ctx.currentTime);
		layer.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
		setTimeout(() => {
			layer.source?.stop();
			layer.gain.disconnect();
		}, FADE * 1000);
	}
}

export const ambience = new Ambience();

let preview: { source: AudioBufferSourceNode; gain: GainNode } | undefined;

/**
 * Plays a sound once, as chosen in Settings, so a storyteller hears what they picked: a call
 * once, a loop for a few seconds. Cuts off the one before.
 */
export async function previewAmbience(id: string): Promise<void> {
	stopPreview();
	const sound = AMBIENCE_SOUNDS.find((each) => each.id === id);
	const ctx = audio();
	if (!sound || !ctx) return;
	if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
	const data = await buffer(ctx, pickFile(sound.files, undefined));
	if (!data) return;
	stopPreview();
	const source = ctx.createBufferSource();
	const gain = ctx.createGain();
	source.buffer = data;
	const level = sound.level * busLevel();
	const length = sound.kind === 'loop' ? 4 : data.duration;
	gain.gain.setValueAtTime(level, ctx.currentTime);
	gain.gain.setValueAtTime(level, ctx.currentTime + length - 0.5);
	gain.gain.linearRampToValueAtTime(0, ctx.currentTime + length);
	source.connect(gain).connect(ctx.destination);
	source.start(0, sound.kind === 'loop' ? Math.random() * Math.max(0, data.duration - length) : 0);
	source.stop(ctx.currentTime + length);
	preview = { source, gain };
}

/** Stops a preview still playing. */
export function stopPreview(): void {
	if (!preview) return;
	try {
		preview.source.stop();
	} catch {
		// Already stopped.
	}
	preview.gain.disconnect();
	preview = undefined;
}
