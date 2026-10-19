<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
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
				<li data-character-id={character.id}>
					<CharacterToken {character} alignment={defaultAlignment(character.type)} size={36} />
					<span class="text">
						<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token, as in the character list -->
						<span class="name">{character.name}</span>
						<span class="ability">{character.ability}</span>
					</span>
				</li>
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
	.rows li:not(.none) {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.name {
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		overflow-wrap: anywhere;
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
