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
		toast('Settings reset', 'Back to the theme defaults on this device.');
	}
</script>

<p>Grim-Games is a touch-first grimoire for Blood on the Clocktower Storytellers.</p>
<p class="muted">
	Not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven
	Medway and The Pandemonium Institute.
</p>

<SettingRow
	label="Reset settings"
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
	<p>Theme, fonts, text size and icons go back to the theme defaults.</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmReset = false)}>Cancel</Button>
		<Button onclick={reset}>Reset</Button>
	{/snippet}
</Dialog>

<style>
	p {
		margin: 0 0 var(--space-3);
	}
	.muted {
		margin-bottom: var(--space-5);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>
