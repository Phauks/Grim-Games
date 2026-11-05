<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { describeThrown } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { onMount, tick } from 'svelte';
	import type { GameData } from '#lib/core/data/index.ts';
	import { characterReference } from '#lib/core/rules/reference.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import LabDock from '#lib/features/character-lab/LabDock.svelte';
	import LabPanel from '#lib/features/character-lab/LabPanel.svelte';
	import LabSelect from '#lib/features/character-lab/LabSelect.svelte';
	import { LabSession } from '#lib/features/character-lab/lab-session.svelte.ts';
	import { MediaQuery } from 'svelte/reactivity';
	import Page from '#lib/ui/layout/Page.svelte';
	import CharacterReference from './CharacterReference.svelte';

	let data = $state<GameData>();
	let error = $state<string>();

	// Built at runtime from the same data and rules code the app uses.
	const entries = $derived(data ? characterReference(data) : []);

	// The Character Lab is this page, for everyone (plans M45, M47): select characters with +,
	// and their rows, with their jinx partners under them, are what they are tested against.
	// Nothing is listed until one is selected (Trevor, 2026-11-04: "do not list all on the
	// left side when none are selected").
	const session = new LabSession();
	/** A computer window: the lab and its game on the right of the table. */
	const computer = new MediaQuery('min-width: 75rem', false);
	const tableLab = $derived({
		locked: session.locked,
		onLock: (id: string, on: boolean) => session.setLocked(id, on)
	});

	onMount(async () => {
		try {
			data = await loadOfficialData();
			session.data = data;
		} catch (e) {
			// Shown in place below, so no corner card as well.
			error = describeThrown(e).message;
			reportError(e, { area: 'reference', notify: false });
			return;
		}
		// A link to one character (#witch, from a bug report) selects it and scrolls to its row.
		const id = decodeURIComponent(location.hash.slice(1));
		if (id && data.byId.has(id)) {
			if (!session.locked.includes(id)) session.setLocked(id, true);
			await tick();
			// After the frame that lays out the lab beside the table, so the row stays put.
			requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
		}
	});
</script>

<Page title={t('reference.title')}>
	<ErrorBoundary area="reference">
		{#if error}
			<p role="alert">{t('reference.loadError', { error })}</p>
		{:else if !data}
			<!-- Reserved space while the data loads, so nothing below jumps. -->
			<div class="loading" aria-busy="true">{t('reference.loading')}</div>
		{:else}
			<div class="characters" class:with-lab={computer.current}>
				<div class="table-area">
					<LabSelect {session} open={!computer.current} />
					{#if session.locked.length}
						<CharacterReference
							{entries}
							lab={tableLab}
							only={session.jinxFilterOn ? session.jinxed : undefined}
							onrows={(rows) => (session.listed = rows.map((e) => e.character.id))}
						/>
					{/if}
				</div>
				{#if computer.current}
					<aside class="lab-side"><LabPanel {session} frame /></aside>
				{/if}
			</div>
			{#if !computer.current}<LabDock {session} />{/if}
		{/if}
	</ErrorBoundary>
</Page>

<style>
	.characters {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	/* The table on the left, the lab and its game on the right, in view while the table scrolls. */
	.characters.with-lab {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: start;
	}
	.table-area {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}
	.lab-side {
		position: sticky;
		top: calc(var(--app-top) + var(--space-2));
		max-height: calc(100dvh - var(--app-top) - var(--space-4));
		overflow-y: auto;
		min-width: 0;
	}
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>
