<script lang="ts">
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

<SettingChoice
	label="Icon style"
	description="Phosphor icons in six weights."
	value={setId}
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
