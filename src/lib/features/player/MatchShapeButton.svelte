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
	 * The town in the Storyteller's board's shape, or filling this screen (Trevor, 2026-10-27),
	 * on the Grim tab and Public Town; also in Settings > Player. Each has its own switch, as
	 * Public Town is on unless switched off. Disabled until the board's shape arrives.
	 */
	interface Props {
		/** Public Town's switch, not the Grim tab's. */
		display: boolean;
		disabled: boolean;
	}

	let { display, disabled }: Props = $props();
	const on = $derived(matchesShape(display));
</script>

<IconButton
	icon="boardShape"
	label={t('player.grim.matchShape')}
	aria-pressed={on}
	{disabled}
	data-testid="match-shape"
	onclick={() => playerSettings.update(display ? { townMatchShape: !on } : { matchShape: !on })}
/>
