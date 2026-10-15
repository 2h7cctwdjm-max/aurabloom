# Aurabloom, mini-site 1 produit (COD)

Produit actuel : **Correcteur V34** (correcteur de couleur pour les dents), 9 900 FCFA, livraison gratuite à Bamako.

Page produit unique avec offres par quantité (1, 2 ou 3 flacons) et formulaire de commande intégré, façon Releasit. Le client commande sans WhatsApp : la commande arrive dans un Google Sheet (et dans Netlify Forms en sauvegarde), avec une notification Telegram.

La version précédente (Sérum Glow Vitamine C) est gardée dans `../archives/aurabloom-serum-glow-index.html`.

⚠️ Les médias actuels (`media/`) proviennent du site de la marque d'origine. À remplacer par tes propres photos et vidéos dès que possible (risque de retrait du site ou des pubs).

En ligne : https://aurabl.netlify.app/ (déployé par Netlify depuis le dépôt GitHub `aurabloom`).

## Tester sur ton ordinateur

```
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. En local, l'envoi affiche une erreur tant que `sheetUrl` est vide, c'est normal : Netlify Forms ne marche qu'une fois en ligne.

## Tout se règle dans le bloc CONFIG (bas de index.html)

- `offers` : les offres, prix et étiquettes
- `cities` : villes et frais de livraison (`0` = gratuite, `null` = frais annoncés par le livreur)
- `sheetUrl` : l'URL du Google Apps Script (étape ci-dessous)
- `facebookPixelId`, `tiktokPixelId` : tes IDs de pixel. Événements envoyés : ViewContent, InitiateCheckout, Purchase (TikTok : CompletePayment)
- `media` : la galerie du haut (photos ou vidéos, dans le dossier `media/`)
- `blocks` : les médias des 3 blocs en zigzag (`null` = bloc sans média). Vidéos MP4 courtes, sans son, moins de 2 Mo
- `ingredients` : la liste des ingrédients (vide = la question est masquée)
- `ticker` : les messages du bandeau qui défile
- `contactWhatsapp` : lien discret en bas de page, vide pour le retirer

## Recevoir les commandes dans Google Sheets (10 minutes, une seule fois)

1. Crée un Google Sheet vide, nomme-le « Commandes Aurabloom ».
2. Menu Extensions > Apps Script. Efface le contenu et colle tout `commandes-google-sheet.gs`.
3. En haut du script, mets ton email dans `NOTIFY_EMAIL` pour être alerté à chaque commande.
4. Choisis la fonction `setup` et clique Exécuter. Accepte les autorisations (c'est ton propre script).
5. Déployer > Nouveau déploiement > type « Application Web ». Exécuter en tant que : Moi. Accès : Tout le monde. Déployer.
6. Copie l'URL qui finit par `/exec` et colle-la dans `sheetUrl`.

## Notification Telegram à chaque commande (5 minutes)

1. Dans Telegram, ouvre **@BotFather**, envoie `/newbot`, choisis un nom (ex : Aurabloom Commandes) et un identifiant finissant par `bot`. Il te donne un **token**.
2. Ouvre ton nouveau bot et envoie-lui « bonjour ».
3. Dans Apps Script : roue dentée (Paramètres du projet) > Propriétés du script > Ajouter : clé `TELEGRAM_TOKEN`, valeur = ton token. Enregistre.
4. Choisis la fonction `connecterTelegram` et clique Exécuter. Tu reçois une commande TEST sur Telegram.

Le token ne doit jamais être collé dans le code ni partagé : ce fichier est public sur GitHub. Si tu le perds ou le partages par erreur, envoie `/revoke` à @BotFather pour en générer un nouveau.

Chaque commande crée une ligne avec une colonne Statut (Nouvelle, Confirmée, Expédiée, Livrée, Refusée, Annulée, Injoignable) et la source de la pub (`utm_source`).

## Netlify Forms (sauvegarde)

Dans Netlify : Site configuration > Forms > activer la détection des formulaires, puis redéployer. Les commandes apparaissent dans l'onglet Forms, avec notifications email possibles.

## Ancienne version

L'ancienne page (commande via WhatsApp) reste dans l'historique du dépôt GitHub.
