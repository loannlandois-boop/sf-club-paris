// ============================================================
// SF CLUB PARIS — Edge Function "staff-invite"
// Appelée depuis le CRM interne (onglet "Équipe") par un ADMINISTRATEUR
// déjà connecté, pour créer le compte d'un nouveau collègue.
// Vérifie d'abord que l'appelant est bien administrateur (is_admin())
// avant de créer quoi que ce soit — sinon n'importe quel membre de
// l'équipe pourrait créer des comptes équipe librement.
// Crée le compte Supabase Auth (mot de passe temporaire), l'ajoute à
// staff_users avec ses infos, puis envoie ce mot de passe par e-mail
// au nouveau membre.
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
    const { data: isAdmin, error: staffErr } = await sbCaller.rpc("is_admin");
    if (staffErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Réservé à l'administrateur SF Club Paris." }), { status: 403, headers: CORS });
    }

    const b = await req.json();
    const emailAdresse = String(b.email || "").trim().toLowerCase();
    const nom = String(b.nom || "").trim();
    const prenom = String(b.prenom || "").trim();
    const civilite = String(b.civilite || "").trim();
    const telephone = String(b.telephone || "").trim();
    if (!emailAdresse || !emailAdresse.includes("@")) {
      return new Response(JSON.stringify({ error: "Adresse e-mail invalide." }), { status: 400, headers: CORS });
    }

    const tempPassword = genTempPassword();
    const { data: created, error: createErr } = await sbService.auth.admin.createUser({
      email: emailAdresse,
      password: tempPassword,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message?.includes("already been registered")
        ? "Un compte existe déjà avec cet e-mail."
        : (createErr?.message || "Création du compte impossible.");
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: CORS });
    }

    const { error: insErr } = await sbService.from("staff_users").insert({
      id: created.user.id,
      email: emailAdresse,
      nom: nom || null,
      prenom: prenom || null,
      civilite: civilite || null,
      telephone: telephone || null,
      doit_changer_mdp: true,
    });
    if (insErr) {
      // rollback : on ne laisse pas traîner un compte Auth sans accès équipe
      await sbService.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Impossible d'ajouter le compte à l'équipe : " + insErr.message }), { status: 500, headers: CORS });
    }

    await email(
      emailAdresse,
      "Votre accès à l'espace équipe SF Club Paris",
      `<p>Bonjour ${civilite ? civilite + " " : ""}${prenom || nom || ""},</p>
       <p>Un compte vient d'être créé pour vous sur l'espace équipe SF Club Paris.</p>
       <table role="presentation" style="margin:22px 0;">
         <tr><td style="background:#0A0A0A;padding:18px 24px;">
           <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Identifiants</div>
           <div style="font-size:14px;color:#ffffff;margin-top:8px;">Email : <b>${emailAdresse}</b></div>
           <div style="font-size:14px;color:#ffffff;margin-top:4px;">Mot de passe provisoire : <b>${tempPassword}</b></div>
         </td></tr>
       </table>
       <p>Connectez-vous avec ce mot de passe provisoire — il vous sera demandé d'en choisir un nouveau dès votre première connexion.</p>
       <div style="margin:22px 0;">
         <a href="${AGENDA_URL}" style="display:inline-block;background:#0A0A0A;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:.5px;padding:13px 24px;">Accéder à l'espace équipe</a>
       </div>
       <p style="font-size:12.5px;color:#999">Cette adresse n'est communiquée qu'à l'équipe SF Club Paris — merci de ne pas la partager.</p>`,
    );

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (e) {
    console.log("staff-invite error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
