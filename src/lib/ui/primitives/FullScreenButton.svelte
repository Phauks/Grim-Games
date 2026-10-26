<script lang="ts">
	import IconButton from './IconButton.svelte';

	/**
	 * Full screen, for those who don't know their browser's own way (Trevor, 2026-10-23): the
	 * board's toolbar and Public Town's top right corner. Only where the browser can: iPhone Safari
	 * can't for a page, so the button isn't there. The whole app's full screen is not in the
	 * installed app (Trevor, 2026-10-23): it already has no address bar, and full screen would
	 * only take the clock and status bar he wants to keep. A part of the page, such as Public
	 * Town's town, still fills the screen there (Trevor, 2026-10-26, on his phone: "don't see
	 * full screen button to enlarge town grim"). The symbol says on or off, one button either way, so nothing
	 * beside it moves (two states = a toggle).
	 */
	interface Props {
		/**
		 * The part of the page that goes full screen; the whole app without it. Public Town
		 * shows only the town (Trevor, 2026-10-26: "not the app itself, but that part of it").
		 */
		target?: HTMLElement;
		/** Drawn like its neighbours: outlined on the board's toolbar, plain over the town. */
		outlined?: boolean;
	}

	let { target, outlined = false }: Props = $props();

	const installed = matchMedia('(display-mode: standalone)').matches;
	const canFullScreen = $derived(document.fullscreenEnabled === true && (!installed || !!target));
	let current = $state.raw(document.fullscreenElement);
	$effect(() => {
		const sync = () => (current = document.fullscreenElement);
		document.addEventListener('fullscreenchange', sync);
		return () => document.removeEventListener('fullscreenchange', sync);
	});
	const fullScreen = $derived(target ? current === target : !!current);
	function toggle() {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void (target ?? document.documentElement).requestFullscreen().catch(() => {});
	}
</script>

{#if canFullScreen}<IconButton
		icon={fullScreen ? 'exitFullScreen' : 'fullScreen'}
		label="Full screen"
		{outlined}
		aria-pressed={fullScreen}
		onclick={toggle}
	/>{/if}
