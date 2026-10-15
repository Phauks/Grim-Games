<script lang="ts">
	import { resolve } from '$app/paths';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	let accountNote = $state(false);
</script>

<header>
	<a class="brand" href={resolve('/')}>Grim-Games</a>
	<div class="actions">
		<IconButton icon="settings" label="Settings" onclick={() => settingsDialog.show()} />
		<!-- Placeholder: accounts and sign-in are on the roadmap. -->
		<IconButton icon="account" label="Account" onclick={() => (accountNote = true)} />
	</div>
</header>

<Dialog bind:open={accountNote} title="Accounts">
	<p>Accounts are coming later. Everything is saved on this device for now.</p>
</Dialog>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: var(--z-raised);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: env(safe-area-inset-top) var(--space-2) 0 var(--space-4);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		color: var(--heading);
		text-decoration: none;
	}
	.actions {
		display: flex;
		gap: var(--space-1);
	}
</style>
