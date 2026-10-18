<script lang="ts">
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';

	/**
	 * Picks the profile icon from the official characters, or None for the usual account
	 * icon. A tap saves and closes. Only the character's id is stored, never an image.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let query = $state('');
	let busy = $state(false);

	$effect(() => {
		if (open) {
			query = '';
			void loadOfficialData();
		}
	});

	async function choose(icon: string | null): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			account.updated(await accountApi.setIcon(icon));
			open = false;
		} catch (e) {
			toast(t('account.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('account.icon.title')} size="full">
	<div class="list">
		{#if officialData.current}
			<CharacterPicker
				characters={officialData.current.characters}
				selected={account.user?.icon ? [account.user.icon] : []}
				bind:query
				collapsibleKey="profile-icon"
				onSelect={(id) => void choose(id)}
				onNone={() => void choose(null)}
			/>
		{:else}
			<p>{t('account.loading')}</p>
		{/if}
	</div>
</Dialog>

<style>
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	p {
		margin: 0;
	}
</style>
