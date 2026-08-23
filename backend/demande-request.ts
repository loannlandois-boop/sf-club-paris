// ============================================================
// SF CLUB PARIS — Edge Function "demande-request"
// Fonction générique appelée par tous les formulaires du site public
// (Contact, Événements, Financement, Estimation Achat & Revente,
// Adhésion Club). Enregistre la demande + envoie l'e-mail interne et
// la confirmation au client.
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//                  RESEND_API_KEY, SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIBELLES: Record<string, { interne: string; sujetClient: string; texteClient: string }> = {
  contact: {
    interne: "Nouvelle demande de contact",
    sujetClient: "Votre message a bien été reçu",
    texteClient: "Nous avons bien reçu votre message. Notre équipe vous répond dans les plus brefs délais.",
  },
  evenement: {
    interne: "Nouvelle demande — Programme des événements",
    sujetClient: "Votre demande de programme a bien été reçue",
    texteClient: "Nous avons bien reçu votre demande. Un conseiller vous transmet le calendrier et les modalités d'accès sous peu.",
  },
  financement: {
    interne: "Nouvelle demande de financement",
    sujetClient: "Votre demande de financement a bien été reçue",
    texteClient: "Nous avons bien reçu votre demande. Notre équipe étudie votre dossier et revient vers vous sous 24 h avec une solution adaptée.",
  },
  estimation: {
    interne: "Nouvelle demande — Achat & Revente",
    sujetClient: "Votre demande a bien été reçue",
    texteClient: "Nous avons bien reçu votre demande. Notre équipe revient vers vous sous 24 h.",
  },
  adhesion: {
    interne: "Nouvelle candidature au Club",
    sujetClient: "Votre candidature a bien été reçue",
    texteClient: "Nous avons bien reçu votre candidature d'adhésion. Notre équipe l'examine avec attention et revient vers vous sous 48 h.",
  },
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

function detailBox(rows: [string, string][]) {
  return `<table role="presentation" width="100%" style="background:#f7f7f5;border:1px solid #ececec;margin:18px 0;">
    <tr><td style="padding:18px 20px;">
      ${rows.map(([k, v]) => `<div style="font-size:13.5px;color:#333;padding:5px 0;"><span style="color:#8a8a8a;display:inline-block;min-width:120px;">${k}</span><b>${v}</b></div>`).join("")}
    </td></tr>
  </table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const type = String(b.type || "contact");
    const nom = b.nom || "";
    const email_ = b.email || "";
    const telephone = b.telephone || "";
    const sujet = b.sujet || "";
    const message = b.message || "";
    const details: Record<string, string> = b.details || {};

    if (!nom || (!email_ && !telephone)) {
      return new Response(JSON.stringify({ error: "champs manquants" }), { status: 400, headers: CORS });
    }

    const { error } = await sb.from("demandes").insert({
      type, nom, email: email_, telephone, sujet, message, details,
    });
    if (error) {
      console.log("demande-request insert error:", JSON.stringify(error));
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    }

    const lib = LIBELLES[type] || LIBELLES.contact;
    const rows: [string, string][] = [
      ["Nom", nom],
      ["Contact", [email_, telephone].filter(Boolean).join(" · ") || "—"],
    ];
    if (sujet) rows.push(["Sujet", sujet]);
    for (const [k, v] of Object.entries(details)) if (v) rows.push([k, String(v)]);

    await email(
      INTERNAL,
      `${lib.interne} — ${nom}`,
      `<p>${lib.interne} :</p>
       ${detailBox(rows)}
       ${message ? `<p style="white-space:pre-wrap;">${message}</p>` : ""}`,
    );

    if (email_ && email_.includes("@")) {
      await email(
        email_,
        lib.sujetClient,
        `<p>Bonjour ${nom},</p><p>${lib.texteClient}</p>`,
      );
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (e) {
    console.log("demande-request error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
