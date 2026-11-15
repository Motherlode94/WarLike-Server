# Renforcement de WarLike Server — 15 novembre 2026

## Changements

- Les en-têtes d’identité du fournisseur sont acceptés uniquement derrière l’origine Sites canonique. Les autres hôtes utilisent une vraie session WarLike ou le pont Mail signé.
- Les chemins ambigus et les alias encodés des routes protégées sont refusés avant le routage.
- Un budget commun par identité complète les limites par route. Les UUID de ressources ne créent plus de quotas indépendants. Les requêtes authentifiées sont limitées avant la lecture des fichiers ; les téléchargements multipart ont une limite horaire commune.
- Une réinitialisation des identifiants, un changement de mot de passe, une suspension ou un changement de rôle révoque les sessions applicatives et les codes d’association en attente du compte concerné.
- La console Membres propose « Déconnecter partout » au propriétaire. Le compte propriétaire, le propre compte de l’acteur et les données des autres membres sont protégés. L’action est journalisée sans mot de passe ni jeton.
- Les compteurs de limitation expirés sont nettoyés par lots bornés.
- Les réponses privées interdisent la mise en cache et l’indexation et varient selon les cookies et l’autorisation.

La révocation concerne les sessions applicatives WarLike, les boîtes mail, Studio et les codes d’association présents dans cette base. Elle ne déconnecte pas le compte du fournisseur d’identité externe. Aucune conversation, aucun projet et aucun fichier utilisateur n’est supprimé.

## Validation

Tests avec base SQLite isolée : cloisonnement entre comptes, refus des rôles non autorisés, réinitialisation atomique, conservation des sessions après un échec, suspension/réactivation, refus des faux en-têtes, chemins ambigus, quotas partagés et requêtes bloquées avant lecture du corps. Compilation TypeScript et build de production.

Aucune migration de données ni création de compte n’est nécessaire. La commande d’administration n’a pas été exécutée sur un compte réel pendant les tests.

## Workers de production

Les adresses workers.dev et les aperçus de Mail/Server restent désactivés. Le Worker de test Online n'est pas lié à Online et reste désactivé. Music, Transcribe et Online conservent leurs points d'entrée publics prévus.

Le masquage des paramètres d'URL des journaux Mail/Server est activé dans Cloudflare. Le déploiement du Server réapplique et vérifie cette option par `scripts/secure-worker-observability.mjs`, en conservant les bindings et les autres paramètres d'observabilité.
