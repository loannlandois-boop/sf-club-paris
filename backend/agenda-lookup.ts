// ============================================================
// SF AGENDA — Edge Function "agenda-lookup"
// Appelée par le site public (ma-reservation.html) pour retrouver une
// réservation à partir de son numéro + son contact (email/téléphone).
// Les deux doivent correspondre : évite qu'un numéro seul suffise à
// consulter la réservation de quelqu'un d'autre.
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { reference, contact } = await req.json();
    if (!reference || !contact) {
      return new Response(JSON.stringify({ found: false }), { headers: CORS });
    }
    const { data } = await sb
      .from("agenda_reservations")
      .select(
        "reference,date_debut,date_fin,heure_debut,heure_fin,adresse_livraison,statut,paye,caution_recue,prix_total,numero_vol,heure_arrivee_vol,heure_depart_vol,agenda_vehicules(marque,modele)",
      )
      .eq("reference", String(reference).trim().toUpperCase())
      .ilike("client_contact", String(contact).trim())
      .maybeSingle();

    return new Response(JSON.stringify({ found: !!data, reservation: data || null }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ found: false, error: String(e) }), { status: 500, headers: CORS });
  }
});
