<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from '#lib/core/text/rich.ts';
	import { chainLabel, detailLabel, moved, type ChainCard } from './chain.ts';

	interface Props {
		/** The cards added with their +, in the order they will be shown. */
		cards: ChainCard[];
		/** Characters the cards can name, to show their badges. */
		characters: readonly Character[];
		/** Show the cards, in order. */
		onshow: () => void;
	}

	let { cards = $bindable(), characters, onshow }: Props = $props();

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const names = (ids: readonly CharacterId[]) =>
		ids.map((id) => byId.get(id)?.name ?? id).join(', ');
	const known = (ids: readonly CharacterId[]) =>
		ids.flatMap((id) => {
			const character = byId.get(id);
			return character ? [character] : [];
		});
</script>

<!--
	The cards to show together (Trevor, 2026-10-16), the same on the Info tokens page and
	the board's sheet (Trevor, 2026-10-18): reorder, remove, clear, then show them all.
-->
{#if cards.length > 0}
	<div class="chain" role="group" aria-label={t('info-tokens.toShow')}>
		{#if cards.length > 0}
			<ol class="chain-list" data-testid="chain-list">
				{#each cards as card, i (card)}
					{@const name = chainLabel(card, names)}
					<li>
						<!-- The chosen characters wrap under the card's words, so the row keeps its width (Trevor, 2026-10-17). -->
						<span class="chain-card">
							<span class="chain-text"
								>{i + 1}. {card.detail ? detailLabel(card) : plainText(card.text)}</span
							>
							{#if card.characterIds.length > 0}
								<span class="badges">
									{#each known(card.characterIds) as character (character.id)}
										<CharacterBadge characterId={character.id} {character} interactive={false} />
									{/each}
								</span>
							{/if}
						</span>
						<span class="chain-buttons">
							<span class="up">
								<IconButton
									icon="expand"
									label={t('info-tokens.moveUp', { name })}
									disabled={i === 0}
									onclick={() => (cards = moved(cards, i, -1))}
								/>
							</span>
							<IconButton
								icon="expand"
								label={t('info-tokens.moveDown', { name })}
								disabled={i === cards.length - 1}
								onclick={() => (cards = moved(cards, i, 1))}
							/>
							<span>
								<DeleteButton
									label={t('info-tokens.removeFromChain', { name })}
									onclick={() => (cards = cards.filter((_, j) => j !== i))}
								/>
							</span>
						</span>
					</li>
				{/each}
			</ol>
		{/if}
		<div class="chain-actions">
			<span>
				<DeleteButton
					label={t('info-tokens.clearChain')}
					disabled={cards.length === 0}
					onclick={() => (cards = [])}
				/>
			</span>
			<Button variant="accent" icon="forward" disabled={cards.length === 0} onclick={onshow}
				>{t('info-tokens.showCards', { count: cards.length })}</Button
			>
		</div>
	</div>
{/if}

<style>
	/* Sits over the bottom of the list, so adding cards never moves the cards above. */
	.chain {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
		margin-top: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--border);
		/* A sheet's colour by default; the page passes its own (`--chain-background`). */
		background: var(--chain-background, var(--sheet-background));
	}
	.chain-list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chain-list li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.chain-card {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: var(--space-1);
	}
	.chain-text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	/* Chosen characters wrap onto new lines rather than widening the row. */
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
	}
	.badges > :global(*) {
		max-width: 100%;
	}
	/* The bin and Show on one line, the bin set apart at the start. */
	.chain-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.chain-buttons {
		display: flex;
		flex: none;
	}
	/* The same caret as the sections, turned to point up. */
	.up :global(.icon) {
		rotate: 180deg;
	}
	.chain-buttons :global(.icon-button) {
		color: inherit;
	}
</style>
