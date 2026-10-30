<script lang="ts">
	import TimerPerPlayerRow from '#lib/features/day/TimerPerPlayerRow.svelte';
	import { SETUP_LOOKS } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import BagDrawRows from './BagDrawRows.svelte';
	import { gameSettings } from './game-settings.svelte.ts';

	/**
	 * One game's settings (Trevor, 2026-10-28), the same rows in the start flow's Game settings
	 * step and in the board's Game settings: each changes this game only. Settings › Storyteller
	 * holds the same rows as the default for new games. Day and Bag draw are tabs, so the
	 * dialog fits a phone without a long scroll (Trevor, 2026-10-29).
	 */
	let { gameId }: { gameId: string } = $props();

	const values = $derived(gameSettings.of(gameId));
	type Tab = 'day' | 'bag';
	const tabs: { value: Tab; label: string }[] = [
		{ value: 'day', label: t('settings.groupDay') },
		{ value: 'bag', label: t('settings.groupSetup') }
	];
	let tab = $state<Tab>('day');
</script>

<Tabs bind:value={tab} label={t('setup.gameSettings')} {tabs} steady>
	{#snippet panel(shown)}
		<div class="rows">
			{#if shown === 'day'}
				<SettingToggle
					label={ASSIST_LABELS.trackNominations.label}
					description={ASSIST_LABELS.trackNominations.description}
					checked={values.trackNominations}
					onChange={(trackNominations) => gameSettings.set(gameId, { trackNominations })}
				/>
				<TimerPerPlayerRow game />
				<SettingSelect
					label={t('day.setupForPlayers')}
					value={values.setupForPlayers}
					options={SETUP_LOOKS.map((value) => ({
						value,
						label: t(`day.setupForPlayers.${value}`)
					}))}
					defaultValue="candles"
					onChange={(setupForPlayers) => gameSettings.set(gameId, { setupForPlayers })}
				/>
			{:else}
				<BagDrawRows {values} onChange={(change) => gameSettings.set(gameId, change)} />
			{/if}
		</div>
	{/snippet}
</Tabs>

<style>
	.rows {
		display: grid;
	}
</style>
