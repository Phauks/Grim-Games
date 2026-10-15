<script lang="ts">
	import { buildInfo } from '#lib/build-info.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { errorDetails, errorReportUrl, type AppError } from './app-error.ts';
	import { errorLog } from './report.svelte.ts';

	// The corner card plus the details dialog; mounted once by install.ts, outside the layout.

	const latest = $derived(errorLog.entries.find((e) => e.key === errorLog.unseen[0]));
	const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

	async function copy(error: AppError) {
		try {
			await navigator.clipboard.writeText(errorDetails(error));
			toast('Copied', 'Error details are on your clipboard.');
		} catch {
			toast('Could not copy', 'Your browser blocked the clipboard.');
		}
	}
</script>

{#if latest}
	<!-- A small card over the page (no reflow, no focus steal): it never interrupts a game. -->
	<div class="notice" role="status" data-testid="error-notice">
		<Icon name="warning" />
		<p class="text">
			<strong>
				Something went wrong{errorLog.unseen.length > 1 ? ` (${errorLog.unseen.length})` : ''}
			</strong>
			<span>{latest.message}</span>
		</p>
		<Button variant="quiet" onclick={() => errorLog.showDetails()}>Details</Button>
		<IconButton icon="close" label="Dismiss" onclick={() => errorLog.dismiss()} />
	</div>
{/if}

<Dialog
	bind:open={errorLog.open}
	title="Problems on this device"
	description="Kept on this device only. Reporting opens a GitHub issue you can read and edit before sending; it holds the error and build, never your game."
>
	{#if errorLog.entries.length === 0}
		<p class="none">None</p>
	{:else}
		<ol class="log">
			{#each errorLog.entries as error (error.key)}
				<li>
					<p class="message"><strong>{error.name}</strong>: {error.message}</p>
					<p class="meta">
						{error.area} · {error.page} · {time.format(error.lastAt)}{error.count > 1
							? ` · ${error.count}×`
							: ''}
					</p>
					<div class="row-actions">
						<Button variant="quiet" onclick={() => copy(error)}>Copy</Button>
						<!-- External GitHub link, not an app route. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							class="link-button"
							href={errorReportUrl(error, buildInfo, navigator.userAgent)}
							target="_blank"
							rel="noopener"
						>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<Icon name="report" /><span>Report</span>
						</a>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
	{#snippet actions()}
		<Button
			variant="quiet"
			disabled={errorLog.entries.length === 0}
			onclick={() => errorLog.clear()}
		>
			Clear
		</Button>
		<Button onclick={() => (errorLog.open = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.notice {
		position: fixed;
		/* Bottom-left on wide screens, top on phones: the update card and toasts use the bottom. */
		bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
		left: max(var(--space-3), env(safe-area-inset-left));
		z-index: var(--z-toast);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: min(calc(24 * var(--u)), calc(100vw - 2 * var(--space-3)));
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-left: 4px solid var(--accent);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
	}
	@media (max-width: 40rem) {
		.notice {
			top: calc(var(--space-3) + env(safe-area-inset-top));
			bottom: auto;
		}
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.3;
	}
	.text span {
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.log {
		display: grid;
		gap: var(--space-3);
		max-height: 60vh;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}
	.log li {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.message,
	.meta {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.meta {
		color: var(--on-surface-muted);
		font-size: 0.8rem;
	}
	.row-actions {
		display: flex;
		gap: var(--space-2);
	}
	.link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border-radius: var(--button-radius);
		background: var(--button-background);
		color: var(--button-color);
		font: var(--button-font);
		letter-spacing: 0.04em;
		text-decoration: none;
	}
	.link-button:hover {
		filter: brightness(1.15);
	}
</style>
