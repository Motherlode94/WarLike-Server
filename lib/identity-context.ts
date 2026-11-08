import { AsyncLocalStorage } from 'node:async_hooks';
import type { ForwardedUser } from './bridge';
import type { Principal } from './policy';
const storage = new AsyncLocalStorage<{ user: ForwardedUser | null; mailboxToken: string | null; principal?: Principal; warlikeAnonymous?: boolean }>();
export const requestIdentity = () => storage.getStore();
export const withRequestIdentity = <T>(user: ForwardedUser | null, mailboxToken: string | null, run: () => T) => storage.run({ user, mailboxToken }, run);
export const withWarLikeIdentity = <T>(principal: Principal, run: () => T) => storage.run({ user: null, mailboxToken: null, principal }, run);
export const withWarLikeAnonymous = <T>(run: () => T) => storage.run({user:null,mailboxToken:null,warlikeAnonymous:true},run);
