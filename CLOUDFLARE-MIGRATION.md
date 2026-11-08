# WarLike Server sur Cloudflare

Cette branche prépare le serveur complet pour une exécution Cloudflare indépendante. Le projet Pages existant utilise `pages-public/_worker.js` comme relais vers un Worker nommé `warlike-server-runtime` par la liaison `WARLIKE_APP`. Le relais conserve l'URL et les cookies des visiteurs.

Construire avec `node node_modules/vite/bin/vite.js build --config vite.cloudflare.config.ts`, puis contrôler avec `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config dist/server/wrangler.json`. La configuration lie `DB` à la base Cloudflare `warlike-server` et active la connexion WarLike.

Avant la mise en production : configurer `WARLIKE_OWNER_EMAIL` en secret du Worker, activer R2 puis lier `BUCKET`, déployer le Worker, lier `WARLIKE_APP` au projet Pages et vérifier les routes et ressources. Copier et réconcilier de nouveau les données de l'ancien serveur juste avant le basculement. Les sessions ne sont pas transférables entre domaines ; les membres se reconnectent avec leurs identifiants WarLike.

La base créée et sa copie initiale des comptes sont une préparation. Elles ne suivent pas automatiquement les modifications faites sur l'ancien serveur. Les fichiers R2 n'ont pas encore été transférés. Ne pas déployer ce relais avant que la base et les liaisons soient vérifiées.
