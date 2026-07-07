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
async function email(to: string, subject: string, html: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const rec = body.record ?? body;
    const table = body.table ?? (rec.photos !== undefined ? "listings" : "searches");

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
            `<p>Bonjour ${s.nom ?? ""},</p><p>Un véhicule correspondant à votre recherche vient d'être proposé au Club : <b>${car.marque} ${car.modele}</b>${car.annee ? ` (${car.annee})` : ""}${car.couleur ? `, ${car.couleur}` : ""}.</p><p>Notre équipe vous met en relation.<br>— SF Club Paris</p>`,
          );
        }
      }
      await email(
        INTERNAL,
        `SF Match — ${car.marque} ${car.modele} — ${matches.length} acheteur(s)`,
        `<p>Nouveau véhicule : <b>${car.marque} ${car.modele}</b> — vendeur ${car.nom ?? ""} (${car.contact ?? ""})</p><p>Acheteurs correspondants : ${matches.map((m: any) => `${m.nom ?? ""} — ${m.contact ?? ""}`).join(" · ") || "aucun"}</p>`,
      );
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
      if (matches.length && s.contact && String(s.contact).includes("@")) {
        await email(
          s.contact,
          `${matches.length} véhicule(s) correspondent à votre recherche`,
          `<p>Bonjour ${s.nom ?? ""},</p><p>${matches.length} véhicule(s) du Club correspondent déjà à votre recherche. Notre équipe vous recontacte.<br>— SF Club Paris</p>`,
        );
      }
    }

    return new Response("ok");
  } catch (e) {
    return new Response("error: " + e, { status: 500 });
  }
});
