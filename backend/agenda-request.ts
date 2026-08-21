// ============================================================
// SF AGENDA — Edge Function "agenda-request"
// Appelée par le site public (bouton "Demander cette réservation").
// Crée une réservation avec statut "en_attente" (ne bloque PAS encore le
// véhicule — seule une validation par l'équipe, via admin-agenda.html, la
// passe en "confirmee" et bloque réellement les dates) + envoie l'e-mail
// interne de notification et la confirmation au client.
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  RESEND_API_KEY, SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function email(to: string, subject: string, html: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const vehicule_id = b.vehicule_id ?? null;
    const marque = b.marque ?? "";
    const modele = b.modele ?? "";
    const agence_nom = b.agence_nom ?? "";
    const date_debut = b.date_debut, date_fin = b.date_fin;
    const heure_debut = b.heure_debut ?? null, heure_fin = b.heure_fin ?? null;
    const adresse_livraison = b.adresse_livraison ?? null;
    const numero_vol = b.numero_vol || null;
    const heure_arrivee_vol = b.heure_arrivee_vol || null;
    const heure_depart_vol = b.heure_depart_vol || null;
    const prix_total = b.prix_total ?? null;
    const nom = b.nom ?? "", contact = b.contact ?? "";

    if (!date_debut || !date_fin || !contact) {
      return new Response(JSON.stringify({ error: "champs manquants" }), { status: 400, headers: CORS });
    }

    const { data, error } = await sb.from("agenda_reservations").insert({
      vehicule_id, date_debut, date_fin, heure_debut, heure_fin, adresse_livraison,
      numero_vol, heure_arrivee_vol, heure_depart_vol,
      client_nom: nom, client_contact: contact, prix_total,
      statut: "en_attente", source: "site",
    }).select("id").maybeSingle();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

    const libelleVehicule = (marque + " " + modele).trim() || "véhicule à confirmer";

    await email(
      INTERNAL,
      `Nouvelle demande de réservation — ${libelleVehicule}`,
      `<p>Nouvelle demande à valider dans l'agenda interne :</p>
       <p><b>${libelleVehicule}</b>${agence_nom ? ` (${agence_nom})` : ""}</p>
       <p>Du ${date_debut}${heure_debut ? " " + heure_debut : ""} au ${date_fin}${heure_fin ? " " + heure_fin : ""}</p>
       <p>Livraison : ${adresse_livraison || "non précisée"}</p>
       ${numero_vol ? `<p>Vol ${numero_vol}${heure_arrivee_vol ? " — arrivée " + heure_arrivee_vol : ""}${heure_depart_vol ? ", départ " + heure_depart_vol : ""}</p>` : ""}
       <p>Prix estimé : ${prix_total ? prix_total + " €" : "sur devis"}</p>
       <p>Client : ${nom} — ${contact}</p>
       <p>Connectez-vous à l'agenda pour valider ou refuser cette demande.</p>`,
    );

    if (contact.includes("@")) {
      await email(
        contact,
        `Votre demande de réservation a bien été reçue`,
        `<p>Bonjour ${nom},</p>
         <p>Nous avons bien reçu votre demande pour <b>${libelleVehicule}</b>
         du ${date_debut} au ${date_fin}.</p>
         <p>Un conseiller SF Club Paris valide votre réservation sous peu et revient vers vous.</p>
         <p>— SF Club Paris</p>`,
      );
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
