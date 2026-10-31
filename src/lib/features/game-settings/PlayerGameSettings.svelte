<script lang="ts">
	import type { PublicGameSettings } from '#lib/core/sync/public-game-settings.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	/**
	 * The game's settings on a player's screen (Trevor, 2026-10-30: "setup on players phones
	 * should show the different options in the game setting menu so users understand"): the
	 * Storyteller's Game settings that players meet, read only, each with what it means for
	 * them. On the Your character row, on /play and the Storyteller's player view alike; with
	 * nothing from the board (no game in play, or a board from before this) it is disabled.
	 */
	let { settings = {} }: { settings?: PublicGameSettings } = $props();
	let open = $state(false);

	const onOff = (on: boolean) => t(on ? 'setup.gameSettings.on' : 'setup.gameSettings.off');
	interface Row {
		key: keyof PublicGameSettings;
		label: string;
		description: string;
		value?: string;
	}
	const day = $derived<Row[]>([
		{
			key: 'trackNominations',
			label: ASSIST_LABELS.trackNominations.label,
			description: t('setup.gameSettings.nominationsHelp'),
			value: settings.trackNominations === undefined ? undefined : onOff(settings.trackNominations)
		},
		{
			key: 'timerPerPlayer',
			label: t('day.timerPerPlayer'),
			description: t('setup.gameSettings.timerHelp'),
			value: settings.timerPerPlayer === undefined ? undefined : String(settings.timerPerPlayer)
		}
	]);
	const hasDay = $derived(day.some((r) => r.value !== undefined));
	const bag = $derived<Row[]>(
		(['requireName', 'holdToReveal', 'slotMachine'] as const).map((key) => ({
			key,
			label: t(`settings.${key}`),
			description: t(`settings.${key}Help`),
			value: settings[key] === undefined ? undefined : onOff(settings[key])
		}))
	);
	const hasBag = $derived(bag.some((r) => r.value !== undefined));
</script>

<Button
	aria-haspopup="dialog"
	data-testid="player-game-settings"
	disabled={!hasDay && !hasBag}
	onclick={() => (open = true)}>{t('setup.gameSettings')}</Button
>

{#snippet rows(list: Row[])}
	{#each list as row (row.key)}
		{#if row.value !== undefined}
			<SettingRow label={row.label} description={row.description}>
				{#snippet control(labelId)}
					<span class="value" aria-labelledby={labelId} data-field={row.key}>{row.value}</span>
				{/snippet}
			</SettingRow>
		{/if}
	{/each}
{/snippet}

<Dialog bind:open title={t('setup.gameSettings')}>
	<div class="rows" data-testid="player-game-settings-list">
		{#if hasDay}
			<SettingHeading title={t('settings.groupDay')} first />
			{@render rows(day)}
		{/if}
		{#if hasBag}
			<SettingHeading title={t('settings.groupSetup')} first={!hasDay} />
			{@render rows(bag)}
		{/if}
	</div>
</Dialog>

<style>
	.rows {
		display: grid;
	}
	.value {
		color: var(--heading);
		white-space: nowrap;
	}
</style>
