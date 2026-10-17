<script lang="ts">
	import { CHARACTER_TYPES, type GameData, type LoadedScript } from '#lib/core/data/index.ts';
	import { scriptFacts } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';

	/**
	 * Factual checks of a previewed script (Trevor, 2026-10-16, from the Ravenswood review,
	 * ideas only): characters per type, the characters that change setup, and any character
	 * whose required partner isn't on the script. Facts from TPI's data and our setup tables
	 * (`scriptFacts`), never a judgement of balance. The jinxes are listed in the players'
	 * sheet below; no Djinn line (Trevor, 2026-10-17: jinxes are enough).
	 */
	interface Props {
		script: LoadedScript;
		data: GameData;
	}

	let { script, data }: Props = $props();

	const facts = $derived(scriptFacts(script.characters, data.jinxes, script.homebrewJinxes));
	const types = $derived(CHARACTER_TYPES.filter((type) => facts.counts[type] > 0));
	const missing = $derived(facts.requirements.filter((r) => !r.onScript));
	const byId = $derived(new Map(script.characters.map((c) => [c.id, c])));
</script>

<Collapsible title={t('scripts.checks.title')} storageKey="scripts:checks" level={3}>
	<dl class="checks" data-testid="script-checks">
		{#each types as type (type)}
			<dt>{TYPE_PLURALS[type]}</dt>
			<dd data-type={type}>{facts.counts[type]}</dd>
		{/each}
		<dt>{t('scripts.checks.setup')}</dt>
		<dd>
			{#if facts.modifiers.length}
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
	</dl>
	{#if missing.length}
		<ul class="warnings" data-testid="script-warnings">
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
	{/if}
</Collapsible>

<style>
	.checks {
		margin: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
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
	.warnings {
		margin-top: var(--space-2);
	}
</style>
