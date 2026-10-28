<script lang="ts">
	import ScriptLogo from './ScriptLogo.svelte';
	import ScriptNameMark from './ScriptNameMark.svelte';

	/**
	 * The script's logo faint in the middle of a board, the same on the Storyteller's board,
	 * every player's grim and the Board settings preview: centred, at most 42% of the board's
	 * width and height, under the seats. Without a logo, or if its link fails, the script's
	 * name takes its place, styled like a logo (ScriptNameMark) (Trevor, 2026-10-27: "If
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
		style:--logo-h={height}><ScriptNameMark name={title} /></span
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
</style>
