// ============================================================
// SF AGENDA — Edge Function "agenda-confirm"
// Appelée par l'équipe (admin-agenda.html) pour valider une réservation :
// bloque le véhicule, génère un lien de paiement Stripe (location) + un
// lien de préautorisation (caution, hold sans capture immédiate), et
// envoie l'e-mail de confirmation au client avec les documents demandés.
//
// Sécurité : la mise à jour du statut passe par le token de l'appelant
// (Authorization reçu), donc les policies RLS "to authenticated" du projet
// s'appliquent normalement — seule l'équipe connectée peut valider.
//
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  STRIPE_SECRET_KEY, RESEND_API_KEY,
//                  SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";
const SITE_URL = "https://loannlandois-boop.github.io/sf-club-paris";

const sbService = createClient(SUPABASE_URL, SERVICE_KEY);

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

async function stripeSession(params: Record<string, string>) {
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const d = await r.json();
  if (!r.ok) { console.log("stripe error:", JSON.stringify(d)); return null; }
  return d.url as string;
}

function lienPaiement(nomProduit: string, montant: number, email?: string) {
  const p: Record<string, string> = {
    mode: "payment",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": nomProduit,
    "line_items[0][price_data][unit_amount]": String(Math.round(montant * 100)),
    "line_items[0][quantity]": "1",
    success_url: `${SITE_URL}/index.html?paiement=ok`,
    cancel_url: `${SITE_URL}/index.html`,
  };
  if (email && email.includes("@")) p["customer_email"] = email;
  return stripeSession(p);
}

function lienCaution(nomProduit: string, montant: number, email?: string) {
  const p: Record<string, string> = {
    mode: "payment",
    "payment_intent_data[capture_method]": "manual",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": nomProduit,
    "line_items[0][price_data][unit_amount]": String(Math.round(montant * 100)),
    "line_items[0][quantity]": "1",
    success_url: `${SITE_URL}/index.html?caution=ok`,
    cancel_url: `${SITE_URL}/index.html`,
  };
  if (email && email.includes("@")) p["customer_email"] = email;
  return stripeSession(p);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id manquant" }), { status: 400, headers: CORS });

    // Le statut passe par le token de l'appelant -> RLS "to authenticated" fait foi.
    const sbUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { error: updErr } = await sbUser
      .from("agenda_reservations")
      .update({ statut: "confirmee" })
      .eq("id", id);
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 403, headers: CORS });

    const { data: r } = await sbService
      .from("agenda_reservations")
      .select("*, agenda_vehicules(marque,modele,agence_nom,caution)")
      .eq("id", id)
      .maybeSingle();
    if (!r) return new Response(JSON.stringify({ error: "reservation introuvable" }), { status: 404, headers: CORS });

    const v = r.agenda_vehicules || {};
    const libelle = ((v.marque || "") + " " + (v.modele || "")).trim() || "votre véhicule";
    const clientEmail = (r.client_contact || "").includes("@") ? r.client_contact : undefined;

    let lienPay: string | null = null;
    let lienDep: string | null = null;
    if (r.prix_total) {
      lienPay = await lienPaiement(`Location ${libelle} — ${r.date_debut} au ${r.date_fin}`, r.prix_total, clientEmail);
    }
    if (v.caution) {
      lienDep = await lienCaution(`Caution (préautorisation, non débitée) — ${libelle}`, v.caution, clientEmail);
    }

    await sbService.from("agenda_reservations").update({ lien_paiement: lienPay, lien_caution: lienDep }).eq("id", id);

    const html = `
      <p>Bonjour ${r.client_nom ?? ""},</p>
      <p>Votre réservation est <b>confirmée</b> : <b>${libelle}</b> du ${r.date_debut}${r.heure_debut ? " " + r.heure_debut : ""}
      au ${r.date_fin}${r.heure_fin ? " " + r.heure_fin : ""}${r.adresse_livraison ? `, livraison à ${r.adresse_livraison}` : ""}.</p>
      <p>Pour finaliser, merci de nous transmettre par retour de ce mail :</p>
      <ul>
        <li>Une copie de votre permis de conduire</li>
        <li>Une copie de votre passeport ou carte d'identité</li>
      </ul>
      <p>Aucune photo de carte bancaire n'est nécessaire : la caution est prélevée en préautorisation
      de façon sécurisée directement via le lien ci-dessous.</p>
      ${lienPay ? `<p><a href="${lienPay}">Payer le montant de la location (${r.prix_total} €)</a></p>` : `<p>Le montant à régler vous sera confirmé par un conseiller.</p>`}
      ${lienDep ? `<p><a href="${lienDep}">Préautoriser la caution (${v.caution} €, non débitée sauf dommages)</a></p>` : ``}
      <p>— SF Club Paris</p>`;

    if (clientEmail) await email(clientEmail, `Réservation confirmée — ${libelle}`, html);
    await email(
      INTERNAL,
      `Réservation validée — ${libelle}`,
      `<p>Réservation #${id} validée pour ${r.client_nom ?? ""} (${r.client_contact ?? ""}).</p>
       <p>Lien paiement : ${lienPay || "non généré"}</p><p>Lien caution : ${lienDep || "non généré"}</p>`,
    );

    return new Response(JSON.stringify({ ok: true, lien_paiement: lienPay, lien_caution: lienDep }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
