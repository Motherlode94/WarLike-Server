# WarLike Server — relais MCP WarLike Engine

Le serveur d'identité et de données **WarLike Server** est la source centrale du relais MCP. L'application Pages `warlike-mcp.pages.dev` est uniquement un proxy HTTPS JSON-RPC ; elle n'héberge **aucune** base parallèle.

## Contrat /api/mcp

`POST /api/mcp` : MCP JSON-RPC 2.0 (client distant), protégé par `Authorization: Bearer WARLIKE_MCP_TOKEN`. Méthodes `initialize`, `ping`, `tools/list`, `tools/call`.

`PUT /api/mcp` : depuis l'onglet Engine autorisé, avec `WARLIKE_MCP_EDITOR_TOKEN` :
- `{action:"connect",permission:"read"|"edit"}` crée une session éphémère.
- `{action:"result",session,commandId,result}` retourne le résultat d'une commande.
- `{action:"disconnect",session}` supprime la session.

`GET /api/mcp?session=<uuid>` : heartbeat et prochaine commande en attente. Origine navigateur autorisée : `https://warlike-engine.pages.dev`. La session est active si vue dans les 30 dernières secondes.

## Appairage explicite et isolation par onglet
- `warlike_list_sessions` renvoie les sessions actives (30 dernières secondes) avec un identifiant opaque.
- **Chaque commande MCP demande `sessionId`**. Plus aucune commande ne sélectionne automatiquement « le dernier onglet connecté ».
- Les résultats `warlike_command_result` requièrent **le même `sessionId` et `commandId`**.
- Le navigateur cesse le heartbeat après déconnexion ; une session expirée est refusée et les commandes âgées de plus de 60 secondes sont marquées expirées.
- Les commandes en attente sont annulées lorsque l'onglet se déconnecte. Un ID de session n’est pas une permission en soi : la clé client MCP reste obligatoire.
- **Limite restante** : les secrets applicatifs sont partagés par déploiement, et non encore associés à des utilisateurs WarLike Keys individuellement. Pas d'ouverture multi-utilisateurs sans scope de compte et contrôle de propriété côté serveur.

Les opérations de modification sont interdites sur une connexion `read` et le bridge Engine les interdit aussi pendant Play. Le serveur n'autorise que les opérations explicitement listées. Aucun script à exécuter, shell, DOM arbitraire ni accès aux fichiers du client.

## Configuration Cloudflare
- Réutiliser le binding D1 existant : `DB`.
- Configurer deux secrets *différents* avec 32 caractères aléatoires minimum : `WARLIKE_MCP_TOKEN` (client MCP) et `WARLIKE_MCP_EDITOR_TOKEN` (onglet Engine). Ne jamais les inclure dans les dépôts ou les URLs.
- Le point d'entrée crée de façon idempotente les tables `mcp_editor_sessions` et `mcp_editor_commands` si elles n'existent pas, dans D1 Server. Prévoir une migration explicite et une stratégie de rétention avant la production à fort trafic.
- Le relais est volontairement inactif sans DB ni secrets. Une authentification WarLike native et des scopes par compte devront être raccordés avant une ouverture multi-utilisateurs.
- Les commandes sont renvoyées en état `pending` avec `commandId` ; le client MCP appelle `warlike_command_result` pour lire le résultat. Cela évite de simuler une exécution synchrone quand l'onglet est fermé.

## Vérification obligatoire avant fusion
1. Lint/TypeScript sur `app/api/mcp/route.ts` ; aucune route fonctionnelle sans tokens.
2. Test d'authentification : bearer absent/faux, mauvaises origines, permissions read/edit et fermeture de session.
3. Créer un objet et ajouter un Component dans Engine ; vérifier son résultat via `warlike_command_result`.
4. Vérifier le refus en mode Play, l'absence d'exécution de scripts arbitraires et la sauvegarde/Undo.
5. Vérifier la compatibilité CORS et le déploiement de `warlike-mcp.pages.dev/mcp`.
6. Ajouter tests de charge, anti-rejeu, nettoyage périodique D1, limitation du taux et journal d'audit avant exposition large.

**État** : code ajouté sur branche, pas de test de production ni de configuration de secrets réalisée par cette PR.
