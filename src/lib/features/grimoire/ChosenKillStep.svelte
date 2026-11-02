<script lang="ts">
	import { SEATED_TYPES, type CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import {
		killChoice,
		liveOrDieChosen,
		namedCharacterKill,
		resolveLiveOrDie,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * A killing step whose choice is not simply a player (`kills.chooses`, core's
	 * `chosen-kills.ts`):
	 *
	 * - `character` (the Ojo, https://wiki.bloodontheclocktower.com/Ojo): the character the
	 *   Demon pointed at on its sheet, then its player, or with none in play, any player the
	 *   Storyteller chooses. Mark dead kills them, the Demon as the cause.
	 * - `live-or-die` (the Al-Hadikhia, https://wiki.bloodontheclocktower.com/Al-Hadikhia): each
	 *   player its reminders mark, in order, with Live or Die as they answer; Apply kills or
	 *   brings back each one, and kills all of them when all live.
	 *
	 * Nothing happens until the Storyteller taps; they may still change anyone on the board.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
	}

	let { grimoire, step }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const character = $derived(step.character);
	const choice = $derived(character ? killChoice(character.id, characters) : undefined);

	// The named character (`character`).
	let named = $state<CharacterId>();
	let pickerOpen = $state(false);
	let anyoneOpen = $state(false);
	const kill = $derived(named ? namedCharacterKill(game, named, characters) : undefined);
	function markDead(seatId: SeatId) {
		if (character) grimoire.run({ type: 'SetDead', seatId, dead: true, cause: character.id });
	}

	// Each chosen player's answer (`live-or-die`).
	type Answer = 'live' | 'die';
	let answers = $state<Record<SeatId, Answer | undefined>>({});
	const chosen = $derived(
		character && choice === 'live-or-die' ? liveOrDieChosen(game, character.id, characters) : []
	);
	const answered = $derived(chosen.every((id) => answers[id] !== undefined));
	const outcome = $derived(
		chosen.length > 0 && answered
			? resolveLiveOrDie(
					game,
					chosen.map((seatId) => ({ seatId, lives: answers[seatId] === 'live' }))
				)
			: undefined
	);
	const changes = $derived(outcome?.results.some((r) => r.died || r.revived) ?? false);
	function apply() {
		if (!character || !outcome) return;
		for (const r of outcome.results) {
			const wasDead = !!game.seats[r.seatId].dead;
			// Brought back first, so one who then dies with the others dies again tonight.
			if (wasDead && (r.revived || r.died))
				grimoire.run({ type: 'SetDead', seatId: r.seatId, dead: false });
			if (r.died)
				grimoire.run({ type: 'SetDead', seatId: r.seatId, dead: true, cause: character.id });
		}
		answers = {};
	}
	function result(seatId: SeatId): string {
		const r = outcome?.results.find((x) => x.seatId === seatId);
		if (!r) return '';
		if (r.died) return 'Dies';
		if (r.revived) return 'Lives again';
		return r.dead ? 'Stays dead' : 'Lives';
	}
</script>

{#if character && choice === 'character'}
	<h3>Named character</h3>
	<div class="row" data-testid="named-kill">
		{#if named}
			<CharacterBadge characterId={named} character={characters.get(named)} />
		{:else}
			<span class="none">None</span>
		{/if}
		<Button variant="quiet" onclick={() => (pickerOpen = true)}>Choose</Button>
	</div>
	{#if kill}
		<ul class="rows">
			{#if kill.storytellerChooses}
				<li>
					<span class="none">Not in play: you choose who dies</span>
					<Button variant="quiet" onclick={() => (anyoneOpen = true)}>Choose</Button>
				</li>
			{:else}
				{#each kill.seats as seatId (seatId)}
					<li>
						<PlayerBadge name={seatName(game, seatId)} />
						<Button
							variant="quiet"
							disabled={!!game.seats[seatId].dead}
							onclick={() => markDead(seatId)}>Mark dead</Button
						>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
	<CharacterPicker
		bind:open={pickerOpen}
		title="Named character"
		{characters}
		script={game.script}
		types={[...SEATED_TYPES, 'traveller']}
		current={named}
		onPick={(id) => {
			named = id;
			pickerOpen = false;
		}}
	/>
	<SeatChooser
		bind:open={anyoneOpen}
		title="Dies"
		{game}
		{characters}
		onChoose={(seatId) => {
			anyoneOpen = false;
			markDead(seatId);
		}}
	/>
{/if}

{#if character && choice === 'live-or-die'}
	<h3>Live or die</h3>
	<ul class="rows" data-testid="live-or-die">
		{#each chosen as seatId (seatId)}
			{@const name = seatName(game, seatId)}
			<li>
				<PlayerBadge {name} />
				<Select
					label="Live or die"
					hideLabel
					placeholder="Choice"
					attention={answers[seatId] === undefined}
					value={answers[seatId]}
					options={[
						{ value: 'live', label: 'Live' },
						{ value: 'die', label: 'Die' }
					]}
					onChange={(v: Answer) => (answers = { ...answers, [seatId]: v })}
					onClear={() => (answers = { ...answers, [seatId]: undefined })}
				/>
				<span class="result">{result(seatId)}</span>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<Button variant="quiet" disabled={!changes} onclick={apply}>Apply</Button>
{/if}

<style>
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	.row,
	.rows li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.row {
		margin-bottom: var(--space-2);
	}
	.rows {
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.rows li {
		padding-block: var(--space-1);
	}
	.rows li + li {
		border-top: var(--card-border);
	}
	.none,
	.result {
		color: var(--on-surface-muted);
	}
	.none {
		flex: 1;
	}
</style>
