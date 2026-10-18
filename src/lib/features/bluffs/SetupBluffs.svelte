<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
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
	}

	let { game, characters, dispatch, waiting, inPlay }: Props = $props();

	let open = $state(false);
	const hasDemon = $derived(
		(inPlay ?? Object.values(game.bag?.tiles ?? {}).map((t) => t.grimoire)).some(
			(id) => characters.get(id)?.type === 'demon'
		)
	);
	const bluffs = $derived(game.bluffs[DEMON_SET] ?? []);
</script>

{#if hasDemon}
	<section class="bluffs" aria-labelledby="setup-bluffs-title" data-testid="setup-bluffs">
		<h2 id="setup-bluffs-title">{t('bluffs.title')}</h2>
		<div class="row">
			<span class="badges">
				{#each bluffs as id (id)}
					<CharacterBadge characterId={id} character={characters.get(id)} interactive={false} />
				{:else}
					<span class="none">{t('common.none')}</span>
				{/each}
			</span>
			<Button
				variant={bluffs.length ? 'quiet' : 'accent'}
				icon="demon"
				disabled={waiting}
				onclick={() => (open = true)}>{t(bluffs.length ? 'bluffs.change' : 'bluffs.choose')}</Button
			>
		</div>
	</section>
	<BluffsSheet bind:open {game} {characters} {dispatch} {inPlay} />
{/if}

<style>
	.bluffs {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: var(--section-title-size);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.badges {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
	}
	.badges > :global(*) {
		max-width: 100%;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
