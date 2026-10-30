<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { prepValueKey, prepValueLabel } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Writes a value the Storyteller decides for a character (the Yaggababble's secret phrase,
	 * the Amnesiac's ability: `setupPrep` notes with a `value`), opened from the pre-day
	 * reminder that shows it. Empty clears it.
	 */
	interface Props {
		open: boolean;
		game: DayPort;
		characterId?: CharacterId;
		valueKey?: string;
	}

	let { open = $bindable(), game, characterId, valueKey }: Props = $props();

	const key = $derived(characterId && valueKey ? prepValueKey(characterId, valueKey) : undefined);
	const saved = $derived((key && game.game.prepValues?.[key]) ?? '');
	const title = $derived(
		(characterId && valueKey && prepValueLabel(characterId, valueKey, game.characters)) ??
			valueKey ??
			''
	);
	let text = $state('');
	$effect(() => {
		if (open) text = saved;
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (key) game.run({ type: 'SetPrepValue', key, value: text.trim() || undefined });
		open = false;
	}
</script>

<Dialog bind:open {title}>
	<form onsubmit={save}>
		<textarea
			aria-label={title}
			bind:value={text}
			rows="3"
			enterkeyhint="done"
			onkeydown={(event) => {
				// Enter saves, as in every other modal; the text wraps on its own.
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					event.currentTarget.form?.requestSubmit();
				}
			}}></textarea>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={text.trim() === saved}
			confirmLabel={t('common.save')}
		/>
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
		resize: none;
	}
</style>
