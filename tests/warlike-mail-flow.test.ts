import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {setCredential,login,session,logout} from '../lib/warlike-auth.ts';
import {issueMailbox,hasMailboxAccess} from '../lib/mailbox-store.ts';
import {withWarLikeIdentity} from '../lib/identity-context.ts';
import {sendDirect,replyToThread,conversationState} from '../lib/conversations.ts';

test('deux comptes WarLike échangent, répondent et retrouvent les messages après reconnexion',async()=>{
 const {db,sql,owner,alice,bob,eve}=mailDatabase();
 await issueMailbox(db,owner,alice,'Alice','Test');await issueMailbox(db,owner,bob,'Bob','Test');
 await setCredential(db,owner,alice.id,'alice','mot-de-passe-alice-fiable');
 await setCredential(db,owner,bob.id,'bob','mot-de-passe-bob-fiable');
 const a=await login(db,'alice','mot-de-passe-alice-fiable','client-a');
 const b=await login(db,'bob','mot-de-passe-bob-fiable','client-b');
 const aliceUser=(await session(db,a.token))!,bobUser=(await session(db,b.token))!;
 assert.equal(await withWarLikeIdentity(aliceUser,()=>hasMailboxAccess(db,aliceUser)),true);
 assert.equal(await withWarLikeIdentity(aliceUser,()=>hasMailboxAccess(db,bobUser)),false);
 const thread=await sendDirect(db,aliceUser,{recipient:bob.id,subject:'Test WarLike',body:'Bonjour Bob',clientKey:'test-unique'});
 assert.equal((await conversationState(db,bobUser)).messages.some(m=>m.body==='Bonjour Bob'),true);
 await replyToThread(db,bobUser,thread,'Bonjour Alice');
 assert.equal((await conversationState(db,aliceUser)).messages.some(m=>m.body==='Bonjour Alice'),true);
 assert.equal((await conversationState(db,eve)).messages.length,0);
 await logout(db,a.token);assert.equal(await session(db,a.token),null);
 const again=await login(db,'alice','mot-de-passe-alice-fiable','client-a');
 assert.equal((await conversationState(db,(await session(db,again.token))!)).messages.length,2);
 sql.close();
});
