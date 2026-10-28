<script lang="ts">
	import {
		DAY_SECONDS_PER_ALIVE,
		DAY_SECONDS_PER_ALIVE_MAX,
		DAY_SECONDS_PER_ALIVE_MIN
	} from '#lib/core/rules/day-timer.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	/**
	 * The day timer's starting time per living player, in seconds (Trevor, 2026-10-19: default
	 * 30). One row for Settings › Storyteller and the timer's own sheet. An untouched timer
	 * follows it at once. A game keeps its own (game-settings.ts): the timer's sheet and Game
	 * settings change only that game (`game`), Settings the default for new games too.
	 */
	let { game = false }: { game?: boolean } = $props();
	const seconds = $derived(gameSettings.current.timerPerPlayer);
	function change(timerPerPlayer: number) {
		if (game) gameSettings.set(gameSettings.gameId, { timerPerPlayer });
		else gameSettings.setDefault({ timerPerPlayer });
	}
</script>

<SettingRow
	label={t('day.timerPerPlayer')}
	onReset={() => change(DAY_SECONDS_PER_ALIVE)}
	isDefault={seconds === DAY_SECONDS_PER_ALIVE}
>
	{#snippet control()}
		<Stepper
			value={seconds}
			label={t('day.timerPerPlayer')}
			lessLabel={t('day.timerPerPlayerLess')}
			moreLabel={t('day.timerPerPlayerMore')}
			min={DAY_SECONDS_PER_ALIVE_MIN}
			max={DAY_SECONDS_PER_ALIVE_MAX}
			typeable
			testid="timer-per-player"
			onchange={change}
		/>
	{/snippet}
</SettingRow>
