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
		type Rect,
		sharpness
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
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadBlob } from '#lib/ui/download.ts';
	import { demoFeed, drawSheet, pictureSheet } from './demo-feed.ts';
	import { onSheet, outline, palette, straighten } from './scan-frame.ts';

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
	 *   moved with them. A read starts once the corners are steady (a hand's shake is fine,
	 *   Trevor 2026-11-10: "I can't stay super still"); the picture is frozen, the sheet is
	 *   straightened into a flat page of paper's shape, and the flat page is read (Trevor,
	 *   2026-11-10: "get the corners, freeze it, align and straighten ... then attempts to
	 *   read").
	 */

	type Source = 'demo' | 'picture' | 'camera';
	type MarkKind = 'character' | 'ability' | 'title' | 'unknown';
	interface Mark {
		/** The line's four corners in the read frame, in picture pixels. */
		points: Point[];
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
	/** Corners that moved less than this share of the sheet's size since the last check are steady. */
	const STEADY = 0.03;
	/** Corners steady this long before a read starts. */
	const STEADY_MS = 800;
	/**
	 * A grab waits for a frame this sharp beside the sharpest of the hold (Trevor, 2026-11-10:
	 * it "takes picture too fast, so it is blurry"): a frame mid-shake scores lower.
	 */
	const SHARP_SHARE = 0.9;

	let source = $state<Source>('demo');
	let tracking = $state(true);
	let status = $state('Starting the text reader');
	let problem = $state('');
	let readMs = $state(0);
	let reads = $state(0);
	let cornersFound = $state(false);
	let title = $state('');
	let reviewOpen = $state(false);
	/**
	 * One grab per scan (Trevor, 2026-11-10: "have the picture auto-grab. hold it, and only
	 * recommend rescanning if it notices certain issues"): once read, the frame stays held.
	 */
	let grabbed = $state(false);
	/** True from the moment a picture is taken: it is held, so the phone can move again. */
	let taken = $state(false);
	/**
	 * What happened on the last grab, to copy and send (Trevor, 2026-11-10: "add copyable
	 * diagnostic for my scans so you can look").
	 */
	let diagnostics: Record<string, unknown> = {};
	/** When Scan again was pressed: a new hold starts then, so the next grab is not at once. */
	let rescanAt = 0;
	/** Set by the shutter button: take the picture now, steady or not. */
	let shutter = false;
	/** What looked wrong with the grab, each a reason to scan again; empty when it looked fine. */
	let issues = $state.raw<string[]>([]);
	/** The frame held while it is read, and after the grab. */
	let frozen: HTMLCanvasElement | undefined;
	let frozenQuad: Point[] | undefined;
	/** The corners found by the quick check when the frame was frozen. */
	let frozenCorners: Point[] | undefined;
	let glareShown = $state(false);
	let page: HTMLCanvasElement | undefined = $state();
	let pageShown = $state(false);
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
		titles.clear();
		reads = 0;
		reading = undefined;
		grabbed = false;
		taken = false;
		diagnostics = {};
		rescanAt = performance.now();
		issues = [];
		reviewOpen = false;
		frozen = undefined;
		frozenQuad = undefined;
		frozenCorners = undefined;
		round++;
	}

	/** Each title read, and how many reads gave it. */
	const titles = new SvelteMap<string, number>();
	/** Bumped by Start over, so a read already under way when the sheet changes is dropped. */
	let round = 0;

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
			feed = drawn;
		}
	}

	let drawn: ReturnType<typeof demoFeed> | undefined;
	let chooser: HTMLInputElement | undefined = $state();

	function useDemo() {
		source = 'demo';
		feed = drawn;
		problem = '';
		startOver();
	}

	/** A picture of any sheet, moved about like the drawn one. */
	async function usePicture(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			feed = demoFeed(await pictureSheet(file), true);
			source = 'picture';
			problem = '';
			startOver();
		} catch (error) {
			problem = `That picture did not open (${(error as Error).message}).`;
		}
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
		toFrame: (p: Point) => Point,
		gray: Gray,
		corners?: Point[]
	) {
		const started = performance.now();
		const begun = round;
		const lines: PlacedLine[] = await reader.read(frame);
		if (begun !== round) return;
		readMs = performance.now() - started;
		reads++;
		const traces: PhotoLineTrace[] = [];
		const result = readScriptLines(lines, pool, (t) => traces.push(t));
		diagnostics.read = {
			ms: Math.round(readMs),
			lines: traces.map((t) => ({ text: t.text, outcome: t.outcome })),
			found: result.found.map((f) => `${f.character.id}${f.kind === 'close' ? '?' : ''}`),
			unmatched: result.unmatched,
			title: result.title,
			author: result.author
		};
		const marks: Mark[] = [];
		for (const trace of traces) {
			const kind = kindOf(trace);
			const box = lines[trace.index]?.box;
			if (!kind || !box) continue;
			marks.push({
				kind,
				points: [
					{ x: box.x0, y: box.y0 },
					{ x: box.x1, y: box.y0 },
					{ x: box.x1, y: box.y1 },
					{ x: box.x0, y: box.y1 }
				].map(toFrame)
			});
		}
		reading = { marks, gray, corners };
		for (const f of result.found) found.set(f.character.id, f.character);
		unknown = [...new Set([...unknown, ...result.unmatched])];
		if (result.title) {
			// One read can catch the title under glare or blur: show the one read most often.
			titles.set(result.title, (titles.get(result.title) ?? 0) + 1);
			title = [...titles].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
		}
	}

	function copyDiagnostics() {
		void copyText(JSON.stringify(diagnostics, null, 1), {
			copied: ['Diagnostics copied'],
			failed: ['Could not copy', 'The browser did not allow it.']
		});
	}

	/** Saves the picture taken and the page straightened from it, to send with the diagnostics. */
	function savePictures() {
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		for (const [name, canvas] of [
			['frame', frozen],
			['page', pageShown ? page : undefined]
		] as const) {
			canvas?.toBlob(
				(blob) => blob && downloadBlob(`live-scan-${stamp}-${name}.jpg`, blob),
				'image/jpeg',
				0.92
			);
		}
	}

	/** Holds the read frame and lists what looked wrong with it, each a reason to scan again. */
	function grab(glareOnSheet: boolean, noCorners = false) {
		const types = new Set([...found.values()].map((c) => c.type));
		const problems = [
			glareOnSheet && 'Glare was on the sheet, so lines under it may be missing.',
			noCorners && "The sheet's corners were not all in view, so it was not straightened.",
			found.size < 5 && `Only ${found.size} ${found.size === 1 ? 'character' : 'characters'} read.`,
			found.size >= 5 && !types.has('demon') && 'No Demon read.',
			found.size >= 5 && !types.has('townsfolk') && 'No Townsfolk read.',
			unknown.length > 0 &&
				`${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} not matched to a character.`,
			!title && 'No title read.'
		];
		issues = problems.filter((i): i is string => !!i);
		diagnostics.issues = issues;
		grabbed = true;
		reviewOpen = true;
	}

	onMount(() => {
		let stopped = false;
		let reader: TextReader | undefined;
		let busy = false;
		let previous: Gray | undefined;
		let stillSince = performance.now();
		let steadySince = performance.now();
		/** The sharpest frame's score since the corners last moved. */
		let sharpest = 0;
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
			drawn = demoFeed(
				drawSheet(
					tb.name,
					tb.characters.map((c) => ({ name: c.name, ability: c.ability }))
				)
			);
			if (source === 'demo') feed = drawn;
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
			ctx.drawImage(frozen ?? shot.el, 0, 0, shot.w, shot.h);
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
				const last = corners;
				corners = seen?.map((p) => ({ x: p.x * toView, y: p.y * toView }));
				cornersFound = !!corners;
				const size = corners
					? Math.hypot(corners[0].x - corners[2].x, corners[0].y - corners[2].y)
					: 1;
				const steady =
					!!corners &&
					!!last &&
					Math.max(...corners.map((c, i) => Math.hypot(c.x - last[i].x, c.y - last[i].y))) <
						STEADY * size;
				const sharp = sharpness(gray);
				if (!steady) {
					steadySince = now;
					sharpest = sharp;
				} else sharpest = Math.max(sharpest, sharp);
				colours = palette();
				if (grabbed) status = issues.length ? 'Read, with problems below' : 'Read';
				else if (!reader) status = 'Starting the text reader';
				else if (busy) status = tracking ? 'Reading the straightened page' : 'Reading';
				else if (tracking)
					status = !corners
						? 'Show all four corners'
						: now - Math.max(steadySince, rescanAt) > STEADY_MS / 2
							? 'Hold it there'
							: 'Steady the sheet';
				else if (moving) status = 'Moving, marks hidden';
				else status = 'Hold still';

				const auto = tracking
					? !!corners &&
						now - Math.max(steadySince, rescanAt) > STEADY_MS &&
						sharp >= SHARP_SHARE * sharpest
					: now - stillSince > STILL_MS;
				if (grabbed || !reader || busy || !(shutter || auto)) {
					// Held after a grab, or not ready: nothing is read.
				} else {
					const manual = shutter;
					shutter = false;
					busy = true;
					const still = document.createElement('canvas');
					still.width = shot.w;
					still.height = shot.h;
					still.getContext('2d')!.drawImage(shot.el, 0, 0, shot.w, shot.h);
					frozen = still;
					frozenCorners = corners;
					const flat = tracking && corners ? straighten(still) : undefined;
					frozenQuad = flat?.quad;
					const glareAtGrab = onSheet(glare, toView, corners);
					taken = true;
					const round1 = (p: Point) => ({ x: Math.round(p.x), y: Math.round(p.y) });
					diagnostics = {
						at: new Date().toISOString(),
						device: navigator.userAgent,
						source,
						frame: { width: shot.w, height: shot.h },
						grab: {
							by: manual ? 'Take picture' : 'auto',
							heldMs: Math.round(now - steadySince),
							sharpness: Math.round(sharp),
							sharpestOfHold: Math.round(sharpest),
							corners: corners?.map(round1),
							straightened: flat ? { width: flat.page.width, height: flat.page.height } : null,
							glareOnSheet: glareAtGrab,
							glare: glare.map((g) => ({
								x0: Math.round(g.x0 * toView),
								y0: Math.round(g.y0 * toView),
								x1: Math.round(g.x1 * toView),
								y1: Math.round(g.y1 * toView)
							}))
						},
						settings: { tracking, steady: STEADY, steadyMs: STEADY_MS, sharpShare: SHARP_SHARE }
					};
					const begun = round;
					const done = () => {
						busy = false;
						if (!grabbed) taken = false;
						if (!grabbed) {
							frozen = undefined;
							frozenQuad = undefined;
						}
						steadySince = performance.now();
					};
					const failed = (error: unknown) =>
						(problem = `A read failed (${(error as Error).message}).`);
					if (flat) {
						status = 'Reading the straightened page';
						if (page) {
							page.width = flat.page.width;
							page.height = flat.page.height;
							page.getContext('2d')!.drawImage(flat.page, 0, 0);
							pageShown = true;
						}
						void read(reader, flat.page, flat.toFrame, gray, corners)
							.then(() => begun === round && grab(glareAtGrab, !corners))
							.catch(failed)
							.finally(done);
					} else if (manual || !tracking) {
						// A picture taken by hand is read as it is when its corners can't be found.
						status = 'Reading';
						const scale = Math.min(1.5, READ_SIDE / Math.max(shot.w, shot.h));
						const frame = document.createElement('canvas');
						frame.width = Math.round(shot.w * scale);
						frame.height = Math.round(shot.h * scale);
						frame.getContext('2d')!.drawImage(still, 0, 0, frame.width, frame.height);
						void read(reader, frame, (p) => ({ x: p.x / scale, y: p.y / scale }), gray, corners)
							.then(() => begun === round && grab(glareAtGrab, tracking && !corners))
							.catch(failed)
							.finally(done);
					} else done();
				}
			}

			const line = Math.max(2, shot.w / 300);
			ctx.lineWidth = line;

			// Marks from the last read, moved with the sheet or faded as the picture moves.
			if (reading && previous) {
				let map: ((p: Point) => Point) | undefined;
				let alpha = 1;
				// While frozen, the marks of the read before are moved onto the frozen frame.
				const target = frozen ? frozenCorners : corners;
				const h =
					tracking && reading.corners && target ? homography(reading.corners, target) : undefined;
				if (h) map = (p) => mapPoint(h, p);
				else {
					const drift = difference(previous, reading.gray);
					alpha = Math.max(0, Math.min(1, 1 - (drift - 4) / 8));
					map = (p) => p;
				}
				if (alpha > 0) {
					ctx.globalAlpha = alpha;
					for (const mark of reading.marks) {
						outline(ctx, mark.points.map(map));
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

			// The sheet's edge as tracking sees it, or as the frozen read straightens it.
			const edge = frozenQuad ?? (tracking ? corners : undefined);
			if (edge) {
				ctx.strokeStyle = frozenQuad ? colours.title : colours.sheet;
				ctx.globalAlpha = frozenQuad ? 1 : 0.6;
				outline(ctx, edge);
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
		<Button variant={source === 'picture' ? 'accent' : 'solid'} onclick={() => chooser?.click()}
			>Picture</Button
		>
		<Button variant={source === 'camera' ? 'accent' : 'solid'} onclick={useCamera}>Camera</Button>
		<input
			bind:this={chooser}
			class="file"
			type="file"
			accept="image/*"
			aria-label="Picture"
			aria-hidden="true"
			tabindex="-1"
			data-testid="live-scan-picture"
			onchange={usePicture}
		/>
		<Toggle
			label="Corner tracking"
			checked={tracking}
			onChange={(on) => (tracking = on)}
			description={tracking
				? 'Marks follow the sheet by its corners; the grab is straightened before it is read'
				: 'Off: marks fade while the picture moves'}
		/>
	</div>

	<div class="stage">
		<video bind:this={video} muted playsinline hidden></video>
		<canvas bind:this={view} data-testid="live-scan-view" aria-label="Camera with read marks"
		></canvas>
		{#if taken}
			<!-- The picture is held (Trevor, 2026-11-10): say so plainly, so the phone can move. -->
			<div class="taken" data-testid="live-scan-taken">
				<p>Picture taken. You can move.</p>
			</div>
		{/if}
		<div class="pills">
			<p class="pill" role="status" data-testid="live-scan-status">{status}</p>
			{#if glareShown && !taken}<p class="pill glare">Glare: tilt to read under it</p>{/if}
		</div>
	</div>

	{#if problem}<p class="problem" role="alert">{problem}</p>{/if}

	<div class="result">
		<p class="banner" data-testid="live-scan-banner">{banner}</p>
		<Button icon="photo" disabled={grabbed} onclick={() => (shutter = true)}>Take picture</Button>
		<Button onclick={() => (reviewOpen = true)} disabled={!found.size}>Review {found.size}</Button>
	</div>
	<p class="stats">
		Last read {(readMs / 1000).toFixed(1)} s · {reads} reads · corners {cornersFound
			? 'found'
			: 'not found'}
	</p>
	<div class="tools">
		<Button variant="quiet" onclick={startOver}>Scan again</Button>
		<Button variant="quiet" disabled={!grabbed} onclick={copyDiagnostics}>Copy diagnostics</Button>
		<Button variant="quiet" disabled={!grabbed} onclick={savePictures}>Save pictures</Button>
	</div>
	<figure class="page" hidden={!pageShown}>
		<canvas bind:this={page} data-testid="live-scan-page" aria-label="The last page straightened"
		></canvas>
		<figcaption>The last page straightened and read</figcaption>
	</figure>
</div>

<Dialog bind:open={reviewOpen} title={title || 'Script from a scan'}>
	{#if issues.length}
		<div class="issues" role="alert" data-testid="live-scan-issues">
			<ul>
				{#each issues as issue (issue)}<li>{issue}</li>{/each}
			</ul>
			<Button onclick={startOver}>Scan again</Button>
		</div>
	{/if}
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
	.file {
		position: absolute;
		width: 1px; /* px-ok: an offscreen file input, as Add script's */
		height: 1px; /* px-ok: an offscreen file input, as Add script's */
		opacity: 0;
		pointer-events: none;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	/* The held picture: a dimmed frame with a plain message, after a flash like a shutter. */
	.taken {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		box-shadow: inset 0 0 0 calc(0.4 * var(--u)) var(--good);
		pointer-events: none;
	}
	.taken::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--surface);
		opacity: 0.35;
		animation: shutter 0.35s ease-out;
	}
	.taken p {
		position: relative;
		margin: 0;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-full);
		background: var(--good);
		color: var(--on-good);
		font-size: 1.25rem;
		font-weight: 700;
	}
	@keyframes shutter {
		from {
			background: var(--on-surface);
			opacity: 0.8;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.taken::before {
			animation: none;
		}
	}
	.issues {
		padding: var(--space-2) var(--space-3);
		border: calc(0.125 * var(--u)) solid var(--evil);
		border-radius: var(--radius-md);
	}
	.issues ul {
		margin: 0 0 var(--space-2);
		padding-inline-start: var(--space-4);
	}
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
	.page {
		margin: 0;
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		color: var(--on-surface-muted);
	}
	.page canvas {
		width: 60%;
		height: auto;
		border-radius: var(--radius-md);
	}
	.stats {
		margin: 0;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
