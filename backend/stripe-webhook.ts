// ============================================================
// SF AGENDA — Edge Function "stripe-webhook"
// Reçoit les événements Stripe en direct (paiement réellement encaissé,
// pas juste le clic sur le lien). Sur "checkout.session.completed", type
// "combine" (lien unique location + caution) :
//  - si une caution est incluse (capture manuelle), capture immédiatement
//    UNIQUEMENT la part location (l'argent arrive normalement), laissant la
//    part caution simplement préautorisée sur la carte
//  - marque la réservation payée, envoie l'e-mail de confirmation
//    (paiement reçu + réservation confirmée) avec le numéro de réservation
// (Conserve aussi les anciens types "paiement"/"caution" pour compatibilité
// avec des liens déjà envoyés avant ce changement.)
//
// IMPORTANT : à déployer avec la vérification JWT DÉSACTIVÉE (Stripe
// n'envoie pas de jeton Supabase). La sécurité est assurée par la
// vérification de signature Stripe ci-dessous (STRIPE_WEBHOOK_SECRET).
//
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, RESEND_API_KEY,
//                  SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";
const SITE_URL = "https://loannlandois-boop.github.io/sf-club-paris";

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

async function capturerPartiel(paymentIntentId: string, montantCents: number) {
  const r = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ amount_to_capture: String(montantCents) }),
  });
  const d = await r.json();
  if (!r.ok) console.log("stripe capture error:", JSON.stringify(d));
  return r.ok;
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const p of sigHeader.split(",")) {
    const [k, v] = p.split("=");
    if (k && v) parts[k] = v;
  }
  if (!parts.t || !parts.v1) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === parts.v1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const sigHeader = req.headers.get("stripe-signature") || "";
    const raw = await req.text();
    const valid = await verifyStripeSignature(raw, sigHeader, WEBHOOK_SECRET);
    if (!valid) return new Response("signature invalide", { status: 400 });

    const event = JSON.parse(raw);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const resId = session.client_reference_id || session.metadata?.reservation_id;
      const type = session.metadata?.type;

      if (resId && type === "combine") {
        const { data: r } = await sb
          .from("agenda_reservations")
          .select("*, agenda_vehicules(marque,modele)")
          .eq("id", resId)
          .maybeSingle();
        if (r && !r.paye) {
          const montantLocationCents = Number(session.metadata?.montant_location_cents || 0);
          const montantCautionCents = Number(session.metadata?.montant_caution_cents || 0);
          const manualCapture = session.metadata?.manual_capture === "1";

          if (manualCapture && montantLocationCents > 0 && session.payment_intent) {
            await capturerPartiel(session.payment_intent, montantLocationCents);
          }

          let facturePdf: string | null = null;
          let factureUrl: string | null = null;
          if (session.invoice) {
            const inv = await fetch(`https://api.stripe.com/v1/invoices/${session.invoice}`, {
              headers: { Authorization: `Bearer ${STRIPE_KEY}` },
            }).then((x) => x.json()).catch(() => null);
            facturePdf = inv?.invoice_pdf || null;
            factureUrl = inv?.hosted_invoice_url || null;
          }

          await sb.from("agenda_reservations").update({
            paye: true,
            caution_recue: montantCautionCents > 0,
          }).eq("id", resId);

          const v = r.agenda_vehicules || {};
          const libelle = ((v.marque || "") + " " + (v.modele || "")).trim() || "votre véhicule";
          const clientEmail = (r.client_contact || "").includes("@") ? r.client_contact : undefined;
          if (clientEmail) {
            await email(
              clientEmail,
              `Paiement reçu — Réservation confirmée — ${r.reference || ""}`,
              `<p>Bonjour Monsieur/Madame ${r.client_nom ?? ""},</p>
               <p>Nous vous confirmons la réception de votre paiement pour <b>${libelle}</b>. Votre réservation
               est désormais <b>garantie et confirmée</b>.</p>

               <table role="presentation" style="margin:20px 0;">
                 <tr><td style="background:#0A0A0A;padding:14px 22px;text-align:center;">
                   <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Num&eacute;ro de r&eacute;servation</div>
                   <div style="font-size:19px;font-weight:800;letter-spacing:1px;color:#ffffff;margin-top:4px;">${r.reference || ""}</div>
                 </td></tr>
               </table>

               ${montantCautionCents > 0 ? `<p style="font-size:13.5px;color:#666;">La caution reste préautorisée sur votre carte, non débitée sauf dommages constatés.</p>` : ""}
               ${facturePdf ? `<div style="margin:20px 0;"><a href="${facturePdf}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;">Télécharger ma facture (PDF)</a></div>` : ""}
               ${factureUrl && !facturePdf ? `<p><a href="${factureUrl}">Consulter ma facture</a></p>` : ""}
               <p style="font-size:13.5px;color:#666;">Conservez votre numéro de réservation : il vous permet de retrouver votre réservation
               à tout moment sur <a href="${SITE_URL}/ma-reservation.html" style="color:#0A0A0A;">ma-reservation.html</a>.</p>
               <p>Notre équipe se tient à votre disposition pour toute question avant votre départ.</p>
               <p>À très bientôt au volant.</p>`,
            );
          }
          await email(
            INTERNAL,
            `Paiement reçu — ${r.reference || resId}`,
            `<p>Paiement encaissé pour <b>${r.client_nom ?? ""}</b> (${r.client_contact ?? ""}), réservation <b>${r.reference || resId}</b>.</p>
             <p>Location : ${(montantLocationCents / 100).toFixed(2)} € encaissée${montantCautionCents ? ` · Caution : ${(montantCautionCents / 100).toFixed(2)} € préautorisée` : ""}.</p>
             ${facturePdf ? `<p>Facture : <a href="${facturePdf}">${facturePdf}</a></p>` : ""}`,
          );
        }
      } else if (resId && type === "paiement") {
        // Compatibilité avec d'anciens liens envoyés avant le passage au lien combiné.
        const { data: r } = await sb.from("agenda_reservations").select("*, agenda_vehicules(marque,modele)").eq("id", resId).maybeSingle();
        if (r && !r.paye) {
          await sb.from("agenda_reservations").update({ paye: true }).eq("id", resId);
          const clientEmail = (r.client_contact || "").includes("@") ? r.client_contact : undefined;
          if (clientEmail) {
            await email(clientEmail, `Paiement reçu — Réservation confirmée — ${r.reference || ""}`, `<p>Bonjour Monsieur/Madame ${r.client_nom ?? ""},</p><p>Votre paiement a bien été reçu, votre réservation <b>${r.reference || ""}</b> est confirmée.</p>`);
          }
          await email(INTERNAL, `Paiement reçu — ${r.reference || resId}`, `<p>Paiement encaissé pour ${r.client_nom ?? ""} (${r.client_contact ?? ""}), réservation ${r.reference || resId}.</p>`);
        }
      } else if (resId && type === "caution") {
        await sb.from("agenda_reservations").update({ caution_recue: true }).eq("id", resId);
      }
    }

    return new Response("ok");
  } catch (e) {
    return new Response("error: " + e, { status: 500 });
  }
});
