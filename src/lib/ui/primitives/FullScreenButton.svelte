<script lang="ts">
	import { fullScreenPart } from '#lib/ui/full-screen.svelte.ts';
	import IconButton from './IconButton.svelte';

	/**
	 * Full screen, for those who don't know their browser's own way (Trevor, 2026-10-23): the
	 * board's toolbar, and the top right corner of a `FullScreenStage` (Public Town's town, the
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
		/** Drawn like its neighbours: outlined on the board's toolbar, plain over the town. */
		outlined?: boolean;
	}

	let { target, outlined = false }: Props = $props();

	const installed = matchMedia('(display-mode: standalone)').matches;
	const canFullScreen = $derived(!!target || (document.fullscreenEnabled === true && !installed));
	let current = $state.raw(document.fullscreenElement);
	$effect(() => {
		const sync = () => {
			current = document.fullscreenElement;
			// Leaving the browser's full screen (Back, Escape) lets the part go too.
			if (!current && target && fullScreenPart.current === target)
				fullScreenPart.current = undefined;
		};
		document.addEventListener('fullscreenchange', sync);
		return () => document.removeEventListener('fullscreenchange', sync);
	});
	const fullScreen = $derived(target ? fullScreenPart.current === target : !!current);
	function toggle() {
		if (target) {
			if (fullScreen) {
				fullScreenPart.current = undefined;
				if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
			} else {
				fullScreenPart.current = target;
				if (document.fullscreenEnabled && !document.fullscreenElement)
					void document.documentElement.requestFullscreen().catch(() => {});
			}
		} else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void document.documentElement.requestFullscreen().catch(() => {});
	}
</script>

{#if canFullScreen}<IconButton
		icon={fullScreen ? 'exitFullScreen' : 'fullScreen'}
		label="Full screen"
		{outlined}
		aria-pressed={fullScreen}
		onclick={toggle}
	/>{/if}
