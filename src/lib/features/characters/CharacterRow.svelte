<script lang="ts">
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterToken from './CharacterToken.svelte';

	/**
	 * One character as the picker lists it: token, name (with an optional note on its line) and
	 * ability. A button when it has `onclick`, otherwise read-only, so a list of chosen
	 * characters looks like the list they were chosen from (Trevor, 2026-10-19/20).
	 */
	interface Props {
		character: Character;
		/** False when the token is drawn outside the row (the picker's own info button). */
		token?: boolean;
		/** On the name's line; never adds a line. */
		note?: string;
		/** Keep the note's place even when there is none, so rows line up. */
		withNote?: boolean;
		/** Ends with the tick column (the picker's chosen mark). */
		withCheck?: boolean;
		checked?: boolean;
		/** Multi choice: aria-pressed. */
		pressed?: boolean;
		/** Single choice: aria-current. */
		current?: boolean;
		disabled?: boolean;
		/** Accessible name; defaults to the name and any note. */
		label?: string;
		onclick?: () => void;
	}

	let {
		character,
		token = true,
		note,
		withNote = false,
		withCheck = false,
		checked = false,
		pressed,
		current,
		disabled = false,
		label,
		onclick
	}: Props = $props();
</script>

{#snippet content()}
	{#if token}
		<CharacterToken {character} alignment={defaultAlignment(character.type)} size={36} />
	{/if}
	<span class="text">
		<span class="head">
			<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
			<span class="name">{character.name}</span>
			{#if withNote || note}<span class="note">{note ?? ''}</span>{/if}
		</span>
		<span class="ability">{character.ability}</span>
	</span>
	{#if withCheck}
		<span class="check" aria-hidden="true"
			>{#if checked}<Icon name="check" />{/if}</span
		>
	{/if}
{/snippet}

{#if onclick}
	<button
		type="button"
		class="row"
		data-character-id={character.id}
		aria-label={label ?? (note ? `${character.name}, ${note}` : character.name)}
		aria-pressed={pressed}
		aria-current={current ? 'true' : undefined}
		{disabled}
		{onclick}>{@render content()}</button
	>
{:else}
	<div class="row" data-character-id={character.id}>{@render content()}</div>
{/if}

<style>
	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		text-align: start;
	}
	button.row {
		cursor: pointer;
		touch-action: manipulation;
	}
	/* Every surface's own colours: a sheet sets them to parchment (tokens/components.css). */
	@media (hover: hover) {
		button.row:hover:not(:disabled):not([aria-pressed='true']):not([aria-current='true']) {
			background: var(--surface-selected);
		}
	}
	.row[aria-pressed='true'],
	.row[aria-current='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.row:disabled {
		opacity: 0.55;
		cursor: default;
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
	/* The name, then any note after it on the same line. */
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		min-width: 0;
	}
	.note {
		flex: 0 1 auto;
		min-width: 0;
		margin-left: auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--accent);
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.check {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.25em;
		align-self: center;
	}
</style>
