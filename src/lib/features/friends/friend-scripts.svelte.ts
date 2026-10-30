/**
 * Scripts friends sent this account, and the scripts on its profile (plan F9, F10), loaded
 * from `worker/friends/scripts.ts` with the Friends page and whenever the Share screen asks.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, call } from '#lib/features/account/account-api.ts';
import { account } from '#lib/features/account/account.svelte.ts';
import {
	DISMISS_SCRIPT_API,
	FRIEND_SCRIPTS_API,
	PUBLISH_SCRIPT_API,
	SEND_SCRIPT_API,
	UNPUBLISH_SCRIPT_API,
	type FriendScript,
	type FriendScriptsResponse,
	type SendScriptResponse
} from './friend-scripts-protocol.ts';

let data = $state.raw<FriendScriptsResponse | undefined>(undefined);
/** Bumped when the account changes, so an answer for the previous one is dropped. */
let generation = 0;
/** A screen asked for them: loaded again once the account is known or changes. */
let wanted = false;

async function update(load: () => Promise<FriendScriptsResponse>): Promise<void> {
	const started = generation;
	try {
		const next = await load();
		if (started === generation) data = next;
	} catch (e) {
		if (!(e instanceof AccountApiError)) reportError(e, { area: 'friends', notify: false });
		throw e;
	}
}

export const friendScripts = {
	/** Undefined until loaded, and while signed out. */
	get data(): FriendScriptsResponse | undefined {
		return data;
	},
	/** Whether the script with this hash is on this account's profile. */
	isPublished(hash: string): boolean {
		return data?.published.some((script) => script.hash === hash) ?? false;
	},
	load(): Promise<void> {
		wanted = true;
		if (account.status !== 'signed-in') return Promise.resolve();
		return update(() => call<FriendScriptsResponse>(FRIEND_SCRIPTS_API)).catch(() => {});
	},
	/** Sends a script to a friend, by the friend's account id. */
	send(to: string, script: FriendScript): Promise<SendScriptResponse> {
		return call<SendScriptResponse>(SEND_SCRIPT_API, 'POST', { ...script, to });
	},
	dismiss(id: number): Promise<void> {
		return update(() => call<FriendScriptsResponse>(DISMISS_SCRIPT_API, 'POST', { id }));
	},
	/** Shows the script on this account's profile, or takes it off. */
	setPublished(script: FriendScript, published: boolean): Promise<void> {
		return published
			? update(() => call<FriendScriptsResponse>(PUBLISH_SCRIPT_API, 'POST', script))
			: update(() =>
					call<FriendScriptsResponse>(UNPUBLISH_SCRIPT_API, 'POST', { hash: script.hash })
				);
	}
};

account.onChange((user) => {
	generation++;
	data = undefined;
	if (user && wanted) void friendScripts.load();
});
