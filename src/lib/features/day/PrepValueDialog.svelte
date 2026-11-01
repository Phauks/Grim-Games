<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { scriptCharacterIds } from '#lib/core/model/index.ts';
	import { prepValueCharacter, prepValueKey, prepValueLabel } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Writes a value the Storyteller decides for a character (the Yaggababble's secret phrase,
	 * the Amnesiac's ability: `setupPrep` notes with a `value`), opened from the pre-day
	 * reminder that shows it. Empty clears it. A character value (the Storm Catcher's named
	 * character) is picked from the script's good characters, in play or not.
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
	const kind = $derived(
		characterId && valueKey ? prepValueCharacter(characterId, valueKey, game.characters) : undefined
	);
	const goodOnScript = $derived(
		kind
			? scriptCharacterIds(game.game.script).filter((id) => {
					const type = game.characters.get(id)?.type;
					return type === 'townsfolk' || type === 'outsider';
				})
			: []
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
		{#if kind}
			<Select
				label={title}
				hideLabel
				placeholder={title}
				value={text || undefined}
				options={goodOnScript.map((id) => ({
					value: id,
					// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as the badge
					label: game.characters.get(id)?.name ?? id
				}))}
				onChange={(id) => (text = id)}
				onClear={() => (text = '')}
			>
				{#snippet item(option)}<CharacterBadge
						characterId={option.value}
						character={game.characters.get(option.value)}
						interactive={false}
					/>{/snippet}
				{#snippet selected(option)}<CharacterBadge
						characterId={option.value}
						character={game.characters.get(option.value)}
						interactive={false}
					/>{/snippet}
			</Select>
		{:else}
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
		{/if}
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
