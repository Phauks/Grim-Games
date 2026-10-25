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
	}

	let { onRead, problem }: Props = $props();

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
				const text = await read(video).catch(() => undefined);
				if (stopped) return;
				if (text && onRead(text)) return stop();
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
</style>
