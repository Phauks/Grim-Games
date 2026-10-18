<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';

	interface Props {
		query: string;
		/** Accessible name of the box. */
		label?: string;
		/** On a computer, "/" anywhere on the page (outside a field or dialog) jumps to this box. */
		shortcut?: boolean;
	}

	let { query = $bindable(''), label = t('picker.search'), shortcut = false }: Props = $props();
</script>

<!-- The character search box: the shared SearchField with the picker's words. -->
<SearchField
	bind:value={query}
	{label}
	placeholder={t('picker.placeholder')}
	clearLabel={t('picker.clearSearch')}
	{shortcut}
/>
