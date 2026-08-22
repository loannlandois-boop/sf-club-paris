// ============================================================
// SF MATCH — Edge Function "notify-buyers"
// Déclenchée par un Database Webhook sur INSERT dans listings / searches.
// Fait le matching et envoie les e-mails automatiquement (via Resend).
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//                  SFMATCH_INTERNAL_EMAIL, SFMATCH_FROM
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND = Deno.env.get("RESEND_API_KEY")!;
const INTERNAL = Deno.env.get("SFMATCH_INTERNAL_EMAIL") ?? "contact@sfclub-paris.com";
const FROM = Deno.env.get("SFMATCH_FROM") ?? "SF Club Paris <onboarding@resend.dev>";

const norm = (s: unknown) => (s ?? "").toString().trim().toLowerCase();
function modelMatch(a: string, b: string) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  const ta = a.split(/\s+/)[0], tb = b.split(/\s+/)[0];
  return a.includes(b) || b.includes(a) || ta === tb;
}
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
  if (!to) { console.log("email() skip: destinataire vide"); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html: emailShell(bodyHtml) }),
  });
  const txt = await r.text();
  console.log(`email() -> ${to} | status ${r.status} | ${txt}`);
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const rec = body.record ?? body;
    const table = body.table ?? (rec.photos !== undefined ? "listings" : "searches");
    console.log("payload recu:", JSON.stringify(body));
    console.log("table detectee:", table, "| contact:", rec.contact);

    if (table === "listings") {
      const car = rec;
      const { data: searches } = await sb.from("searches").select("*");
      const matches = (searches ?? []).filter((s: any) =>
        norm(s.marque) === norm(car.marque) &&
        (!s.modele || modelMatch(car.modele, s.modele) || s.similaire !== false)
      );
      for (const s of matches) {
        if (s.contact && String(s.contact).includes("@")) {
          await email(
            s.contact,
            `Un ${car.marque} ${car.modele} correspond à votre recherche`,
            `<p>Bonjour ${s.nom ?? ""},</p><p>Un véhicule correspondant à votre recherche vient d'être proposé au Club : <b>${car.marque} ${car.modele}</b>${car.annee ? ` (${car.annee})` : ""}${car.couleur ? `, ${car.couleur}` : ""}.</p><p>Notre équipe vous met en relation.</p>`,
          );
        }
      }
      await email(
        INTERNAL,
        `SF Match — ${car.marque} ${car.modele} — ${matches.length} acheteur(s)`,
        `<p>Nouveau véhicule : <b>${car.marque} ${car.modele}</b> — vendeur ${car.nom ?? ""} (${car.contact ?? ""})</p><p>Acheteurs correspondants : ${matches.map((m: any) => `${m.nom ?? ""} — ${m.contact ?? ""}`).join(" · ") || "aucun"}</p>`,
      );
      if (car.contact && String(car.contact).includes("@")) {
        await email(
          car.contact,
          `Votre véhicule a bien été transmis à SF Club Paris`,
          `<p>Bonjour ${car.nom ?? ""},</p><p>Nous avons bien reçu votre annonce : <b>${car.marque} ${car.modele}</b>${car.annee ? ` (${car.annee})` : ""}.</p><p>${matches.length ? `${matches.length} acheteur(s) du Club recherchent déjà ce type de véhicule — un conseiller va vous mettre en relation.` : `Votre véhicule est désormais visible par les acheteurs du Club dont la recherche correspond. Vous serez notifié dès qu'une opportunité se présente.`}</p>`,
        );
      }
    }

    if (table === "searches") {
      const s = rec;
      const { data: listings } = await sb.from("listings").select("*");
      const matches = (listings ?? []).filter((c: any) =>
        norm(c.marque) === norm(s.marque) &&
        (!s.modele || modelMatch(c.modele, s.modele) || s.similaire !== false)
      );
      await email(
        INTERNAL,
        `SF Match — Recherche ${s.marque} ${s.modele ?? ""} — ${matches.length} véhicule(s)`,
        `<p>Nouvelle recherche : <b>${s.marque} ${s.modele ?? ""}</b> — ${s.nom ?? ""} (${s.contact ?? ""})</p><p>Véhicules correspondants : ${matches.map((m: any) => `${m.marque} ${m.modele}`).join(" · ") || "aucun"}</p>`,
      );
      if (s.contact && String(s.contact).includes("@")) {
        await email(
          s.contact,
          matches.length
            ? `${matches.length} véhicule(s) correspondent à votre recherche`
            : `Votre alerte SF Match est active`,
          matches.length
            ? `<p>Bonjour ${s.nom ?? ""},</p><p>${matches.length} véhicule(s) du Club correspondent déjà à votre recherche <b>${s.marque} ${s.modele ?? ""}</b>. Notre équipe vous recontacte.</p>`
            : `<p>Bonjour ${s.nom ?? ""},</p><p>Votre recherche <b>${s.marque} ${s.modele ?? ""}</b> a bien été enregistrée. Dès qu'un véhicule correspondant — ou similaire — est déposé au Club, vous êtes notifié en priorité.</p>`,
        );
      }
    }

    return new Response("ok");
  } catch (e) {
    return new Response("error: " + e, { status: 500 });
  }
});
