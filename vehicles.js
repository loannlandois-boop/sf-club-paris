/* ============================================================
   SF MATCH — Base de véhicules réels + moteur de similarité
   Segments : supercar · sport · gt · suv_luxe · suv · berline_luxe
              berline · cabriolet · citadine · electrique
   ============================================================ */
(function (root) {

  // Classe n'importe quelle (marque, modèle) en un "segment" (type de véhicule).
  // Robuste aux modèles inconnus grâce à des règles par mots-clés.
  function sfSegmentOf(marque, modele) {
    var s = ((marque || '') + ' ' + (modele || '')).toLowerCase()
      .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    function has() { for (var i = 0; i < arguments.length; i++) if (s.indexOf(arguments[i]) !== -1) return true; return false; }

    // 100 % électriques
    if (has('taycan', 'e-tron', 'etron', 'eqs', 'eqe', 'model s', 'model 3', 'model x', 'model y',
      ' i4', ' i5', ' i7', ' ix', 'spectre', 'lucid', 'rimac', ' evija', ' eq ')) return 'electrique';

    // Supercars / exotiques
    if (has('laferrari', 'sf90', '296', 'f8', '812', 'roma', 'purosangue', '12 cilindri', 'monza', 'daytona sp3',
      'huracan', 'huracán', 'aventador', 'revuelto', 'temerario', 'countach',
      '720s', '750s', '765', '765lt', 'artura', 'senna', ' p1', ' gt ', 'mclaren',
      'chiron', 'veyron', 'tourbillon', 'valkyrie', 'valour', 'vulcan',
      'carrera gt', '918', 'gt2 rs', 'gt3 rs', 'revuelto', 'utopia', 'battista')) return 'supercar';

    // Cabriolets (attribut fort — beaucoup d'acheteurs cherchent “un cabriolet”)
    if (has('cabriolet', 'décapotable', 'decapotable', 'spider', 'spyder', 'roadster',
      'volante', 'convertible', ' gtc', ' cc', ' dawn', ' targa')) return 'cabriolet';

    // Grand tourisme
    if (has('continental gt', 'flying spur', 'db11', 'db12', 'dbs', 'vanquish', 'granturismo',
      'wraith', 'panamera', 'ghost', 'phantom', 'quattroporte', 'lc 500', 'lc500')) return 'gt';

    // SUV ultra-luxe
    if (has('cullinan', 'bentayga', 'urus', 'purosangue', 'dbx', 'g63', 'g 63', 'g65', 'g manufaktur',
      'gls 63', 'gls63', 'range rover sv', 'range rover autobiography', 'range rover vogue', 'levante trofeo')) return 'suv_luxe';

    // SUV premium
    if (has('cayenne', 'macan', 'gle', 'glc', 'gla', 'glb', 'gls', ' g class', 'g-class', 'classe g',
      ' x1', ' x2', ' x3', ' x4', ' x5', ' x6', ' x7', 'ix',
      ' q2', ' q3', ' q5', ' q7', ' q8', 'range rover', 'rangerover', 'defender', 'discovery', 'evoque', 'velar',
      'wrangler', 'grand cherokee', 'levante', 'grecale', 'stelvio', 'touareg', 'tiguan', 'dbx707')) return 'suv';

    // Berlines de luxe
    if (has('classe s', 'class s', ' s class', ' s 500', ' s 63', 'serie 7', 'série 7', ' 7 series', ' a8', ' i7')) return 'berline_luxe';

    // Sportives / coupés performants
    if (has('911', '992', '991', '718', 'cayman', 'boxster', 'amg gt', ' gt r', ' gtr', ' gt3', ' gt4',
      ' m2', ' m3', ' m4', ' m5', ' m8', ' rs3', ' rs4', ' rs5', ' rs6', ' rs7', ' r8', ' tt rs', ' tts',
      'supra', 'corvette', 'emira', 'vantage', 'nsx', 'gr yaris', 'gr86', 'cayman', 'a45', 'cla 45', 'c 63', 'e 63')) return 'sport';

    // Citadines / compactes
    if (has('mini', ' 500', 'fiat 500', ' a1', 'serie 1', 'série 1', ' 1 series', 'classe a', 'class a',
      ' polo', ' golf', 'clio', ' up', ' 208', ' 108', ' twingo', ' countryman')) return 'citadine';

    // Berlines / breaks classiques
    if (has('classe c', 'classe e', 'classe b', ' c class', ' e class', 'serie 3', 'série 3', 'serie 5', 'série 5',
      ' 3 series', ' 5 series', ' a3', ' a4', ' a5', ' a6', ' a7', 'passat', 'insignia', 'giulia')) return 'berline';

    // Monospaces / vans de luxe
    if (has('classe v', 'class v', ' vito', 'viano', 'multivan', 'california')) return 'berline_luxe';

    return 'autre';
  }

  // Libellé lisible d'un segment
  var LABELS = {
    supercar: 'Supercar', sport: 'Sportive', gt: 'Grand Tourisme',
    suv_luxe: 'SUV ultra-luxe', suv: 'SUV premium', berline_luxe: 'Berline de luxe',
    berline: 'Berline', cabriolet: 'Cabriolet', citadine: 'Citadine',
    electrique: 'Électrique', autre: 'Véhicule'
  };
  function sfSegmentLabel(seg) { return LABELS[seg] || 'Véhicule'; }

  // Score de correspondance entre deux véhicules
  //  'exact'   : même marque + même modèle (approché)
  //  'similar' : même type (segment) — la vraie "intelligence"
  //  null      : rien à voir
  function norm(x) { return (x || '').toString().trim().toLowerCase().replace(/\s+/g, ' '); }
  function sfMatch(a, b, allowSimilar) {
    var ma = norm(a.marque), mb = norm(b.marque);
    var na = norm(a.modele), nb = norm(b.modele);
    if (ma && mb && ma === mb && na && nb) {
      var ta = na.split(' ')[0], tb = nb.split(' ')[0];
      if (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1 || ta === tb) return 'exact';
    }
    if (allowSimilar === false) return null;
    var sa = sfSegmentOf(a.marque, a.modele), sb = sfSegmentOf(b.marque, b.modele);
    if (sa !== 'autre' && sa === sb) return 'similar';
    return null;
  }

  // Catalogue de référence (véhicules réels) — sert à l'autocomplétion
  // et aux suggestions “modèles similaires du réseau”.
  var CATALOG = [
    // Supercars
    ['Ferrari', 'LaFerrari'], ['Ferrari', 'SF90 Stradale'], ['Ferrari', '296 GTB'], ['Ferrari', '296 GTS'],
    ['Ferrari', 'F8 Tributo'], ['Ferrari', '812 Superfast'], ['Ferrari', '812 GTS'], ['Ferrari', 'Roma'],
    ['Ferrari', 'Portofino M'], ['Ferrari', 'Purosangue'], ['Ferrari', '12 Cilindri'], ['Ferrari', 'Daytona SP3'],
    ['Lamborghini', 'Revuelto'], ['Lamborghini', 'Huracán Evo'], ['Lamborghini', 'Huracán STO'],
    ['Lamborghini', 'Huracán Tecnica'], ['Lamborghini', 'Aventador SVJ'], ['Lamborghini', 'Temerario'], ['Lamborghini', 'Urus S'], ['Lamborghini', 'Urus Performante'],
    ['McLaren', '720S'], ['McLaren', '750S'], ['McLaren', 'Artura'], ['McLaren', '765LT'], ['McLaren', 'GT'],
    ['Porsche', '911 Carrera'], ['Porsche', '911 Carrera S'], ['Porsche', '911 Carrera GTS'], ['Porsche', '911 Turbo S'],
    ['Porsche', '911 GT3'], ['Porsche', '911 GT3 RS'], ['Porsche', '911 Dakar'], ['Porsche', '718 Cayman'],
    ['Porsche', '718 Boxster'], ['Porsche', '718 Spyder'], ['Porsche', 'Panamera'], ['Porsche', 'Panamera Turbo S'],
    ['Porsche', 'Taycan'], ['Porsche', 'Taycan Turbo S'], ['Porsche', 'Macan'], ['Porsche', 'Cayenne'],
    ['Porsche', 'Cayenne Coupé'], ['Porsche', 'Cayenne Turbo GT'],
    ['Aston Martin', 'DB11'], ['Aston Martin', 'DB12'], ['Aston Martin', 'DB12 Volante'], ['Aston Martin', 'Vantage'],
    ['Aston Martin', 'DBS'], ['Aston Martin', 'DBX'], ['Aston Martin', 'DBX707'],
    ['Bentley', 'Continental GT'], ['Bentley', 'Continental GT Speed'], ['Bentley', 'Continental GTC'],
    ['Bentley', 'Flying Spur'], ['Bentley', 'Bentayga'], ['Bentley', 'Bentayga S'],
    ['Rolls-Royce', 'Ghost'], ['Rolls-Royce', 'Phantom'], ['Rolls-Royce', 'Cullinan'], ['Rolls-Royce', 'Spectre'],
    ['Rolls-Royce', 'Wraith'], ['Rolls-Royce', 'Dawn'],
    ['Maserati', 'MC20'], ['Maserati', 'GranTurismo'], ['Maserati', 'Grecale'], ['Maserati', 'Levante'], ['Maserati', 'Quattroporte'],
    // Mercedes-AMG / Mercedes
    ['Mercedes-AMG', 'GT 63'], ['Mercedes-AMG', 'GT 63 S'], ['Mercedes-AMG', 'C 63'], ['Mercedes-AMG', 'E 63'],
    ['Mercedes-AMG', 'A 45 S'], ['Mercedes-AMG', 'CLA 45'], ['Mercedes-AMG', 'G 63'], ['Mercedes-AMG', 'GLE 53'],
    ['Mercedes-AMG', 'GLS 63'], ['Mercedes', 'Classe S'], ['Mercedes', 'Classe E'], ['Mercedes', 'Classe C'],
    ['Mercedes', 'Classe A'], ['Mercedes', 'CLE Cabriolet'], ['Mercedes', 'GLC'], ['Mercedes', 'GLE'],
    ['Mercedes', 'GLS'], ['Mercedes', 'Classe G'], ['Mercedes', 'EQS'], ['Mercedes', 'Classe V'],
    // BMW
    ['BMW', 'M2'], ['BMW', 'M3'], ['BMW', 'M4'], ['BMW', 'M4 Cabriolet'], ['BMW', 'M5'], ['BMW', 'M8'],
    ['BMW', 'Série 3'], ['BMW', 'Série 5'], ['BMW', 'Série 7'], ['BMW', 'Série 8'], ['BMW', 'i7'], ['BMW', 'iX'],
    ['BMW', 'X3'], ['BMW', 'X4'], ['BMW', 'X5'], ['BMW', 'X6'], ['BMW', 'X7'], ['BMW', 'Z4'],
    // Audi
    ['Audi', 'R8'], ['Audi', 'RS3'], ['Audi', 'RS4 Avant'], ['Audi', 'RS5'], ['Audi', 'RS6 Avant'],
    ['Audi', 'RS7'], ['Audi', 'RS Q8'], ['Audi', 'e-tron GT'], ['Audi', 'Q5'], ['Audi', 'Q7'], ['Audi', 'Q8'],
    ['Audi', 'A5 Cabriolet'], ['Audi', 'A6'], ['Audi', 'A8'], ['Audi', 'TT RS'],
    // Land Rover / Range Rover
    ['Land Rover', 'Range Rover'], ['Land Rover', 'Range Rover SV'], ['Land Rover', 'Range Rover Sport'],
    ['Land Rover', 'Range Rover Velar'], ['Land Rover', 'Range Rover Evoque'], ['Land Rover', 'Defender 90'],
    ['Land Rover', 'Defender 110'], ['Land Rover', 'Discovery'],
    // Autres sport / citadines
    ['Alpine', 'A110'], ['Alpine', 'A110 S'], ['Lotus', 'Emira'], ['Lotus', 'Eletre'],
    ['Chevrolet', 'Corvette C8'], ['Toyota', 'GR Supra'], ['Toyota', 'GR Yaris'],
    ['Mini', 'Cooper S'], ['Mini', 'Cooper Cabriolet'], ['Mini', 'Countryman'], ['Mini', 'John Cooper Works'],
    ['Jeep', 'Wrangler'], ['Jeep', 'Grand Cherokee'],
    ['Tesla', 'Model S'], ['Tesla', 'Model 3'], ['Tesla', 'Model X'], ['Tesla', 'Model Y']
  ].map(function (x) { return { marque: x[0], modele: x[1], seg: sfSegmentOf(x[0], x[1]) }; });

  root.SF_VEHICLES = CATALOG;
  root.sfSegmentOf = sfSegmentOf;
  root.sfSegmentLabel = sfSegmentLabel;
  root.sfMatch = sfMatch;

})(typeof window !== 'undefined' ? window : this);
