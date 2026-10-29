# WarLike Server

> Site : https://warlike-server.vikktor7.chatgpt.site/
> Sources de la version publiée : `57cb999f086ec814aa776eb2a8967a410b217864`.
> Les identifiants de connexion, secrets et bases de données ne sont pas inclus.

Serveur privé de WarLike Mail : identités communes, conversations, demandes d’inscription, autorisations enregistrées et brouillons. Données persistantes dans D1, migrations Drizzle versionnées.

## Authentification

Le propriétaire de la console utilise Sign in with ChatGPT. Le client Mail transmet une identité provenant de cette même connexion, signée HMAC-SHA256 avec une validité de 30 secondes. Le serveur vérifie la signature et relit le rôle en base pour chaque action. La clé de pont et l’accès de service restent dans les variables d’environnement privées. Une identité anonyme ne peut pas accéder aux conversations. Un membre lit ses conversations ; le référent gère la boîte d’équipe ; seul le propriétaire nomme les référents.

Variables requises : WARLIKE_OWNER_EMAIL et WARLIKE_BRIDGE_KEY. La console d’hébergement reste réservée au propriétaire. Le partage natif du site reste privé.

## Contrôles

`node --experimental-strip-types --test tests/*.test.ts` : politique de rôles, isolation des conversations, validation des champs, origine, identifiants et signatures du pont. `npx tsc --noEmit` et build Sites.

## Périmètre

Ce serveur héberge l’API et les données. Il ne fournit pas de SMTP/IMAP et n’héberge pas les fichiers de Studio ou Engine. Les autorisations du registre ne bloquent pas encore les versions publiques `.pages.dev` : leur contrôle de connexion doit être raccordé séparément. Aucun référent réel n’est préconfiguré ; son adresse n’a pas encore été fournie.
