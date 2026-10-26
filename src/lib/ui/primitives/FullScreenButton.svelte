<script lang="ts">
	import IconButton from './IconButton.svelte';

	/**
	 * Full screen, for those who don't know their browser's own way (Trevor, 2026-10-23): the
	 * board's toolbar and Public Town's title line. Only where the browser can: iPhone Safari
	 * can't for a page, so the button isn't there. Not in the installed app (Trevor,
	 * 2026-10-23): it already has no address bar, and full screen would only take the clock and
	 * status bar he wants to keep. The symbol says on or off, one button either way, so nothing
	 * beside it moves (two states = a toggle).
	 */
	const canFullScreen =
		document.fullscreenEnabled === true && !matchMedia('(display-mode: standalone)').matches;
	let fullScreen = $state(!!document.fullscreenElement);
	$effect(() => {
		const sync = () => (fullScreen = !!document.fullscreenElement);
		document.addEventListener('fullscreenchange', sync);
		return () => document.removeEventListener('fullscreenchange', sync);
	});
	function toggle() {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void document.documentElement.requestFullscreen().catch(() => {});
	}
</script>

{#if canFullScreen}<IconButton
		icon={fullScreen ? 'exitFullScreen' : 'fullScreen'}
		label="Full screen"
		outlined
		aria-pressed={fullScreen}
		onclick={toggle}
	/>{/if}
