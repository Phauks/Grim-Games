<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type {
		AnswerValue,
		Impairment,
		InfoPicker,
		NightAnswer,
		NightStep,
		Reliability
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * What the game says for a night step (Trevor, 2026-10-16), from core's `withNightInfo`:
	 * the answer the grimoire gives (the Undertaker's executed character), the truthful
	 * options for an info picker, or who dies. Suggestions only: nothing is applied, and an
	 * answer the player's ability can't be trusted for is marked. Values and names only, no
	 * new rules wording.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep;
		/** One line, for the walk-through strip. */
		compact?: boolean;
		/** Show a character to the player. */
		onShow?: (characterId: CharacterId) => void;
	}

	let { grimoire, step, compact = false, onShow }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const assistance = $derived(preferences.current.assistance);
	const info = $derived(step.info);
	const name = (seatId: SeatId) => seatName(game, seatId);
	const names = (seats: readonly SeatId[]) => seats.map(name).join(', ');

	/** "poisoned", or the Preacher's reminder "No Ability" (TPI). */
	const reason = (i: Impairment) => (i.reason === 'no-ability' ? 'No Ability' : i.reason);

	function valueText(v: AnswerValue): string {
		switch (v.kind) {
			case 'yes-no':
				return v.value ? 'Yes' : 'No';
			case 'character':
				// Drawn as a badge (the value snippet); only its id here.
				return v.value;
			case 'number':
				return String(v.value);
			case 'none':
				return v.reason;
		}
	}

	/**
	 * Why an answer may not be the truth: impaired, the Vortox, registration. Impairments and
	 * allowed values are drawn after the text, so their characters show as badges.
	 */
	interface Flag {
		text: string;
		impairments?: readonly Impairment[];
		allowed?: readonly AnswerValue[];
	}
	function flags(r: Reliability & { possible?: AnswerValue[] }): Flag[] {
		const out: Flag[] = [];
		if (r.unreliable) out.push({ text: 'Not reliable:', impairments: r.impairments });
		if (r.mustBeFalse) out.push({ text: 'Vortox: must be false' });
		if (r.misregister.length > 0)
			out.push({ text: `Might register falsely: ${names(r.misregister)}` });
		if (r.possible && r.possible.length > 1) out.push({ text: 'Allowed:', allowed: r.possible });
		return out;
	}

	function rangeText(p: InfoPicker): string {
		if (!p.range) return '';
		return p.range.possible.length > 1
			? `${p.range.truth} (${p.range.possible.join(' / ')})`
			: String(p.range.truth);
	}

	const showAnswers = $derived(assistance.nightAnswers);
	const showPickers = $derived(assistance.infoSuggestions);
	const has = $derived(
		(info?.kind === 'answer' && showAnswers && info.answers.length > 0) ||
			(info?.kind === 'picker' && showPickers && info.pickers.length > 0) ||
			(info?.kind === 'death' &&
				showAnswers &&
				info.checks.some((c) => c.verdict && c.verdict.kind !== 'choose'))
	);

	/** The strip's one line: the first answer or range; a character shows as a badge first. */
	const line = $derived.by((): { characterId?: CharacterId; text: string } => {
		if (!info || !has) return { text: '' };
		if (info.kind === 'answer') {
			const a = info.answers[0];
			const note = a.unreliable ? ' (not reliable)' : '';
			return a.kind === 'character'
				? { characterId: a.value, text: note }
				: { text: `${valueText(a)}${note}` };
		}
		if (info.kind === 'picker') {
			const p = info.pickers[0];
			const r = rangeText(p);
			if (r) return { text: r };
			const o = p.options[0];
			if (!o) return { text: '' };
			return o.characterId
				? { characterId: o.characterId, text: `: ${names(o.seats)}` }
				: { text: names(o.seats) };
		}
		const v = info.checks.find((c) => c.verdict && c.verdict.kind !== 'choose')?.verdict;
		if (v?.kind === 'dies') return { text: `Dead: ${names(v.seatIds)}` };
		if (v?.kind === 'ask') return { text: `Dead? ${names(v.ifYes)}` };
		return { text: v?.kind === 'no-death' ? 'No death' : '' };
	});
</script>

{#snippet value(v: AnswerValue)}{#if v.kind === 'character'}<CharacterBadge
			characterId={v.value}
			character={characters.get(v.value)}
			inline
		/>{:else}{valueText(v)}{/if}{/snippet}

{#snippet flagBody(flag: Flag)}{flag.text}{#each flag.impairments ?? [] as i, n (n)}{n
			? '; '
			: ' '}{reason(i)} · {#if i.source.seatId}{name(i.source.seatId)} (<CharacterBadge
				characterId={i.source.characterId}
				character={characters.get(i.source.characterId)}
				inline
			/>){:else}<CharacterBadge
				characterId={i.source.characterId}
				character={characters.get(i.source.characterId)}
				inline
			/>{/if}{/each}{#each flag.allowed ?? [] as v, n (n)}{n ? ' / ' : ' '}{@render value(
			v
		)}{/each}{/snippet}

{#snippet answer(a: NightAnswer)}
	<li data-unreliable={a.unreliable ? '' : undefined}>
		<span class="main">
			{#if info && info.kind === 'answer' && info.answers.length > 1}<span class="whose"
					>{name(a.seatId)}:</span
				>{/if}
			{#if a.kind === 'character'}
				<CharacterBadge characterId={a.value} character={characters.get(a.value)} inline />
			{:else}
				<strong>{valueText(a)}</strong>
			{/if}
			{#if a.because.length > 0}<span class="because">({names(a.because)})</span>{/if}
		</span>
		{#each flags(a) as flag (flag.text)}
			<span class="flag" class:warn={a.unreliable || a.mustBeFalse}>
				{#if a.unreliable}<Icon name="warning" />{/if}{@render flagBody(flag)}
			</span>
		{/each}
		{#if a.kind === 'character' && onShow}
			{@const id = a.value}
			<Button variant="quiet" onclick={() => onShow(id)}>Show to player</Button>
		{/if}
	</li>
{/snippet}

{#if compact}
	{#if has}<span class="compact" data-testid="night-suggested"
			>Suggested: {#if line.characterId}<CharacterBadge
					characterId={line.characterId}
					character={characters.get(line.characterId)}
					inline
					interactive={false}
				/>{/if}{line.text}</span
		>{/if}
{:else if has && info}
	<section class="suggested" aria-label="Suggested" data-testid="night-suggested">
		<h3>Suggested</h3>
		<ul>
			{#if info.kind === 'answer'}
				{#each info.answers as a (a.seatId)}{@render answer(a)}{/each}
			{:else if info.kind === 'picker'}
				{#each info.pickers as p (p.seatId)}
					<li data-unreliable={p.unreliable ? '' : undefined}>
						{#if info.pickers.length > 1}<span class="whose">{name(p.seatId)}:</span>{/if}
						{#if p.range}
							<span class="main"><strong>{rangeText(p)}</strong></span>
						{:else}
							{#each p.options.slice(0, 6) as o, i (i)}
								<span class="main option">
									{#if o.characterId}<CharacterBadge
											characterId={o.characterId}
											character={characters.get(o.characterId)}
											inline
										/>{/if}
									{#if o.none}<strong>None</strong>{:else if o.yes !== undefined}<strong
											>{o.yes ? 'Yes' : 'No'}</strong
										>{/if}
									{names(o.seats)}
								</span>
							{/each}
						{/if}
						{#each flags(p) as flag (flag.text)}
							<span class="flag" class:warn={p.unreliable || p.mustBeFalse}>
								{#if p.unreliable}<Icon name="warning" />{/if}{@render flagBody(flag)}
							</span>
						{/each}
					</li>
				{/each}
			{:else}
				{#each info.checks as c (c.seatId)}
					{@const v = c.verdict}
					{#if v && v.kind !== 'choose'}
						<li>
							<span class="main"
								><strong
									>{v.kind === 'dies'
										? `Dead: ${names(v.seatIds)}`
										: v.kind === 'ask'
											? `Dead? ${names(v.ifYes)}`
											: 'No death'}</strong
								></span
							>
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</section>
{/if}

<style>
	.suggested {
		margin: var(--space-2) 0;
		padding: var(--space-2);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		color: var(--on-surface-muted);
	}
	ul {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.main {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.whose,
	.because {
		color: var(--on-surface-muted);
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		--icon-size: 1em;
	}
	.flag.warn {
		color: var(--evil);
	}
	/* An answer that may not be the truth is greyed, its warning in red. */
	li[data-unreliable] .main {
		opacity: 0.6;
	}
	.compact {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
	}
</style>
