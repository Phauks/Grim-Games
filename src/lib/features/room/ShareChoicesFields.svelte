<script lang="ts">
	import type { ShareChoices } from '#lib/core/engine/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	/**
	 * What goes with a shared grimoire besides its characters and reminders, a switch each
	 * (Trevor, 2026-11-15: "we don't always want to share everything"): Share grim's and Grim
	 * view's alike (2026-11-16).
	 */
	interface Props {
		choices: ShareChoices;
	}

	let { choices = $bindable() }: Props = $props();
</script>

<div class="choices" data-testid="share-grim-choices">
	<Toggle
		label={t('room.shareGrim.history')}
		checked={choices.history}
		onChange={(on) => (choices = { ...choices, history: on })}
	/>
	<Toggle
		label={t('room.shareGrim.seatNotes')}
		checked={choices.seatNotes}
		onChange={(on) => (choices = { ...choices, seatNotes: on })}
	/>
	<Toggle
		label={t('room.shareGrim.gameNotes')}
		checked={choices.gameNotes}
		onChange={(on) => (choices = { ...choices, gameNotes: on })}
	/>
	<Toggle
		label={t('room.shareGrim.bluffs')}
		checked={choices.bluffs}
		onChange={(on) => (choices = { ...choices, bluffs: on })}
	/>
</div>

<style>
	.choices {
		display: grid;
		margin-top: var(--space-3);
	}
</style>
