/**
 * Calls to the accounts API (`worker/account/routes.ts`). Every change is a JSON request,
 * which the Worker requires together with our own `Origin`.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import type {
	ApiError,
	DeviceSession,
	DocKind,
	ProfileDoc,
	PutDocRequest,
	SessionInfo,
	StartResponse,
	UserResponse
} from './account-protocol.ts';

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
	try {
		response = await fetch(path, {
			method,
			credentials: 'same-origin',
			headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
			body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
		});
	} catch {
		throw new AccountApiError(
			navigator.onLine === false ? t('account.api.offline') : t('account.api.unreachable'),
			0
		);
	}
	const data: unknown = await response.json().catch(() => undefined);
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
	verifyCode: (email: string, code: string) =>
		call<SessionInfo>('/api/auth/verify', 'POST', { email, code }),
	verifyLink: (email: string, token: string) =>
		call<SessionInfo>('/api/auth/verify', 'POST', { email, token }),
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
	deleteAccount: () => call<{ ok: true }>('/api/account', 'DELETE'),
	listDocs: <T>(kind: DocKind) =>
		call<{ docs: ProfileDoc<T>[] }>(`/api/account/docs/${kind}`).then((r) => r.docs),
	putDoc: <T>(kind: DocKind, id: string, request: PutDocRequest) =>
		call<ProfileDoc<T>>(`/api/account/docs/${kind}/${encodeURIComponent(id)}`, 'PUT', request)
};

/** Where "Download my data" points: the browser saves the Worker's JSON as a file. */
export const EXPORT_PATH = '/api/account/export';
