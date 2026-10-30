import { noStore, text } from './http.ts';
import { usernameKey } from '../src/lib/features/account/account-protocol.ts';
import {
	ADMIN_ACCOUNTS_API,
	ADMIN_ACCOUNTS_LIST,
	parseAdminAccountPath,
	sortAdminAccounts,
	type AdminAccount,
	type AdminAccountList,
	type AdminAccountResponse
} from '../src/lib/features/account/admin-accounts-protocol.ts';
import { directoryStub, nameStub, userStub } from './account/objects.ts';
import { deleteAccount, getUser, type Env } from './account/routes.ts';
import { isAdmin } from './admins.ts';

/**
 * Every account in the directory (objects/directory.ts), each as it is now. An id whose
 * account is gone leaves the list, as Live games drops a closed room.
 */
async function listAccounts(env: Env, url: URL): Promise<AdminAccount[]> {
	const directory = directoryStub(env);
	if (!directory) return [];
	const accounts: AdminAccount[] = [];
	await Promise.all(
		(await directory.ids()).map(async (id) => {
			const account = await adminAccount(env, url, id);
			if (account) accounts.push(account);
			else await directory.remove(id);
		})
	);
	return sortAdminAccounts(accounts);
}

async function adminAccount(env: Env, url: URL, id: string): Promise<AdminAccount | null> {
	const user = userStub(env, id);
	const profile = await user.profile();
	if (!profile) return null;
	const sessions = await user.sessions('');
	return {
		id,
		email: profile.email,
		username: profile.username,
		hasPassword: profile.hasPassword,
		createdAt: profile.createdAt,
		devices: sessions.length,
		...(sessions.length ? { lastSeenAt: Math.max(...sessions.map((s) => s.lastSeenAt)) } : {}),
		admin: await isAdmin(env, url, profile.email)
	};
}

function answer(account: AdminAccount | null): Response {
	return Response.json({ account } satisfies AdminAccountResponse, { headers: noStore });
}

/**
 * `/api/admin/accounts/*` (plan S27; admin-accounts-protocol.ts). Answers 404 unless an
 * admin account asks, so the routes don't advertise themselves (as Live games). Every
 * request must come from our own pages with a JSON body, as the account routes. Undefined
 * for other paths.
 */
export async function handleAdminAccounts(
	request: Request,
	env: Env,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname !== ADMIN_ACCOUNTS_API && !url.pathname.startsWith(`${ADMIN_ACCOUNTS_API}/`))
		return undefined;
	const auth = await getUser(request, env);
	if (!auth || !(await isAdmin(env, url, auth.user.email))) return text('Not found', 404);
	if (
		request.headers.get('Origin') !== url.origin ||
		!(request.headers.get('Content-Type') ?? '').startsWith('application/json')
	) {
		return text('This request must come from the app', 403);
	}

	if (url.pathname === ADMIN_ACCOUNTS_LIST && request.method === 'POST') {
		const accounts = await listAccounts(env, url);
		return Response.json({ accounts } satisfies AdminAccountList, { headers: noStore });
	}

	const target = parseAdminAccountPath(url.pathname);
	if (!target) return text('Not found', 404);
	const user = userStub(env, target.id);
	if (!(await user.profile())) return text('Not found', 404);
	if (!target.action && request.method === 'DELETE') {
		await deleteAccount(env, target.id);
		return new Response(null, { status: 204, headers: noStore });
	}
	if (target.action === 'sign-out' && request.method === 'POST') {
		await user.endAllSessions();
		return answer(await adminAccount(env, url, target.id));
	}
	if (target.action === 'remove-username' && request.method === 'POST') {
		const { old } = await user.clearUsername();
		if (old !== null) await nameStub(env, usernameKey(old)).release(target.id);
		return answer(await adminAccount(env, url, target.id));
	}
	return text('Method not allowed', 405);
}
