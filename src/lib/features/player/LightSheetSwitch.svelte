<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The script and night order sheets' light background, a sun when on and a moon when off
	 * (Trevor, 2026-10-23: "change to sun and moon icon"). One setting for every sheet, also in
	 * Settings > Player.
	 */
	const light = $derived(playerSettings.current.lightSheet);
</script>

<IconButton
	icon={light ? 'lightSheet' : 'darkSheet'}
	label={t('player.lightSheet')}
	aria-pressed={light}
	data-testid="light-sheet"
	onclick={() => playerSettings.update({ lightSheet: !light })}
/>
