/**
 * Aurabloom, réception des commandes dans Google Sheets.
 * À coller dans : Google Sheet > Extensions > Apps Script. Mode d'emploi dans README.md.
 */

// Email qui reçoit une alerte à chaque commande. Vide = pas d'email.
var NOTIFY_EMAIL = "";

// Telegram : le token du bot se met dans Paramètres du projet > Propriétés du script,
// clé TELEGRAM_TOKEN. Ne le colle jamais ici (ce fichier est public sur GitHub).

var SHEET_NAME = "Commandes";
var HEADERS = ["Date", "N° commande", "Nom", "Téléphone", "Ville", "Quartier", "Offre", "Quantité",
               "Sous-total", "Livraison", "Total", "Paiement", "Statut", "Source", "Campagne", "Note"];
var STATUTS = ["Nouvelle", "Confirmée", "Expédiée", "Livrée", "Refusée", "Annulée", "Injoignable"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = e.parameter || {};
    if (p["bot-field"]) return ok_();
    var sh = sheet_();
    sh.appendRow([
      new Date(), clean_(p.order_id), clean_(p.name), "'" + clean_(p.phone), clean_(p.city), clean_(p.district),
      clean_(p.offer), Number(p.qty) || "", Number(p.subtotal) || "", isNaN(Number(p.delivery)) ? clean_(p.delivery) : Number(p.delivery),
      Number(p.total) || "", clean_(p.payment), "Nouvelle", clean_(p.source), clean_(p.campaign), ""
    ]);
    // Une notification qui échoue ne doit jamais bloquer l'enregistrement de la commande.
    try { notifyTelegram_(p); } catch (err) { console.error("Telegram : " + err); }
    try {
      if (NOTIFY_EMAIL) {
        MailApp.sendEmail(NOTIFY_EMAIL,
          "Nouvelle commande " + p.order_id + " : " + p.offer + ", " + p.total + " FCFA",
          "Nom : " + p.name + "\nTéléphone : " + p.phone + "\nAdresse : " + p.district + ", " + p.city +
          "\nOffre : " + p.offer + "\nTotal : " + p.total + " FCFA\nSource : " + p.source);
      }
    } catch (err) { console.error("Email : " + err); }
    return ok_();
  } finally {
    lock.releaseLock();
  }
}

// Lance cette fonction une fois à la main pour créer l'onglet et tester.
function setup() {
  sheet_();
}

/* ---------- Telegram ---------- */

// Étape 1 : envoie un message à ton bot dans Telegram, puis lance cette fonction.
// Elle retrouve ton chat et l'enregistre toute seule.
function connecterTelegram() {
  var token = prop_("TELEGRAM_TOKEN");
  if (!token) throw new Error("Ajoute d'abord TELEGRAM_TOKEN dans les Propriétés du script.");
  var res = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getUpdates").getContentText());
  var msgs = (res.result || []).filter(function (u) { return u.message; });
  if (!msgs.length) throw new Error("Aucun message trouvé. Écris « bonjour » à ton bot dans Telegram puis relance.");
  var chat = msgs[msgs.length - 1].message.chat;
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
  var token = prop_("TELEGRAM_TOKEN"), chatId = prop_("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;
  var total = Number(p.total) ? Number(p.total).toLocaleString("fr-FR") + " FCFA" : esc_(p.total);
  if (isNaN(Number(p.delivery))) total += " + livraison";
  var text =
    "🛍 <b>Nouvelle commande " + esc_(p.order_id) + "</b>\n\n" +
    "<b>" + esc_(p.offer) + "</b>, " + total + "\n" +
    "👤 " + esc_(p.name) + "\n" +
    "📞 +223 " + esc_(p.phone) + "\n" +
    "📍 " + esc_(p.district) + ", " + esc_(p.city) + "\n" +
    "Source : " + esc_(p.source || "direct");
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
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
