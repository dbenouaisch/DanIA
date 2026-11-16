/* Réglages communs à la mesure d'audience (track.js), au formulaire (lead.js) et à la page de suivi.
   endpoint : URL « /exec » de l'application Web Apps Script (voir integrations/google-sheet.gs).
              Vide = aucune mesure.
   prodHosts : domaines de production. Tout autre domaine (localhost, aperçus Vercel) n'est pas mesuré. */
window.DANIA_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxcPtrb5SnjAJFGzm52FmuHZGGhMVdNyoJUUZXlmUuW4EDL52MhwHKp2AVWumefO295/exec",
  prodHosts: ["dan-ia.vercel.app"]
};
