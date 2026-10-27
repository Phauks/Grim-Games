<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import TokenAppearancePreview from '#lib/features/characters/TokenAppearancePreview.svelte';
	import TokenAppearanceRow from '#lib/features/characters/TokenAppearanceRow.svelte';
	import { PLAYER_SIZE_GROUPS } from './player-size-rows.ts';
	import type { TokenAppearance } from '#lib/ui/token/token-appearance.ts';
	import NameSizeSlider from '#lib/features/grimoire/NameSizeSlider.svelte';

	/**
	 * The Storyteller's text and token sizes, for the player's own screens (Trevor, 2026-10-27:
	 * "some ppl will want some text bigger than others, same with reminder token and character
	 * sizes"): the same rows as Settings > Tokens and the same saved values, so a
	 * change here shows there too. Settings > Player, the player screen's cog and the
	 * Public Town's cog show it, each group beside the same live preview as in Settings > Tokens
	 * (Trevor, 2026-10-27).
	 */
	const value = $derived(preferences.current.tokenAppearance);
	const onChange = (tokenAppearance: TokenAppearance) => preferences.update({ tokenAppearance });
</script>

<SettingGroup title={t('characters.group.inText')} testid="player-in-text-preview">
	{#snippet preview()}<TokenAppearancePreview kind="inText" {value} />{/snippet}
	{#each PLAYER_SIZE_GROUPS.inText as key (key)}<TokenAppearanceRow
			{key}
			{value}
			{onChange}
		/>{/each}
</SettingGroup>

<SettingGroup title={t('characters.group.token')} testid="player-token-preview">
	{#snippet preview()}<TokenAppearancePreview kind="token" {value} />{/snippet}
	{#each PLAYER_SIZE_GROUPS.token as key (key)}<TokenAppearanceRow
			{key}
			{value}
			{onChange}
		/>{/each}
	<NameSizeSlider />
</SettingGroup>

<SettingGroup title={t('characters.group.reminder')} testid="player-reminder-preview">
	{#snippet preview()}<TokenAppearancePreview kind="reminder" {value} />{/snippet}
	{#each PLAYER_SIZE_GROUPS.reminder as key (key)}<TokenAppearanceRow
			{key}
			{value}
			{onChange}
		/>{/each}
</SettingGroup>
