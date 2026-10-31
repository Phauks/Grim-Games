<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import SettingCollapsible from '#lib/ui/settings/SettingCollapsible.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import {
		MARGIN_UNITS,
		MAX_MARGIN_MM,
		PAGE_SIZES,
		PRINT_COLUMNS,
		PRINT_DEFAULTS,
		PRINT_DENSITIES,
		PRINT_ICON_SCALE,
		playerSettings,
		type PrintBack,
		type PrintFront,
		type PrintSettings
	} from './player-settings.svelte.ts';

	/**
	 * Our printed sheet's settings: in the Print screen beside its preview, and in Settings →
	 * Print. Paper, then the Front and the Back, each with a switch per item (Trevor, 2026-10-29:
	 * "segment sections for front and back, add toggles instead of bundling it all together").
	 */
	interface Props {
		/** The script being printed has a logo; without one its switch shows greyed out. */
		hasLogo?: boolean;
		/** Printing from a game with a game mode or special rules; else their switches grey out. */
		hasRules?: boolean;
	}

	let { hasLogo = true, hasRules = true }: Props = $props();

	const print = $derived(playerSettings.current.print);
	const set = (patch: Partial<PrintSettings>) =>
		playerSettings.update({ print: { ...print, ...patch } });
	const setFront = (patch: Partial<PrintFront>) => set({ front: { ...print.front, ...patch } });
	const setBack = (patch: Partial<PrintBack>) => set({ back: { ...print.back, ...patch } });

	/** One margin step: an eighth of an inch, or a millimetre. */
	const MM_PER_STEP = { in: 25.4 / 8, mm: 1 } as const;
	const unit = $derived(print.marginUnit);
	const marginSteps = $derived(Math.round(print.margin / MM_PER_STEP[unit]));
	const maxSteps = $derived(Math.floor(MAX_MARGIN_MM / MM_PER_STEP[unit] + 1e-9));
	/** "½ in", "1¼ in" or "12 mm". */
	function marginText(steps: number): string {
		if (unit === 'mm') return `${steps} ${t('player.printMarginUnit.mm')}`;
		const whole = Math.floor(steps / 8);
		const eighths = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][steps % 8];
		const number = whole ? `${whole}${eighths}` : eighths || '0';
		return `${number} ${t('player.printMarginUnit.in')}`;
	}
	const sideTitle = (side: 'front' | 'back', number: number) =>
		`${t(side === 'front' ? 'player.printFront' : 'player.printBack')} · ${t('player.printPageNumber', { number })}`;
	const percent = (v: number) => `${Math.round(v * 100)}%`;
</script>

<div class="fields" data-testid="print-settings">
	<SettingCollapsible title={t('player.printPaper')} storageKey="print-paper">
		<SettingSelect
			label={t('player.printPageSize')}
			value={print.pageSize}
			options={PAGE_SIZES.map((value) => ({
				value,
				label: t(`player.printPageSize.${value}`),
				description: t(`player.printPageSize.${value}.size`)
			}))}
			defaultValue={PRINT_DEFAULTS.pageSize}
			onChange={(pageSize) => set({ pageSize })}
		/>
		<!-- Under its name on a phone, where the margin and unit don't fit beside it. -->
		<SettingRow
			layout="inline-wide"
			label={t('player.printMargins')}
			onReset={() => set({ margin: PRINT_DEFAULTS.margin })}
			isDefault={Math.abs(print.margin - PRINT_DEFAULTS.margin) < 0.05}
		>
			{#snippet control(labelId)}
				<span class="margin">
					<NumberSelect
						value={marginSteps}
						label={t('player.printMargins')}
						labelledBy={labelId}
						min={0}
						max={maxSteps}
						format={marginText}
						onchange={(steps) => set({ margin: steps * MM_PER_STEP[unit] })}
					/>
					<Select
						label={t('player.printMarginUnit')}
						hideLabel
						value={unit}
						options={MARGIN_UNITS.map((value) => ({
							value,
							label: t(`player.printMarginUnit.${value}`)
						}))}
						onChange={(marginUnit) =>
							// The nearest step of the new unit, so the margin's choice is exact.
							set({
								marginUnit,
								margin: Math.round(print.margin / MM_PER_STEP[marginUnit]) * MM_PER_STEP[marginUnit]
							})}
					/>
				</span>
			{/snippet}
		</SettingRow>
		<SettingToggle
			label={t('player.printFriendly')}
			checked={print.printerFriendly}
			onChange={(printerFriendly) => set({ printerFriendly })}
		/>
		<SettingToggle
			label={t('player.printUnderlines')}
			checked={print.underlines}
			onChange={(underlines) => set({ underlines })}
		/>
	</SettingCollapsible>

	<SettingCollapsible title={sideTitle('front', 1)} storageKey="print-front">
		<SettingToggle
			label={t('player.printLogo')}
			checked={hasLogo && print.front.logo}
			disabled={!hasLogo}
			onChange={(logo) => setFront({ logo })}
		/>
		<SettingToggle
			label={t('player.printNightStrips')}
			checked={print.front.nightStrips}
			onChange={(nightStrips) => setFront({ nightStrips })}
		/>
		<SettingToggle
			label={t('player.jinxes')}
			checked={print.front.jinxes}
			onChange={(jinxes) => setFront({ jinxes })}
		/>
		<SettingToggle
			label={t('player.printRuleCharacters')}
			checked={print.front.ruleCharacters}
			onChange={(ruleCharacters) => setFront({ ruleCharacters })}
		/>
		<SettingToggle
			label={t('player.modeAndRules')}
			checked={hasRules && print.front.rules}
			disabled={!hasRules}
			onChange={(rules) => setFront({ rules })}
		/>
		<SettingSelect
			label={t('player.printColumns')}
			value={print.front.columns}
			options={PRINT_COLUMNS.map((value) => ({ value, label: t(`player.printColumns.${value}`) }))}
			defaultValue={PRINT_DEFAULTS.front.columns}
			onChange={(columns) => setFront({ columns })}
		/>
		<SettingSelect
			label={t('player.printDensity')}
			value={print.front.density}
			options={PRINT_DENSITIES.map((value) => ({
				value,
				label: value === 'auto' ? t('player.printAuto') : t(`player.density.${value}`)
			}))}
			defaultValue={PRINT_DEFAULTS.front.density}
			onChange={(density) => setFront({ density })}
		/>
		<SettingSlider
			label={t('player.printIconSize')}
			value={print.front.iconScale}
			{...PRINT_ICON_SCALE}
			defaultValue={1}
			format={percent}
			onChange={(iconScale) => setFront({ iconScale })}
		/>
	</SettingCollapsible>

	<SettingCollapsible title={sideTitle('back', 2)} storageKey="print-back">
		<SettingToggle
			label={t('player.printBackOn')}
			checked={print.back.enabled}
			onChange={(enabled) => setBack({ enabled })}
		/>
		<!-- Shown greyed out while there is no back, so nothing moves (no reflow). -->
		<SettingToggle
			label={t('player.printNight')}
			checked={print.back.night}
			disabled={!print.back.enabled}
			onChange={(night) => setBack({ night })}
		/>
		<SettingToggle
			label={t('player.printCounts')}
			checked={print.back.counts}
			disabled={!print.back.enabled}
			onChange={(counts) => setBack({ counts })}
		/>
		<SettingToggle
			label={t('player.jinxes')}
			checked={print.back.jinxes}
			disabled={!print.back.enabled}
			onChange={(jinxes) => setBack({ jinxes })}
		/>
		<SettingToggle
			label={t('player.printRuleCharacters')}
			checked={print.back.ruleCharacters}
			disabled={!print.back.enabled}
			onChange={(ruleCharacters) => setBack({ ruleCharacters })}
		/>
		<SettingToggle
			label={t('player.modeAndRules')}
			checked={hasRules && print.back.rules}
			disabled={!print.back.enabled || !hasRules}
			onChange={(rules) => setBack({ rules })}
		/>
		<SettingSlider
			label={t('player.printIconSize')}
			value={print.back.iconScale}
			{...PRINT_ICON_SCALE}
			defaultValue={1}
			format={percent}
			disabled={!print.back.enabled}
			onChange={(iconScale) => setBack({ iconScale })}
		/>
	</SettingCollapsible>
</div>

<style>
	.fields {
		display: grid;
	}
	.margin {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		white-space: nowrap;
	}
	/* The margin and its unit keep their width, so a longer choice never moves them. */
	.margin > :global([data-scope='select'][data-part='root']) {
		flex: none;
		width: calc(6 * var(--u));
	}
</style>
