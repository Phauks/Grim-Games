<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import ReminderTokenRow from '#lib/features/grimoire/ReminderTokenRow.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import GenericLookDialog from '#lib/features/grimoire/GenericLookDialog.svelte';
	import {
		isGenericReminder,
		placedKey,
		playerLook,
		reminderWords,
		type PlayerReminder
	} from './player-reminders.ts';

	/**
	 * The reminders a player put on a seat in their own grim (Trevor, 2026-10-26): a tap takes
	 * one off, and a generic ∞ token's opens its look (text, symbol or colour for numbers and
	 * notes). Tokens are added from the reminder bin only (Trevor, 2026-10-29), so this lists
	 * none to add.
	 */
	interface Props {
		open: boolean;
		/** The seat's name, for the title. */
		name: string;
		/** This seat's reminders, in the order placed. */
		placed: readonly PlayerReminder[];
		characterOf: (id: CharacterId) => Character | undefined;
		onToggle: (reminder: PlayerReminder) => void;
		onGenericLook: (id: string, look: GenericLook) => void;
	}

	let { open = $bindable(), name, placed, characterOf, onToggle, onGenericLook }: Props = $props();

	/** The generic token whose look is open. */
	let editing = $state<string>();
	let lookOpen = $state(false);
	const edited = $derived(placed.find((r) => r.id === editing));
	function edit(id: string | undefined) {
		if (!id) return;
		editing = id;
		lookOpen = true;
	}
</script>

<Dialog bind:open title={t('player.grim.remindersTitle', { name })}>
	<!-- The tokens themselves, as on the board (Trevor, 2026-10-30). -->
	<div class="recent" role="group" aria-label={t('player.grim.onThisSeat')}>
		<ReminderTokenRow inline>
			{#each placed as reminder (placedKey(reminder))}
				{@const generic = isGenericReminder(reminder)}
				<button
					type="button"
					class="chip"
					aria-label={generic
						? t('player.grim.editGeneric', { label: reminderWords(reminder) })
						: t('player.grim.takeOff', { label: reminder.label })}
					aria-pressed="true"
					onclick={() => (generic ? edit(reminder.id) : onToggle(reminder))}
				>
					<BoardReminder {...playerLook(reminder, characterOf)} />
				</button>
			{:else}
				<span class="none">{t('common.none')}</span>
			{/each}
		</ReminderTokenRow>
	</div>
</Dialog>

<GenericLookDialog
	bind:open={lookOpen}
	look={edited}
	tokenKey={editing}
	onChange={(change) => editing && onGenericLook(editing, change)}
	onDelete={() => edited && onToggle(edited)}
	deleteLabel={t('player.grim.deleteGeneric')}
/>

<style>
	.recent {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-wrap: wrap;
		min-height: calc(3.25 * var(--u));
	}
	.none {
		font-size: 0.85rem;
		opacity: 0.7;
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
		border-radius: 50%;
	}
	.chip:hover {
		filter: brightness(1.15);
	}
</style>
