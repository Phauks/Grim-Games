<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import ReminderGroupRow from '#lib/features/characters/ReminderGroupRow.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import {
		placedKey,
		scriptReminderGroups,
		type PlayerReminder,
		type PlayerReminderGroup
	} from './player-reminders.ts';

	/**
	 * The reminders a player puts on a seat in their own grim (Trevor, 2026-10-26), laid out as
	 * the board's "Reminders for Seat N": this seat's reminders on top, a tap takes one off; then
	 * every reminder of the script's characters, a tap puts it on or takes it off. Stays open, so
	 * several can be changed in a row.
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
	}

	let { open = $bindable(), name, characters, placed, characterOf, onToggle }: Props = $props();

	const groups = $derived<PlayerReminderGroup[]>(scriptReminderGroups(characters));
	const isPlaced = (reminder: PlayerReminder) =>
		placed.some((r) => r.characterId === reminder.characterId && r.label === reminder.label);
</script>

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
	<ul class="list" data-testid="player-reminder-list">
		{#each groups as group (group.character.id)}
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
		{/each}
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
	.chip:hover {
		filter: brightness(1.15);
	}
</style>
