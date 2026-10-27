<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Spinner from '#lib/ui/primitives/Spinner.svelte';
	import { makeQrReader } from './qr-reader.ts';

	/**
	 * The camera, reading QR codes (plan J2, 2026-10-22: Join game gets "an option to scan a
	 * code"). In the app rather than the phone's camera app, because on an iPhone a code the
	 * camera app opens goes to Safari, not to the installed app. The back camera; the camera
	 * stops when this closes.
	 */
	interface Props {
		/** Each code read. Returns true when it was the one wanted, which stops the camera. */
		onRead: (text: string) => boolean;
		/** Shown over the picture when a code was read but was not one wanted. */
		problem?: string;
		/** Shown over the picture while a code is being read, e.g. an animated code's frames. */
		progress?: string;
		/**
		 * Which pieces of an animated code are in, one square each (Trevor, 2026-10-27: "show what
		 * information has been transferred"), under `progress`.
		 */
		pieces?: boolean[];
	}

	let { onRead, problem, progress, pieces }: Props = $props();

	let video = $state<HTMLVideoElement>();
	let phase = $state<'starting' | 'running' | 'denied' | 'none' | 'failed'>('starting');
	/** How often a frame is read: often enough to feel instant, rarely enough for a phone. */
	const EVERY_MS = 150;

	onMount(() => {
		let stream: MediaStream | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		const stop = () => {
			stopped = true;
			clearTimeout(timer);
			for (const track of stream?.getTracks() ?? []) track.stop();
		};
		(async () => {
			if (!navigator.mediaDevices?.getUserMedia) return void (phase = 'none');
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: 'environment' },
					audio: false
				});
			} catch (error) {
				const name = (error as DOMException)?.name;
				phase = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'none';
				return;
			}
			if (stopped || !video) return stop();
			video.srcObject = stream;
			await video.play().catch(() => {});
			const read = await makeQrReader().catch(() => undefined);
			if (!read) return void (phase = 'failed');
			phase = 'running';
			const tick = async () => {
				if (stopped || !video) return;
				const texts = await read(video).catch(() => []);
				if (stopped) return;
				// Every code in view: another code beside an animated one is not lost (2026-10-27).
				if (texts.some((text) => onRead(text))) return stop();
				timer = setTimeout(tick, EVERY_MS);
			};
			void tick();
		})();
		return stop;
	});

	const message = $derived(
		phase === 'denied'
			? t('share.scan.denied')
			: phase === 'none'
				? t('share.scan.noCamera')
				: phase === 'failed'
					? t('share.scan.failed')
					: ''
	);
</script>

<!-- One square whatever happens, so the camera starting or failing moves nothing. -->
<div class="scanner" data-testid="qr-scanner">
	<video bind:this={video} muted playsinline aria-label={t('share.scan.camera')}></video>
	{#if phase === 'starting'}
		<p class="over"><Spinner label={t('share.scan.starting')} /></p>
	{:else if message}
		<p class="over" role="alert">{message}</p>
	{:else if problem}
		<p class="over bottom" role="alert">{problem}</p>
	{:else if progress}
		<div class="over bottom progress" role="status">
			<p>{progress}</p>
			{#if pieces?.length}
				<ol class="pieces" aria-hidden="true">
					{#each pieces as have, i (i)}<li class:have></li>{/each}
				</ol>
			{/if}
		</div>
	{/if}
</div>

<style>
	.scanner {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.over {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: var(--space-4);
		text-align: center;
	}
	.over.bottom {
		inset: auto 0 0;
		background: var(--evil);
		color: var(--on-evil);
		padding: var(--space-2);
	}
	.progress {
		display: grid;
		gap: var(--space-1);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.progress p {
		margin: 0;
	}
	.pieces {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: calc(0.5 * var(--u));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pieces li {
		width: calc(2 * var(--u));
		aspect-ratio: 1;
		border: calc(0.25 * var(--u)) solid var(--on-surface-muted);
		border-radius: calc(0.5 * var(--u));
	}
	.pieces li.have {
		background: var(--good);
		border-color: var(--good);
	}
</style>
