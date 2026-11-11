<script lang="ts">
	import AbilityText from './AbilityText.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import { EDITION_LABELS } from '#lib/features/reference/labels.ts';
	import CharacterPiece from './CharacterPiece.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import ReminderTokenRow from '#lib/features/board/ReminderTokenRow.svelte';
	import CharacterGroupDialog from './CharacterGroupDialog.svelte';
	import { groupSourceOf } from '#lib/core/data/index.ts';

	/**
	 * A character at a glance: the standard character row (icon, name, ability), then its
	 * character type and where it comes from, then its reminder tokens (Trevor, 2026-11-02:
	 * the character's page opens with the standard row, the type and edition lower). The top
	 * of the character dialog and the Library's character pane.
	 */
	interface Props {
		character: Character;
		/** Its alignment when it isn't the type's own, for its icon. */
		alignment?: Alignment;
		/** Every reminder token under the ability. */
		reminders?: boolean;
		/**
		 * The seat it was opened from: its number and alignment show above the type, since
		 * custom tokens can look alike (Trevor, 2026-10-22, plan L26).
		 */
		seat?: { number: number; alignment?: Alignment };
	}

	let { character, alignment, reminders: showReminders = true, seat }: Props = $props();

	const typeLabel = $derived(character.type[0].toUpperCase() + character.type.slice(1));
	// Where the character comes from, as in the Reference: TPI's edition, or Homebrew for a
	// script's own character. Fabled and Loric are their own edition, so it is not repeated.
	const source = $derived(
		character.edition
			? (EDITION_LABELS[character.edition] ?? character.edition)
			: t('characters.homebrew')
	);
	/** TPI's reminder tokens, then the global ones, as in the Reference. */
	const reminders = $derived(
		showReminders
			? [
					...character.reminders.map((label) => ({ label, global: false })),
					...character.remindersGlobal.map((label) => ({ label, global: true }))
				]
			: []
	);
	// The type and source open every character of that type from that source (Trevor,
	// 2026-10-20); a homebrew character's has no official group.
	const typeLine = $derived(source === typeLabel ? typeLabel : `${typeLabel} · ${source}`);
	let groupOpen = $state(false);
	let groupUsed = $state(false);
</script>

<header class="character">
	<!-- No ring button: this is already the character's own page. -->
	<CharacterPiece template="row" {character} alignment={seat?.alignment ?? alignment}>
		{#snippet abilityText()}<AbilityText
				text={character.ability}
				names={[character.name]}
			/>{/snippet}
	</CharacterPiece>
	<div class="about">
		{#if seat}<p class="type" data-testid="character-seat">
				{t('characters.seatLine', {
					number: seat.number,
					alignment:
						seat.alignment === 'good'
							? t('characters.good')
							: seat.alignment === 'evil'
								? t('characters.evil')
								: t('common.none')
				})}
			</p>{/if}
		<p class="type">
			{#if character.edition}<button
					type="button"
					class="group"
					aria-haspopup="dialog"
					title={t('characters.group', { type: typeLabel, source })}
					onclick={() => {
						groupUsed = true;
						groupOpen = true;
					}}>{typeLine}</button
				>{:else}{typeLine}{/if}
		</p>
		{#if groupUsed}<CharacterGroupDialog
				bind:open={groupOpen}
				source={groupSourceOf(character)}
				type={character.type}
			/>{/if}
		<!-- Every reminder token, beside the ability on every section (Trevor, 2026-10-16), as
		     the tokens themselves (Trevor, 2026-10-30). -->
		{#if reminders.length}
			<div class="reminders">
				<ReminderTokenRow testid="character-reminders">
					{#each reminders as reminder, i (i)}<li>
							<BoardReminder label={reminder.label} {character} alignment={seat?.alignment} />
						</li>{/each}
				</ReminderTokenRow>
			</div>
		{/if}
	</div>
</header>

<style>
	.character {
		display: grid;
		gap: var(--space-2);
		flex: none;
		padding: var(--space-2) 0 var(--space-3);
		border-bottom: var(--card-border);
	}
	.type {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* Reads as the same line of text, underlined; the tap area reaches 44px without making
	   the line taller. */
	.group {
		position: relative;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		text-decoration: underline dotted;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}
	.group::before {
		content: '';
		position: absolute;
		inset: calc((1lh - var(--tap-target)) / 2) 0;
	}
	.reminders {
		margin-top: var(--space-3);
	}
</style>
