<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import TokenAppearanceRow from '#lib/features/characters/TokenAppearanceRow.svelte';
	import { PLAYER_SIZE_GROUPS } from './player-size-rows.ts';
	import type { TokenAppearance } from '#lib/ui/token/token-appearance.ts';
	import NameSizeSlider from '#lib/features/grimoire/NameSizeSlider.svelte';

	/**
	 * The Storyteller's text and token sizes, for the player's own screens (Trevor, 2026-10-27:
	 * "some ppl will want some text bigger than others, same with reminder token and character
	 * sizes"): the same rows as Settings > Tokens and the same saved values, so a
	 * change here shows there too. Settings > Player, the player screen's cog and the
	 * Public Town's cog show it.
	 */
	const value = $derived(preferences.current.tokenAppearance);
	const onChange = (tokenAppearance: TokenAppearance) => preferences.update({ tokenAppearance });
</script>

<SettingHeading title={t('characters.group.inText')} />
{#each PLAYER_SIZE_GROUPS.inText as key (key)}<TokenAppearanceRow {key} {value} {onChange} />{/each}

<SettingHeading title={t('characters.group.token')} />
{#each PLAYER_SIZE_GROUPS.token as key (key)}<TokenAppearanceRow {key} {value} {onChange} />{/each}
<NameSizeSlider />

<SettingHeading title={t('characters.group.reminder')} />
{#each PLAYER_SIZE_GROUPS.reminder as key (key)}<TokenAppearanceRow
		{key}
		{value}
		{onChange}
	/>{/each}
