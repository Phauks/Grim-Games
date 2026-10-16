<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		character: Character;
		copies: number;
		/** Whether more than one copy may be added (Village Idiot, Legion, or the switch). */
		duplicates: boolean;
		/** Jinxed with another selected character. */
		jinxed: boolean;
		onToggle: () => void;
		onAddCopy: () => void;
	}

	let { character, copies, duplicates, jinxed, onToggle, onAddCopy }: Props = $props();
	const selected = $derived(copies > 0);
</script>

<!--
	One selectable character. Tapping toggles it (or removes one copy when there are several);
	the + button adds a copy. Every mark has a fixed slot, so selecting never moves anything.
-->
<div class="choice" data-selected={selected ? '' : undefined} data-type={character.type}>
	<button
		type="button"
		class="main"
		aria-pressed={selected}
		aria-label={copies > 1 ? `${character.name}, ${copies} copies` : character.name}
		data-character-id={character.id}
		onclick={onToggle}
	>
		<CharacterToken {character} alignment={defaultAlignment(character.type)} size={44} />
		<span class="text">
			<span class="name">{character.name}</span>
			<span class="ability">{character.ability}</span>
		</span>
		<span class="marks" aria-hidden="true">
			<span class="jinx" title={t('setup.jinxed')}>{jinxed ? '★' : ''}</span>
			<span class="copies">{copies > 1 ? `×${copies}` : ''}</span>
			<span class="check"
				>{#if selected}<Icon name="check" />{/if}</span
			>
		</span>
	</button>
	{#if duplicates}
		<button
			type="button"
			class="add"
			aria-label={t('setup.addAnotherOf', { name: character.name })}
			title={t('setup.addAnother')}
			onclick={onAddCopy}><Icon name="add" /></button
		>
	{/if}
</div>

<style>
	.choice {
		display: flex;
		align-items: stretch;
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	/*
	 * Selected looks the same however it was chosen (tap, Random, reload): the ring is drawn
	 * above the row, so a hover or a phone's sticky tap highlight can't paint over it, and it
	 * is not red, which reads as an error (Trevor, 2026-10-16).
	 */
	.choice {
		position: relative;
	}
	.choice[data-selected] {
		background: var(--choice-selected-background);
	}
	.choice[data-selected]::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--focus);
		pointer-events: none;
	}
	/*
	 * Token | name | marks on the first line; the ability runs under the name and the marks,
	 * so the marks' reserved slot doesn't narrow the ability text (Trevor: it broke early).
	 */
	.main {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		flex: 1;
		align-items: start;
		column-gap: var(--space-2);
		min-width: 0;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	@media (hover: hover) {
		.main:hover {
			background: var(--surface-selected);
			border-radius: var(--radius-md);
		}
	}
	.main > :global(:first-child) {
		grid-column: 1;
		grid-row: 1 / 3;
	}
	.text {
		display: contents;
	}
	.name {
		grid-column: 2;
		grid-row: 1;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		overflow-wrap: anywhere;
	}
	.ability {
		grid-column: 2 / 4;
		grid-row: 2;
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.marks {
		grid-column: 3;
		grid-row: 1;
		display: grid;
		grid-template-columns: 1em 2em 1.25em;
		align-items: center;
		justify-items: center;
		flex: none;
		font-weight: 700;
	}
	.jinx {
		color: var(--accent);
	}
	.add {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		border: 0;
		border-inline-start: 1px solid var(--border);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.add:hover {
		background: var(--surface-selected);
	}
</style>
