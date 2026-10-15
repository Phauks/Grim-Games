<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	let confirmReset = $state(false);

	function reset() {
		preferences.reset();
		confirmReset = false;
		toast('Settings reset', 'Back to the defaults on this device.');
	}
</script>

<SettingRow
	label="Reset all settings"
	description="Settings are saved on this device only and are not shared with other players."
>
	{#snippet control(labelId)}
		<Button
			variant="quiet"
			icon="undo"
			aria-describedby={labelId}
			onclick={() => (confirmReset = true)}
		>
			Reset all
		</Button>
	{/snippet}
</SettingRow>

<Dialog bind:open={confirmReset} role="alertdialog" title="Reset settings?">
	<p>Theme, fonts, text size, icon size, icons and Storyteller help go back to their defaults.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmReset = false)}>Cancel</Button>
		<Button onclick={reset}>Reset</Button>
	{/snippet}
</Dialog>
