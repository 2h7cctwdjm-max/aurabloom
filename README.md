# Aurabloom — mini-site 1 produit (COD)

Page produit unique, fonctionnelle, sans Shopify. Le client remplit le formulaire et sa commande part sur ton WhatsApp, déjà écrite. Tu paies zéro abonnement.

## Lancer le site sur ton ordinateur

Ouvre un terminal dans ce dossier et lance :

```
python3 -m http.server 8000
```

Puis ouvre dans ton navigateur : http://localhost:8000

Pour arrêter : `Ctrl + C` dans le terminal.

(Tu peux aussi juste double-cliquer sur `index.html`, mais le serveur local reproduit mieux les conditions réelles.)

## À configurer avant de tester une vraie commande

Dans `index.html`, en bas, cherche le bloc `CONFIG` :

- `whatsapp` : ton numéro au format international, sans + ni espaces. Pour le Mali : `223` suivi de ton numéro. Exemple : `22376001122`.
- `productName` : le nom du produit.
- `deliveryFee` : les frais de livraison à Bamako (en FCFA).

Les prix et les deux formats se modifient directement dans le HTML (section `variants`).

## Ce que ça fait et ne fait pas

- Fait : page produit, choix du format, quantité, calcul du total, formulaire, envoi de la commande sur WhatsApp, bouton WhatsApp flottant, FAQ.
- Ne fait pas : pas de pixel Facebook/TikTok, pas de suivi des stocks, pas de tableau de bord des commandes (tout arrive dans WhatsApp). C'est voulu, pour tester vite et sans frais.

## Mettre en ligne plus tard

Le site est 100 % statique. Pour le rendre accessible depuis les pubs, tu pourras le déposer gratuitement sur Netlify, Vercel ou Cloudflare Pages. On verra ça quand le test local te convient.
