<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { EDITION_LABELS } from '#lib/features/reference/labels.ts';
	import { iconUrl } from './icon-url.ts';
	import ReminderToken from './ReminderToken.svelte';

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
	}

	let { character, icon: given, reminders: showReminders = true }: Props = $props();

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
</script>

<header class="character">
	<span class="icon"
		>{#if icon}<img src={icon} alt="" width="64" height="64" />{/if}</span
	>
	<div>
		<p class="type">{source === typeLabel ? typeLabel : `${typeLabel} · ${source}`}</p>
		<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
		<!-- Every reminder token, beside the ability on every section (Trevor, 2026-10-16). -->
		{#if reminders.length}
			<p class="reminders" data-testid="character-reminders">
				{#each reminders as reminder, i (i)}<ReminderToken
						label={reminder.global
							? t('reference.globalReminder', { label: reminder.label })
							: reminder.label}
						type={character.type}
					/>{/each}
			</p>
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
	.ability {
		margin: 0;
		font-family: var(--font-ability);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.reminders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: var(--space-2) 0 0;
	}
</style>
