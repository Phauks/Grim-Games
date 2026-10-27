<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import ScriptLogo from './ScriptLogo.svelte';

	/**
	 * The script's logo faint in the middle of a board, the same on the Storyteller's board,
	 * every player's grim and the Board settings preview: centred, at most 42% of the board's
	 * width and height, under the seats. Without a logo, or if its link fails, the script's
	 * name in the headings font takes its place, styled like a logo (Trevor, 2026-10-27: "If
	 * there is no script logo, I want to default writing the name of the script in the
	 * background"). No name, or a script that hides its title, leaves the middle empty.
	 */
	interface Props {
		src: string | undefined;
		/** The script's name, shown when there is no logo; '' or undefined for none. */
		name?: string;
		/** How visible it is, 0.05 to 1. */
		opacity: number;
		/**
		 * The box's height, when the board's own height differs from what it is sized by: the
		 * board without the walk-through strip, so the logo keeps its size when the night starts
		 * (Trevor, 2026-10-23: "flexes for a second").
		 */
		height?: string;
		/** Told when the logo's link fails, e.g. so a corner drops it too. */
		onfail?: () => void;
	}

	let { src, name, opacity, height, onfail }: Props = $props();

	let failed = $state(false);
	$effect(() => {
		void src;
		failed = false;
	});
	const title = $derived(name?.trim() ?? '');
	/**
	 * Sizes the name to fill its box (Trevor, 2026-10-27: a long name gets smaller rather than
	 * cut): the largest share of its full size at which every line fits the box's width, each
	 * word whole, and all the lines its height. Measured again when the box changes size and
	 * once the fonts have loaded.
	 */
	function fitName(words: string): Attachment<HTMLElement> {
		void words;
		return (node) => {
			const box = node.parentElement;
			if (!box) return;
			const fits = (share: number) => {
				node.style.setProperty('--fit', String(share));
				return node.scrollWidth <= box.clientWidth && node.offsetHeight <= box.clientHeight;
			};
			const fit = () => {
				if (box.clientWidth === 0 || fits(1)) return;
				let low = 0.1;
				let high = 1;
				for (let step = 0; step < 8; step++) {
					const mid = (low + high) / 2;
					if (fits(mid)) low = mid;
					else high = mid;
				}
				fits(low);
			};
			fit();
			const resized = new ResizeObserver(fit);
			resized.observe(box);
			void document.fonts?.ready.then(fit);
			return () => resized.disconnect();
		};
	}
</script>

{#if src && !failed}
	<ScriptLogo
		{src}
		class="board-logo"
		--logo-opacity={opacity}
		--logo-h={height}
		onfail={() => {
			failed = true;
			onfail?.();
		}}
	/>
{:else if title}
	<span
		class="board-logo board-name"
		data-testid="board-name"
		aria-hidden="true"
		style:--logo-opacity={opacity}
		style:--logo-h={height}><span class="text" {@attach fitName(title)}>{title}</span></span
	>
{/if}

<style>
	/* Outranks ScriptLogo's own `position: relative`, whichever stylesheet comes first. */
	.board-name,
	:global(span.script-logo.board-logo) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 42%;
		height: var(--logo-h, 42%);
		translate: -50% -50%;
		opacity: var(--logo-opacity);
		pointer-events: none;
		user-select: none;
	}
	/* Sized by its box: a quarter of its height for a short name, smaller for a long one. */
	.board-name {
		display: grid;
		place-items: center;
		overflow: hidden;
		container-type: size;
	}
	.text {
		max-width: 100%;
		color: var(--heading);
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: calc(var(--fit, 1) * min(25cqh, 18cqw));
		line-height: 1.1;
		letter-spacing: 0.04em;
		text-align: center;
		text-wrap: balance;
		text-shadow: 0 0 0.15em var(--surface);
	}
</style>
