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
{#each groups as [group, tokens] (group)}
	<SettingCollapsible
		title={t(`settings.colorGroup.${group}`)}
		storageKey="settings-colors-{group}"
		defaultOpen={false}
	>
		{#each tokens as token (token)}
			<SettingColor
				label={name(token)}
				value={colorFor(theme, colors, token)}
				custom={token in colors}
				warnings={warnings(token)}
				onChange={(value) => setColor(token, value)}
				onReset={() => setColor(token, undefined)}
			/>
		{/each}
	</SettingCollapsible>
{/each}
