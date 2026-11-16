/* Réglages communs à la mesure d'audience (track.js), au formulaire (rdv.js) et à /admin.
   endpoint : URL « /exec » de l'application Web Apps Script (voir integrations/google-sheet.gs).
              Vide = aucune mesure ni enregistrement des demandes.
   prodHosts : domaines de production. Tout autre domaine (localhost, aperçus Vercel) n'est pas mesuré. */
window.DANIA_CONFIG = {
  endpoint: "",
  prodHosts: ["dan-ia.vercel.app"]
};
