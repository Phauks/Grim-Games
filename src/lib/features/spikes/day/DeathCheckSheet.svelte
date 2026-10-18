<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { deathVerdict, type DeathCheck, type DeathVerdict } from '#lib/core/rules/index.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { DayGame } from './day-game.svelte.ts';
	import { verdictText } from './night-values.ts';

	/**
	 * Who dies from a night ability that needs the waking player's choice (Gambler, Acrobat,
	 * Lycanthrope): the Storyteller taps what they chose, the app works out the death, and
	 * the Storyteller records it. Nothing is marked dead without their tap.
	 */
	interface Props {
		open?: boolean;
		game: DayGame;
		check?: DeathCheck;
	}

	let { open = $bindable(false), game, check }: Props = $props();

	let seatId = $state<SeatId | undefined>();
	let characterId = $state<CharacterId | undefined>();

	$effect(() => {
		if (!open) return;
		seatId = undefined;
		characterId = undefined;
	});

	const g = $derived(game.game);
	const characterChoices = $derived(
		g.script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id))
	);
	const verdict = $derived<DeathVerdict | undefined>(
		check
			? deathVerdict(g, check.seatId, check.characterId, { seatId, characterId }, game.characters)
			: undefined
	);
	const names = (seats: SeatId[]) => seats.map((s) => game.seatName(s)).join(', ');

	function record(dies: SeatId[]) {
		if (!check || !verdict || verdict.kind === 'choose') return;
		const chose = [
			seatId ? game.seatName(seatId) : '',
			characterId ? game.characterName(characterId) : ''
		]
			.filter(Boolean)
			.join(' · ');
		const outcome = dies.length ? `Dead: ${names(dies)}` : '—';
		const ok = game.run({
			type: 'RecordNightInfo',
			seatId: check.seatId,
			characterId: check.characterId,
			text: `${chose} · ${outcome}`,
			...(verdict.kind === 'no-death' && verdict.abnormal ? { abnormal: verdict.abnormal } : {})
		});
		if (!ok) return;
		for (const s of dies) {
			if (!g.seats[s].dead)
				game.run({ type: 'SetDead', seatId: s, dead: true, cause: check.characterId });
		}
		open = false;
	}
</script>

<BottomSheet
	bind:open
	title={check
		? `${game.characterName(check.characterId)} · ${game.seatName(check.seatId)}`
		: 'Choice'}
	description={check?.needs === 'player-character'
		? 'Tap a player and a character.'
		: 'Tap a player.'}
	height="85dvh"
>
	{#if check}
		<div class="picker">
			<div class="grid" role="group" aria-label="Players">
				{#each g.seating as s (s)}
					<button
						type="button"
						class="option"
						aria-pressed={seatId === s}
						onclick={() => (seatId = s)}
					>
						{game.seatName(s)}
					</button>
				{/each}
			</div>
			{#if check.needs === 'player-character'}
				<div class="grid" role="group" aria-label="Characters">
					{#each characterChoices as id (id)}
						<button
							type="button"
							class="option"
							aria-pressed={characterId === id}
							onclick={() => (characterId = id)}
						>
							{game.characterName(id)}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Reserved line: the verdict appears without moving the buttons. -->
			<p class="verdict" aria-live="polite" data-testid="death-verdict">
				{verdictText(game, verdict)}
			</p>

			<div class="actions">
				<Button variant="quiet" onclick={() => (open = false)}>Cancel</Button>
				{#if verdict?.kind === 'ask'}
					<Button variant="quiet" onclick={() => record([])}>Record —</Button>
					{#if verdict.ifYes.length}
						<Button onclick={() => record(verdict.ifYes)}>Dead: {names(verdict.ifYes)}</Button>
					{/if}
				{:else if verdict?.kind === 'dies'}
					<Button onclick={() => record(verdict.seatIds)}>Dead: {names(verdict.seatIds)}</Button>
				{:else}
					<Button disabled={verdict?.kind !== 'no-death'} onclick={() => record([])}>Record</Button>
				{/if}
			</div>
		</div>
	{/if}
</BottomSheet>

<style>
	.picker {
		display: grid;
		gap: var(--space-4);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(6.5 * var(--u)), 1fr));
		gap: var(--space-2);
	}
	.option {
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--on-surface-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.option[aria-pressed='true'] {
		background: var(--sheet-color, var(--on-surface));
		color: var(--sheet-background, var(--sheet));
	}
	.verdict {
		min-height: 3em;
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
