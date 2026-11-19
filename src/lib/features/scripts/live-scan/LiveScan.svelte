<script lang="ts" module>
	import type { PlacedLine } from '../photo-reader.ts';

	/** What one scan gave: the lines read, the picture they were read from, and what looked wrong. */
	export interface Scanned {
		lines: PlacedLine[];
		picture: HTMLCanvasElement;
		/** Each a reason to scan again; empty when the picture looked fine. */
		issues: string[];
		/** How the picture was taken, for the read log (Trevor, 2026-11-10: diagnostics). */
		notes: string[];
	}
</script>

<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import {
		glareRects,
		grayOf,
		sharpness,
		sheetCorners,
		type Point,
		type Rect
	} from '#lib/core/photo/frame-checks.ts';
	import { readScriptLines } from '#lib/core/photo/script-photo.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { openTextReader, type TextReader } from '../photo-reader.ts';
	import { onSheet, outline, straighten } from './scan-frame.ts';

	/**
	 * Take a Photo (plan M54): the camera runs while the sheet is held up to it. Once the
	 * sheet's four corners are steady and the frame is sharp, the picture is taken once, held,
	 * straightened into a flat page and read on the device (Trevor, 2026-11-10: "auto-grab ...
	 * hold it, and only recommend rescanning if it notices certain issues"; "assume we have some
	 * stability before picture is taken"); Take picture takes it at once. Built from the live
	 * scan spike (Trevor, 2026-11-18: "being on its own spike no longer benefits").
	 */
	interface Props {
		open?: boolean;
		/** Called with what was read, once the picture is read. */
		onscanned: (scanned: Scanned) => void;
		/** Opens the phone's own camera instead, when this one can't start. */
		onfallback: () => void;
	}

	let { open = $bindable(false), onscanned, onfallback }: Props = $props();

	/** The small frame the quick checks look at, this wide. */
	const SMALL = 160;
	/** Frames are read at this long side when the sheet can't be straightened. */
	const READ_SIDE = 1200;
	/** Corners that moved less than this share of the sheet's size since the last check are steady. */
	const STEADY = 0.03;
	/** Corners steady this long before the picture is taken. */
	const STEADY_MS = 800;
	/** A grab waits for a frame this sharp beside the sharpest of the hold: a frame mid-shake scores lower. */
	const SHARP_SHARE = 0.9;

	let status = $state('');
	let problem = $state('');
	let glareShown = $state(false);
	/** From the moment the picture is taken: it is held, so the phone can move again. */
	let taken = $state(false);
	let shutter = false;
	let view: HTMLCanvasElement | undefined = $state();
	let video: HTMLVideoElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		return start();
	});

	/** Starts the camera, the text reader and the checks; returns what stops them. */
	function start(): () => void {
		let stopped = false;
		let stream: MediaStream | undefined;
		let reader: TextReader | undefined;
		let pool: Character[] = [];
		let busy = false;
		let frozen: HTMLCanvasElement | undefined;
		let frozenQuad: Point[] | undefined;
		let steadySince = performance.now();
		let sharpest = 0;
		let lastCheck = 0;
		let corners: Point[] | undefined;
		let glare: Rect[] = [];
		/** The edge's and glare's colours, from the theme, once the view is there. */
		let colours: { edge: string; glare: string } | undefined;
		const small = document.createElement('canvas');
		const smallCtx = small.getContext('2d', { willReadFrequently: true })!;
		taken = false;
		problem = '';
		status = t('scripts.scan.starting');

		const stopTracks = () => {
			for (const track of stream?.getTracks() ?? []) track.stop();
		};

		void (async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
					audio: false
				});
				if (stopped) return stopTracks();
				if (video) {
					video.srcObject = stream;
					await video.play().catch(() => {});
				}
			} catch (error) {
				problem = t('scripts.scan.noCamera', { reason: (error as Error).name });
				return;
			}
			try {
				const data = await loadOfficialData();
				pool = data.characters.filter((c) => c.edition);
				reader = await openTextReader();
				if (stopped) void reader.close();
			} catch (error) {
				problem = t('scripts.scan.noReader', { reason: (error as Error).message });
			}
		})();

		const take = (shot: HTMLVideoElement, manual: boolean, now: number, sharp: number) => {
			busy = true;
			shutter = false;
			taken = true;
			status = t('scripts.scan.reading');
			const w = shot.videoWidth;
			const h = shot.videoHeight;
			const still = document.createElement('canvas');
			still.width = w;
			still.height = h;
			still.getContext('2d')!.drawImage(shot, 0, 0, w, h);
			frozen = still;
			const flat = corners ? straighten(still) : undefined;
			frozenQuad = flat?.quad;
			const toView = w / SMALL;
			const glareOnSheet = onSheet(glare, toView, corners);
			let picture = flat?.page;
			if (!picture) {
				// Read as it is when its corners can't be found.
				const scale = Math.min(1.5, READ_SIDE / Math.max(w, h));
				picture = document.createElement('canvas');
				picture.width = Math.round(w * scale);
				picture.height = Math.round(h * scale);
				picture.getContext('2d')!.drawImage(still, 0, 0, picture.width, picture.height);
			}
			const notes = [
				`Camera: ${w} by ${h}, ${navigator.userAgent}`,
				`Picture taken ${manual ? 'by hand' : 'when steady'} after ${Math.round(now - steadySince)} ms, sharpness ${Math.round(sharp)} of ${Math.round(sharpest)}`,
				flat
					? `Straightened to ${flat.page.width} by ${flat.page.height}`
					: 'Corners not found: read as taken',
				glareOnSheet ? `Glare on the sheet: ${glare.length} patch(es)` : 'No glare on the sheet'
			];
			const page = picture;
			void reader!
				.read(page)
				.then((lines) => {
					if (stopped) return;
					onscanned({ lines, picture: page, issues: issuesOf(lines, glareOnSheet, !flat), notes });
					open = false;
				})
				.catch((error: unknown) => {
					problem = t('scripts.scan.readFailed', { reason: (error as Error).message });
					taken = false;
					frozen = frozenQuad = undefined;
				})
				.finally(() => (busy = false));
		};

		/** What looked wrong with the picture, each a reason to scan again. */
		const issuesOf = (lines: PlacedLine[], glareOnSheet: boolean, noCorners: boolean) => {
			const read = readScriptLines(lines, pool);
			const types = new Set(read.found.map((f) => f.character.type));
			const count = read.found.length;
			return [
				glareOnSheet && t('scripts.scan.issue.glare'),
				noCorners && t('scripts.scan.issue.corners'),
				count < 5 && t('scripts.scan.issue.few', { count }),
				count >= 5 && !types.has('demon') && t('scripts.scan.issue.demon'),
				count >= 5 && !types.has('townsfolk') && t('scripts.scan.issue.townsfolk'),
				read.unmatched.length > 0 &&
					t('scripts.scan.issue.unmatched', { count: read.unmatched.length }),
				!read.title && t('scripts.scan.issue.title')
			].filter((i): i is string => !!i);
		};

		const tick = (now: number) => {
			if (stopped) return;
			requestAnimationFrame(tick);
			const shot = video;
			if (!shot || !shot.videoWidth || !view) return;
			const w = shot.videoWidth;
			const h = shot.videoHeight;
			if (view.width !== w || view.height !== h) {
				view.width = w;
				view.height = h;
			}
			const ctx = view.getContext('2d')!;
			ctx.drawImage(frozen ?? shot, 0, 0, w, h);
			const toView = w / SMALL;

			// The quick checks, about 15 times a second.
			if (!frozen && now - lastCheck > 66) {
				lastCheck = now;
				small.width = SMALL;
				small.height = Math.round((h * SMALL) / w);
				smallCtx.drawImage(shot, 0, 0, small.width, small.height);
				const rgba = smallCtx.getImageData(0, 0, small.width, small.height).data;
				const gray = grayOf(rgba, small.width, small.height);
				glare = glareRects(rgba, small.width, small.height);
				glareShown = glare.length > 0;
				const last = corners;
				corners = sheetCorners(gray)?.map((p) => ({ x: p.x * toView, y: p.y * toView }));
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
				const held = now - steadySince;
				if (busy) status = t('scripts.scan.reading');
				else if (!reader) status = t('scripts.scan.starting');
				else if (!corners) status = t('scripts.scan.corners');
				else status = held > STEADY_MS / 2 ? t('scripts.scan.hold') : t('scripts.scan.steady');
				const auto = !!corners && held > STEADY_MS && sharp >= SHARP_SHARE * sharpest;
				if (reader && !busy && (shutter || auto)) take(shot, shutter, now, sharp);
			}

			// The sheet's edge as the checks see it, or as the picture taken is straightened.
			const css = getComputedStyle(view);
			colours ??= { edge: css.getPropertyValue('--edge'), glare: css.getPropertyValue('--glare') };
			ctx.lineWidth = Math.max(2, w / 300);
			const edge = frozenQuad ?? corners;
			if (edge) {
				ctx.strokeStyle = colours.edge;
				outline(ctx, edge);
				ctx.stroke();
			}
			if (!frozen) {
				ctx.strokeStyle = colours.glare;
				ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
				for (const g of glare) {
					ctx.strokeRect(
						g.x0 * toView,
						g.y0 * toView,
						(g.x1 - g.x0) * toView,
						(g.y1 - g.y0) * toView
					);
				}
				ctx.setLineDash([]);
			}
		};
		requestAnimationFrame(tick);

		return () => {
			stopped = true;
			stopTracks();
			void reader?.close();
		};
	}
</script>

<Dialog bind:open title={t('scripts.picker.photo')} size="screen" scroll={false}>
	<div class="stage">
		<video bind:this={video} muted playsinline hidden></video>
		<canvas bind:this={view} data-testid="live-scan-view" aria-label={t('scripts.scan.view')}
		></canvas>
		{#if taken}
			<!-- The picture is held (Trevor, 2026-11-10): said plainly, so the phone can move. -->
			<div class="taken" data-testid="live-scan-taken">
				<p>{t('scripts.scan.taken')}</p>
			</div>
		{/if}
		<div class="pills">
			<p class="pill" role="status" data-testid="live-scan-status">{status}</p>
			{#if glareShown && !taken}<p class="pill glare">{t('scripts.scan.glare')}</p>{/if}
		</div>
	</div>
	{#if problem}
		<div class="problem" role="alert">
			<p>{problem}</p>
			<Button icon="photo" onclick={onfallback}>{t('scripts.scan.cameraApp')}</Button>
		</div>
	{/if}
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => (shutter = true)}
			disabled={taken || !!problem}
			confirmLabel={t('scripts.scan.take')}
		/>
	{/snippet}
</Dialog>

<style>
	.stage {
		position: relative;
		display: grid;
		place-items: center;
		height: 100%;
		min-height: 0;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-raised);
		--edge: var(--good);
		--glare: var(--accent);
	}
	canvas {
		display: block;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
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
	:global(:root[data-motion-off]) .taken::before {
		animation: none;
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
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		margin-top: var(--space-2);
		color: var(--evil-text);
	}
	.problem p {
		margin: 0;
	}
</style>
