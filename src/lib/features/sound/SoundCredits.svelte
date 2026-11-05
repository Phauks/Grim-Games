<script lang="ts">
	import { AMBIENCE_MIXES } from '#lib/core/sound/ambience.ts';
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/** Each recording with what the credit names, in one list per place it plays. */
	const groups = [
		{
			id: 'ambience',
			title: t('settings.ambience'),
			credits: AMBIENCE_MIXES.map((mix) => ({ ...mix, licence: 'Public domain' }))
		},
		{ id: 'soundboard', title: t('settings.soundboard'), credits: BOARD_SOUNDS }
	];
</script>

<!-- Where each recording comes from (plans U3 and U6). Each is public domain or CC0; the NPS
     asks for credit, and the rest are credited the same way, with the recordist when named.
     Day and night sound and the soundboard each fold away, closed until opened, remembered
     on this device (Trevor, 2026-11-05). -->
<SectionStack>
	{#each groups as group (group.id)}
		<Collapsible
			title={group.title}
			level={3}
			storageKey="credits-sound-{group.id}"
			defaultOpen={false}
			count={group.credits.length}
		>
			<ul class="credits">
				{#each group.credits as credit (credit.id)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={credit.page} target="_blank" rel="noopener"
							>{credit.place ? `${credit.name}, ${credit.place}` : credit.name}</a
						>
						<span class="source"
							>{credit.recordist ? `${credit.recordist} · ` : ''}{credit.source} · {credit.licence}</span
						>
					</li>
				{/each}
			</ul>
		</Collapsible>
	{/each}
</SectionStack>

<style>
	.credits {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 var(--space-2);
		padding-block: var(--space-2);
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	a {
		color: inherit;
	}
	.source {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
</style>
