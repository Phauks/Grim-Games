<script lang="ts" module>
	import { playerSettings } from './player-settings.svelte.ts';

	/** Whether the town is drawn in the board's shape: Public Town's switch, or the Grim tab's. */
	export const matchesShape = (display: boolean) =>
		display ? playerSettings.current.townMatchShape : playerSettings.current.matchShape;
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * The Grim tab's town in the Storyteller's board's shape, or filling this screen (Trevor,
	 * 2026-10-27); also in Settings > Player. Public Town has its own, in its settings cog.
	 * Disabled until the board's shape arrives.
	 */
	let { disabled }: { disabled: boolean } = $props();
	const on = $derived(playerSettings.current.matchShape);
</script>

<IconButton
	icon="boardShape"
	label={t('player.grim.matchShape')}
	aria-pressed={on}
	{disabled}
	data-testid="match-shape"
	onclick={() => playerSettings.update({ matchShape: !on })}
/>
