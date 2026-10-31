<script lang="ts">
	import { onDestroy } from 'svelte';
	import { reminderHolder, type ReminderInstance } from '#lib/core/model/index.ts';
	import { cardsOfCharacter } from '#lib/features/info-tokens/character-cards.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The Storyteller's own words on a reminder whose rules say it carries them (`noteOn`: the
	 * Zenomancer's Goal, Trevor 2026-10-31), typed in its reminder dialog and shown to that
	 * player on the character's card ("Your goal is"). Show waits for some words.
	 */
	interface Props {
		grimoire: Grimoire;
		reminder: ReminderInstance;
	}

	let { grimoire, reminder }: Props = $props();

	const character = $derived(grimoire.open.characters.get(reminder.characterId));
	const card = $derived(character ? cardsOfCharacter(character)[0] : undefined);
	const label = $derived(card ? t(card.fillKey) : reminder.label);

	const saved = $derived(reminder.note ?? '');
	// Typed text, reset whenever the saved note changes.
	let text = $derived(saved);

	function save() {
		const note = text.trim();
		// Already taken off the board: nothing to save it on.
		if (note === saved || !reminderHolder(grimoire.game, reminder.reminderId)) return;
		grimoire.run({ type: 'SetReminderNote', reminderId: reminder.reminderId, note });
	}
	onDestroy(save);

	let showOpen = $state(false);
	const shown = $derived(
		text.trim()
			? [
					{
						title: card ? t(card.titleKey) : '',
						characters: character ? [{ character }] : [],
						detail: text.trim()
					}
				]
			: []
	);
</script>

<div class="noted" data-testid="noted-reminder">
	<TextField {label} bind:value={text} enterkeyhint="done" oncommit={save} testid="reminder-note" />
	<Button
		variant="quiet"
		icon="showToPlayer"
		disabled={!text.trim()}
		onclick={() => {
			save();
			showOpen = true;
		}}>{t('show.toPlayer')}</Button
	>
</div>
<ShowToPlayer bind:open={showOpen} cards={shown} />

<style>
	.noted {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		margin: 0 0 var(--space-3);
	}
	.noted > :global(:first-child) {
		justify-self: stretch;
	}
</style>
