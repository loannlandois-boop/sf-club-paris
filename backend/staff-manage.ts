// ============================================================
// SF CLUB PARIS — Edge Function "staff-manage"
// Appelée depuis le CRM interne (onglet "Équipe") par l'ADMINISTRATEUR
// pour réinitialiser le mot de passe d'un collègue ou supprimer son
// compte (comme un admin Google Workspace). Réservé à is_admin() —
// vérifié à chaque appel avant toute action.
// Corps attendu : { action: "reset" | "delete", staff_id: "<uuid>" }
// Secrets requis : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//                  (tous automatiques), RESEND_API_KEY, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sbService = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";
const SITE_URL = "https://loannlandois-boop.github.io/sf-club-paris";
const AGENDA_URL = `${SITE_URL}/equipe-5097a044d0-agenda.html`;

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

function genTempPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: CORS });

    const sbCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: caller } = await sbCaller.auth.getUser();
    const { data: isAdmin, error: staffErr } = await sbCaller.rpc("is_admin");
    if (staffErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Réservé à l'administrateur SF Club Paris." }), { status: 403, headers: CORS });
    }

    const b = await req.json();
    const action = String(b.action || "");
    const staffId = String(b.staff_id || "");
    if (!staffId) return new Response(JSON.stringify({ error: "Membre manquant." }), { status: 400, headers: CORS });
    if (caller?.user && staffId === caller.user.id) {
      return new Response(JSON.stringify({ error: "Impossible d'agir sur votre propre compte depuis cet écran." }), { status: 400, headers: CORS });
    }

    const { data: target } = await sbService.from("staff_users").select("email, nom, prenom, civilite").eq("id", staffId).maybeSingle();
    if (!target) return new Response(JSON.stringify({ error: "Membre introuvable." }), { status: 404, headers: CORS });

    if (action === "reset") {
      const tempPassword = genTempPassword();
      const { error: updErr } = await sbService.auth.admin.updateUserById(staffId, { password: tempPassword });
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: CORS });

      await email(
        target.email,
        "Votre mot de passe a été réinitialisé — SF Club Paris",
        `<p>Bonjour ${target.civilite ? target.civilite + " " : ""}${target.prenom || target.nom || ""},</p>
         <p>Votre mot de passe pour l'espace équipe SF Club Paris vient d'être réinitialisé par l'administrateur.</p>
         <table role="presentation" style="margin:22px 0;">
           <tr><td style="background:#0A0A0A;padding:18px 24px;">
             <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Nouveau mot de passe temporaire</div>
             <div style="font-size:16px;color:#ffffff;margin-top:8px;"><b>${tempPassword}</b></div>
           </td></tr>
         </table>
         <div style="margin:22px 0;">
           <a href="${AGENDA_URL}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;">Accéder à l'espace équipe</a>
         </div>
         <p style="font-size:12.5px;color:#999">Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement l'administrateur.</p>`,
      );
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (action === "delete") {
      const { error: delErr } = await sbService.auth.admin.deleteUser(staffId);
      if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: CORS });
      // staff_users a on delete cascade sur auth.users, la ligne équipe est supprimée automatiquement.
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Action inconnue." }), { status: 400, headers: CORS });
  } catch (e) {
    console.log("staff-manage error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
