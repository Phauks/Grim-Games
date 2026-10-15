<script lang="ts">
	import { isSeatable, type Character, type NightMarker } from '#lib/core/data/index.ts';
	import {
		MARKER_TEXT,
		nightOrder,
		withNightInfo,
		type InfoPicker,
		type Night,
		type NightAnswer,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import NightText from '#lib/features/reference/NightText.svelte';
	import type { Assistance } from '#lib/ui/assistance.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { DayGame } from './day-game.svelte.ts';
	import InfoPickerSheet from './InfoPickerSheet.svelte';

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
		return withNightInfo(order.steps, g, game.characters);
	});

	let index = $state(0);
	let done = $state<Record<string, boolean>>({});
	const current = $derived(steps[Math.min(index, steps.length - 1)]);

	function seatsHolding(step: NightStep) {
		return g.seating.filter((s) => g.seats[s].characterId === step.character?.id);
	}

	function stepTitle(step: NightStep): string {
		if (step.kind === 'marker') return MARKER_TEXT[step.id as NightMarker].name;
		return step.title ?? step.character?.name ?? step.id;
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
			case 'number':
				return `Show ${a.value}${who.length ? `: ${who.join(', ')}` : ''}`;
			case 'none':
				return a.reason;
		}
	}

	function flags(a: {
		unreliable?: string;
		mustBeFalse?: boolean;
		misregister: string[];
		seatId: string;
	}) {
		const out: string[] = [];
		if (a.unreliable) out.push(`${game.seatName(a.seatId)} is ${a.unreliable}: give any answer.`);
		if (a.mustBeFalse) out.push('Vortox in play: the answer must be false.');
		if (a.misregister.length) {
			out.push(`Might register falsely: ${a.misregister.map((s) => game.seatName(s)).join(', ')}.`);
		}
		return out;
	}

	// Record what was shown: the Storyteller's override of a worked-out answer.
	let recordOpen = $state(false);
	let recordFor = $state<NightAnswer>();
	let recordText = $state('');
	function openRecord(a: NightAnswer) {
		recordFor = a;
		recordText = a.shown?.text ?? answerText(a);
		recordOpen = true;
	}
	function saveRecord() {
		if (!recordFor) return;
		const ok = game.run({
			type: 'RecordNightInfo',
			seatId: recordFor.seatId,
			characterId: recordFor.characterId,
			text: recordText
		});
		if (ok) recordOpen = false;
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
					character={step.character}
				/>{:else}{step.reminder}{/if}
		</p>{/if}

	{#if step.info?.kind === 'answer' && assistance.nightAnswers}
		{#each step.info.answers as a (a.seatId)}
			<div class="answer" role="group" aria-label={`${game.characterName(a.characterId)} answer`}>
				<p class="answer-main" data-kind={a.kind}>{answerText(a)}</p>
				<!-- Reserved lines: flags and the recorded answer never push anything down. -->
				<p class="answer-sub">{flags(a).join(' ')}</p>
				<p class="answer-sub">{a.shown ? `Recorded: ${a.shown.text}` : ''}</p>
				<Button variant="quiet" onclick={() => openRecord(a)}>Record what you showed</Button>
			</div>
		{/each}
	{:else if step.info?.kind === 'picker'}
		{#each step.info.pickers as p (p.seatId)}
			<div class="answer" role="group" aria-label={`${game.characterName(p.characterId)} info`}>
				<p class="answer-sub">
					{assistance.infoSuggestions ? flags(p).join(' ') : ''}
				</p>
				<p class="answer-sub" data-testid="info-shown">
					{p.shown ? `Recorded: ${p.shown.text}` : ''}
				</p>
				<Button onclick={() => openPicker(p)}>Pick info for {game.seatName(p.seatId)}</Button>
			</div>
		{/each}
	{/if}
{/snippet}

<div class="panel">
	<div class="toolbar">
		<Button icon="back" variant="quiet" onclick={onBack}>Back to day</Button>
		<Segmented
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
		color: var(--on-surface-muted);
	}
	.marker {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--heading);
	}
	.reminder {
		margin: 0;
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
		border: 1px solid var(--on-sheet-muted);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
