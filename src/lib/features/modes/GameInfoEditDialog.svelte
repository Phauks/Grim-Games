<script lang="ts" module>
	import type { ScriptChoice } from './script-choices.svelte.ts';

	/** What the Game info pencil can change; more fields join this as they become editable. */
	export interface GameInfoChanges {
		storytellerName: string;
		/** The script picked, only when it isn't the one the dialog opened with. */
		script?: ScriptChoice;
	}
</script>

<script lang="ts">
	import { MAX_STORYTELLER_NAME } from '#lib/features/game/storyteller-name.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ScriptPicker from './ScriptPicker.svelte';

	interface Props {
		open?: boolean;
		/** The values it starts from each time it opens; `script` is undefined for a script no picker choice matches. */
		initial: { storytellerName: string; script: ScriptChoice | undefined };
		onsave: (changes: GameInfoChanges) => void;
	}

	let { open = $bindable(false), initial, onsave }: Props = $props();

	/** The editable fields, in the order Game info lists them (Trevor, 2026-10-19). */
	const FIELDS: readonly { key: 'storytellerName'; label: string; maxlength: number }[] = [
		{ key: 'storytellerName', label: t('modes.info.storyteller'), maxlength: MAX_STORYTELLER_NAME }
	];

	let values = $state({ storytellerName: '' });
	let script = $state<ScriptChoice>('');

	$effect(() => {
		if (!open) return;
		values = { storytellerName: initial.storytellerName };
		script = initial.script ?? '';
		// The picker lists the recent and Library scripts, as on New game.
		void restoreScripts();
	});

	function save() {
		onsave({
			storytellerName: values.storytellerName.trim().replace(/\s+/g, ' '),
			...(script && script !== initial.script ? { script } : {})
		});
		open = false;
	}
</script>

<!-- The Game info pencil: every Game info value the Storyteller can change, in one place. The
     script is swapped with the same picker as New game, keeping the seats, names and room
     (Trevor, 2026-10-23: "switch to a different script with the same players"). -->
<Dialog bind:open title={t('modes.info.edit')}>
	<div class="fields">
		<ScriptPicker label={t('modes.info.script')} value={script} onChange={(v) => (script = v)} />
		{#each FIELDS as field (field.key)}
			<TextField
				label={field.label}
				bind:value={values[field.key]}
				maxlength={field.maxlength}
				autocomplete="off"
				oncommit={() => {
					save();
					return false;
				}}
			/>
		{/each}
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={save} />
	{/snippet}
</Dialog>

<style>
	.fields {
		display: grid;
		gap: var(--space-3);
	}
</style>
