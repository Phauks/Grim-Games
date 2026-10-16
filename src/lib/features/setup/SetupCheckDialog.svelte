<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { BagPlan, ScriptJinx, SetupAnalysis } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';

	interface Props {
		open: boolean;
		analysis: SetupAnalysis;
		plan: BagPlan;
		/** Jinxes between selected characters. */
		jinxes: readonly ScriptJinx[];
		/** Warnings in plain words, from the setup analysis, the bag and exclusive jinxes. */
		warnings: readonly string[];
		lookup: (id: CharacterId) => Character | undefined;
		onStandIn: (characterId: CharacterId, shows: CharacterId) => void;
	}

	let { open = $bindable(), analysis, plan, jinxes, warnings, lookup, onStandIn }: Props = $props();

	const name = (id: CharacterId) => lookup(id)?.name ?? id;
</script>

<!-- Everything the counts bar can't show: warnings, setup changes, stand-ins and jinxes. -->
<Dialog bind:open title="Setup check" size="full">
	<div class="body" data-testid="setup-check">
		<Collapsible title="Warnings" level={3} storageKey="setup-check:warnings">
			{#if warnings.length}
				<ul>
					{#each warnings as warning, i (i)}<li><GlossaryText text={warning} /></li>{/each}
				</ul>
			{:else}<p>None</p>{/if}
		</Collapsible>

		<Collapsible title="Shown instead" level={3} storageKey="setup-check:shown-instead">
			{#if plan.standIns.length}
				<ul class="stand-ins">
					{#each plan.standIns as standIn (standIn.characterId)}
						<li data-testid="stand-in-{standIn.characterId}">
							<CharacterBadge characterId={standIn.characterId} />
							<span>is shown</span>
							{#if standIn.options.length}
								<Select
									label="Shown to the {name(standIn.characterId)}"
									hideLabel
									value={standIn.shows ?? ''}
									options={standIn.options.map((id) => ({ value: id, label: name(id) }))}
									onChange={(id) => onStandIn(standIn.characterId, id)}
								/>
							{:else}<span>None</span>{/if}
						</li>
					{/each}
				</ul>
			{:else}<p>None</p>{/if}
		</Collapsible>

		<Collapsible title="Setup changes" level={3} storageKey="setup-check:setup-changes">
			{#if analysis.modifiers.length || analysis.notes.length}
				<ul>
					{#each analysis.modifiers as modifier (modifier.id)}
						<li><GlossaryText text={modifier.explanation} /></li>
					{/each}
					{#each analysis.notes as note, i (i)}<li><GlossaryText text={note} /></li>{/each}
				</ul>
			{:else}<p>None</p>{/if}
		</Collapsible>

		<Collapsible title="Jinxes" level={3} storageKey="setup-check:jinxes">
			{#if jinxes.length}
				<ul>
					{#each jinxes as jinx (jinx.characters.join('+'))}
						<li>
							<CharacterBadge characterId={jinx.characters[0]} inline /> and
							<CharacterBadge characterId={jinx.characters[1]} inline />: {jinx.reason}
						</li>
					{/each}
				</ul>
			{:else}<p>None</p>{/if}
		</Collapsible>
	</div>
</Dialog>

<style>
	.body {
		display: grid;
		gap: var(--space-3);
		overflow-y: auto;
		padding-top: var(--space-2);
	}
	p,
	ul {
		margin: 0;
	}
	ul {
		display: grid;
		gap: var(--space-2);
		padding-inline-start: 1.2em;
	}
	.stand-ins {
		padding: 0;
		list-style: none;
	}
	.stand-ins li {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
	}
</style>
