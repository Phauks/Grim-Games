<script lang="ts">
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';
	import ScriptCharactersButton from './ScriptCharactersButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings, the script's own
	 * characters in the bag, join, then Settings, since setup has the game's screen with no app
	 * header (Trevor, 2026-10-23).
	 */
	let { port }: { port: SetupGamePort } = $props();
</script>

<BagSettings /><ScriptCharactersButton {port} />{#if port.openGame}<JoinButton
		game={port.openGame}
	/>{/if}<IconButton
	icon="settings"
	label={t('shell.settings')}
	onclick={() => settingsDialog.show()}
/>
