<script lang="ts" module>
	/** What the Game info pencil can change; more fields join this as they become editable. */
	export interface GameInfoChanges {
		storytellerName: string;
	}
</script>

<script lang="ts">
	import { MAX_STORYTELLER_NAME } from '#lib/features/game/storyteller-name.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	interface Props {
		open?: boolean;
		/** The values it starts from each time it opens. */
		initial: GameInfoChanges;
		onsave: (changes: GameInfoChanges) => void;
	}

	let { open = $bindable(false), initial, onsave }: Props = $props();

	/** The editable fields, in the order Game info lists them (Trevor, 2026-10-19). */
	const FIELDS: readonly { key: keyof GameInfoChanges; label: string; maxlength: number }[] = [
		{ key: 'storytellerName', label: t('modes.info.storyteller'), maxlength: MAX_STORYTELLER_NAME }
	];

	let values = $state<GameInfoChanges>({ storytellerName: '' });

	$effect(() => {
		if (open) values = { ...initial };
	});

	function save() {
		onsave({ storytellerName: values.storytellerName.trim().replace(/\s+/g, ' ') });
		open = false;
	}
</script>

<!-- The Game info pencil: every Game info value the Storyteller can change, in one place. -->
<Dialog bind:open title={t('modes.info.edit')}>
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
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={save} />
	{/snippet}
</Dialog>
