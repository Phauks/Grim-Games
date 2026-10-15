<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { errorLog } from '#lib/features/errors/report.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { REPOSITORY_URL, shortCommit } from './report-issue.ts';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<!-- The one About view in the app, opened from the footer. -->
<Dialog bind:open title="About Grim-Games">
	<p>A touch-first grimoire for Blood on the Clocktower Storytellers.</p>
	<dl>
		<dt>Version</dt>
		<dd>{info.version}</dd>
		<dt>Commit</dt>
		<dd>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
				>{shortCommit(info)}</a
			>
		</dd>
		<dt>Branch</dt>
		<dd>{info.branch}</dd>
		<dt>Channel</dt>
		<dd>{info.channel}</dd>
		<dt>Built</dt>
		<dd>{new Date(info.builtAt).toLocaleString()}</dd>
		<dt>Problems</dt>
		<dd>
			<!-- Reopens the device's error log after its corner card was dismissed. -->
			<button
				type="button"
				class="link"
				onclick={() => {
					open = false;
					errorLog.showDetails();
				}}>Problems on this device ({errorLog.entries.length})</button
			>
		</dd>
	</dl>
	<p class="small">
		Not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven
		Medway and The Pandemonium Institute. Character data and icons from TPI's toolmaker resources
		under the Community Created Content policy.
	</p>
</Dialog>

<style>
	p {
		margin: var(--space-3) 0;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: calc(0.25 * var(--u)) calc(1 * var(--u));
	}
	dt {
		opacity: 0.75;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
		min-height: auto;
	}
	.link {
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		text-decoration: underline;
	}
	.small {
		font-size: 0.85rem;
		opacity: 0.75;
	}
</style>
