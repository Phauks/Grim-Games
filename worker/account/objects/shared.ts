import { PASSWORD_ITERATIONS, passwordHash, randomToken } from '../crypto.ts';

/** A new salt and the password's hash with it. */
export async function hashPassword(password: string): Promise<PasswordHash> {
	const salt = randomToken(16);
	return { hash: await passwordHash(password, salt), salt, iterations: PASSWORD_ITERATIONS };
}

export const HOUR_MS = 60 * 60 * 1000;

/** A password's stored form; never the password itself. */
export interface PasswordHash {
	hash: string;
	salt: string;
	iterations: number;
}
