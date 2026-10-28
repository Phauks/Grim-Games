<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import {
		MAX_PRINT_COPIES,
		PRINT_BACKS,
		PRINT_COLUMNS,
		PRINT_DEFAULTS,
		PRINT_DENSITIES,
		playerSettings,
		type PrintSettings
	} from './player-settings.svelte.ts';

	/**
	 * Our printed sheet's settings (Trevor, 2026-10-19), ideas from Ravenswood Studio's script
	 * generator: in the Print screen beside its preview, and in Settings → Print.
	 */
	const print = $derived(playerSettings.current.print);
	const set = (patch: Partial<PrintSettings>) =>
		playerSettings.update({ print: { ...print, ...patch } });
</script>

<div class="fields" data-testid="print-settings">
	<SettingRow
		label={t('player.printCopies')}
		onReset={() => set({ copies: PRINT_DEFAULTS.copies })}
		isDefault={print.copies === PRINT_DEFAULTS.copies}
	>
		{#snippet control()}
			<Stepper
				value={print.copies}
				label={t('player.printCopies')}
				lessLabel={t('player.printFewerCopies')}
				moreLabel={t('player.printMoreCopies')}
				min={1}
				max={MAX_PRINT_COPIES}
				onchange={(copies) => set({ copies })}
			/>
		{/snippet}
	</SettingRow>
	<SettingSelect
		label={t('player.printColumns')}
		value={print.columns}
		options={PRINT_COLUMNS.map((value) => ({ value, label: t(`player.printColumns.${value}`) }))}
		defaultValue={PRINT_DEFAULTS.columns}
		onChange={(columns) => set({ columns })}
	/>
	<SettingSelect
		label={t('player.printDensity')}
		value={print.density}
		options={PRINT_DENSITIES.map((value) => ({
			value,
			label: value === 'auto' ? t('player.printAuto') : t(`player.density.${value}`)
		}))}
		defaultValue={PRINT_DEFAULTS.density}
		onChange={(density) => set({ density })}
	/>
	<SettingToggle
		label={t('player.printNightStrips')}
		checked={print.nightStrips}
		onChange={(nightStrips) => set({ nightStrips })}
	/>
	<SettingToggle
		label={t('player.jinxes')}
		checked={print.jinxes}
		onChange={(jinxes) => set({ jinxes })}
	/>
	<SettingSelect
		label={t('player.printBack')}
		value={print.back}
		options={PRINT_BACKS.map((value) => ({ value, label: t(`player.printBack.${value}`) }))}
		defaultValue={PRINT_DEFAULTS.back}
		onChange={(back) => set({ back })}
	/>
</div>

<style>
	.fields {
		display: grid;
		gap: var(--space-2);
	}
</style>
