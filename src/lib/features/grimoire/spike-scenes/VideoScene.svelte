<script lang="ts">
	/**
	 * SPIKE (animated backgrounds, not for merge). Option C: a looping, muted video. The
	 * browser decodes it in hardware; a poster shows until it plays, and stays when still.
	 */
	interface Props {
		src: string;
		poster?: string;
		still?: boolean;
		contained?: boolean;
	}
	let { src, poster, still = false, contained = false }: Props = $props();
	let video = $state<HTMLVideoElement>();
	$effect(() => {
		if (!video) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (still || reduce) video.pause();
		else void video.play().catch(() => {});
		const onVisible = () =>
			document.visibilityState === 'visible' && !still && !reduce
				? void video?.play().catch(() => {})
				: video?.pause();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video
	bind:this={video}
	class="scene"
	class:contained
	{src}
	{poster}
	muted
	loop
	playsinline
	preload="auto"
	aria-hidden="true"
></video>

<style>
	.scene {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: -1;
		pointer-events: none;
		filter: brightness(0.5) saturate(0.9);
	}
	.contained {
		position: absolute;
	}
</style>
