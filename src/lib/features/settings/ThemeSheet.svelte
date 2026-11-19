<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { settingsDialog } from './settings-dialog.svelte.ts';
	import ThemePanel from './ThemePanel.svelte';

	/**
	 * The board's looks for a player, from their settings cog: the Storyteller's More > Theme in a
	 * sheet that leaves the top of the screen in view, so a change shows there at once (Trevor,
	 * 2026-11-18). The cog in its header opens all of Settings.
	 */
	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();
</script>

<BottomSheet bind:open title={t('settings.theme.title')} height="60dvh">
	{#snippet actions()}<IconButton
			icon="settings"
			label={t('settings.title')}
			data-testid="theme-sheet-settings"
			onclick={() => {
				open = false;
				settingsDialog.show();
			}}
		/>{/snippet}
	<ThemePanel />
</BottomSheet>
