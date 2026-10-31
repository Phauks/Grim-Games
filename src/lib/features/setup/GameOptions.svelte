<script lang="ts">
	import { untrack } from 'svelte';
	import { STANDARD } from '#lib/core/modes/index.ts';
	import { optionalRuleChoices } from '#lib/core/rules/index.ts';
	import GameSettingsDialog from '#lib/features/game-settings/GameSettingsDialog.svelte';
	import { seedStartSettings } from '#lib/features/game-settings/start-settings.ts';
	import AddModeDialog from '#lib/features/modes/AddModeDialog.svelte';
	import { findMode } from '#lib/features/modes/custom-modes.svelte.ts';
	import { findRule } from '#lib/features/modes/custom-rules.svelte.ts';
	import { readGameMode } from '#lib/features/modes/game-mode-store.ts';
	import { applyGameRules } from '#lib/features/modes/game-rules.svelte.ts';
	import { notBegun } from '#lib/features/modes/new-game-draft.ts';
	import { choicesOf, type SwitchChoices } from '#lib/features/modes/rule-switches.ts';
	import SpecialRulesDialog from '#lib/features/modes/SpecialRulesDialog.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import type { SetupGamePort } from './game-port.ts';

	/**
	 * The game's own options at the top of Character selection (Trevor, 2026-10-29: "condense
	 * three screens into one"). Special rules and Game settings open over the screen; Game
	 * settings has the settings profile the game starts with while it hasn't begun. Neither is a
	 * start-flow step any more. The rules apply as their sheet closes (game-rules.svelte.ts), and
	 * stay as they are once the game has begun.
	 */
	let { port }: { port: SetupGamePort } = $props();

	const game = $derived(port.game);
	const starting = $derived(game ? notBegun(game) : false);
	const record = $derived(game ? readGameMode(game.gameId) : undefined);
	const mode = $derived(findMode(record?.modeId ?? STANDARD.id) ?? STANDARD);
	// Characters' optional rules, set straight on the game: chosen before it begins.
	const optionalRules = $derived(
		game && port.lookup
			? optionalRuleChoices(game, port.lookup).map((r) => ({
					...r,
					character: port.lookup?.get(r.characterId)
				}))
			: []
	);

	let open = $state(false);
	let rulesOpen = $state(false);
	let adding = $state(false);
	let ruleIds = $state<string[]>([]);
	let choices = $state<SwitchChoices>({});

	$effect(() => {
		const gameId = game && starting ? game.gameId : undefined;
		if (gameId) untrack(() => seedStartSettings(gameId));
	});

	$effect(() => {
		const rules = record?.rules ?? [];
		untrack(() => {
			ruleIds = rules.map((r) => r.id);
			choices = choicesOf(rules, findRule);
		});
	});

	function openRules() {
		rulesOpen = true;
	}
	let wasOpen = false;
	$effect(() => {
		if (rulesOpen) wasOpen = true;
		else if (wasOpen) {
			wasOpen = false;
			untrack(() => void applyGameRules(port, ruleIds, choices));
		}
	});
</script>

<div class="game-options" data-testid="game-options">
	<Button
		variant="field"
		icon="fabled"
		disabled={!game || !starting}
		onclick={openRules}
		data-testid="setup-special-rules"
	>
		{t('modes.specialRules')}
		<CountBadge count={ruleIds.length + optionalRules.filter((r) => r.on).length} />
	</Button>
	<Button variant="field" icon="settings" disabled={!game} onclick={() => (open = true)}>
		{t('setup.gameSettings')}
	</Button>
</div>

{#if game}
	<GameSettingsDialog bind:open gameId={game.gameId} profile={starting} />
	<SpecialRulesDialog
		bind:open={rulesOpen}
		{mode}
		{ruleIds}
		onChange={(ids) => (ruleIds = ids)}
		{choices}
		onSwitch={(c) => (choices = c)}
		onadd={() => (adding = true)}
		{optionalRules}
		onOptionalRule={(characterId, on) =>
			port.dispatch({ type: 'SetOptionalRule', characterId, on })}
	/>
	<AddModeDialog
		bind:open={adding}
		onadded={() => {}}
		onaddedrule={(r) => (ruleIds = [...ruleIds.filter((id) => id !== r.id), r.id])}
	/>
{/if}

<style>
	.game-options {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
</style>
