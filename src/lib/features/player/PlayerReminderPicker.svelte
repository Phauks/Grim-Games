<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import ReminderGroupRow from '#lib/features/characters/ReminderGroupRow.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { matchesReminderSearch } from '#lib/features/characters/character-search.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import {
		guessesFirst,
		placedKey,
		scriptReminderGroups,
		type PlayerReminder,
		type PlayerReminderGroup
	} from './player-reminders.ts';

	/**
	 * The reminders a player puts on a seat in their own grim (Trevor, 2026-10-26), laid out as
	 * the board's "Reminders for Seat N": this seat's reminders on top, a tap takes one off; then
	 * every reminder of the script's characters, a tap puts it on or takes it off. Stays open, so
	 * several can be changed in a row. A search box narrows the list, and the characters the
	 * player guessed come first (Trevor, 2026-10-26: "search and guess is best").
	 */
	interface Props {
		open: boolean;
		/** The seat's name, for the title. */
		name: string;
		characters: readonly Character[];
		/** This seat's reminders, in the order placed. */
		placed: readonly PlayerReminder[];
		characterOf: (id: CharacterId) => Character | undefined;
		onToggle: (reminder: PlayerReminder) => void;
		/** Characters the player guessed on any seat, or knows (a Traveller): listed first. */
		guessed?: readonly CharacterId[];
	}

	let {
		open = $bindable(),
		name,
		characters,
		placed,
		characterOf,
		onToggle,
		guessed = []
	}: Props = $props();

	let query = $state('');
	const groups = $derived(
		guessesFirst(
			scriptReminderGroups(characters).filter((g) => matchesReminderSearch(g, query)),
			guessed
		)
	);
	const isPlaced = (reminder: PlayerReminder) =>
		placed.some((r) => r.characterId === reminder.characterId && r.label === reminder.label);
</script>

{#snippet row(group: PlayerReminderGroup)}
	<ReminderGroupRow character={group.character}>
		{#each group.labels as label (label)}
			{@const reminder = { characterId: group.character.id, label }}
			<button
				type="button"
				class="chip"
				aria-pressed={isPlaced(reminder)}
				onclick={() => onToggle(reminder)}
			>
				<ReminderToken {label} character={group.character} />
			</button>
		{/each}
	</ReminderGroupRow>
{/snippet}

<Dialog bind:open title={t('player.grim.remindersTitle', { name })} size="full">
	<!-- A fixed-height row, so the list below never moves. -->
	<div class="recent" role="group" aria-label={t('player.grim.onThisSeat')}>
		{#each placed as reminder (placedKey(reminder))}
			<button
				type="button"
				class="chip"
				aria-label={t('player.grim.takeOff', { label: reminder.label })}
				aria-pressed="true"
				onclick={() => onToggle(reminder)}
			>
				<ReminderToken label={reminder.label} character={characterOf(reminder.characterId)} />
			</button>
		{:else}
			<span class="none">{t('common.none')}</span>
		{/each}
	</div>
	<div class="search">
		<SearchField label={t('common.searchReminders')} bind:value={query} />
	</div>
	<ul class="list" data-testid="player-reminder-list">
		{#if groups.first.length}
			<li class="part">{t('player.grim.yourGuesses')}</li>
			{#each groups.first as group (group.character.id)}{@render row(group)}{/each}
			<li class="part">{t('player.grim.onTheScript')}</li>
		{/if}
		{#each groups.rest as group (group.character.id)}{@render row(group)}{/each}
		{#if !groups.first.length && !groups.rest.length}<li class="none">{t('common.none')}</li>{/if}
	</ul>
</Dialog>

<style>
	.recent {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: calc(3.25 * var(--u));
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.none {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.list {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	/* Big, easy targets, as on the board's picker. */
	.chip {
		display: inline-grid;
		place-items: center;
		min-width: calc(3.25 * var(--u));
		min-height: calc(3.25 * var(--u));
		padding: 0 calc(0.125 * var(--u));
		border: 0;
		background: none;
		cursor: pointer;
	}
	/* On this seat: selected, with a ring that hugs the token; a tap takes it off. */
	.chip[aria-pressed='true'] > :global(.reminder) {
		outline: 0.2rem solid var(--accent);
		outline-offset: 0.1rem;
	}
	.search {
		margin: var(--space-2) 0 var(--space-1);
	}
	/* Your guesses, then the rest of the script. */
	.part {
		padding: var(--space-2) 0 var(--space-1);
		border-bottom: 1px solid var(--border);
		color: var(--on-surface-muted);
		font-family: var(--font-control);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.chip:hover {
		filter: brightness(1.15);
	}
</style>
