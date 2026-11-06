/**
 * Aurabloom, réception des commandes dans Google Sheets.
 * À coller dans : Google Sheet > Extensions > Apps Script. Mode d'emploi dans README.md.
 *
 * L'adresse de ce script est publique (elle est dans le code des pages) : tout ce qui arrive
 * ici est vérifié, et le prix est toujours recalculé à partir du catalogue ci-dessous.
 */

// Email qui reçoit une alerte à chaque commande. Vide = pas d'email.
var NOTIFY_EMAIL = "";

// Telegram : le token du bot se met dans Paramètres du projet > Propriétés du script,
// clé TELEGRAM_TOKEN. Ne le colle jamais ici (ce fichier est public sur GitHub).

// Catalogue : à garder identique aux offres (CONFIG.offers) de chaque page.
// Un produit ou une offre absents d'ici = commande refusée. Pense à ce fichier quand tu changes un prix.
var CATALOGUE = {
  "Correcteur V34": {
    "1 flacon": { qty: 1, prix: 9900 },
    "2 flacons": { qty: 2, prix: 18000 },
    "3 flacons": { qty: 3, prix: 25500 }
  },
  "Huile de Chébé": {
    "1 flacon": { qty: 1, prix: 9900 },
    "2 flacons": { qty: 2, prix: 18000 },
    "3 flacons": { qty: 3, prix: 25500 }
  },
  "Savon au Curcuma": {
    "1 savon": { qty: 1, prix: 9900 },
    "2 savons": { qty: 2, prix: 18000 },
    "3 savons": { qty: 3, prix: 25500 }
  }
};
var VILLE_GRATUITE = "Bamako"; // Ailleurs : frais annoncés par le livreur.

// Limites contre les envois en masse. À remonter si tes ventes approchent ces chiffres.
var MAX_PAR_NUMERO = 3;  // commandes par numéro sur 10 minutes
var MAX_PAR_HEURE = 60;  // commandes au total par heure

var SHEET_NAME = "Commandes";
var HEADERS = ["Date", "N° commande", "Nom", "Téléphone", "Ville", "Quartier", "Offre", "Quantité",
               "Sous-total", "Livraison", "Total", "Paiement", "Statut", "Source", "Campagne", "Note"];
var STATUTS = ["Nouvelle", "Confirmée", "Expédiée", "Livrée", "Refusée", "Annulée", "Injoignable"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Occupé : le site affiche une erreur et la cliente réessaie, sans doublon grâce au numéro de commande.
  if (!lock.tryLock(10000)) return refus_("occupe");
  try {
    var p = (e && e.parameter) || {};
    if (p["bot-field"]) return ok_();

    var c = verifier_(p);
    if (!c) return refus_("invalide");

    var cache = CacheService.getScriptCache();
    // Même numéro de commande déjà reçu : la cliente a réessayé, on ne crée pas de doublon.
    if (cache.get("id_" + c.order_id)) return ok_();

    if (compter_(cache, "tel_" + c.phone, 600) > MAX_PAR_NUMERO) return refus_("trop");
    var heure = "h_" + Math.floor(Date.now() / 3600000);
    var total = compter_(cache, heure, 3700);
    if (total > MAX_PAR_HEURE) {
      if (total === MAX_PAR_HEURE + 1) {
        try { alerteTelegram_("⚠️ Plus de " + MAX_PAR_HEURE + " commandes en une heure : les suivantes sont refusées. Vérifie le Sheet."); }
        catch (err) { console.error("Telegram : " + err); }
      }
      return refus_("trop");
    }

    var sh = sheet_();
    sh.appendRow([
      new Date(), c.order_id, clean_(c.name), "'" + c.phone, clean_(c.city), clean_(c.district),
      clean_(c.offer), c.qty, c.subtotal, c.delivery, c.total, "Paiement à la livraison", "Nouvelle",
      clean_(p.source), clean_(p.campaign), ""
    ]);
    cache.put("id_" + c.order_id, "1", 21600);

    // Une notification qui échoue ne doit jamais bloquer l'enregistrement de la commande.
    c.source = p.source;
    try { notifyTelegram_(c); } catch (err) { console.error("Telegram : " + err); }
    try {
      if (NOTIFY_EMAIL) {
        MailApp.sendEmail(NOTIFY_EMAIL,
          "Nouvelle commande " + c.order_id + " : " + c.offer + ", " + c.total + " FCFA",
          "Nom : " + c.name + "\nTéléphone : " + c.phone + "\nAdresse : " + c.district + ", " + c.city +
          "\nOffre : " + c.offer + "\nTotal : " + c.total + " FCFA\nSource : " + c.source);
      }
    } catch (err) { console.error("Email : " + err); }
    return ok_();
  } finally {
    lock.releaseLock();
  }
}

// Contrôle la commande et recalcule le prix. Le total envoyé par le navigateur n'est jamais utilisé.
function verifier_(p) {
  var order_id = String(p.order_id || "");
  var phone = String(p.phone || "").replace(/\D/g, "");
  var name = texte_(p.name, 80);
  var district = texte_(p.district, 200);
  var city = texte_(p.city, 60);
  var offer = texte_(p.offer, 120);
  if (!/^AB-[A-Z0-9]{1,10}$/.test(order_id)) return null;
  if (!/^[5-9]\d{7}$/.test(phone)) return null;
  if (name.length < 2 || district.length < 2 || !city) return null;

  var coupe = offer.lastIndexOf(", ");
  if (coupe < 1) return null;
  var produit = offer.slice(0, coupe), libelle = offer.slice(coupe + 2);
  var offres = Object.prototype.hasOwnProperty.call(CATALOGUE, produit) ? CATALOGUE[produit] : null;
  var o = offres && Object.prototype.hasOwnProperty.call(offres, libelle) ? offres[libelle] : null;
  if (!o) return null;

  var gratuite = city === VILLE_GRATUITE;
  return {
    order_id: order_id, phone: phone, name: name, district: district, city: city, offer: offer,
    qty: o.qty, subtotal: o.prix, delivery: gratuite ? 0 : "à confirmer", total: o.prix
  };
}

function texte_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]+/g, " ").trim().slice(0, max);
}

function compter_(cache, cle, duree) {
  var n = (Number(cache.get(cle)) || 0) + 1;
  cache.put(cle, String(n), duree);
  return n;
}

// Lance cette fonction une fois à la main pour créer l'onglet et tester.
function setup() {
  sheet_();
}

/* ---------- Telegram ---------- */

// Étape 1 : envoie un message à ton bot dans Telegram, puis lance cette fonction.
// Elle retrouve ton chat et l'enregistre toute seule. Si quelqu'un d'autre a écrit au bot, elle s'arrête :
// cette personne recevrait sinon les noms, numéros et adresses des clientes.
function connecterTelegram() {
  var token = prop_("TELEGRAM_TOKEN");
  if (!token) throw new Error("Ajoute d'abord TELEGRAM_TOKEN dans les Propriétés du script.");
  var res = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getUpdates").getContentText());
  var msgs = (res.result || []).filter(function (u) { return u.message; });
  if (!msgs.length) throw new Error("Aucun message trouvé. Écris « bonjour » à ton bot dans Telegram puis relance.");
  var chats = {};
  msgs.forEach(function (u) { chats[u.message.chat.id] = u.message.chat; });
  var ids = Object.keys(chats);
  if (ids.length > 1) {
    throw new Error("Plusieurs personnes ont écrit au bot : " + ids.map(function (i) {
      return (chats[i].first_name || chats[i].title) + " (" + i + ")";
    }).join(", ") + ". Mets ton numéro de chat à la main dans la propriété TELEGRAM_CHAT_ID.");
  }
  var chat = chats[ids[0]];
  PropertiesService.getScriptProperties().setProperty("TELEGRAM_CHAT_ID", String(chat.id));
  console.log("Connecté au chat de " + (chat.first_name || chat.title) + " (" + chat.id + ")");
  testTelegram();
}

// Étape 2 : envoie une fausse commande sur Telegram pour vérifier.
function testTelegram() {
  notifyTelegram_({ order_id: "TEST", name: "Client test", phone: "76000000", city: "Bamako",
    district: "Hamdallaye", offer: "2 flacons", total: "17000", delivery: "1000", source: "facebook" });
}

function notifyTelegram_(p) {
  var total = Number(p.total) ? Number(p.total).toLocaleString("fr-FR") + " FCFA" : esc_(p.total);
  if (isNaN(Number(p.delivery))) total += " + livraison";
  envoyerTelegram_(
    "🛍 <b>Nouvelle commande " + esc_(p.order_id) + "</b>\n\n" +
    "<b>" + esc_(p.offer) + "</b>, " + total + "\n" +
    "👤 " + esc_(p.name) + "\n" +
    "📞 +223 " + esc_(p.phone) + "\n" +
    "📍 " + esc_(p.district) + ", " + esc_(p.city) + "\n" +
    "Source : " + esc_(String(p.source || "direct").slice(0, 100))
  );
}

function alerteTelegram_(message) { envoyerTelegram_(esc_(message)); }

function envoyerTelegram_(text) {
  var token = prop_("TELEGRAM_TOKEN"), chatId = prop_("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "post",
    payload: { chat_id: chatId, text: text, parse_mode: "HTML" }
  });
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function esc_(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#F1E4D1");
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUTS, true).build();
    sh.getRange(2, HEADERS.indexOf("Statut") + 1, 5000, 1).setDataValidation(rule);
  }
  return sh;
}

// Empêche qu'un texte saisi par un client soit interprété comme une formule.
function clean_(v) {
  v = String(v == null ? "" : v).slice(0, 300);
  return /^[\s=+\-@]/.test(v) ? "'" + v : v;
}

function ok_() { return reponse_({ ok: true }); }
function refus_(raison) { return reponse_({ ok: false, error: raison }); }
function reponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
