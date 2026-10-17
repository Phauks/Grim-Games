<script lang="ts">
	import { say, t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { sectionLabel, settingsSections } from './registry.ts';
	import './sections/index.ts';
	import { settingsDialog } from './settings-dialog.svelte.ts';

	const sections = settingsSections();
	// Wide screens always show a section (the first by default); narrow screens show the list
	// until a section is picked, then drill in with a Back button.
	const active = $derived(sections.find((s) => s.id === settingsDialog.section) ?? sections[0]);

	// Each section opens at its top, not at the last section's scroll position (Trevor,
	// 2026-10-16); the section list keeps its own scroll.
	let content = $state<HTMLElement>();
	$effect(() => {
		void active?.id;
		if (content) content.scrollTop = 0;
	});
</script>

<Dialog bind:open={settingsDialog.open} title={t('settings.title')} size="full">
	<div
		class="layout"
		data-view={settingsDialog.only ? 'only' : settingsDialog.section ? 'section' : 'list'}
	>
		{#if !settingsDialog.only}<nav aria-label={t('settings.sections')}>
				<ul>
					{#each sections as section (section.id)}
						<li>
							<button
								aria-current={section.id === active?.id ? 'page' : undefined}
								onclick={() => (settingsDialog.section = section.id)}
							>
								<Icon name={section.icon} />
								<span class="label">{sectionLabel(section.label, say)}</span>
								<span class="chevron"><Icon name="forward" /></span>
							</button>
						</li>
					{/each}
				</ul>
			</nav>{/if}
		{#if active}
			<section class="content" bind:this={content} aria-labelledby="settings-section-title">
				<!-- One sticky row: back icon, then the section's name (Trevor, 2026-10-17). -->
				<div class="heading">
					{#if !settingsDialog.only}<button
							class="back"
							aria-label={t('settings.allSettings')}
							title={t('settings.allSettings')}
							onclick={() => (settingsDialog.section = null)}
						>
							<Icon name="back" />
						</button>{/if}
					<h2 id="settings-section-title">{sectionLabel(active.label, say)}</h2>
					{#if active.headingAction}<active.headingAction />{/if}
				</div>
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
	@media (hover: hover) and (pointer: fine) {
		nav button:not([aria-current='page']):hover {
			background: var(--surface-hover);
		}
	}
	/* Wide windows: room for every section name on one line. */
	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: calc(15 * var(--u)) 1fr;
		}
	}
	/* One section on its own, opened from where it is used: no section list. */
	.layout[data-view='only'] {
		grid-template-columns: 1fr;
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
	/* Same height with or without a heading action, so sections line up. It stays at the top
	   while the section scrolls, with a sticky preview held just below it. */
	.content {
		--settings-heading-height: calc(var(--tap-target) + var(--space-3));
	}
	.heading {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		box-sizing: border-box;
		height: var(--settings-heading-height);
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		background: var(--dialog-background);
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
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
		@media (hover: hover) and (pointer: fine) {
			nav button:not([aria-current='page']):hover {
				background: var(--surface-hover);
			}
		}
		/* Wide windows: room for every section name on one line. */
		@media (min-width: 64rem) {
			.layout {
				grid-template-columns: calc(15 * var(--u)) 1fr;
			}
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
			display: inline-grid;
			place-items: center;
			flex: none;
			width: var(--tap-target);
			height: var(--tap-target);
			margin-left: calc(-1 * var(--space-2));
			padding: 0;
			border: 0;
			background: none;
			color: var(--heading);
			cursor: pointer;
		}
	}
</style>
