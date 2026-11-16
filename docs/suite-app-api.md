# Connexion et brouillons Academy / Business

Server fournit le compte commun et le stockage privé. Les interfaces Academy et Business doivent intégrer ce contrat ; elles ne sont pas raccordées automatiquement par cette modification. Studio conserve son contrat actuel.

## Autorisation

1. Sur l’origine de l’application, créer un verifier aléatoire PKCE de 32 octets et un state aléatoire, encodés base64url. Conserver ces deux valeurs temporairement dans sessionStorage, jamais le bearer.
2. Naviguer vers `https://warlike-server.pages.dev/connect/academy?challenge=SHA256_BASE64URL(verifier)&state=...` (ou `/connect/business`). Server affiche le compte et demande l’autorisation, après connexion WarLike et remplacement des identifiants temporaires si nécessaire.
3. Le consentement appelle `POST /api/{app}/authorize` avec le cookie natif et une origine Server identique. Le navigateur est redirigé exclusivement vers `https://warlike-{app}.pages.dev/#warlike_app_code=...&state=...&app=...`.
4. Vérifier le state, l’application, l’origine Server et l’âge de la demande ; nettoyer immédiatement le fragment puis appeler `POST /api/{app}/exchange` avec `{code,verifier}`. Le code dure 120 secondes, est consommé une seule fois et ne permet pas de changer d’application.
5. Conserver `{token,expiresAt}` uniquement en mémoire. Les requêtes suivantes utilisent `Authorization: Bearer <token>` et `credentials: 'omit'`. Session de huit heures ; pas de renouvellement silencieux. Un rechargement nécessite une nouvelle association.
6. `POST /api/{app}/revoke` avec `{}` révoque la session. Un changement de mot de passe ou une réinitialisation révoque aussi les sessions et codes en attente. Les suspensions, droits Hub, droits applicatifs et versions d’identifiants sont relus à chaque requête.

Le client navigateur [suite-client.mjs](../examples/suite-client.mjs) implémente ce parcours sans dépendance. Le copier dans chaque application et appeler `complete()` au démarrage, `connect()` sur action de l’utilisateur. Un 401 nécessite une reconnexion ; ne pas effacer les brouillons locaux en réponse à une erreur réseau. Les entêtes d’identité et les rôles déclarés par le navigateur ne font jamais autorité.

Le propriétaire attribue les accès depuis `/applications` : Academy `student` ou `editor`, Business `member`. Aucun accès implicite pour les membres ou référents du Hub. Le rôle Academy editor prépare le contrat d’édition ; ce changement ne crée pas un système de cours publiés ni de notes officielles.

## API JSON

Toutes les écritures exigent `Content-Type: application/json`. Les erreurs sont `{error:string}` avec 400/401/403/404/409/413/415/429/503. CORS accepte exclusivement l’origine configurée pour l’application, sans cookies interdomaines. Un proxy de confiance peut appeler sans Origin avec le même bearer ; il ne peut pas utiliser le cookie Server comme bearer.

| Méthode | Route | Corps / résultat |
| --- | --- | --- |
| GET | `/api/{app}/me` | `{userId,displayName,app,role,scope}` ; rôle applicatif, pas un rôle global à réutiliser |
| GET / POST | `/api/academy/drafts` | Liste `{drafts:[...]}` / création `{title,payload}` → `{id,revision,...}` |
| GET / PUT / DELETE | `/api/academy/drafts/:id` | Lecture complète / `{title,payload,expectedRevision}` / `{expectedRevision}` |
| GET / POST | `/api/business/organizations` | Organisations du compte / création `{name}` |
| GET / POST / DELETE | `/api/business/organizations/:org/members` | Responsables seulement ; écriture `{memberId,role,expectedRevision}` / retrait `{memberId,expectedRevision}` |
| GET / POST | `/api/business/organizations/:org/drafts` | Même contrat de brouillons ; portée imposée par l’organisation du chemin |
| GET / PUT / DELETE | `/api/business/organizations/:org/drafts/:id` | Même contrat de révision, avec contrôle d’appartenance à chaque appel |
| GET / POST | `/api/apps/access` | Cookie Server, propriétaire uniquement ; écriture `{app,memberId,role,enabled}` |

Les propriétés d’enregistrement utilisent `createdAt` et `updatedAt` ; les listes utilisent les noms SQL `created_at` et `updated_at`. Une révision attendue est un entier : 0 pour un nouveau membre, version actuelle pour une modification ou une réactivation après retrait ; un conflit renvoie 409, sans écrasement automatique. Les membres retirés restent listés avec status revoked et une version croissante, sans accès aux données. Les brouillons supprimés conservent une marque de suppression et ne sont pas restaurés par un ancien client.

Business : owner/admin gèrent les membres, accountant écrit les brouillons, viewer lit seulement. Le propriétaire de l’organisation et son propre rôle sont protégés ; seul l’owner attribue ou gère un admin. Être propriétaire global de Server ne donne pas accès aux données d’une autre organisation. Un membre ajouté doit avoir un accès Business actif.

Limites : 10 organisations créées par compte, 200 brouillons actifs par espace, titre 120 caractères, payload JSON objet de 120 000 octets maximum, profondeur 32 et 10 000 valeurs maximum, corps HTTP de 130 000 octets maximum, budgets de requêtes avant lecture du corps. Les propriétés inconnues du payload sont conservées. L’application doit envoyer le payload complet lors d’un PUT.

Ces données sont des **brouillons** : pas de validation de notes, pas de factures légales, pas de comptabilité certifiée, pas de paiements. N’y importer aucune donnée de démonstration comme donnée officielle. Les fonctions métier et l’import des données locales sont des travaux distincts dans Academy et Business.

## Mise en production

La migration additive `drizzle/0010_suite_app_access.sql` crée uniquement des tables `app_*`. Ne pas réinitialiser les comptes existants. Avant déploiement : vérifier le compte, le binding DB et une sauvegarde D1/Time Travel ; appliquer ce fichier sur la base cible, puis déployer le runtime construit. Exemple, après validation de la cible :

```sh
node node_modules/wrangler/bin/wrangler.js d1 execute warlike-server --remote --config dist/server/wrangler.json --file drizzle/0010_suite_app_access.sql
node node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json
node scripts/secure-worker-observability.mjs
```

Le workflow de déploiement relève un bookmark de récupération D1, applique cette migration additive et vérifie le schéma avant de publier. Le jeton de déploiement doit donc permettre D1 Read/Edit en plus de Workers Scripts Edit ; si ces droits manquent, le déploiement s’arrête avant publication. La CI fonctionnelle utilise une base D1 locale jetable avec des comptes fictifs, jamais la base distante. La migration peut être réappliquée ; conserver ces tables lors d’un retour à l’ancien Worker pour préserver les brouillons. Les schémas Studio et les données existantes ne sont pas réécrits.

Ne pas journaliser les query strings d’association (state/challenge), les fragments, les codes, les bearers ou les mots de passe. La configuration de confidentialité des logs doit rester active après déploiement.
