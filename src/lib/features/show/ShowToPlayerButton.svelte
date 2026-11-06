<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * Show to player as an eye, beside an answer a night step offers (Trevor, 2026-11-06:
	 * "Instead of show to player. Change to eyeball"). The same eye as the step's own Show to
	 * player beside its X, outlined so it reads as something to tap in a row of text.
	 */
	let { ...rest }: HTMLButtonAttributes = $props();
</script>

<IconButton icon="showToPlayer" label={t('show.toPlayer')} outlined {...rest} />
