<script lang="ts">
	import ProfileSelect from '#lib/features/settings/profiles/ProfileSelect.svelte';
	import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import GameSettingsRows from './GameSettingsRows.svelte';
	import { chooseStartProfile } from './start-settings.ts';

	interface Props {
		open?: boolean;
		gameId: string;
		/**
		 * Before the game begins (Character selection, Trevor 2026-10-29): the settings profile
		 * it starts with comes first, since it sets where the rows below start.
		 */
		profile?: boolean;
	}

	/** One game's settings: the board's ⋯ › Game, and Character selection's Game settings. */
	let { open = $bindable(false), gameId, profile = false }: Props = $props();
</script>

<Dialog bind:open title={t('setup.gameSettings')}>
	<div class="rows" data-testid="game-settings">
		{#if profile}
			<SettingRow label={t('settings.profile')}>
				{#snippet control()}
					<ProfileSelect
						value={settingsProfiles.profileOfGame(gameId)}
						onChange={(id) => chooseStartProfile(gameId, id)}
					/>
				{/snippet}
			</SettingRow>
		{/if}
		<GameSettingsRows {gameId} />
	</div>
</Dialog>

<style>
	.rows {
		display: grid;
	}
</style>
