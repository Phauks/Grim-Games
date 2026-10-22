<script lang="ts">
	import { onMount } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { BackgroundChoice } from '#lib/features/grimoire/backgrounds.ts';
	import BoardBackdrop from '#lib/features/grimoire/BoardBackdrop.svelte';
	import { boardBackground } from '#lib/features/grimoire/board-background.svelte.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { defaultBackground } from '#lib/features/grimoire/default-background.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { boardTokenSize } from '#lib/ui/seating/last-board.svelte.ts';

	/**
	 * Two seats on the board's background (Trevor, 2026-10-20: "you can't really see changes
	 * until you leave"): the open board's background, or the one for every game, with the
	 * vignette and a dead player whose ghost vote is used.
	 */
	onMount(() => void loadOfficialData());
	const SEATS = [
		{ id: 'godfather', name: t('characters.previewPlayer'), dead: false },
		{ id: 'washerwoman', name: t('settings.previewDeadPlayer'), dead: true }
	] as const;
	const choice: BackgroundChoice = $derived(
		boardBackground.context?.current ?? defaultBackground.current ?? { kind: 'none' }
	);
	let url = $state<string | undefined>();
	$effect(() => {
		if (choice.kind === 'image') {
			const objectUrl = URL.createObjectURL(choice.image);
			url = objectUrl;
			return () => URL.revokeObjectURL(objectUrl);
		}
		url = choice.kind === 'script' ? boardBackground.context?.scriptImage : undefined;
	});
	// The board's own token size at 100% (Character token size is set in Tokens), small
	// enough for both seats to fit the box's width.
	const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });
	let width = $state(0);
	const size = $derived(
		Math.min(96, boardTokenSize(1, viewport), width ? Math.floor(width / 2.8) : 96)
	);
</script>

<div
	class="board-preview"
	bind:clientWidth={width}
	style:--size="{size}px"
	style:--name-scale={boardLooks.current.nameSize}
	style:--name-offset={boardLooks.current.nameOffset}
>
	<BoardBackdrop
		contained
		{url}
		preset={choice.kind === 'preset' ? choice.id : undefined}
		vignette={boardLooks.current.vignette ? boardLooks.current.vignetteStrength : undefined}
	/>
	{#each SEATS as seat, i (seat.id)}
		{@const character = officialData.current?.byId.get(seat.id)}
		<SeatDisc
			{size}
			name={seat.name}
			number={i + 1}
			dead={seat.dead}
			vote={seat.dead ? 'used' : undefined}
			usedVote={boardLooks.current.usedGhostVote}
		>
			{#snippet face()}{#if character}<CharacterToken {character} {size} />{/if}{/snippet}
		</SeatDisc>
	{/each}
</div>

<style>
	/* Fixed height: the seats with their names at the largest Player name size and distance,
	   so no setting moves the rows below. */
	.board-preview {
		position: relative;
		isolation: isolate;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: calc(2 * var(--u));
		height: calc(1.6 * var(--size));
		padding-top: calc(0.15 * var(--size));
		overflow: hidden;
		border-radius: var(--card-radius);
	}
</style>
