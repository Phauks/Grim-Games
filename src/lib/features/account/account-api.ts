/**
 * Calls to the accounts API (`worker/account/routes.ts`). Every change is a JSON request,
 * which the Worker requires together with our own `Origin`.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import { fetchJson, SLOW_FETCH_TIMEOUT_MS } from '#lib/ui/fetch.ts';
import type {
	ApiError,
	DeviceSession,
	DocKind,
	ProfileDoc,
	PutDocRequest,
	SessionInfo,
	StartResponse,
	SyncRequest,
	SyncResponse,
	UserResponse
} from './account-protocol.ts';

/** Everything stored for the account, as JSON. */
const EXPORT_PATH = '/api/account/export';

/** A failed call, with a message to show. `status` is 0 when the server couldn't be reached. */
export class AccountApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		/** For a 409 on a document: the server's copy. */
		readonly body?: unknown
	) {
		super(message);
		this.name = 'AccountApiError';
	}
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	let response: Response;
	let data: unknown;
	try {
		({ response, body: data } = await fetchJson(path, {
			method,
			// "Download my data" can be large.
			timeoutMs: path === EXPORT_PATH ? SLOW_FETCH_TIMEOUT_MS : undefined,
			credentials: 'same-origin',
			headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
			body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
		}));
	} catch {
		throw new AccountApiError(
			navigator.onLine === false ? t('account.api.offline') : t('account.api.unreachable'),
			0
		);
	}
	if (!response.ok) {
		const message =
			typeof data === 'object' && data !== null && typeof (data as ApiError).error === 'string'
				? (data as ApiError).error
				: t('account.api.httpStatus', { status: response.status });
		throw new AccountApiError(message, response.status, data);
	}
	return data as T;
}

export const accountApi = {
	session: () => call<SessionInfo>('/api/auth/session'),
	start: (email: string) => call<StartResponse>('/api/auth/start', 'POST', { email }),
	/** `password` becomes the account's (signing up, or replacing a forgotten one). */
	verifyCode: (
		email: string,
		code: string,
		remember: boolean,
		password?: string,
		acceptPrivacy?: string
	) =>
		call<SessionInfo>('/api/auth/verify', 'POST', {
			email,
			code,
			remember,
			password,
			acceptPrivacy
		}),
	signInWithPassword: (
		email: string,
		password: string,
		remember: boolean,
		acceptPrivacy?: string
	) =>
		call<SessionInfo>('/api/auth/password', 'POST', { email, password, remember, acceptPrivacy }),
	verifyLink: (email: string, token: string, acceptPrivacy?: string) =>
		call<SessionInfo>('/api/auth/verify', 'POST', { email, token, acceptPrivacy }),
	signOut: () => call<{ ok: true }>('/api/auth/sign-out', 'POST'),
	sessions: () =>
		call<{ sessions: DeviceSession[] }>('/api/account/sessions').then((r) => r.sessions),
	endSession: (id: string) =>
		call<{ ok: true }>(`/api/account/sessions/${encodeURIComponent(id)}`, 'DELETE'),
	endOtherSessions: () => call<{ ok: true }>('/api/account/sessions/others', 'POST'),
	startEmailChange: (email: string) =>
		call<StartResponse>('/api/account/email/start', 'POST', { email }),
	verifyEmailChange: (email: string, code: string) =>
		call<UserResponse>('/api/account/email/verify', 'POST', { email, code }).then((r) => r.user),
	setUsername: (username: string) =>
		call<UserResponse>('/api/account/username', 'PUT', { username }).then((r) => r.user),
	setIcon: (icon: string | null) =>
		call<UserResponse>('/api/account/icon', 'PUT', { icon }).then((r) => r.user),
	setPassword: (password: string) =>
		call<UserResponse>('/api/account/password', 'PUT', { password }).then((r) => r.user),
	/** Everything stored for the account, for "Download my data". */
	exportData: () => call<unknown>(EXPORT_PATH),
	deleteAccount: () => call<{ ok: true }>('/api/account', 'DELETE'),
	listDocs: <T>(kind: DocKind) =>
		call<{ docs: ProfileDoc<T>[] }>(`/api/account/docs/${kind}`).then((r) => r.docs),
	/** Pushes queued changes and pulls what changed since `since`, in one request. */
	sync: (request: SyncRequest) => call<SyncResponse>('/api/account/sync', 'POST', request),
	putDoc: <T>(kind: DocKind, id: string, request: PutDocRequest) =>
		call<ProfileDoc<T>>(`/api/account/docs/${kind}/${encodeURIComponent(id)}`, 'PUT', request)
};
