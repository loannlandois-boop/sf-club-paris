// ============================================================
// SF AGENDA — Edge Function "agenda-merci"
// Appelée automatiquement chaque jour (via pg_cron, voir cron-merci.sql).
// Cherche les réservations dont la location se termine aujourd'hui (ou
// avant, au cas où le job aurait manqué un jour), payées, et pas encore
// remerciées -> envoie un e-mail de remerciement au client.
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  RESEND_API_KEY, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
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
                04&nbsp;93&nbsp;08&nbsp;02&nbsp;80 &middot; <a href="mailto:contact@sfclub-paris.com" style="color:#555555;text-decoration:none;">contact@sfclub-paris.com</a><br>
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

Deno.serve(async (_req) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await sb
      .from("agenda_reservations")
      .select("*, agenda_vehicules(marque,modele)")
      .eq("statut", "confirmee")
      .eq("paye", true)
      .eq("merci_envoye", false)
      .lte("date_fin", today);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    let envoyes = 0;
    for (const r of rows || []) {
      const v = r.agenda_vehicules || {};
      const libelle = ((v.marque || "") + " " + (v.modele || "")).trim() || "votre véhicule";
      const clientEmail = (r.client_contact || "").includes("@") ? r.client_contact : null;
      if (clientEmail) {
        await email(
          clientEmail,
          `Merci de votre confiance — SF Club Paris`,
          `<p>Bonjour ${r.client_nom ?? ""},</p>
           <p>Nous espérons que vous avez passé un excellent moment au volant de votre <b>${libelle}</b>.</p>
           <p>Toute l'équipe SF Club Paris vous remercie pour votre confiance, et espère vous accueillir à
           nouveau très prochainement.</p>
           <p style="font-size:13.5px;color:#666;">Une remarque sur votre expérience ? Répondez simplement à
           cet e-mail, nous lisons chaque retour avec attention.</p>
           <p>À très bientôt.</p>`,
        );
        await sb.from("agenda_reservations").update({ merci_envoye: true }).eq("id", r.id);
        envoyes++;
      } else {
        await sb.from("agenda_reservations").update({ merci_envoye: true }).eq("id", r.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, envoyes }));
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
