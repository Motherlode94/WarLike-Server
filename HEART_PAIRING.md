# WarLike Server → WarLike Heart : association de compte (PKCE)

**État : intégration en préparation ; ne pas déclarer opérationnelle avant test de bout en bout.**

## Parcours

1. Heart crée un vérificateur et un challenge PKCE SHA-256 aléatoires dans sessionStorage (séparés par un état aléatoire).
2. Heart ouvre `https://warlike-server.pages.dev/connect/heart?challenge=...&state=...`.
3. Le membre se connecte sur **WarLike Server** via son formulaire d'origine, puis confirme explicitement le couplage. Aucun mot de passe ni cookie de session ne quitte le domaine du serveur.
4. `POST /api/heart/authorize` (origine du serveur vérifiée, membre authentifié) enregistre un code unique en D1 pendant **120 secondes** et retourne une URL vers le fragment de Heart.
5. Heart envoie code + vérificateur à **son propre backend**. Le backend Heart échange le code en HTTPS via `POST /api/heart/exchange`. L'échange est atomique, lié à un PKCE et à un membre actif.
6. Heart crée un cookie signé HttpOnly 10 minutes pour **l'affichage d'identité seulement**.

## Activation requise

- Appliquer la migration `drizzle/0007_heart_pairing.sql` sur la D1 `warlike-server` (une seule fois, sans écraser les autres tables).
- Reconstruire et redéployer `warlike-server-runtime` via le workflow `deploy-cloudflare-runtime.yml`, vérifier le service binding `WARLIKE_APP` du projet Pages.
- Définir le secret **`HEART_SESSION_SECRET`** (au moins 32 caractères, secret Cloudflare Pages uniquement) sur `warlike-heart`, et déployer le frontend contenant `heart-account.js` et `functions/api/account.js`.
- Tester le parcours complet après connexion réelle, expiration du code, réutilisation refusée, déconnexion et absence de fuite de mot de passe.
- Les deux origines sont figées dans le code pour ce premier déploiement ; leur changement doit être fait ensemble.

## Menaces et limites

- L'association **n'est pas** une connexion automatique au serveur depuis Heart : l'utilisateur autorise chaque flux.
- Le code n'est pas exposé dans les journaux de requêtes URL : le retour vers Heart utilise un fragment d'URL supprimé immédiatement après traitement.
- Les codes sont stockés sous hachage SHA-256 et deviennent inutilisables dès l'échange ou l'expiration ; le vérificateur reste dans sessionStorage du navigateur Heart.
- Les contrôles de fréquence et l'épuration périodique de `heart_pair_codes` sont à ajouter avant une mise à grande échelle.
- Le cookie temporaire de Heart n'accorde **aucun droit d'administration** ni accès aux données privées WarLike. L'authentification WarLike Server n'est pas réévaluée en temps réel après émission : un compte désactivé ou une session révoquée peuvent rester visibles dans Heart au plus 10 minutes. Ne jamais utiliser ce cookie seul pour des opérations sensibles.
- Aucune synchronisation de mémoire ni transfert des conversations n'est incluse à ce stade : cela exigera une API de stockage par utilisateur, un contrôle d'accès serveur et une autorisation supplémentaire.
