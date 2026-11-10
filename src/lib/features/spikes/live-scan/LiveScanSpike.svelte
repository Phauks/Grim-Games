<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { editionScript } from '#lib/core/data/script.ts';
	import {
		difference,
		glareRects,
		grayOf,
		homography,
		mapPoint,
		sheetCorners,
		type Gray,
		type Point,
		type Rect
	} from '#lib/core/photo/frame-checks.ts';
	import { readScriptLines, type PhotoLineTrace } from '#lib/core/photo/script-photo.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { groupByType } from '#lib/features/player/player-script.ts';
	import {
		openTextReader,
		type PlacedLine,
		type TextReader
	} from '#lib/features/scripts/photo-reader.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { demoFeed } from './demo-feed.ts';

	/**
	 * Live script scan, mockup C built for real so the two ways of keeping its marks on the
	 * sheet can be tried side by side (Trevor, 2026-11-10: "build prototypes for both ... and
	 * then I decide"). The camera (or a pretend one) runs all the time; whenever the picture
	 * is held still, the text reader reads a frame and each line it read is marked over the
	 * picture: blue for a character, gold for the title, red for a name the app doesn't know,
	 * dashed for glare. Each read adds to what was read before.
	 *
	 * - Fade while moving: marks stay where the read frame had them, and fade out as the
	 *   picture moves away from that frame.
	 * - Corner tracking: the sheet's four corners are found in every frame and the marks are
	 *   moved with them.
	 */

	type Source = 'demo' | 'camera';
	type MarkKind = 'character' | 'ability' | 'title' | 'unknown';
	interface Mark {
		box: Rect;
		kind: MarkKind;
	}
	interface Reading {
		marks: Mark[];
		/** The read frame, small, to tell how far the picture has moved since. */
		gray: Gray;
		/** The sheet's corners in the read frame, in picture pixels. */
		corners?: Point[];
	}

	/** The small frame the quick checks look at, this wide. */
	const SMALL = 160;
	/** Frames are read at this long side: big enough for a sheet's small print. */
	const READ_SIDE = 1200;
	/** A frame this unlike the last (mean brightness change, 0 to 255) counts as moving. */
	const MOVING = 3;
	/** Held still this long before a read starts. */
	const STILL_MS = 350;

	let source = $state<Source>('demo');
	let tracking = $state(false);
	let status = $state('Starting the text reader');
	let problem = $state('');
	let readMs = $state(0);
	let reads = $state(0);
	let cornersFound = $state(false);
	let title = $state('');
	let reviewOpen = $state(false);
	let glareShown = $state(false);
	let pool = $state.raw<Character[]>([]);
	const found = new SvelteMap<CharacterId, Character>();
	let unknown = $state.raw<string[]>([]);

	let view: HTMLCanvasElement | undefined = $state();
	let video: HTMLVideoElement | undefined = $state();

	const groups = $derived(groupByType([...found.values()]));
	const banner = $derived(
		found.size || title
			? `${title || 'No title read yet'}. ${found.size} ${found.size === 1 ? 'character' : 'characters'} read.`
			: 'Nothing read yet'
	);

	function startOver() {
		found.clear();
		unknown = [];
		title = '';
		reads = 0;
		reading = undefined;
	}

	let reading: Reading | undefined;
	let feed: ReturnType<typeof demoFeed> | undefined;
	let stream: MediaStream | undefined;

	async function useCamera() {
		source = 'camera';
		problem = '';
		startOver();
		try {
			stream ??= await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
				audio: false
			});
			if (video) {
				video.srcObject = stream;
				await video.play().catch(() => {});
			}
		} catch (error) {
			problem = `The camera did not start (${(error as Error).name}).`;
			source = 'demo';
		}
	}

	function useDemo() {
		source = 'demo';
		problem = '';
		startOver();
	}

	/** The picture to look at now, and its size, or undefined while there is none. */
	function picture(now: number): { el: CanvasImageSource; w: number; h: number } | undefined {
		if (source === 'camera') {
			if (!video || !video.videoWidth) return undefined;
			return { el: video, w: video.videoWidth, h: video.videoHeight };
		}
		if (!feed) return undefined;
		feed.draw(now);
		return { el: feed.canvas, w: feed.canvas.width, h: feed.canvas.height };
	}

	function kindOf(trace: PhotoLineTrace): MarkKind | undefined {
		if (trace.outcome === 'name' || trace.outcome === 'close') return 'character';
		if (trace.outcome === 'ability') return 'ability';
		if (trace.outcome === 'title') return 'title';
		if (trace.outcome === 'unmatched') return 'unknown';
		return undefined;
	}

	/** Reads one frame and merges what it names into what was read before. */
	async function read(
		reader: TextReader,
		frame: HTMLCanvasElement,
		scale: number,
		gray: Gray,
		corners?: Point[]
	) {
		const started = performance.now();
		const lines: PlacedLine[] = await reader.read(frame);
		readMs = performance.now() - started;
		reads++;
		const traces: PhotoLineTrace[] = [];
		const result = readScriptLines(lines, pool, (t) => traces.push(t));
		const marks: Mark[] = [];
		for (const trace of traces) {
			const kind = kindOf(trace);
			const box = lines[trace.index]?.box;
			if (!kind || !box) continue;
			marks.push({
				kind,
				box: { x0: box.x0 / scale, y0: box.y0 / scale, x1: box.x1 / scale, y1: box.y1 / scale }
			});
		}
		reading = { marks, gray, corners };
		for (const f of result.found) found.set(f.character.id, f.character);
		unknown = [...new Set([...unknown, ...result.unmatched])];
		title ||= result.title;
	}

	/** The colour of each kind of mark, from the theme. */
	function palette() {
		const css = getComputedStyle(document.documentElement);
		const token = (name: string) => css.getPropertyValue(name).trim();
		return {
			character: token('--good'),
			ability: token('--good'),
			title: token('--accent'),
			unknown: token('--evil'),
			glare: token('--accent'),
			sheet: token('--on-surface')
		};
	}

	function outline(ctx: CanvasRenderingContext2D, points: Point[]) {
		ctx.beginPath();
		points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
		ctx.closePath();
	}

	onMount(() => {
		let stopped = false;
		let reader: TextReader | undefined;
		let busy = false;
		let previous: Gray | undefined;
		let stillSince = performance.now();
		let lastCheck = 0;
		let glare: Rect[] = [];
		let corners: Point[] | undefined;
		let colours = palette();
		const small = document.createElement('canvas');
		const smallCtx = small.getContext('2d', { willReadFrequently: true })!;

		void (async () => {
			const data = await loadOfficialData();
			pool = data.characters.filter((c) => c.edition);
			const tb = editionScript('tb', data)!;
			feed = demoFeed(
				tb.name,
				tb.characters.map((c) => ({ name: c.name, ability: c.ability }))
			);
			try {
				reader = await openTextReader();
				if (stopped) return void reader.close();
				status = 'Hold still';
			} catch (error) {
				problem = `The text reader did not load (${(error as Error).message}).`;
			}
		})();

		const tick = (now: number) => {
			if (stopped) return;
			requestAnimationFrame(tick);
			const shot = picture(now);
			if (!shot || !view) return;
			if (view.width !== shot.w || view.height !== shot.h) {
				view.width = shot.w;
				view.height = shot.h;
				previous = undefined;
				reading = undefined;
			}
			const ctx = view.getContext('2d')!;
			ctx.drawImage(shot.el, 0, 0, shot.w, shot.h);
			const toView = shot.w / SMALL;

			// The quick checks, about 15 times a second.
			if (now - lastCheck > 66) {
				lastCheck = now;
				small.width = SMALL;
				small.height = Math.round((shot.h * SMALL) / shot.w);
				smallCtx.drawImage(shot.el, 0, 0, small.width, small.height);
				const rgba = smallCtx.getImageData(0, 0, small.width, small.height).data;
				const gray = grayOf(rgba, small.width, small.height);
				const moving = previous ? difference(gray, previous) > MOVING : true;
				previous = gray;
				if (moving) stillSince = now;
				glare = glareRects(rgba, small.width, small.height);
				glareShown = glare.length > 0;
				const seen = sheetCorners(gray);
				corners = seen?.map((p) => ({ x: p.x * toView, y: p.y * toView }));
				cornersFound = !!corners;
				colours = palette();
				if (!reader) status = 'Starting the text reader';
				else if (busy) status = 'Reading';
				else if (moving) status = tracking ? 'Moving' : 'Moving, marks hidden';
				else status = 'Hold still';

				if (reader && !busy && now - stillSince > STILL_MS) {
					busy = true;
					status = 'Reading';
					const scale = Math.min(1.5, READ_SIDE / Math.max(shot.w, shot.h));
					const frame = document.createElement('canvas');
					frame.width = Math.round(shot.w * scale);
					frame.height = Math.round(shot.h * scale);
					frame.getContext('2d')!.drawImage(shot.el, 0, 0, frame.width, frame.height);
					void read(reader, frame, scale, gray, corners)
						.catch((error) => (problem = `A read failed (${(error as Error).message}).`))
						.finally(() => (busy = false));
				}
			}

			const line = Math.max(2, shot.w / 300);
			ctx.lineWidth = line;

			// Marks from the last read, moved with the sheet or faded as the picture moves.
			if (reading && previous) {
				let map: ((p: Point) => Point) | undefined;
				let alpha = 1;
				const h =
					tracking && reading.corners && corners ? homography(reading.corners, corners) : undefined;
				if (h) map = (p) => mapPoint(h, p);
				else {
					const drift = difference(previous, reading.gray);
					alpha = Math.max(0, Math.min(1, 1 - (drift - 4) / 8));
					map = (p) => p;
				}
				if (alpha > 0) {
					ctx.globalAlpha = alpha;
					for (const mark of reading.marks) {
						const { x0, y0, x1, y1 } = mark.box;
						outline(
							ctx,
							[
								{ x: x0, y: y0 },
								{ x: x1, y: y0 },
								{ x: x1, y: y1 },
								{ x: x0, y: y1 }
							].map(map)
						);
						ctx.strokeStyle = colours[mark.kind];
						ctx.globalAlpha = alpha * (mark.kind === 'ability' ? 0.45 : 1);
						ctx.stroke();
						if (mark.kind === 'character') {
							ctx.fillStyle = colours.character;
							ctx.globalAlpha = alpha * 0.15;
							ctx.fill();
						}
						ctx.globalAlpha = alpha;
					}
					ctx.globalAlpha = 1;
				}
			}

			// Glare, live from this frame.
			ctx.setLineDash([line * 3, line * 2]);
			ctx.strokeStyle = colours.glare;
			for (const g of glare) {
				ctx.strokeRect(
					g.x0 * toView,
					g.y0 * toView,
					(g.x1 - g.x0) * toView,
					(g.y1 - g.y0) * toView
				);
			}
			ctx.setLineDash([]);

			// The sheet's edge as tracking sees it.
			if (tracking && corners) {
				ctx.strokeStyle = colours.sheet;
				ctx.globalAlpha = 0.6;
				outline(ctx, corners);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
		};
		requestAnimationFrame(tick);

		return () => {
			stopped = true;
			for (const track of stream?.getTracks() ?? []) track.stop();
			void reader?.close();
		};
	});
</script>

<div class="spike">
	<div class="controls">
		<Button variant={source === 'demo' ? 'accent' : 'solid'} onclick={useDemo}>Demo sheet</Button>
		<Button variant={source === 'camera' ? 'accent' : 'solid'} onclick={useCamera}>Camera</Button>
		<Toggle
			label="Corner tracking"
			checked={tracking}
			onChange={(on) => (tracking = on)}
			description={tracking
				? 'Marks follow the sheet by its corners'
				: 'Off: marks fade while the picture moves'}
		/>
	</div>

	<div class="stage">
		<video bind:this={video} muted playsinline hidden></video>
		<canvas bind:this={view} data-testid="live-scan-view" aria-label="Camera with read marks"
		></canvas>
		<div class="pills">
			<p class="pill" role="status" data-testid="live-scan-status">{status}</p>
			{#if glareShown}<p class="pill glare">Glare: tilt to read under it</p>{/if}
		</div>
	</div>

	{#if problem}<p class="problem" role="alert">{problem}</p>{/if}

	<div class="result">
		<p class="banner" data-testid="live-scan-banner">{banner}</p>
		<Button onclick={() => (reviewOpen = true)} disabled={!found.size}>Review {found.size}</Button>
	</div>
	<p class="stats">
		Last read {(readMs / 1000).toFixed(1)} s · {reads} reads · corners {cornersFound
			? 'found'
			: 'not found'}
	</p>
	<Button variant="quiet" onclick={startOver}>Start over</Button>
</div>

<Dialog bind:open={reviewOpen} title={title || 'Script from a scan'}>
	{#each groups as group (group.type)}
		<h3>{group.type}</h3>
		<ul>
			{#each group.characters as c (c.id)}<li>{c.name}</li>{/each}
		</ul>
	{/each}
	{#if unknown.length}
		<h3>Not matched</h3>
		<ul>
			{#each unknown as u (u)}<li>{u}</li>{/each}
		</ul>
	{/if}
</Dialog>

<style>
	.spike {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: calc(36 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.stage {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-raised);
	}
	canvas {
		display: block;
		width: 100%;
		max-height: 70dvh;
		object-fit: contain;
	}
	.pills {
		position: absolute;
		top: var(--space-2);
		left: var(--space-2);
		right: var(--space-2);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.pill {
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: var(--on-surface);
	}
	.glare {
		font-weight: 600;
	}
	.problem {
		margin: 0;
		color: var(--evil-text);
	}
	.result {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.banner {
		margin: 0;
		font-weight: 700;
	}
	.stats {
		margin: 0;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
