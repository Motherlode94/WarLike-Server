# WarLike Server

> Site : https://warlike-server.vikktor7.chatgpt.site/
> Source publiée : `22e77b2b3358cb76d3167ff9fde5220a6712d99c`.
> Secrets et données privées exclus.

Développement et direction : **Hardi Victor MBANVU / HardieBay**.

Espace privé de l’univers WarLike, avec une identité commune et des données persistantes sur Cloudflare Workers, D1 et R2.

| Espace | Route | Fonctions |
| --- | --- | --- |
| Serveur | `/` | État du stockage et liens vers les services |
| Admin | `/admin` | Membres, rôles, suspension, maintenance, présence API et journal |
| Communauté | `/communaute` | Œuvres, images et audio, appréciations, commentaires et modération |
| Crypte | `/crypte` | Coffre individuel chiffré, générateur et sauvegardes chiffrées |
| PDF | `/pdf` | Fusion, ordre et rotation des pages, texte, surlignage, dessin, rectangles et export |
| API Mail | `/api/mail` | Conversations, inscriptions, décisions, droits et brouillons |

## Identité et comptes

La connexion utilise Sign in with ChatGPT. Le client WarLike Mail transmet une identité signée HMAC-SHA256, valable 30 secondes. Le serveur vérifie la signature, retrouve l’identifiant WarLike et relit le rôle en base à chaque action. Les secrets ne sont jamais fournis au navigateur.

Variables privées requises : `WARLIKE_OWNER_EMAIL` et `WARLIKE_BRIDGE_KEY`. La base utilise le binding `DB` ; les images et fichiers audio utilisent `BUCKET`. Les migrations Drizzle sont versionnées dans `drizzle/` et sont appliquées par l’hébergement.

Le propriétaire conserve les droits Dev / Admin et ne peut pas être suspendu ou rétrogradé depuis la console. La migration prépare **5 profils testeurs et 4 profils approbateurs** ; la commande de préparation de la console est également idempotente. Ces profils sont des places à attribuer, sans mot de passe partagé ni identité fictive. Il faut associer une adresse réelle, puis autoriser la personne dans le partage privé du Site. L’association ne transmet aucune invitation automatiquement.

Les approbateurs correspondent au rôle `referent` : ils traitent les demandes, modèrent les œuvres et gèrent les membres ordinaires. Seul le propriétaire nomme d’autres approbateurs et contrôle la maintenance. Une suspension est vérifiée sur les prochaines requêtes authentifiées. La présence signifie qu’un appel API a été observé dans les deux dernières minutes ; ce n’est pas une connexion WebSocket en temps réel. La console affiche des mesures D1 réelles, sans inventer de CPU ou de RAM.

## Communauté

Les membres autorisés publient leurs jeux, morceaux et illustrations. Les contenus restent privés selon le partage du Site. Les œuvres peuvent recevoir une image ou un fichier audio détecté par signature (PNG, JPEG, GIF, WebP, MP3, WAV, OGG), avec une limite de 12 Mo. SVG et HTML ne sont pas acceptés. Les textes sont rendus par React, les liens sont HTTPS, les droits de modification sont vérifiés côté serveur et la modération est journalisée. Le fil présente les 50 dernières publications ; les commentaires affichent les 100 premiers messages visibles d’une publication.

## WarLike Crypte — version expérimentale

Le mot de passe maître et le contenu déchiffré restent dans le navigateur. Web Crypto dérive une clé AES-GCM 256 bits non exportable avec PBKDF2-SHA256, 600 000 itérations et un sel aléatoire de 32 octets. Chaque enregistrement utilise un IV aléatoire de 12 octets. L’identité WarLike est liée au contenu authentifié. L’API stocke uniquement l’enveloppe chiffrée et refuse les sauvegardes dont la révision est dépassée. Il n’existe pas de lecture administrative du coffre d’un autre membre.

Le coffre se verrouille après deux minutes d’inactivité ou lorsque l’onglet devient masqué. Les exports et imports sont chiffrés ; une restauration demande le mot de passe de la sauvegarde puis une confirmation de remplacement. Changer le mot de passe maître rechiffre le coffre. Les anciennes sauvegardes nécessitent encore l’ancien mot de passe. Le presse-papiers reste sous le contrôle du système.

**Aucun audit de sécurité indépendant n’a été réalisé.** Ne pas présenter cette version comme un remplacement éprouvé d’un gestionnaire de mots de passe audité. Le mot de passe maître ne peut pas être réinitialisé pour retrouver le contenu. Conserver ce mot de passe et une sauvegarde chiffrée en lieu sûr. La sécurité dépend aussi du navigateur, de l’appareil et du code servi par le Site.

Sources techniques : [Web Crypto AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams), [dérivation PBKDF2](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [recommandation OWASP PBKDF2-SHA256](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## WarLike PDF

Les fichiers PDF sont chargés et modifiés **localement dans le navigateur**. Aucun document n’est envoyé à l’API. Limites : 30 Mo par fichier, 50 Mo au total, 10 fichiers, 200 pages et 100 annotations. L’export conserve les pages PDF et les ajouts vectoriels : il ne convertit pas le document entier en images. La police DejaVu Sans embarquée permet notamment les accents français.

Cette version ajoute du texte et des annotations ; elle ne réécrit pas les paragraphes d’origine et ne réalise pas de caviardage sécurisé. Les formulaires interactifs sont conservés lorsqu’un seul fichier est réordonné ou annoté avec toutes ses pages. La fusion, la duplication et le retrait de pages d’un formulaire sont refusés à l’export pour préserver ses champs. Les PDF protégés doivent être ouverts dans une copie déverrouillée. Toute modification d’un PDF signé invalide sa signature ; conserver l’original.

Moteurs et licences : [pdf-lib](https://pdf-lib.js.org/) (MIT), [Mozilla PDF.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), [fontkit](https://github.com/Hopding/fontkit) (MIT), [DejaVu Fonts](https://dejavu-fonts.github.io/) (licence Bitstream Vera / domaine public selon les parties). Les ressources d’affichage et leurs licences sont embarquées dans `public/vendor/pdfjs/` ; aucune dépendance à un CDN à l’usage.

## Développement et contrôles

```sh
node "$SITES_PNPM_BIN" install --frozen-lockfile
node --experimental-strip-types --test --test-concurrency=1 tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Construire et publier avec le workflow Sites, en conservant le `project_id` de `.openai/hosting.json` et son audience privée. Les tests exécutent les migrations réelles dans SQLite et vérifient les rôles, les signatures, la maintenance, l’isolation des coffres, les conflits de sauvegarde et l’export PDF, y compris les champs de formulaire et leurs apparences.

## Limites d’intégration

Ce serveur ne fournit pas de SMTP/IMAP et n’héberge pas les fichiers de Studio ou Engine. Les autorisations du registre **ne bloquent pas encore leurs versions publiques `.pages.dev`** : leur contrôle de connexion reste à raccorder. Les redémarrages, domaines et déploiements se gèrent auprès de l’hébergement. Le partage privé du Site est distinct des rôles applicatifs et doit autoriser chaque futur membre.

## Sécurité et boîtes nominatives

Consulter [SECURITY.md](SECURITY.md) pour les protections, les limites et les tests. Dans WarLike Mail → Paramètres → Adresse et accès à la boîte, le responsable choisit un membre, son prénom et son nom puis génère ses identifiants. Le mot de passe aléatoire s’affiche une seule fois. Les adresses `prenom.nom@warlike.maill.dev` fonctionnent comme identifiants internes ; aucun DNS ni SMTP/IMAP Internet n’est configuré.

Audit : `python3 security/audit.py --root .`. Validateur natif : `c++ -std=c++20 -O2 native/path_guard.cpp -o /tmp/warlike-path-guard` puis `/tmp/warlike-path-guard --self-test`. Tests Python : `python3 -m unittest discover -s security -p 'test_*.py'`.

## WarLike Hub

La page `/` rassemble Studio, Engine, Communauté, Mail, PDF, Crypte et les espaces de gestion selon le rôle. `/inscription` permet de confirmer son identité ChatGPT, déposer une présentation et choisir les espaces souhaités. `/inscriptions` est réservé au propriétaire et aux approbateurs pour valider ou refuser les demandes. Les réponses sont consultables par la personne ; aucun e-mail automatique n’est envoyé.

Une nouvelle connexion ne donne pas accès aux services : les pages, les API et le lanceur `/ouvrir/[app]` vérifient l’adhésion au hub côté serveur. Le propriétaire et les approbateurs conservent leurs droits ; une validation n’attribue que le rôle membre et les autorisations Studio/Engine demandées. Les profils préparés puis attribués par le propriétaire sont reconnus. La migration conserve les comptes existants sans modifier leurs coffres ou leurs messages. Les décisions sont journalisées et les décisions répétées refusées.

Le partage natif du Site reste privé : autoriser une adhésion au hub ne remplace pas l’autorisation de visiter le Site. Le formulaire est disponible aux personnes déjà autorisées dans ce partage. Le lanceur vérifie les accès, mais ne transforme pas les liens publics de Studio/Engine en applications privées. Mail garde son partage propre ; son identité signée est reliée au même identifiant WarLike sans écraser l’identité du hub, car les identifiants techniques Sites diffèrent entre applications.

Les favoris sont des préférences locales au navigateur, séparées par identifiant WarLike. Ils ne contiennent ni clé ni mot de passe. Les dossiers regroupent les applications, sans simuler un stockage de fichiers. L’infrastructure précédente reste accessible au propriétaire dans `/serveur`.

## Menu et extensions du hub

Les dossiers utilisent de vrais liens `/?dossier=...#espaces`, rendus côté serveur. Ils fonctionnent sans attendre l’hydratation JavaScript et supportent rechargement et historique du navigateur. La recherche peut être soumise en GET. Les liens de connexion/inscription pour les visiteurs et les lanceurs externes utilisent une navigation au niveau supérieur pour éviter un écran d’authentification ou une application externe bloquée dans l’aperçu intégré. La politique de protection des frames reste inchangée.

`/extensions` présente quatre modules WarLike activables par un compte autorisé : Notes rapides (30 notes, archives et export texte), Atelier Markdown (aperçu sans interprétation du HTML et export `.md`), Palette de couleurs (cinq couleurs, contrastes et export CSS), Minuteur Focus (décompte fondé sur une échéance absolue, pause et reprise). Les préférences et données de ces outils sont enregistrées dans le navigateur, avec des clés séparées par identifiant WarLike. Il ne s’agit pas d’une sauvegarde cloud : exporter les notes pour en conserver une copie. La désactivation conserve les données. Les valeurs stockées sont validées au chargement ; les modules ne chargent pas de code tiers arbitraire.

## Conversations privées et contrôle des accès

Les messages privés sont accessibles uniquement aux participants, même si un autre compte possède un rôle propriétaire ou référent. Les conversations de la boîte d’équipe restent partagées avec les responsables et sont présentées comme telles lors de la rédaction. Cette confidentialité est appliquée par les permissions du serveur ; les messages ne sont pas chiffrés de bout en bout et restent lisibles par un opérateur ayant accès à la base.

Lecture, favoris, archivage et corbeille sont propres à chaque membre. Déplacer une conversation dans sa corbeille ne la retire pas à son correspondant ; elle peut être restaurée. L’envoi privé utilise un identifiant stable pour éviter une livraison en double lors d’une nouvelle tentative.

Les brouillons sont enregistrés automatiquement après une pause de saisie. Chaque sauvegarde exige la révision attendue : une autre fenêtre ne peut pas écraser silencieusement un texte plus récent. Un brouillon envoyé ou supprimé conserve un marqueur de suppression afin de refuser les sauvegardes tardives.

Les pages applicatives et les API du Server refusent les visiteurs non connectés et les comptes non validés, refusés ou suspendus. L’accueil et le formulaire d’inscription permettent de consulter ou déposer sa demande ; les espaces de gestion exigent le rôle approprié. Le partage natif Sites reste une première barrière distincte. Les redirections d’accès et réponses privées interdisent le cache. Les liens publics Studio/Engine restent hors de cette protection.
