import { buildInfo } from '#lib/build-info.ts';
import { REPOSITORY_URL } from '#lib/features/about/report-issue.ts';
import { BUILD_CACHE_PREFIX, RUNTIME_CACHE } from '#lib/features/offline/cache-rules.ts';
import { locale, t } from '#lib/i18n/locale.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { scrubUrls } from './app-error.ts';
import {
	formatBytes,
	registeredRows,
	type Diagnostics,
	type DiagnosticSection
} from './diagnostics.ts';
import { errorLog } from './report.svelte.ts';

/** Local date and time to the second, in the interface language. */
const dateTime = (at: number | string): string =>
	new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'medium' }).format(
		new Date(at)
	);

const yesNo = (value: boolean | undefined): string =>
	value === undefined
		? t('errors.diag.unknown')
		: value
			? t('errors.diag.yes')
			: t('errors.diag.no');

async function attempt<T>(read: () => Promise<T> | T): Promise<T | undefined> {
	try {
		return await read();
	} catch {
		return undefined;
	}
}

/** The offline worker and its caches (MDN: ServiceWorkerContainer.getRegistration, CacheStorage.keys). */
async function appSection(): Promise<DiagnosticSection> {
	const supported = 'serviceWorker' in navigator;
	const registration = supported
		? await attempt(() => navigator.serviceWorker.getRegistration())
		: undefined;
	const keys = (await attempt(() => caches.keys())) ?? [];
	const builds = keys.filter((k) => k.startsWith(BUILD_CACHE_PREFIX) && k !== RUNTIME_CACHE);
	const worker = !supported
		? t('errors.diag.unsupported')
		: registration?.active
			? navigator.serviceWorker.controller
				? t('errors.diag.workerRunning')
				: t('errors.diag.workerNotControlling')
			: t('errors.diag.workerNone');
	return {
		id: 'app',
		title: 'errors.diag.app',
		rows: [
			{ label: 'errors.diag.offlineWorker', value: worker },
			{
				label: 'errors.diag.updateWaiting',
				value: yesNo(supported ? !!registration?.waiting : undefined)
			},
			{ label: 'errors.diag.offlineCopies', value: String(builds.length) },
			{ label: 'errors.diag.runtimeCache', value: yesNo(keys.includes(RUNTIME_CACHE)) }
		]
	};
}

/** Space used and allowed (MDN: StorageManager.estimate, StorageManager.persisted). */
async function storageSection(): Promise<DiagnosticSection> {
	const estimate = await attempt(() => navigator.storage?.estimate?.());
	const persisted = await attempt(() => navigator.storage?.persisted?.());
	return {
		id: 'storage',
		title: 'errors.diag.storage',
		rows: [
			{ label: 'errors.diag.storageUsed', value: formatBytes(estimate?.usage) },
			{ label: 'errors.diag.storageQuota', value: formatBytes(estimate?.quota) },
			{ label: 'errors.diag.storagePersisted', value: yesNo(persisted) }
		]
	};
}

function deviceSection(): DiagnosticSection {
	const installed = matchMedia('(display-mode: standalone)').matches;
	return {
		id: 'device',
		title: 'errors.diag.device',
		rows: [
			{ label: 'errors.diag.browser', value: navigator.userAgent },
			{
				label: 'errors.diag.screen',
				value: `${screen.width}×${screen.height} @${devicePixelRatio}x`
			},
			{ label: 'errors.diag.viewport', value: `${innerWidth}×${innerHeight}` },
			{ label: 'errors.diag.touchPoints', value: String(navigator.maxTouchPoints) },
			{
				label: 'errors.diag.displayMode',
				value: installed ? t('errors.diag.installed') : t('errors.diag.inBrowser')
			},
			{ label: 'errors.diag.languages', value: navigator.languages.join(', ') },
			{ label: 'errors.diag.online', value: yesNo(navigator.onLine) },
			{ label: 'errors.diag.page', value: scrubUrls(location.pathname) }
		]
	};
}

function settingsSection(): DiagnosticSection {
	return {
		id: 'settings',
		title: 'errors.diag.settings',
		rows: [
			{ label: 'errors.diag.language', value: `${locale.current} (${locale.choice})` },
			// Look-and-feel only: preferences never hold names, games or scripts (preferences.ts).
			{
				label: 'errors.diag.preferences',
				value: JSON.stringify($state.snapshot(preferences.current))
			}
		]
	};
}

/** Everything the Diagnostics page shows, read now. Never throws. */
export async function collectDiagnostics(now = Date.now()): Promise<Diagnostics> {
	const [app, storage] = await Promise.all([appSection(), storageSection()]);
	const room = registeredRows();
	const sections: DiagnosticSection[] = [
		{
			id: 'build',
			title: 'errors.diag.build',
			rows: [
				{ label: 'errors.diag.gatheredAt', value: dateTime(now) },
				{ label: 'errors.diag.version', value: buildInfo.version },
				{
					label: 'errors.diag.commit',
					value: buildInfo.commit,
					href: `${REPOSITORY_URL}/commit/${buildInfo.commit}`
				},
				{
					label: 'errors.diag.branch',
					value: buildInfo.branch,
					href: `${REPOSITORY_URL}/tree/${buildInfo.branch}`
				},
				{ label: 'errors.diag.channel', value: buildInfo.channel },
				{ label: 'errors.diag.builtAt', value: dateTime(buildInfo.builtAt) }
			]
		},
		app,
		storage,
		deviceSection(),
		settingsSection(),
		{
			id: 'room',
			title: 'errors.diag.liveRoom',
			rows: room.length ? room : [{ label: 'errors.diag.roomStatus', value: t('common.none') }]
		}
	];
	return { sections, problems: $state.snapshot(errorLog.entries), gatheredAt: now };
}
