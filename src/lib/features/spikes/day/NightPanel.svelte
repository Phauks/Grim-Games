<script lang="ts">
	import { isSeatable, type Character, type NightMarker } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import {
		MARKER_TEXT,
		answerCauses,
		nightOrder,
		withNightInfo,
		type AbilityState,
		type AnswerValue,
		type DeathCheck,
		type InfoPicker,
		type Night,
		type NightAnswer,
		type NightStep,
		type Reliability
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import NightText from '#lib/features/reference/NightText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import type { DayGame } from './day-game.svelte.ts';
	import DeathCheckSheet from './DeathCheckSheet.svelte';
	import InfoPickerSheet from './InfoPickerSheet.svelte';
	import {
		abnormalText,
		impairmentValues,
		possibleText,
		valueText,
		verdictText
	} from './night-values.ts';

	interface Props {
		game: DayGame;
		assistance: Assistance;
		night: Night;
		onNight: (night: Night) => void;
		onBack: () => void;
	}

	let { game, assistance, night, onNight, onBack }: Props = $props();

	const g = $derived(game.game);

	const steps = $derived.by((): NightStep[] => {
		// The night order wakes players by the token they hold (a Drunk wakes as their Townsfolk).
		const inPlay: Character[] = [];
		for (const id of [...g.seating.map((s) => g.seats[s].characterId), ...g.ruleCharacters]) {
			const c = id ? game.characters.get(id) : undefined;
			if (c) inPlay.push(c);
		}
		const players = inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length;
		const order = nightOrder({
			night,
			sheet: game.data.nightSheet,
			inPlay,
			players,
			overrides: g.nightOrderOverrides
		});
		return withNightInfo(order.steps, g, game.characters, night);
	});

	let index = $state(0);
	let done = $state<Record<string, boolean>>({});
	const current = $derived(steps[Math.min(index, steps.length - 1)]);

	function seatsHolding(step: NightStep) {
		return g.seating.filter((s) => g.seats[s].characterId === step.character?.id);
	}

	function stepTitle(step: NightStep): string {
		if (step.kind === 'marker') return MARKER_TEXT[step.id as NightMarker].name;
		if (step.gained) {
			return `${step.character?.name} · ${game.characterName(step.gained.characterId)}`;
		}
		return step.title ?? step.character?.name ?? step.id;
	}

	/** "Ana · poisoned · Ben (Poisoner)": a waking player whose ability does not work. */
	function impairedLine(a: AbilityState): string {
		return `${game.seatName(a.seatId)} · ${impairmentValues(game, a.impairments)}`;
	}

	function answerText(a: NightAnswer): string {
		const who = a.because.map(
			(s) => `${game.seatName(s)} (${game.characterName(g.seats[s].characterId)})`
		);
		switch (a.kind) {
			case 'yes-no':
				if (a.characterId === 'towncrier') {
					return a.value ? `Yes: ${who.join(', ')} nominated` : 'No: no Minion nominated';
				}
				if (a.characterId === 'flowergirl') {
					return a.value ? `Yes: the Demon ${who.join(', ')} voted` : 'No: the Demon did not vote';
				}
				return a.value ? 'Yes' : 'No';
			case 'character':
				return `Show the ${game.characterName(a.value)}: ${who.join(', ')} died by execution`;
			case 'characters':
				return valueText(game, a);
			case 'number':
				if (a.abnormal) {
					const list = a.abnormal.map(
						(u) => `${game.seatName(u.seatId)} (${game.characterName(u.characterId)})`
					);
					return `Show ${a.value}${list.length ? `: ${list.join(', ')}` : ''}`;
				}
				return `Show ${a.value}${who.length ? `: ${who.join(', ')}` : ''}`;
			case 'none':
				return a.reason;
		}
	}

	function flags(a: Reliability & { seatId: string; possible?: AnswerValue[] }) {
		const out: string[] = [];
		if (a.unreliable) {
			out.push(
				`${game.seatName(a.seatId)} · ${impairmentValues(game, a.impairments)}: give any answer.`
			);
		}
		if (a.mustBeFalse) out.push('Vortox in play: the answer must be false.');
		if (a.misregister.length) {
			out.push(`Might register falsely: ${a.misregister.map((s) => game.seatName(s)).join(', ')}.`);
		}
		if (a.possible) out.push(possibleText(game, a.possible));
		return out;
	}

	/** For a number picker: "1 (1 / 2)", the true number and every number registration allows. */
	function rangeText(p: InfoPicker): string {
		if (!p.range) return '';
		return p.range.possible.length > 1
			? `${p.range.truth} (${p.range.possible.join(' / ')})`
			: String(p.range.truth);
	}

	// Record what was shown: the Storyteller's override of a worked-out answer.
	let recordOpen = $state(false);
	let recordFor = $state<NightAnswer>();
	let recordText = $state('');
	let recordAbnormal = $state(false);
	function openRecord(a: NightAnswer) {
		recordFor = a;
		recordText = a.shown?.text ?? answerText(a);
		recordAbnormal = false;
		recordOpen = true;
	}
	function saveRecord() {
		if (!recordFor) return;
		const causes = answerCauses(recordFor);
		const ok = game.run({
			type: 'RecordNightInfo',
			seatId: recordFor.seatId,
			characterId: recordFor.characterId,
			text: recordText,
			...(recordAbnormal
				? { abnormal: causes.length ? causes : [{ reason: 'other' as const }] }
				: {})
		});
		if (ok) recordOpen = false;
	}

	let deathOpen = $state(false);
	let deathFor = $state<DeathCheck>();
	function openDeath(check: DeathCheck) {
		deathFor = check;
		deathOpen = true;
	}
	function markDead(check: DeathCheck, seats: SeatId[]) {
		for (const s of seats) {
			if (!g.seats[s].dead) {
				game.run({ type: 'SetDead', seatId: s, dead: true, cause: check.characterId });
			}
		}
	}

	let pickerOpen = $state(false);
	let picker = $state<InfoPicker>();
	function openPicker(p: InfoPicker) {
		picker = p;
		pickerOpen = true;
	}
</script>

{#snippet stepBody(step: NightStep)}
	<div class="step-head">
		{#if step.character}
			<CharacterBadge characterId={step.character.id} />
			<span class="players"
				>{seatsHolding(step)
					.map((s) => game.seatName(s))
					.join(', ')}</span
			>
		{:else}
			<strong class="marker">{stepTitle(step)}</strong>
		{/if}
	</div>
	{#if step.reminder}<p class="reminder">
			{#if step.character}<NightText
					text={step.reminder}
					character={step.gained
						? (game.characters.get(step.gained.characterId) ?? step.character)
						: step.character}
					{night}
				/>{:else}{step.reminder}{/if}
		</p>{/if}
	{#if step.gained}
		<!-- The Pixie's reminder tokens (TPI): Mad until the Storyteller places Has Ability. -->
		<p class="answer-sub" data-testid="step-gained">
			{step.gained.status === 'if-mad' ? 'Mad → Has Ability' : 'Has Ability'}
		</p>
	{/if}
	{#each step.impaired ?? [] as a (a.seatId)}
		<p class="answer-sub" data-testid="step-impaired">{impairedLine(a)}</p>
	{/each}

	{#if step.info?.kind === 'answer' && assistance.nightAnswers}
		{#each step.info.answers as a (a.seatId)}
			<div class="answer" role="group" aria-label={`${game.characterName(a.characterId)} answer`}>
				<p class="answer-main" data-kind={a.kind}>{answerText(a)}</p>
				<!-- Reserved lines: flags and the recorded answer never push anything down. -->
				<p class="answer-sub">{a.abnormal ? abnormalText(game, a) : flags(a).join(' ')}</p>
				<p class="answer-sub">{a.shown ? `Recorded: ${a.shown.text}` : ''}</p>
				<Button variant="quiet" onclick={() => openRecord(a)}>Record what you showed</Button>
			</div>
		{/each}
	{:else if step.info?.kind === 'picker'}
		{#each step.info.pickers as p (p.seatId)}
			<div class="answer" role="group" aria-label={`${game.characterName(p.characterId)} info`}>
				<p class="answer-sub" data-testid="info-range">
					{assistance.infoSuggestions ? rangeText(p) : ''}
				</p>
				<p class="answer-sub">
					{assistance.infoSuggestions ? flags(p).join(' ') : ''}
				</p>
				<p class="answer-sub" data-testid="info-shown">
					{p.shown ? `Recorded: ${p.shown.text}` : ''}
				</p>
				<Button onclick={() => openPicker(p)}>Pick info for {game.seatName(p.seatId)}</Button>
			</div>
		{/each}
	{:else if step.info?.kind === 'death' && assistance.nightAnswers}
		{#each step.info.checks as c (c.seatId)}
			<div class="answer" role="group" aria-label={`${game.characterName(c.characterId)} death`}>
				{#if c.verdict}
					<p class="answer-main" data-testid="death-verdict">{verdictText(game, c.verdict)}</p>
					{#if c.verdict.kind === 'dies' || (c.verdict.kind === 'ask' && c.verdict.ifYes.length)}
						{@const seats = c.verdict.kind === 'dies' ? c.verdict.seatIds : c.verdict.ifYes}
						<Button
							disabled={seats.every((s) => g.seats[s].dead)}
							onclick={() => markDead(c, seats)}
						>
							Mark {seats.map((s) => game.seatName(s)).join(', ')} dead
						</Button>
					{/if}
				{:else}
					<Button onclick={() => openDeath(c)}>Pick for {game.seatName(c.seatId)}</Button>
				{/if}
			</div>
		{/each}
	{/if}
{/snippet}

<div class="panel">
	<div class="toolbar">
		<Button icon="back" variant="quiet" onclick={onBack}>Back to day</Button>
		<Select
			label="Which night"
			hideLabel
			value={night}
			options={[
				{ value: 'first', label: 'First' },
				{ value: 'other', label: 'Others' }
			]}
			onChange={(value) => {
				index = 0;
				onNight(value);
			}}
		/>
	</div>

	{#if assistance.nightWalkthrough}
		<!-- Controls above the card, so a taller step never moves them. -->
		<div class="walk" data-testid="night-walkthrough">
			<Button icon="back" variant="quiet" disabled={index === 0} onclick={() => index--}>
				Back
			</Button>
			<span class="count">Step {index + 1} of {steps.length}</span>
			<Button icon="forward" disabled={index >= steps.length - 1} onclick={() => index++}>
				Next
			</Button>
		</div>
		{#if current}
			<article class="card" aria-label={`Night step: ${stepTitle(current)}`} data-step={current.id}>
				{@render stepBody(current)}
			</article>
		{/if}
	{:else}
		<ol class="checklist" data-testid="night-checklist">
			{#each steps as step (step.id)}
				<li class="card" data-step={step.id} data-done={done[step.id] === true}>
					<label class="check">
						<input
							type="checkbox"
							aria-label={`Done: ${stepTitle(step)}`}
							bind:checked={done[step.id]}
						/>
					</label>
					<div class="check-body">{@render stepBody(step)}</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<InfoPickerSheet bind:open={pickerOpen} {game} {picker} suggestions={assistance.infoSuggestions} />
<DeathCheckSheet bind:open={deathOpen} {game} check={deathFor} />

<BottomSheet
	bind:open={recordOpen}
	title={recordFor
		? `What you showed: ${game.characterName(recordFor.characterId)}`
		: 'What you showed'}
	description="This replaces the worked-out answer for tonight."
>
	<form
		class="record"
		onsubmit={(event) => {
			event.preventDefault();
			saveRecord();
		}}
	>
		<textarea bind:value={recordText} rows="3" aria-label="What you showed"></textarea>
		<label class="abnormal">
			<input type="checkbox" bind:checked={recordAbnormal} />
			Abnormal
		</label>
		<div class="actions">
			<Button variant="quiet" onclick={() => (recordOpen = false)}>Cancel</Button>
			<Button type="submit">Record</Button>
		</div>
	</form>
</BottomSheet>

<style>
	.panel {
		display: grid;
		gap: var(--space-4);
	}
	.toolbar,
	.walk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.count {
		color: var(--on-surface-muted);
	}
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--card-background, var(--surface-raised));
	}
	.step-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.players {
		font-family: var(--font-player);
		color: var(--on-surface-muted);
	}
	.marker {
		font-family: var(--font-character);
		font-size: 1.1rem;
		color: var(--heading);
	}
	.reminder {
		margin: 0;
		font-family: var(--font-ability);
	}
	.answer {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--heading);
	}
	.answer-main {
		margin: 0;
		min-height: 1.5em;
		font-weight: 700;
	}
	.answer-sub {
		margin: 0;
		min-height: 1.4em;
		color: var(--on-surface-muted);
	}
	.checklist {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.checklist .card {
		grid-template-columns: auto 1fr;
		align-items: start;
	}
	.checklist .card[data-done='true'] .check-body {
		opacity: 0.55;
	}
	.check {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
	}
	.check input {
		width: calc(1.4 * var(--u));
		height: calc(1.4 * var(--u));
	}
	.check-body {
		display: grid;
		gap: var(--space-2);
	}
	.record {
		display: grid;
		gap: var(--space-3);
	}
	textarea {
		width: 100%;
		padding: var(--space-3);
		border: 1px solid var(--on-surface-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.abnormal {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.abnormal input {
		width: calc(1.4 * var(--u));
		height: calc(1.4 * var(--u));
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
