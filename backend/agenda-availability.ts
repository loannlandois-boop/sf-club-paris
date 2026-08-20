// ============================================================
// SF AGENDA — Edge Function "agenda-availability"
// Appelée par le site public (widget Location) ET par l'admin.
// Calcule dispo + prix dégressif, propose une alternative si indisponible.
// Ne renvoie JAMAIS les données clients des autres réservations (sécurité).
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (fournis auto par Supabase)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function nbJours(debut: string, fin: string) {
  const a = new Date(debut + "T00:00:00Z").getTime();
  const b = new Date(fin + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

function prixJour(v: any, jours: number): number | null {
  if (jours <= 3) return v.prix_jour_1_3 ?? v.prix_jour_4_6 ?? v.prix_jour_7_13 ?? v.prix_jour_14plus ?? null;
  if (jours <= 6) return v.prix_jour_4_6 ?? v.prix_jour_7_13 ?? v.prix_jour_1_3 ?? v.prix_jour_14plus ?? null;
  if (jours <= 13) return v.prix_jour_7_13 ?? v.prix_jour_14plus ?? v.prix_jour_4_6 ?? v.prix_jour_1_3 ?? null;
  return v.prix_jour_14plus ?? v.prix_jour_7_13 ?? v.prix_jour_4_6 ?? v.prix_jour_1_3 ?? null;
}

async function estDisponible(vehiculeId: number, debut: string, fin: string) {
  const { data } = await sb
    .from("agenda_reservations")
    .select("id")
    .eq("vehicule_id", vehiculeId)
    .neq("statut", "annulee")
    .lte("date_debut", fin)
    .gte("date_fin", debut)
    .limit(1);
  return !(data && data.length);
}

function chiffrer(v: any, jours: number) {
  const pj = prixJour(v, jours);
  return { vehicule: v, duree: jours, prix_jour: pj, prix_total: pj != null ? Math.round(pj * jours) : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { vehicule_id, marque, modele, segment, date_debut, date_fin } = await req.json();
    if (!date_debut || !date_fin) {
      return new Response(JSON.stringify({ error: "dates manquantes" }), { status: 400, headers: CORS });
    }
    const jours = nbJours(date_debut, date_fin);

    let cible: any = null;
    if (vehicule_id) {
      const { data } = await sb.from("agenda_vehicules").select("*").eq("id", vehicule_id).eq("actif", true).maybeSingle();
      cible = data;
    } else if (marque) {
      let q = sb.from("agenda_vehicules").select("*").eq("actif", true).ilike("marque", `%${marque}%`);
      if (modele) q = q.ilike("modele", `%${modele}%`);
      const { data } = await q.limit(1);
      cible = data && data[0];
    }

    if (cible) {
      const dispo = await estDisponible(cible.id, date_debut, date_fin);
      if (dispo) {
        return new Response(JSON.stringify({ disponible: true, ...chiffrer(cible, jours) }), { headers: CORS });
      }
    }

    // Indisponible (ou aucun véhicule exact trouvé) -> on cherche des alternatives du même segment, disponibles
    const seg = (cible && cible.segment) || segment || null;
    let altQuery = sb.from("agenda_vehicules").select("*").eq("actif", true);
    if (seg) altQuery = altQuery.eq("segment", seg);
    else if (marque) altQuery = altQuery.ilike("marque", `%${marque}%`);
    const { data: candidats } = await altQuery.limit(20);

    const alternatives = [];
    for (const v of candidats || []) {
      if (cible && v.id === cible.id) continue;
      if (await estDisponible(v.id, date_debut, date_fin)) {
        alternatives.push(chiffrer(v, jours));
        if (alternatives.length >= 3) break;
      }
    }
    alternatives.sort((a, b) => (a.prix_total ?? Infinity) - (b.prix_total ?? Infinity));

    return new Response(
      JSON.stringify({
        disponible: false,
        vehicule: cible || null,
        duree: jours,
        alternatives,
      }),
      { headers: CORS },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
