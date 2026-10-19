import type { BuildInfo } from '#lib/build-info.ts';

/** The beta branch's Worker Preview alias: previews are served as `<alias>.<production host>`. */
const BETA_ALIAS = 'beta';

export interface BuildSwitch {
	/** Which build the link opens. */
	to: 'beta' | 'production';
	/** The same page on that build. */
	href: string;
}

/**
 * The footer link to the other build (Trevor, 2026-10-19: "switch between beta and production
 * builds"). Production opens beta on `beta.<host>`; beta and every other preview, which Cloudflare
 * serves as `<alias>.<production host>`, open production on the host without that first label.
 * Local builds have no other build, so they get none. Only the path is carried over: the query
 * and hash belong to this build's state.
 */
export function buildSwitch(
	info: Pick<BuildInfo, 'channel'>,
	location: Pick<URL, 'protocol' | 'host' | 'pathname'>
): BuildSwitch | undefined {
	if (info.channel === 'local') return undefined;
	if (info.channel === 'production') {
		return {
			to: 'beta',
			href: `${location.protocol}//${BETA_ALIAS}.${location.host}${location.pathname}`
		};
	}
	const dot = location.host.indexOf('.');
	const production = location.host.slice(dot + 1);
	// A preview on a host with no parent domain left to open (such as an IP address) has nowhere to go.
	if (dot < 0 || !production.includes('.')) return undefined;
	return { to: 'production', href: `${location.protocol}//${production}${location.pathname}` };
}
