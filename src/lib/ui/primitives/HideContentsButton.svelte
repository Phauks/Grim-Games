<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from './IconButton.svelte';

	/**
	 * Hide contents: one switch for anything a player keeps private (a note, a scratch pad),
	 * so it looks and sits the same everywhere (Trevor, 2026-10-18). On, the list shows the
	 * title and "Hidden" in place of the contents.
	 */
	interface Props {
		hidden: boolean;
		onchange: (hidden: boolean) => void;
		testid?: string;
	}

	let { hidden, onchange, testid }: Props = $props();
</script>

<IconButton
	icon="hide"
	label={t('common.hideContents')}
	aria-pressed={hidden}
	data-testid={testid}
	onclick={() => onchange(!hidden)}
/>
