<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { EDITION_LABELS } from '#lib/features/reference/labels.ts';
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import ReminderTokenRow from '#lib/features/grimoire/ReminderTokenRow.svelte';
	import CharacterGroupDialog from './CharacterGroupDialog.svelte';
	import { groupSourceOf } from '#lib/core/data/index.ts';

	/**
	 * A character at a glance: icon, character type and where it comes from, its ability and
	 * its reminder tokens. The top of the character dialog, and of anything else that shows
	 * whose a token is (the board's reminder dialog).
	 */
	interface Props {
		character: Character;
		/** The seat's icon (its alignment); otherwise the character's own. */
		icon?: string;
		/** Every reminder token under the ability. */
		reminders?: boolean;
		/**
		 * The seat it was opened from: its number and alignment show above the type, since
		 * custom tokens can look alike (Trevor, 2026-10-22, plan L26).
		 */
		seat?: { number: number; alignment?: Alignment };
	}

	let { character, icon: given, reminders: showReminders = true, seat }: Props = $props();

	const icon = $derived(given ?? iconUrl(character));
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
	<span class="icon"
		>{#if icon}<img
				src={icon}
				alt=""
				width="64"
				height="64"
				referrerpolicy="no-referrer"
				{@attach iconFallback(fallbackIconUrl(character))}
			/>{/if}</span
	>
	<div>
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
		<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
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
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		flex: none;
		padding: var(--space-2) 0 var(--space-3);
		border-bottom: var(--card-border);
	}
	.icon {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: calc(4.5 * var(--u));
		height: calc(4.5 * var(--u));
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
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
	.ability {
		margin: 0;
		font-family: var(--font-ability);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.reminders {
		margin-top: var(--space-3);
	}
</style>
