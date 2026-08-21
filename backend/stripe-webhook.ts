// ============================================================
// SF AGENDA — Edge Function "stripe-webhook"
// Reçoit les événements Stripe en direct (paiement réellement encaissé,
// pas juste le clic sur le lien). Sur "checkout.session.completed" :
//  - type "paiement" -> marque la réservation payée, envoie l'e-mail de
//    remerciement avec le numéro de réservation
//  - type "caution"  -> marque la caution comme préautorisée
//
// IMPORTANT : à déployer avec la vérification JWT DÉSACTIVÉE (Stripe
// n'envoie pas de jeton Supabase). La sécurité est assurée par la
// vérification de signature Stripe ci-dessous (STRIPE_WEBHOOK_SECRET).
//
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  STRIPE_WEBHOOK_SECRET, RESEND_API_KEY,
//                  SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";
const SITE_URL = "https://loannlandois-boop.github.io/sf-club-paris";

async function email(to: string, subject: string, html: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
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

      if (resId && type === "paiement") {
        const { data: r } = await sb
          .from("agenda_reservations")
          .select("*, agenda_vehicules(marque,modele)")
          .eq("id", resId)
          .maybeSingle();
        if (r && !r.paye) {
          await sb.from("agenda_reservations").update({ paye: true }).eq("id", resId);
          const v = r.agenda_vehicules || {};
          const libelle = ((v.marque || "") + " " + (v.modele || "")).trim() || "votre véhicule";
          const clientEmail = (r.client_contact || "").includes("@") ? r.client_contact : undefined;
          if (clientEmail) {
            await email(
              clientEmail,
              `Merci ! Paiement reçu — ${r.reference || ""}`,
              `<p>Bonjour ${r.client_nom ?? ""},</p>
               <p>Nous vous remercions : votre paiement pour <b>${libelle}</b> a bien été reçu.</p>
               <p>Votre numéro de réservation : <b>${r.reference || ""}</b>. Conservez-le : il vous permet de
               retrouver votre réservation à tout moment sur
               <a href="${SITE_URL}/ma-reservation.html">${SITE_URL}/ma-reservation.html</a>.</p>
               <p>À très bientôt.<br>— SF Club Paris</p>`,
            );
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
