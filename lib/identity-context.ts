import { AsyncLocalStorage } from 'node:async_hooks';
import type { ForwardedUser } from './bridge';
const storage = new AsyncLocalStorage<{ user: ForwardedUser | null; mailboxToken: string | null }>();
export const requestIdentity = () => storage.getStore();
export const withRequestIdentity = <T>(user: ForwardedUser | null, mailboxToken: string | null, run: () => T) => storage.run({ user, mailboxToken }, run);
