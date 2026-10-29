# Sécurité WarLike

Le serveur reste privé et utilise l’identité transmise par la plateforme Sites. Une copie déployée ailleurs exige une intégration d’authentification adaptée : ne jamais accepter des en-têtes d’identité fournis directement par Internet.

Le pont Mail signe la méthode, le chemin, le corps et la session avec HMAC-SHA256. Une signature expire en 30 secondes. Son nonce est consommé une seule fois dans D1. Les rôles sont relus en base ; aucun rôle transmis par le client ne donne un privilège. Les compteurs de débit sont atomiques en base, partagés entre les instances du Worker. Les corps de requêtes sont bornés en octets pendant leur lecture. Les réponses privées interdisent le cache ; les erreurs techniques ne renvoient pas de détail SQL au client.

## Boîtes et mots de passe

Le responsable active les boîtes des membres dans Mail → Paramètres. L’adresse prend la forme `prenom.nom@warlike.maill.dev` ; accents et espaces sont normalisés. Une collision reçoit un suffixe lié à l’identifiant du membre. Une adresse existante reste stable lors d’une réinitialisation.

Chaque réinitialisation génère 32 octets aléatoires (256 bits), encodés en 43 caractères. Le mot de passe est remis dans la réponse autorisée, affiché une minute, puis effacé de l’interface. Le serveur conserve un sel et un vérificateur PBKDF2-SHA256/HMAC, jamais le mot de passe. Le coût PBKDF2 est de 100 000 itérations pour la compatibilité Workers ; seuls des secrets aléatoires de 256 bits sont émis. Cette API ne permet pas de les remplacer par un mot de passe humain plus faible.

L’accès au site continue d’exiger ChatGPT et son partage privé. Pour les membres dont la boîte est activée, le mot de passe ouvre ensuite une session de boîte de huit heures. Son jeton est haché en base et conservé par Mail dans un cookie `__Host-`, Secure, HttpOnly et SameSite=Strict. Cinq tentatives de connexion sont admises par fenêtre de quinze minutes. Une réinitialisation révoque immédiatement les anciennes sessions. Propriétaire et référents conservent leur accès administratif à la boîte d’équipe par Sites.

Les noms ne sont pas des identités d’authentification. Les comptes de plateforme restent liés au registre commun. Aucun domaine DNS ou compte SMTP/IMAP n’est créé par ce code. L’acheminement Internet sous `warlike.maill.dev` exige le contrôle du domaine et un fournisseur mail.

## Python, C++ et contrôles

`security/audit.py` inspecte les sources suivies et les fichiers non ignorés pour détecter des fichiers d’environnement et certains secrets embarqués. Il vérifie aussi les archives sans les extraire : chemins, liens symboliques, collisions Windows, CRC, volume et taux d’expansion. Avec `--path-guard`, les chemins passent également par le validateur C++ `native/path_guard.cpp`. Un SHA-256 vérifie l’intégrité d’un fichier par comparaison avec une valeur obtenue par un canal de confiance ; il ne remplace pas une signature de l’éditeur.

Les tests couvrent les signatures, l’anti-rejeu, les limites de requêtes, la séparation des membres, les mots de passe, la révocation des sessions et les migrations SQL réelles. Le workflow GitHub fixe les actions à des commits et limite son jeton à la lecture du dépôt.

Ces contrôles réduisent des risques précis ; ils ne constituent pas un audit indépendant. La CSP autorise encore les scripts et styles inline requis par l’application. Les sessions WebView2 et les données affichées restent accessibles au propriétaire de la session Windows. Les secrets de production appartiennent aux variables privées de déploiement, jamais à GitHub ou au client natif.

## Conversations privées et contrôle des accès

Les messages privés sont accessibles uniquement aux participants, même si un autre compte possède un rôle propriétaire ou référent. Les conversations de la boîte d’équipe restent partagées avec les responsables et sont présentées comme telles lors de la rédaction. Cette confidentialité est appliquée par les permissions du serveur ; les messages ne sont pas chiffrés de bout en bout et restent lisibles par un opérateur ayant accès à la base.

Lecture, favoris, archivage et corbeille sont propres à chaque membre. Déplacer une conversation dans sa corbeille ne la retire pas à son correspondant ; elle peut être restaurée. L’envoi privé utilise un identifiant stable pour éviter une livraison en double lors d’une nouvelle tentative.

Les brouillons sont enregistrés automatiquement après une pause de saisie. Chaque sauvegarde exige la révision attendue : une autre fenêtre ne peut pas écraser silencieusement un texte plus récent. Un brouillon envoyé ou supprimé conserve un marqueur de suppression afin de refuser les sauvegardes tardives.

Les pages applicatives et les API du Server refusent les visiteurs non connectés et les comptes non validés, refusés ou suspendus. L’accueil et le formulaire d’inscription permettent de consulter ou déposer sa demande ; les espaces de gestion exigent le rôle approprié. Le partage natif Sites reste une première barrière distincte. Les redirections d’accès et réponses privées interdisent le cache. Les liens publics Studio/Engine restent hors de cette protection.
