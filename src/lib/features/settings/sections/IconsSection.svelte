<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		ICON_SETS,
		ICON_SLOTS,
		iconSlots,
		withWeight,
		type IconSetId,
		type IconSlot
	} from '#lib/ui/icons/catalogue.ts';
	import IconGlyph from '#lib/ui/icons/IconGlyph.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { resolveIconBase, resolveIconSet } from '#lib/ui/preferences.ts';
	import SettingChoice from '#lib/ui/settings/SettingChoice.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import { DEFAULT_PREFERENCES, ICON_SCALE } from '#lib/ui/preferences.ts';
	import { intl } from '#lib/i18n/locale.svelte.ts';

	const theme = $derived(preferences.theme);
	const setId = $derived(resolveIconSet(preferences.current, theme));
	const weight = $derived(ICON_SETS.find((set) => set.id === setId)?.weight ?? 'regular');
	const choosable = iconSlots.filter((slot) => ICON_SLOTS[slot].choices.length > 1);

	function chooseSet(id: IconSetId) {
		preferences.update({ iconSet: id === theme.iconSet ? null : id });
	}

	function chooseIcon(slot: IconSlot, id: string) {
		const overrides = { ...preferences.current.iconOverrides, [slot]: id };
		if (id === (theme.icons[slot] ?? ICON_SLOTS[slot].choices[0])) delete overrides[slot];
		preferences.update({ iconOverrides: overrides });
	}
</script>

<!-- Next to the icon style and choices it scales (Trevor, 2026-10-17). -->
<SettingSlider
	label={t('settings.iconSize')}
	description={t('settings.iconSizeHelp')}
	value={preferences.current.iconScale}
	defaultValue={DEFAULT_PREFERENCES.iconScale}
	{...ICON_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(iconScale) => preferences.update({ iconScale })}
/>
<!-- Character icons in lists and the day, next to the interface's (2026-10-18: names in text
     got their own sizes in Tokens). -->
<SettingSlider
	label={t('settings.characterIconSize')}
	description={t('settings.characterIconSizeHelp')}
	value={preferences.current.characterIconScale}
	defaultValue={DEFAULT_PREFERENCES.characterIconScale}
	{...ICON_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(characterIconScale) => preferences.update({ characterIconScale })}
/>

<SettingChoice
	label={t('settings.iconStyle')}
	description={t('settings.iconStyleHelp')}
	value={setId}
	defaultValue={resolveIconSet({ ...preferences.current, iconSet: null }, theme)}
	options={ICON_SETS.map((set) => ({ value: set.id, label: set.label }))}
	onChange={chooseSet}
>
	{#snippet item(option)}
		{@const set = ICON_SETS.find((s) => s.id === option.value) ?? ICON_SETS[0]}
		<span class="weight">
			<IconGlyph id={withWeight('ph:skull', set.weight)} set={set.id} />
			<IconGlyph id={withWeight('ph:moon-stars', set.weight)} set={set.id} />
			{option.label}
		</span>
	{/snippet}
</SettingChoice>

{#each choosable as slot (slot)}
	<SettingChoice
		label={ICON_SLOTS[slot].label}
		layout="row"
		value={resolveIconBase(slot, preferences.current, theme)}
		defaultValue={resolveIconBase(slot, { ...preferences.current, iconOverrides: {} }, theme)}
		options={ICON_SLOTS[slot].choices.map((id) => ({ value: id, label: id }))}
		onChange={(id) => chooseIcon(slot, id)}
	>
		{#snippet item(option)}
			<IconGlyph
				id={withWeight(option.value, weight)}
				set={setId}
				label={option.value.replace('ph:', '').replaceAll('-', ' ')}
			/>
		{/snippet}
	</SettingChoice>
{/each}

<style>
	.weight {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
