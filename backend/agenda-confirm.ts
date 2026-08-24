// ============================================================
// SF AGENDA — Edge Function "agenda-confirm"
// Appelée par l'équipe (admin-agenda.html) pour valider une réservation :
// bloque le véhicule, génère DEUX liens de paiement Stripe distincts —
// paiement de la location (capture immédiate, facture générée par Stripe) et
// préautorisation de la caution (capture manuelle, jamais débitée sauf
// dommages) — et envoie l'e-mail de confirmation au client avec les
// documents demandés. Applique automatiquement la remise de fidélité
// (Argent -5%, Or -10%) sur le montant de la location UNIQUEMENT — jamais
// sur la caution — si l'e-mail du client correspond à un compte SF Club.
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

function emailShell(bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f2f2f0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e6e6e3;">
        <tr><td style="background:#0A0A0A;padding:30px 32px;text-align:center;">
          <div style="font-size:21px;font-weight:800;letter-spacing:3px;color:#ffffff;">SF CLUB<span style="color:#999999;font-weight:400;">.PARIS</span></div>
          <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#999999;margin-top:7px;">Club Automobile Priv&eacute;</div>
        </td></tr>
        <tr><td style="padding:34px 32px 8px;color:#1a1a1a;font-size:15px;line-height:1.65;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:26px 32px 32px;">
          <table role="presentation" width="100%" style="border-top:1px solid #ececec;padding-top:22px;">
            <tr><td>
              <div style="font-size:13px;font-weight:700;letter-spacing:1.5px;color:#0A0A0A;">SF CLUB<span style="color:#999999;font-weight:400;">.PARIS</span></div>
              <div style="font-size:11px;color:#a3a3a3;letter-spacing:.5px;margin-top:3px;">L'h&eacute;ritage en mouvement</div>
              <div style="font-size:12.5px;color:#555555;margin-top:14px;line-height:1.7;">
                07&nbsp;83&nbsp;21&nbsp;27&nbsp;49 &middot; <a href="mailto:contact@sfclub-paris.com" style="color:#555555;text-decoration:none;">contact@sfclub-paris.com</a><br>
                Paris &middot; C&ocirc;te d'Azur &middot; Monaco
              </div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

function bouton(url: string, texte: string) {
  return `<a href="${url}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;margin:6px 8px 6px 0;">${texte}</a>`;
}

// Tableau à 2 colonnes (label / valeur) : plus fiable que inline-block/min-width
// pour l'alignement, en particulier dans Outlook.
function detailBox(rows: [string, string][]) {
  return `<table role="presentation" width="100%" style="background:#f7f7f5;border:1px solid #ececec;margin:18px 0;">
    <tr><td style="padding:14px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows.map(([k, v]) => `<tr>
          <td style="font-size:13.5px;color:#8a8a8a;padding:6px 10px 6px 0;white-space:nowrap;vertical-align:top;">${k}</td>
          <td style="font-size:13.5px;color:#333;padding:6px 0;vertical-align:top;"><b>${v}</b></td>
        </tr>`).join("")}
      </table>
    </td></tr>
  </table>`;
}

async function email(to: string, subject: string, bodyHtml: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html: emailShell(bodyHtml) }),
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

// Deux liens Stripe distincts (redevenu séparé : combiner paiement automatique
// + caution manuelle dans UNE session est rejeté par Stripe quand une facture
// est demandée — "Post-payment invoice creation does not support separate
// authorization and capture"). Le lien location est encaissé immédiatement
// (capture automatique, facture générée par Stripe). Le lien caution est une
// pure préautorisation (capture manuelle), jamais débitée sauf dommages.
function lienPaiement(libelle: string, montant: number, reservationId: number, email?: string) {
  const p: Record<string, string> = {
    mode: "payment",
    client_reference_id: String(reservationId),
    "metadata[reservation_id]": String(reservationId),
    "metadata[type]": "paiement",
    "invoice_creation[enabled]": "true",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": `Location — ${libelle}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(montant * 100)),
    "line_items[0][quantity]": "1",
    success_url: `${SITE_URL}/ma-reservation.html?paiement=ok`,
    cancel_url: `${SITE_URL}/index.html`,
  };
  if (email && email.includes("@")) p["customer_email"] = email;
  return stripeSession(p);
}

function lienCaution(libelle: string, montant: number, reservationId: number, email?: string) {
  const p: Record<string, string> = {
    mode: "payment",
    client_reference_id: String(reservationId),
    "metadata[reservation_id]": String(reservationId),
    "metadata[type]": "caution",
    "payment_intent_data[capture_method]": "manual",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][product_data][name]": `Caution (préautorisation, non débitée) — ${libelle}`,
    "line_items[0][price_data][unit_amount]": String(Math.round(montant * 100)),
    "line_items[0][quantity]": "1",
    success_url: `${SITE_URL}/ma-reservation.html?caution=ok`,
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
    const reference = r.reference || `SF-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;

    // Remise de fidélité automatique, appliquée uniquement sur le montant de la
    // location (jamais sur la caution) — selon le palier de points du client SF Club.
    let montantLocation = r.prix_total || 0;
    let remisePct = 0;
    let palierNom = "";
    if (clientEmail) {
      const { data: cli } = await sbService.from("clients").select("points").eq("email", clientEmail).maybeSingle();
      if (cli) {
        const pts = cli.points || 0;
        if (pts >= 1000) { remisePct = 10; palierNom = "Or"; }
        else if (pts >= 300) { remisePct = 5; palierNom = "Argent"; }
      }
    }
    if (remisePct > 0 && montantLocation > 0) {
      const montantAvantRemise = montantLocation;
      montantLocation = Math.round(montantLocation * (1 - remisePct / 100));
      await sbService.from("agenda_reservations").update({ prix_total: montantLocation }).eq("id", id);
      console.log(`agenda-confirm: remise fidelite ${remisePct}% (palier ${palierNom}) appliquee, reservation ${id} : ${montantAvantRemise}€ -> ${montantLocation}€`);
    }

    const montantCaution = v.caution || 0;
    const libelleComplet = `${libelle} — ${r.date_debut} au ${r.date_fin}`;

    const lienPay = montantLocation > 0 ? await lienPaiement(libelleComplet, montantLocation, id, clientEmail) : null;
    const lienDep = montantCaution > 0 ? await lienCaution(libelleComplet, montantCaution, id, clientEmail) : null;
    if (montantLocation > 0 && !lienPay) console.log(`agenda-confirm: lien paiement non genere pour reservation ${id}`);
    if (montantCaution > 0 && !lienDep) console.log(`agenda-confirm: lien caution non genere pour reservation ${id}`);

    await sbService.from("agenda_reservations").update({ lien_paiement: lienPay, lien_caution: lienDep, reference }).eq("id", id);

    const rowsRecap: [string, string][] = [
      ["Véhicule", libelle],
      ["Dates", `${r.date_debut}${r.heure_debut ? " " + r.heure_debut : ""} → ${r.date_fin}${r.heure_fin ? " " + r.heure_fin : ""}`],
    ];
    if (r.adresse_livraison) rowsRecap.push(["Livraison", r.adresse_livraison]);
    if (r.numero_vol) rowsRecap.push(["Vol", `${r.numero_vol}${r.heure_arrivee_vol ? " — arrivée " + r.heure_arrivee_vol : ""}${r.heure_depart_vol ? ", départ " + r.heure_depart_vol : ""}`]);
    if (montantLocation) rowsRecap.push(["Montant location", `${montantLocation} €` + (remisePct > 0 ? ` (remise fidélité palier ${palierNom} : -${remisePct}% incluse)` : "")]);
    if (montantCaution) rowsRecap.push(["Caution", `${montantCaution} € (préautorisée, non débitée)`]);

    const html = `
      <p>Bonjour ${r.civilite ? r.civilite + " " : ""}${r.client_nom ?? ""},</p>
      <p>Votre réservation est <b>confirmée</b>. Voici le récapitulatif :</p>

      ${detailBox(rowsRecap)}

      <table role="presentation" style="margin:0 0 22px;">
        <tr><td style="background:#0A0A0A;padding:14px 22px;text-align:center;">
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Num&eacute;ro de r&eacute;servation</div>
          <div style="font-size:19px;font-weight:800;letter-spacing:1px;color:#ffffff;margin-top:4px;">${reference}</div>
        </td></tr>
      </table>
      <p style="font-size:13.5px;color:#666;">Conservez ce numéro : il vous permet de retrouver votre réservation à tout moment.</p>
      <div style="margin:6px 0 22px;">
        <a href="${SITE_URL}/ma-reservation.html" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;">Suivre ma réservation</a>
      </div>

      <p>Pour finaliser, merci de nous transmettre <b>par retour de ce mail</b> :</p>
      <ul style="padding-left:20px;color:#333;">
        <li>Une copie de votre permis de conduire</li>
        <li>Une copie de votre passeport ou carte d'identité</li>
      </ul>
      <p style="font-size:13.5px;color:#666;">Aucune photo de carte bancaire n'est nécessaire : la caution est prélevée en
      préautorisation de façon sécurisée directement via le lien ci-dessous.</p>

      <div style="margin-top:22px;">
        ${lienPay ? bouton(lienPay, `Payer la location — ${montantLocation} €`) : ""}
        ${lienDep ? bouton(lienDep, `Préautoriser la caution — ${montantCaution} €`) : ""}
      </div>
      ${!lienPay && montantLocation ? `<p style="font-size:13.5px;color:#666;">Le montant à régler vous sera confirmé par un conseiller.</p>` : ""}`;

    if (clientEmail) await email(clientEmail, `Réservation confirmée — ${reference}`, html);
    await email(
      INTERNAL,
      `Réservation validée — ${reference}`,
      `<p>Réservation <b>${reference}</b> validée pour ${r.client_nom ?? ""} (${r.client_contact ?? ""}).</p>
       ${r.numero_vol ? `<p>Vol ${r.numero_vol}${r.heure_arrivee_vol ? " — arrivée " + r.heure_arrivee_vol : ""}${r.heure_depart_vol ? ", départ " + r.heure_depart_vol : ""}</p>` : ""}
       <p style="margin-top:14px;">Lien paiement : ${lienPay ? `<a href="${lienPay}">${lienPay}</a>` : "non généré"}</p>
       <p>Lien caution : ${lienDep ? `<a href="${lienDep}">${lienDep}</a>` : "non généré"}</p>`,
    );

    return new Response(JSON.stringify({ ok: true, reference, lien_paiement: lienPay, lien_caution: lienDep }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
