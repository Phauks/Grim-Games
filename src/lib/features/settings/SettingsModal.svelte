<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { AUDIENCE_LABELS, settingsSections, type SettingsAudience } from './registry.ts';
	import './sections/index.ts';
	import { settingsDialog } from './settings-dialog.svelte.ts';

	const sections = settingsSections();
	// Wide screens always show a section (the first by default); narrow screens show the list
	// until a section is picked, then drill in with a Back button.
	// Grouped by who the settings affect: shared ones first, then Storyteller only.
	const groups = (['everyone', 'storyteller'] as SettingsAudience[])
		.map((audience) => ({ audience, sections: sections.filter((s) => s.audience === audience) }))
		.filter((group) => group.sections.length);
	const active = $derived(sections.find((s) => s.id === settingsDialog.section) ?? sections[0]);
</script>

<Dialog bind:open={settingsDialog.open} title="Settings" size="full">
	<div class="layout" data-view={settingsDialog.section ? 'section' : 'list'}>
		<nav aria-label="Settings sections">
			{#each groups as group (group.audience)}
				<h3 id="settings-group-{group.audience}">{AUDIENCE_LABELS[group.audience]}</h3>
				<ul aria-labelledby="settings-group-{group.audience}">
					{#each group.sections as section (section.id)}
						<li>
							<button
								aria-current={section.id === active?.id ? 'page' : undefined}
								onclick={() => (settingsDialog.section = section.id)}
							>
								<Icon name={section.icon} />
								<span class="label">{section.label}</span>
								<span class="chevron"><Icon name="forward" /></span>
							</button>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
		{#if active}
			<section class="content" aria-labelledby="settings-section-title">
				<button class="back" onclick={() => (settingsDialog.section = null)}>
					<Icon name="back" /> All settings
				</button>
				<h2 id="settings-section-title">{active.label}</h2>
				<p class="audience">Applies to: {AUDIENCE_LABELS[active.audience]}</p>
				<active.component />
			</section>
		{/if}
	</div>
</Dialog>

<style>
	.layout {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: calc(12 * var(--u)) 1fr;
		gap: var(--space-4);
		margin-top: var(--space-3);
	}
	nav {
		overflow-y: auto;
		border-right: 1px solid var(--border);
		padding-right: var(--space-3);
	}
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	nav button {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: var(--on-surface);
		font-family: var(--font-control);
		text-align: left;
	}
	nav button[aria-current='page'] {
		background: var(--surface-selected);
		box-shadow: inset 3px 0 0 var(--accent);
	}
	.label {
		flex: 1;
	}
	.chevron,
	.back {
		display: none;
	}
	.content {
		min-width: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: var(--space-6);
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.audience {
		margin: var(--space-1) 0 var(--space-4);
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	nav h3 {
		margin: var(--space-3) 0 var(--space-1);
		padding: 0 var(--space-3);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	nav h3:first-child {
		margin-top: 0;
	}

	/* Narrow screens: a two-step drill-in instead of side by side. */
	@media (max-width: 40rem) {
		.layout {
			grid-template-columns: 1fr;
		}
		nav {
			border-right: 0;
			padding-right: 0;
		}
		nav button {
			border-bottom: 1px solid var(--border);
			border-radius: 0;
		}
		nav button[aria-current='page'] {
			background: none;
			box-shadow: none;
		}
		.chevron {
			display: inline-block;
			color: var(--on-surface-muted);
		}
		.layout[data-view='list'] .content,
		.layout[data-view='section'] nav {
			display: none;
		}
		.back {
			display: inline-flex;
			align-items: center;
			gap: var(--space-2);
			min-height: var(--tap-target);
			margin-bottom: var(--space-2);
			padding: 0;
			border: 0;
			background: none;
			color: var(--heading);
			font-family: var(--font-control);
		}
	}
</style>
