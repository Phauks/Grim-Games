<script lang="ts">
	import type { Character, CharacterId, GameData } from '#lib/core/data/index.ts';
	import type { NightPlace } from '#lib/core/data/parts/night-order.ts';
	import type { Band } from '#lib/core/night-placement/index.ts';
	import { nightStages, suggestedNightPlace, type Night } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import StepPiece from '#lib/features/grimoire/StepPiece.svelte';
	import type { NamedStep } from '#lib/features/grimoire/night-steps.ts';

	/**
	 * Where a custom character wakes on one night (M59, Trevor 2026-11-06: mockup C): the
	 * night's stages in order with the marker steps where they fall. The stage it wakes in is
	 * open, with its characters and the character itself in its place; tapping one of them puts
	 * it right after that one, and tapping the open stage's name puts it first in the stage.
	 * Another stage opens in a sheet to pick from, so the list never grows in place. With no
	 * place of its own it shows the one suggested from its ability, and saves nothing until a
	 * place is picked.
	 */
	interface Props {
		night: Night;
		label: string;
		/** The character as the form has it. */
		character: Character;
		data: GameData | undefined;
		value: NightPlace | undefined;
		/** Off while it has no night text for this night: it doesn't wake. */
		disabled?: boolean;
		onChange: (place: NightPlace) => void;
	}

	let { night, label, character, data, value, disabled = false, onChange }: Props = $props();

	const list = $derived(
		data ? (night === 'first' ? data.nightSheet.firstNight : data.nightSheet.otherNight) : []
	);
	const parts = $derived(data ? nightStages(list, night, data.characters) : []);
	const suggested = $derived(
		data && character.ability
			? suggestedNightPlace(character, night, data.nightSheet, data.byId)
			: undefined
	);
	const place = $derived(value ?? suggested);
	const openStage = $derived(place?.stage);

	/** The step just before a stage: the last one of the parts before it. */
	function before(stage: Band): string | undefined {
		let last: string | undefined;
		for (const part of parts) {
			if (part.kind === 'stage' && part.stage === stage) return last;
			last = part.kind === 'marker' ? part.id : (part.steps.at(-1) ?? last);
		}
		return last;
	}

	/** The stage's steps with the character placed after `place.after` (or first, or last). */
	function withOwn(stage: Band, steps: readonly CharacterId[]): (CharacterId | null)[] {
		const out: (CharacterId | null)[] = [...steps];
		const after = place?.after;
		const at = after === undefined ? steps.length : steps.indexOf(after as CharacterId);
		if (after !== undefined && after === before(stage)) out.unshift(null);
		else out.splice(at < 0 ? steps.length : at + 1, 0, null);
		return out;
	}

	function pick(stage: Band, after: string | undefined) {
		onChange({ stage, ...(after ? { after } : {}) });
	}

	let sheetStage = $state<Band | undefined>();
	const sheetSteps = $derived.by(() => {
		const part = parts.find((p) => p.kind === 'stage' && p.stage === sheetStage);
		return part?.kind === 'stage' ? part.steps : [];
	});

	const stepOf = (id: CharacterId): NamedStep => ({
		id,
		kind: 'character',
		character: data?.byId.get(id)
	});
	const stageName = (stage: Band) => t(`character-builder.stage.${stage}`);
</script>

<div class="field" class:disabled data-testid={`night-place-${night}`}>
	<span class="label">{label}</span>
	<ol class="order" aria-label={label}>
		{#each parts as part (part.kind === 'marker' ? part.id : part.stage)}
			{#if part.kind === 'marker'}
				<li class="marker">
					<StepPiece step={{ id: part.id, kind: 'marker' }} template="name" interactive={false} />
				</li>
			{:else}
				{@const open = part.stage === openStage}
				<li>
					<button
						type="button"
						class="stage"
						class:open
						{disabled}
						aria-expanded={open}
						onclick={() =>
							open ? pick(part.stage, before(part.stage)) : (sheetStage = part.stage)}
					>
						<span class="name">{stageName(part.stage)}</span>
						<span class="count"><CountBadge count={part.steps.length} /></span>
					</button>
					{#if open}
						<ol class="steps">
							{#each withOwn(part.stage, part.steps) as id (id ?? 'own')}
								<li class:own={id === null}>
									{#if id === null}
										<StepPiece
											step={{ id: character.id, kind: 'character', character }}
											template="name"
											current
											interactive={false}
										/>
									{:else}
										<StepPiece
											step={stepOf(id)}
											template="name"
											{disabled}
											onclick={() => pick(part.stage, id)}
										/>
									{/if}
								</li>
							{/each}
						</ol>
					{/if}
				</li>
			{/if}
		{/each}
	</ol>
</div>

<!-- Open while it has a stage; closing it forgets the stage. -->
<BottomSheet
	bind:open={() => sheetStage !== undefined, (open) => !open && (sheetStage = undefined)}
	title={sheetStage ? stageName(sheetStage) : ''}>
	{#if sheetStage}
		{@const stage = sheetStage}
		<ol class="sheet-steps">
			<li>
				<button
					type="button"
					class="stage"
					onclick={() => {
						pick(stage, before(stage));
						sheetStage = undefined;
					}}>{t('character-builder.stageStart')}</button
				>
			</li>
			{#each sheetSteps as id (id)}
				<li>
					<StepPiece
						step={stepOf(id)}
						template="name"
						onclick={() => {
							pick(stage, id);
							sheetStage = undefined;
						}}
					/>
				</li>
			{/each}
		</ol>
	{/if}
</BottomSheet>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.label {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.order,
	.steps,
	.sheet-steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.order {
		border: var(--card-border);
		border-radius: var(--radius-md);
	}
	.order > li + li {
		border-top: var(--card-border);
	}
	.marker {
		padding: var(--space-1) var(--space-2);
	}
	.stage {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		background: none;
		border: none;
		color: var(--on-surface-muted);
		font: inherit;
		text-align: start;
	}
	.stage.open {
		color: var(--on-surface);
		font-weight: 600;
	}
	.stage .count {
		margin-inline-start: auto;
	}
	.steps {
		padding: 0 var(--space-2) var(--space-2) var(--space-4);
		gap: var(--space-1);
	}
	.own {
		outline: calc(0.125 * var(--u)) solid var(--accent);
		border-radius: var(--radius-md);
	}
	.sheet-steps {
		gap: var(--space-1);
	}
	.disabled {
		opacity: 0.5;
	}
</style>
