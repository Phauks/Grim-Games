<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingCollapsible from '#lib/ui/settings/SettingCollapsible.svelte';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';
	import SettingColor from '#lib/ui/settings/SettingColor.svelte';
	import {
		COLOR_GROUPS,
		colorFor,
		contrastWarnings,
		type ColorGroup,
		type ColorToken
	} from '#lib/ui/themes/colors.ts';
	import { THEMES } from '#lib/ui/themes/registry.ts';
	import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
	import AnimationsSetting from '../AnimationsSetting.svelte';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';

	interface Props {
		/**
		 * Each colour group under a plain heading, not its own fold: inside a band of the game
		 * pane's Theme, only the band folds (Trevor, 2026-11-18).
		 */
		flat?: boolean;
	}

	let { flat = false }: Props = $props();

	const theme = $derived(preferences.theme);
	const colors = $derived(preferences.current.colors);
	const groups = Object.entries(COLOR_GROUPS) as [ColorGroup, readonly ColorToken[]][];
	const name = (token: ColorToken) => t(`settings.color.${token.slice(2)}` as PlainMessageKey);

	function setColor(token: ColorToken, value: string | undefined) {
		const next = { ...colors };
		if (value === undefined) delete next[token];
		else next[token] = value;
		preferences.update({ colors: next });
	}

	function warnings(token: ColorToken): string[] {
		return contrastWarnings(theme, colors, token).map((w) =>
			t('settings.colorContrastPair', {
				text: name(w.text),
				background: name(w.background),
				ratio: intl.number(w.ratio, { maximumFractionDigits: 1 })
			})
		);
	}
</script>

<!-- Theme (Trevor, 2026-10-18): a theme fills every colour; any colour can then be the
     person's own, with a reset back to the theme's. Low contrast warns and never blocks. -->
<SettingChoice
	label={t('settings.theme')}
	value={theme.id}
	defaultValue={DEFAULT_PREFERENCES.themeId}
	options={THEMES.map((option) => ({ value: option.id, label: option.name }))}
	onChange={(themeId) => preferences.update({ themeId })}
/>
<AnimationsSetting />
{#each groups as [group, tokens] (group)}
	{#if flat}
		<SettingHeading title={t(`settings.colorGroup.${group}`)} />
		{#each tokens as token (token)}{@render colour(token)}{/each}
	{:else}
		<SettingCollapsible
			title={t(`settings.colorGroup.${group}`)}
			storageKey="settings-colors-{group}"
			defaultOpen={false}
		>
			{#each tokens as token (token)}{@render colour(token)}{/each}
		</SettingCollapsible>
	{/if}
{/each}

{#snippet colour(token: ColorToken)}
	<SettingColor
		label={name(token)}
		value={colorFor(theme, colors, token)}
		custom={token in colors}
		warnings={warnings(token)}
		onChange={(value) => setColor(token, value)}
		onReset={() => setColor(token, undefined)}
	/>
{/snippet}
