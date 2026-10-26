<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ShowToPlayer from './ShowToPlayer.svelte';

	/**
	 * The grim cover (Trevor, 2026-10-26: "Grim cover, no info at all. Accessible from day or
	 * grim view"): an opaque screen with nothing on it, which only its ✕ takes away. The
	 * board's ⋯ menu opens the same cover (BoardMenu).
	 */
	let open = $state(false);
</script>

<IconButton
	icon="cover"
	label={t('show.cover')}
	data-testid="cover-button"
	onclick={() => (open = true)}
/>
<ShowToPlayer bind:open blank />
