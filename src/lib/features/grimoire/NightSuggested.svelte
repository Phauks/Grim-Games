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

	function source(i: Impairment): string {
		const c = characters.get(i.source.characterId)?.name ?? i.source.characterId;
		return i.source.seatId ? `${name(i.source.seatId)} (${c})` : c;
	}
	/** "poisoned · Ben (Poisoner)"; the Preacher's reminder is "No Ability" (TPI). */
	const impairments = (list: readonly Impairment[]) =>
		list
			.map((i) => `${i.reason === 'no-ability' ? 'No Ability' : i.reason} · ${source(i)}`)
			.join('; ');

	function valueText(v: AnswerValue): string {
		switch (v.kind) {
			case 'yes-no':
				return v.value ? 'Yes' : 'No';
			case 'character':
				return characters.get(v.value)?.name ?? v.value;
			case 'number':
				return String(v.value);
			case 'none':
				return v.reason;
		}
	}

	/** Why an answer may not be the truth: impaired, the Vortox, registration. */
	function flags(r: Reliability & { possible?: AnswerValue[] }): string[] {
		const out: string[] = [];
		if (r.unreliable) out.push(`Not reliable: ${impairments(r.impairments)}`);
		if (r.mustBeFalse) out.push('Vortox: must be false');
		if (r.misregister.length > 0) out.push(`Might register falsely: ${names(r.misregister)}`);
		if (r.possible && r.possible.length > 1)
			out.push(`Allowed: ${r.possible.map(valueText).join(' / ')}`);
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

	/** The strip's one line: the first answer or range. */
	const line = $derived.by(() => {
		if (!info || !has) return '';
		if (info.kind === 'answer') {
			const a = info.answers[0];
			return `${valueText(a)}${a.unreliable ? ' (not reliable)' : ''}`;
		}
		if (info.kind === 'picker') {
			const p = info.pickers[0];
			const r = rangeText(p);
			if (r) return r;
			const o = p.options[0];
			return o
				? `${o.characterId ? `${characters.get(o.characterId)?.name ?? o.characterId}: ` : ''}${names(o.seats)}`
				: '';
		}
		const v = info.checks.find((c) => c.verdict && c.verdict.kind !== 'choose')?.verdict;
		if (v?.kind === 'dies') return `Dead: ${names(v.seatIds)}`;
		if (v?.kind === 'ask') return `Dead? ${names(v.ifYes)}`;
		return v?.kind === 'no-death' ? 'No death' : '';
	});
</script>

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
		{#each flags(a) as flag (flag)}
			<span class="flag" class:warn={a.unreliable || a.mustBeFalse}>
				{#if a.unreliable}<Icon name="warning" />{/if}{flag}
			</span>
		{/each}
		{#if a.kind === 'character' && onShow}
			{@const id = a.value}
			<Button variant="quiet" onclick={() => onShow(id)}>Show to player</Button>
		{/if}
	</li>
{/snippet}

{#if compact}
	{#if has}<span class="compact" data-testid="night-suggested">Suggested: {line}</span>{/if}
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
						{#each flags(p) as flag (flag)}
							<span class="flag" class:warn={p.unreliable || p.mustBeFalse}>
								{#if p.unreliable}<Icon name="warning" />{/if}{flag}
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
