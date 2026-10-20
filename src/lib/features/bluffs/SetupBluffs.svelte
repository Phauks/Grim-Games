<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import BluffsSheet, { type BluffDispatch } from './BluffsSheet.svelte';
	import { DEMON_SET } from './bluffs.ts';

	/**
	 * The Demon's bluffs, chosen while setting up (Trevor, 2026-10-18): after the draw, when
	 * every seat has its character and so what is not in play is known. Drawn from the start
	 * and usable once the bag is empty, so nothing moves; only in games with a Demon.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		dispatch: BluffDispatch;
		/** Tiles still in the bag: who is in play is not known yet. */
		waiting: boolean;
		/** The characters chosen, on the Characters screen; otherwise the bag's tiles. */
		inPlay?: readonly CharacterId[];
		/**
		 * Shown and usable before a Demon is chosen (the Characters screen, Trevor 2026-10-18),
		 * so it never appears later and moves things.
		 */
		always?: boolean;
	}

	let { game, characters, dispatch, waiting, inPlay, always = false }: Props = $props();

	let open = $state(false);
	const hasDemon = $derived(
		(inPlay ?? Object.values(game.bag?.tiles ?? {}).map((t) => t.grimoire)).some(
			(id) => characters.get(id)?.type === 'demon'
		)
	);
	const bluffs = $derived(
		(game.bluffs[DEMON_SET] ?? []).flatMap((id) => {
			const character = characters.get(id);
			return character ? [character] : [];
		})
	);
</script>

{#if hasDemon || always}
	<section class="bluffs" aria-labelledby="setup-bluffs-title" data-testid="setup-bluffs">
		<!-- The button on the heading's line (Trevor, 2026-10-19). -->
		<div class="head">
			<h2 id="setup-bluffs-title">{t('bluffs.title')}</h2>
			<Button
				variant={bluffs.length ? 'quiet' : 'accent'}
				icon="demon"
				disabled={waiting}
				onclick={() => (open = true)}>{t(bluffs.length ? 'bluffs.change' : 'bluffs.choose')}</Button
			>
		</div>
		<!-- Each bluff like a character in the list above: token, name and ability. -->
		<ul class="rows">
			{#each bluffs as character (character.id)}
				<li><CharacterRow {character} /></li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
	</section>
	<BluffsSheet bind:open {game} {characters} {dispatch} {inPlay} />
{/if}

<style>
	.bluffs {
		display: grid;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	h2 {
		margin: 0;
		font-size: var(--section-title-size);
	}
	/* The character list's rows (CharacterPicker), not choosable here. */
	.rows {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(18 * var(--u))), 1fr));
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
