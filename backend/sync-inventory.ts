// ============================================================
// SF MATCH — Edge Function "sync-inventory"
// Récupère des annonces chez un agrégateur (ex. Marketcheck) et
// remplit la table `inventory` (avec segment calculé). À lancer par CRON.
// Secret requis : MARKETCHECK_API_KEY  (ou adapter à votre fournisseur)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MC_KEY = Deno.env.get("MARKETCHECK_API_KEY") ?? "";

// --- Classificateur de segment (identique au site / notify-buyers) ---
function segmentOf(marque: string, modele: string): string {
  let s = ((marque || "") + " " + (modele || "")).toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  const has = (...k: string[]) => k.some((x) => s.indexOf(x) !== -1);
  if (has("taycan","e-tron","etron","eqs","eqe","model s","model 3","model x","model y"," i4"," i7"," ix","spectre")) return "electrique";
  if (has("laferrari","sf90","296","f8","812","roma","purosangue","12 cilindri","huracan","huracán","aventador","revuelto","temerario","720s","750s","765","artura","senna","mclaren","chiron","valkyrie","carrera gt","918","gt3 rs","gt2 rs")) return "supercar";
  if (has("cabriolet","décapotable","decapotable","spider","spyder","roadster","volante","convertible"," gtc"," cc"," dawn"," targa")) return "cabriolet";
  if (has("continental gt","flying spur","db11","db12","dbs","vanquish","granturismo","wraith","panamera","ghost","phantom","quattroporte")) return "gt";
  if (has("cullinan","bentayga","urus","purosangue","dbx","g63","g 63","gls 63","gls63","range rover sv","range rover autobiography","range rover vogue")) return "suv_luxe";
  if (has("cayenne","macan","gle","glc","gla","glb","gls","g-class","classe g"," x1"," x3"," x4"," x5"," x6"," x7"," q3"," q5"," q7"," q8","range rover","rangerover","defender","discovery","evoque","velar","wrangler","levante","grecale","stelvio")) return "suv";
  if (has("classe s"," s 500"," s 63","serie 7","série 7"," 7 series"," a8"," i7")) return "berline_luxe";
  if (has("911","992","991","718","cayman","boxster","amg gt"," gt3"," gt4"," m2"," m3"," m4"," m5"," m8"," rs3"," rs5"," rs6"," rs7"," r8","supra","corvette","emira","vantage"," c 63"," e 63"," a45")) return "sport";
  if (has("mini"," 500"," a1","serie 1","série 1","classe a"," polo"," golf","clio","countryman")) return "citadine";
  if (has("classe c","classe e","serie 3","série 3","serie 5","série 5"," a3"," a4"," a5"," a6","giulia")) return "berline";
  return "autre";
}

Deno.serve(async () => {
  try {
    if (!MC_KEY) return new Response(JSON.stringify({ error: "MARKETCHECK_API_KEY manquant" }), { status: 400 });

    // Marques premium ciblées (adaptez à votre positionnement)
    const marques = ["Ferrari", "Lamborghini", "Porsche", "Aston Martin", "Bentley",
      "Rolls-Royce", "McLaren", "Mercedes-Benz", "BMW", "Audi", "Land Rover", "Maserati"];

    let upserted = 0;
    for (const mk of marques) {
      const url = "https://mc-api.marketcheck.com/v2/search/car/active"
        + "?api_key=" + encodeURIComponent(MC_KEY)
        + "&make=" + encodeURIComponent(mk)
        + "&rows=50&sort_by=price&sort_order=desc";
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      const rows = (j.listings ?? []).map((l: any) => {
        const b = l.build ?? {};
        const marque = b.make ?? mk;
        const modele = [b.model, b.trim].filter(Boolean).join(" ");
        return {
          source: "marketcheck",
          ext_id: String(l.id ?? l.vin ?? (marque + modele + (l.price ?? ""))),
          marque, modele,
          annee: b.year ? String(b.year) : null,
          prix: l.price ? String(l.price) : null,
          couleur: l.exterior_color ?? null,
          km: l.miles ? String(l.miles) : null,
          segment: segmentOf(marque, modele),
          url: l.vdp_url ?? null,
          image: (l.media?.photo_links ?? [])[0] ?? null,
          ville: l.dealer?.city ?? null,
          updated_at: new Date().toISOString(),
        };
      }).filter((x: any) => x.marque && x.modele);

      if (rows.length) {
        const { error } = await sb.from("inventory").upsert(rows, { onConflict: "source,ext_id" });
        if (!error) upserted += rows.length;
      }
    }
    return new Response(JSON.stringify({ ok: true, upserted }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
