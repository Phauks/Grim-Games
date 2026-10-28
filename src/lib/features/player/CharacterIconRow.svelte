<script lang="ts">
	import { avatarCharacter, characterAvatar } from '#lib/core/avatars/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The character that represents the player (Trevor, 2026-10-28: "representative character
	 * token"), picked from the official characters, or None. It sits on top of their laurel,
	 * full colour here and engraved on seats; the face keeps their initials or picture.
	 */
	let open = $state(false);
	let query = $state('');

	const chosen = $derived(avatarCharacter(playerSettings.current.avatar));
	const character = $derived(chosen ? officialData.current?.byId.get(chosen) : undefined);

	$effect(() => {
		if (chosen) void loadOfficialData();
	});
	$effect(() => {
		if (!open) return;
		query = '';
		void loadOfficialData();
	});

	function choose(id: string | null) {
		playerSettings.update({ avatar: id ? characterAvatar(id) : 'initials' });
		open = false;
	}
</script>

<SettingRow label={t('player.characterIcon')}>
	{#snippet control(labelId)}
		<span class="value">
			<span class="current" data-testid="character-icon">
				{#if chosen && character}<CharacterBadge characterId={chosen} {character} />{:else}{t(
						'common.none'
					)}{/if}
			</span>
			<IconButton
				icon="edit"
				label={t('player.editCharacterIcon')}
				aria-haspopup="dialog"
				aria-describedby={labelId}
				onclick={() => (open = true)}
			/>
		</span>
	{/snippet}
</SettingRow>

<Dialog bind:open title={t('player.characterIcon')} size="full">
	<div class="list">
		{#if officialData.current}
			<CharacterPicker
				characters={officialData.current.characters}
				selected={chosen ? [chosen] : []}
				bind:query
				collapsibleKey="avatar-character"
				onSelect={(id) => choose(id)}
				onNone={() => choose(null)}
			/>
		{:else}
			<p>{t('account.loading')}</p>
		{/if}
	</div>
</Dialog>

<style>
	.value {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		min-width: 0;
	}
	.current {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.list {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
