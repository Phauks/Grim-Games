<script lang="ts">
	import { untrack } from 'svelte';
	import { appFullScreen, fullScreenPart } from '#lib/ui/full-screen.svelte.ts';
	import IconButton from './IconButton.svelte';

	/**
	 * Full screen, for those who don't know their browser's own way (Trevor, 2026-10-23): the
	 * top right corner of a `FullScreenStage` (Public Town's town, the
	 * player screen's Grim). The whole app's full screen is only where the browser can (iPhone
	 * Safari can't for a page), and not in the installed app (Trevor, 2026-10-23): it already
	 * has no address bar, and full screen would only take the clock and status bar he wants to
	 * keep. A part of the page fills the screen everywhere (Trevor, 2026-10-26, on his phone:
	 * "don't see full screen button to enlarge town grim"), hiding the browser's bars too where
	 * it can. The symbol says on or off, one button either way, so nothing beside it moves (two
	 * states = a toggle).
	 */
	interface Props {
		/**
		 * The part of the page that fills the screen; the whole app without it (Trevor,
		 * 2026-10-26: "not the app itself, but that part of it").
		 */
		target?: HTMLElement;
		/** Drawn like its neighbours: plain over the town. */
		outlined?: boolean;
	}

	let { target, outlined = false }: Props = $props();

	const canFullScreen = $derived(!!target || appFullScreen.available);
	// Leaving the browser's full screen (Back, Escape) lets the part go too; where the browser
	// can't fill the screen (iPhone), the part fills the window alone and stays.
	let wasFull = false;
	$effect(() => {
		const full = !!appFullScreen.element;
		if (wasFull && !full && target && untrack(() => fullScreenPart.current) === target)
			fullScreenPart.current = undefined;
		wasFull = full;
	});
	const fullScreen = $derived(target ? fullScreenPart.current === target : appFullScreen.on);
	function toggle() {
		if (!target) appFullScreen.toggle();
		else if (fullScreen) {
			fullScreenPart.current = undefined;
			if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		} else {
			fullScreenPart.current = target;
			if (document.fullscreenEnabled && !document.fullscreenElement)
				void document.documentElement.requestFullscreen().catch(() => {});
		}
	}
</script>

{#if canFullScreen}<IconButton
		icon={fullScreen ? 'exitFullScreen' : 'fullScreen'}
		label="Full screen"
		{outlined}
		aria-pressed={fullScreen}
		onclick={toggle}
	/>{/if}
