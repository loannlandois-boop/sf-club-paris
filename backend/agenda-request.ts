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

async function email(to: string, subject: string, bodyHtml: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html: emailShell(bodyHtml) }),
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

    if (error) {
      console.log("agenda-request insert error:", JSON.stringify(error));
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    }

    const libelleVehicule = (marque + " " + modele).trim() || "véhicule à confirmer";

    const detailBox = (rows: [string, string][]) => `
      <table role="presentation" width="100%" style="background:#f7f7f5;border:1px solid #ececec;margin:18px 0;">
        <tr><td style="padding:18px 20px;">
          ${rows.map(([k, v]) => `<div style="font-size:13.5px;color:#333;padding:5px 0;"><span style="color:#8a8a8a;display:inline-block;min-width:120px;">${k}</span><b>${v}</b></div>`).join("")}
        </td></tr>
      </table>`;

    await email(
      INTERNAL,
      `Nouvelle demande de réservation — ${libelleVehicule}`,
      `<p>Nouvelle demande à valider dans l'agenda interne :</p>
       ${detailBox([
         ["Véhicule", libelleVehicule + (agence_nom ? ` (${agence_nom})` : "")],
         ["Dates", `${date_debut}${heure_debut ? " " + heure_debut : ""} → ${date_fin}${heure_fin ? " " + heure_fin : ""}`],
         ["Livraison", adresse_livraison || "non précisée"],
         ...(numero_vol ? [["Vol", `${numero_vol}${heure_arrivee_vol ? " — arrivée " + heure_arrivee_vol : ""}${heure_depart_vol ? ", départ " + heure_depart_vol : ""}`] as [string, string]] : []),
         ["Prix estimé", prix_total ? prix_total + " €" : "sur devis"],
         ["Client", `${nom} — ${contact}`],
       ])}
       <p>Connectez-vous à l'agenda pour valider ou refuser cette demande.</p>`,
    );

    if (contact.includes("@")) {
      await email(
        contact,
        `Votre demande de réservation a bien été reçue`,
        `<p>Bonjour ${nom},</p>
         <p>Nous avons bien reçu votre demande pour <b>${libelleVehicule}</b>, du ${date_debut} au ${date_fin}.</p>
         <p>Un conseiller SF Club Paris valide votre réservation sous peu et revient vers vous.</p>`,
      );
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }), { headers: CORS });
  } catch (e) {
    console.log("agenda-request error:", String(e), e instanceof Error ? e.stack : "");
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
