<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ScratchActions from './ScratchActions.svelte';
	import ScratchPad from './ScratchPad.svelte';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		open?: boolean;
		pad: ScratchPadState;
		/** Deletes the pad, once confirmed; the dialog closes first. */
		onDelete: () => void;
	}

	let { open = $bindable(false), pad, onDelete }: Props = $props();
</script>

<!-- The pad full screen: as much paper as the screen has (Trevor, 2026-10-17). It only
     opens when a pad is chosen, never by itself (Trevor, 2026-10-17). -->
<Dialog bind:open title={t('scratch.title')} size="max" scroll={false}>
	{#snippet headActions()}
		<ScratchActions
			{pad}
			shortcuts={open}
			onDelete={() => {
				open = false;
				onDelete();
			}}
		/>
	{/snippet}
	<ScratchPad {pad} />
</Dialog>
