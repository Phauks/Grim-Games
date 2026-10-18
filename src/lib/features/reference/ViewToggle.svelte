<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { referenceView } from './view-mode.svelte.ts';

	// Cards or table is two states, so one toggle on the search line (Trevor, 2026-10-18).
	const table = $derived(referenceView.current === 'table');
</script>

<IconButton
	icon="tableView"
	label={t('reference.showAsTable')}
	aria-pressed={table}
	onclick={() => (referenceView.current = table ? 'cards' : 'table')}
/>
