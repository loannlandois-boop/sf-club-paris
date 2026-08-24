// ============================================================
// SF CLUB PARIS — Edge Function "client-bienvenue"
// Appelée par connexion.html juste après la création d'un compte client.
// Crédite une offre de bienvenue (50 points de fidélité) et envoie
// l'e-mail de bienvenue correspondant.
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  RESEND_API_KEY, SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";
const SITE_URL = "https://loannlandois-boop.github.io/sf-club-paris";
const POINTS_BIENVENUE = 50;

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
    const email_ = String(b.email || "").trim();
    const civilite = b.civilite || "";
    const prenom = b.prenom || "";
    const nom = b.nom || "";
    if (!email_) return new Response(JSON.stringify({ error: "email manquant" }), { status: 400, headers: CORS });

    const { data: cli } = await sb.from("clients").select("id, points, bienvenue_envoye").eq("email", email_).maybeSingle();
    let pointsTotal = POINTS_BIENVENUE;
    if (cli && !cli.bienvenue_envoye) {
      pointsTotal = (cli.points || 0) + POINTS_BIENVENUE;
      await sb.from("clients").update({ points: pointsTotal, bienvenue_envoye: true }).eq("id", cli.id);
    } else if (cli) {
      pointsTotal = cli.points || 0; // déjà envoyé, on ne recrédite pas
    }

    await email(
      email_,
      `Bienvenue au SF Club Paris — 50 points offerts`,
      `<p>Bonjour ${civilite ? civilite + " " : ""}${prenom} ${nom},</p>
       <p>Votre compte SF Club Paris est créé — bienvenue parmi nous.</p>

       <table role="presentation" style="margin:22px 0;">
         <tr><td style="background:#0A0A0A;padding:18px 24px;text-align:center;">
           <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Offre de bienvenue</div>
           <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:6px;">+${POINTS_BIENVENUE} points offerts</div>
           <div style="font-size:12px;color:#999999;margin-top:4px;">crédités dès aujourd'hui sur votre compte</div>
         </td></tr>
       </table>

       <p>Cumulez des points à chaque réservation payée (1 point / 10 € dépensés) et progressez à travers nos
       paliers Bronze, Argent puis Or.</p>
       <div style="margin:22px 0;">
         <a href="${SITE_URL}/mon-compte.html" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;">Voir mon compte</a>
         <a href="${SITE_URL}/location.html" style="display:inline-block;color:#0A0A0A;text-decoration:underline;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 6px;">Réserver un véhicule</a>
       </div>
       <p style="font-size:13.5px;color:#666;">À très bientôt au volant.</p>`,
    );

    await email(
      INTERNAL,
      `Nouveau compte client — ${prenom} ${nom}`,
      `<p>Nouveau compte créé : <b>${civilite} ${prenom} ${nom}</b> — ${email_}. ${POINTS_BIENVENUE} points de bienvenue crédités.</p>`,
    );

    return new Response(JSON.stringify({ ok: true, points: pointsTotal }), { headers: CORS });
  } catch (e) {
    console.log("client-bienvenue error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
