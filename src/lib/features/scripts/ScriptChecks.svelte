<script lang="ts">
	import { CHARACTER_TYPES, type GameData, type LoadedScript } from '#lib/core/data/index.ts';
	import { scriptFacts } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * Factual checks of a previewed script (Trevor, 2026-10-16, from the Ravenswood review,
	 * ideas only): characters per type, the characters that change setup, and any character
	 * whose required partner isn't on the script. Facts from TPI's data and our setup tables
	 * (`scriptFacts`), never a judgement of balance. Rows of the details' main info, not a
	 * section of their own, with the counts on one line (Trevor, 2026-10-17). No Djinn line
	 * (Trevor, 2026-10-17: jinxes are enough).
	 */
	interface Props {
		/** Undefined while the script loads: the rows are kept, empty, so nothing moves. */
		script: LoadedScript | undefined;
		data: GameData;
	}

	let { script, data }: Props = $props();

	const facts = $derived(
		script && scriptFacts(script.characters, data.jinxes, script.homebrewJinxes)
	);
	const types = $derived(facts ? CHARACTER_TYPES.filter((type) => facts.counts[type] > 0) : []);
	const missing = $derived(facts?.requirements.filter((r) => !r.onScript) ?? []);
	const byId = $derived(new Map(script?.characters.map((c) => [c.id, c]) ?? []));
</script>

<!-- Rows of the details' list: `display: contents` keeps them on its grid. -->
<div class="checks" data-testid="script-checks">
	<dt>{t('scripts.checks.characters')}</dt>
	<dd class="counts">
		{#each types as type, i (type)}
			{#if i > 0}<span aria-hidden="true">·</span>{/if}
			<span><span data-type={type}>{facts?.counts[type]}</span> {TYPE_PLURALS[type]}</span>
		{/each}
	</dd>
	<dt>{t('scripts.checks.setup')}</dt>
	<dd>
		{#if !facts}
			<!-- Loading: kept empty. -->
		{:else if facts.modifiers.length}
			<ul>
				{#each facts.modifiers as modifier (modifier.id)}
					<li>
						<CharacterBadge characterId={modifier.id} character={byId.get(modifier.id)} inline />
						<span>{modifier.summary}</span>
					</li>
				{/each}
			</ul>
		{:else}
			{t('common.none')}
		{/if}
	</dd>
	{#if missing.length}
		<dt>{t('scripts.checks.missing')}</dt>
		<dd>
			<ul data-testid="script-warnings">
				{#each missing as requirement (requirement.id)}
					<li>
						<Icon name="warning" />
						<CharacterBadge
							characterId={requirement.id}
							character={byId.get(requirement.id)}
							inline
						/>
						<span>{t('scripts.checks.needs')}</span>
						<CharacterBadge characterId={requirement.requires} inline />
						<span>{t('scripts.checks.notOnScript')}</span>
					</li>
				{/each}
			</ul>
		</dd>
	{/if}
</div>

<style>
	.checks {
		display: contents;
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
		min-height: 1lh;
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-1);
	}
	.counts > span {
		white-space: nowrap;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-1);
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
</style>
