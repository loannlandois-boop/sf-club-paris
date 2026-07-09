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

/* Modèles réels (NHTSA vPIC — gratuit) pour l'autocomplétion */
(function(r){ r.SF_MODELS = ["Alfa Romeo 164","Alfa Romeo 4C","Alfa Romeo 8C Competizione Spider","Alfa Romeo GTV6","Alfa Romeo Giulia (952)","Alfa Romeo Milano","Alfa Romeo Spider","Alfa Romeo Stelvio","Alfa Romeo Tonale","Alpine #1 ALPINE CUSTOMS","Alpine ALPINE WELDING & FABRICATION INC TRAILER","Alpine Alpine","Alpine Alpine Industrial, LLC","Alpine Alpine Trailers, LLC","Aston Martin DB11","Aston Martin DB12","Aston Martin DB7","Aston Martin DB9","Aston Martin DBS","Aston Martin DBX","Aston Martin Lagonda","Aston Martin Rapide","Aston Martin V12 Vantage","Aston Martin V8","Aston Martin V8 Vantage","Aston Martin Valhalla","Aston Martin Valiant","Aston Martin Valour","Aston Martin Vanquish","Aston Martin Vanquish Zagato","Aston Martin Vantage","Aston Martin Virage","Audi 100","Audi 200","Audi 4000","Audi 5000","Audi 80","Audi 90","Audi A3","Audi A4","Audi A4 allroad","Audi A5","Audi A6","Audi A6 allroad","Audi A7","Audi A7 e","Audi A8","Audi A8 L","Audi A8 L e","Audi A8 e","Audi Cabriolet","Audi Coupe","Audi Q3","Audi Q4","Audi Q5","Audi Q5 e","Audi Q6","Audi Q7","Audi Q8","Audi R8","Audi RS 3","Audi RS 4","Audi RS 5","Audi RS 6","Audi RS 6 Avant","Audi RS 7","Audi RS Q8","Audi RS e-tron GT","Audi S e-tron GT","Audi S3","Audi S4","Audi S5","Audi S6","Audi S7","Audi S8","Audi SQ5","Audi SQ6","Audi SQ7","Audi SQ8","Audi TT","Audi TT RS","Audi TTS","Audi V8","Audi allroad","Audi e-tron","Audi e-tron GT","Audi e-tron Sportback","BMW 128i","BMW 135i","BMW 1M","BMW 228","BMW 228i","BMW 230i","BMW 318i","BMW 318iC","BMW 318iS","BMW 318ti","BMW 320i","BMW 323i","BMW 323iC","BMW 323is","BMW 325/325e","BMW 325/325eS","BMW 325Ci","BMW 325i","BMW 325i/325is","BMW 325iC","BMW 325iS","BMW 325ix","BMW 325xi","BMW 328Ci","BMW 328d","BMW 328i","BMW 328iC","BMW 328iS","BMW 328xi","BMW 330Ci","BMW 330e","BMW 330i","BMW 330xi","BMW 335","BMW 335d","BMW 335i","BMW 335is","BMW 335xi","BMW 340i","BMW 428i","BMW 430i","BMW 435i","BMW 440i","BMW 524td","BMW 525i","BMW 525iA","BMW 525xi","BMW 528e","BMW 528i","BMW 528xi","BMW 530e","BMW 530i","BMW 530iA","BMW 530xi","BMW 533i","BMW 535d","BMW 535i","BMW 535i/535is","BMW 535xi","BMW 540d","BMW 540i","BMW 540iA","BMW 545i","BMW 550e","BMW 550i","BMW 633 csi","BMW 635CSi","BMW 640i","BMW 640xi","BMW 645Ci","BMW 645i","BMW 650i","BMW 650i, Alpina B6","BMW 650i, B6","BMW 650xi","BMW 730i","BMW 733i","BMW 735i","BMW 735iL","BMW 740Li","BMW 740e","BMW 740i","BMW 740iL","BMW 745Le","BMW 745Li","BMW 745e","BMW 745i","BMW 750Li","BMW 750Li, Alpina B7","BMW 750Lxi","BMW 750Lxi, Alpina B7","BMW 750e","BMW 750i","BMW 750i, Alpina B7","BMW 750i, B7","BMW 750iL","BMW 750xi","BMW 750xi, Alpina B7","BMW 760Li","BMW 760i","BMW 840Ci","BMW 840i","BMW 850CSi","BMW 850Ci","BMW 850i","BMW ActiveE","BMW ActiveHybrid 3","BMW ActiveHybrid 5","BMW ActiveHybrid 7","BMW Alpina","BMW Alpina B8","BMW B7","BMW C 400 GT","BMW C 400 X","BMW C 600","BMW C 650","BMW C 650 GT","BMW C Evolution","BMW CE 02","BMW CE 04","BMW F 650","BMW F 650 CS","BMW F 650 GS","BMW F 650 S","BMW F 700 GS","BMW F 750 GS","BMW F 800 GS","BMW F 800 GT","BMW F 800 R","BMW F 800 S","BMW F 800 ST","BMW F 850 GS","BMW F 900","BMW F 900 GS","BMW F 900 GS Adventure","BMW F 900 GS-P","BMW F 900 R","BMW F 900 XR","BMW G 310 GS","BMW G 310 R","BMW G 450 X","BMW G 650","BMW G 650 GS","BMW HP2","BMW HP4","BMW K 100 LT","BMW K 100 RS","BMW K 100 RT","BMW K 1100 LT","BMW K 1100 RS","BMW K 1200 GT","BMW K 1200 LT","BMW K 1200 R","BMW K 1200 RS","BMW K 1200 S","BMW K 1300 GT","BMW K 1300 R","BMW K 1300 S","BMW K 1600 B","BMW K 1600 GT","BMW K 1600 GTL","BMW K1","BMW K100","BMW K75","BMW K75RT","BMW K75S","BMW L7","BMW M 1000","BMW M 1000 R","BMW M 1000 RR","BMW M 1000 XR","BMW M2","BMW M235","BMW M235i","BMW M240i","BMW M3","BMW M340i","BMW M3Ci","BMW M4","BMW M440i","BMW M5","BMW M550i","BMW M6","BMW M760Li","BMW M760i","BMW M8","BMW M850i","BMW R 100","BMW R 100 CS","BMW R 100 GS","BMW R 100 GSPD","BMW R 100 R","BMW R 100 RS","BMW R 100 RT","BMW R 1100 GS","BMW R 1100 R","BMW R 1100 RS","BMW R 1100 RT","BMW R 1100 S","BMW R 1150 GS","BMW R 1150 R","BMW R 1150 RS","BMW R 1150 RT","BMW R 12","BMW R 12 G/S","BMW R 12 nineT","BMW R 1200 C","BMW R 1200 CL","BMW R 1200 GS","BMW R 1200 R","BMW R 1200 RS","BMW R 1200 RT","BMW R 1200 S","BMW R 1200 ST","BMW R 1250 GS","BMW R 1250 GS Adventure","BMW R 1250 R","BMW R 1250 RS","BMW R 1250 RT","BMW R 1300 GS","BMW R 1300 GS Adventure","BMW R 1300 R","BMW R 1300 RS","BMW R 1300 RT","BMW R 18","BMW R 18 B","BMW R 18 Classic","BMW R 18 Roctane","BMW R 18 Transcontinental","BMW R 65","BMW R 65 LS","BMW R 80","BMW R 80 GS","BMW R 80 RT","BMW R 80 ST","BMW R 850 R","BMW R 900 RT","BMW R nineT","BMW S 1000 R","BMW S 1000 RR","BMW S 1000 XR","BMW X1","BMW X2","BMW X3","BMW X4","BMW X5","BMW X6","BMW X7","BMW XM","BMW Z3","BMW Z4","BMW Z8","BMW i3","BMW i4","BMW i5","BMW i7","BMW i8","BMW iX","Bentley A Smith GT Bentley","Bentley ARMOURED ARNAGE","Bentley Arnage","Bentley Azure","Bentley Bentayga","Bentley Bentley Industries, LLC","Bentley Bentley Trailers & Custom Coaches","Bentley Brooklands","Bentley Continental","Bentley Eight","Bentley Flying Spur","Bentley Mulsanne","Bentley Roll Royce Silver Seraph","Bentley Rolls-Royce Park Ward","Bentley Turbo","Bugatti Chiron","Bugatti Chiron Pur Sport","Bugatti Chiron Supersport","Bugatti EB110","Bugatti Mistral","Bugatti Veyron","Ferrari 12Cilindri","Ferrari 296","Ferrari 296 Speciale","Ferrari 296 Speciale A","Ferrari 3.2 Mondial","Ferrari 308 Convertible","Ferrari 308GTB","Ferrari 308GTB Quattrovalvole","Ferrari 308GTBi","Ferrari 308GTS","Ferrari 308GTS Quattrovalvole","Ferrari 308GTSi","Ferrari 328","Ferrari 328 GTB","Ferrari 328 GTS","Ferrari 348 Spider","Ferrari 348 tb","Ferrari 348 ts","Ferrari 355 Berlinetta","Ferrari 355 GTS","Ferrari 355 Spider","Ferrari 360","Ferrari 430","Ferrari 456","Ferrari 456M","Ferrari 458","Ferrari 458 Italia","Ferrari 488","Ferrari 512 TR","Ferrari 550 Barchetta","Ferrari 550 Maranello","Ferrari 575M Maranello","Ferrari 599","Ferrari 599 GTB Fiorano","Ferrari 612 Scaglietti","Ferrari 812","Ferrari 849 Testarossa","Ferrari Amalfi","Ferrari California","Ferrari California T","Ferrari Challenge Stradale","Ferrari Daytona SP3","Ferrari Enzo","Ferrari F12 Berlinetta","Ferrari F12 Special Series","Ferrari F12 tdf (Tour de France)","Ferrari F355","Ferrari F40","Ferrari F430","Ferrari F50","Ferrari F60 America","Ferrari F8","Ferrari F80","Ferrari FF","Ferrari GTC4Lusso","Ferrari La Ferrari","Ferrari Luce","Ferrari Mondial 8","Ferrari Mondial T","Ferrari Monza SP1/SP2","Ferrari Portofino","Ferrari Portofino M","Ferrari Purosangue","Ferrari Roma","Ferrari SF90","Ferrari Testarossa","Jaguar Black Jaguar","Jaguar E-PACE","Jaguar F-PACE","Jaguar F-TYPE","Jaguar I-PACE","Jaguar S-Type","Jaguar Vanden Plas","Jaguar X-Type","Jaguar XE","Jaguar XF","Jaguar XJ","Jaguar XJ12","Jaguar XJ6","Jaguar XJ8","Jaguar XJR","Jaguar XJS","Jaguar XK","Jaguar XK8","Lamborghini 147","Lamborghini Aventador","Lamborghini Diablo","Lamborghini Gallardo","Lamborghini Huracan","Lamborghini Murcielago","Lamborghini Revuelto","Lamborghini Roadster","Lamborghini Temerario","Lamborghini URUS","Land Rover 110\" WB","Land Rover 88” WB","Land Rover 90\" WB","Land Rover Defender","Land Rover Discovery","Land Rover Discovery Sport","Land Rover Freelander","Land Rover LR2","Land Rover LR3","Land Rover LR4","Land Rover New Range Rover","Land Rover Range Rover","Land Rover Range Rover Evoque","Land Rover Range Rover Sport","Land Rover Range Rover Velar","Lexus CT","Lexus ES","Lexus GS","Lexus GX","Lexus HS","Lexus IS","Lexus LC","Lexus LFA","Lexus LS","Lexus LX","Lexus NX","Lexus RC","Lexus RX","Lexus RZ","Lexus SC","Lexus TX","Lexus UX","Lotus 2-Eleven","Lotus 340R","Lotus ELETRE","Lotus Eagle","Lotus Eclat","Lotus Elan","Lotus Eleven","Lotus Elise","Lotus Elite","Lotus Emira","Lotus Esprit","Lotus Europa","Lotus Evora","Lotus Exige","Lotus MEL","Lotus Monaco","Lotus Monza","Lotus Spa","Lotus Turbo Esprit","Maserati 228","Maserati 430","Maserati Biturbo","Maserati Coupe","Maserati Ghibli","Maserati Grancabrio","Maserati Granturismo","Maserati Grecale","Maserati Levante","Maserati MC20","Maserati MCPura","Maserati Merak","Maserati Quattroporte","Maserati Spyder","Maserati TC","McLaren 540C","McLaren 570GT","McLaren 570S","McLaren 600LT","McLaren 620R","McLaren 625C","McLaren 650S","McLaren 675LT","McLaren 720S","McLaren 750S","McLaren 765LT","McLaren ARTURA","McLaren ELVA","McLaren GT","McLaren GTS","McLaren Luggage Trailer","McLaren MP4-12C","McLaren P1","McLaren SENNA","McLaren SENNA GTR","Mercedes 190","Mercedes 240","Mercedes 260","Mercedes 280","Mercedes 300","Mercedes 350","Mercedes 380","Mercedes 400","Mercedes 420","Mercedes 500","Mercedes 560","Mercedes 600","Mercedes A-Class","Mercedes AMG GT","Mercedes B-Class","Mercedes C-Class","Mercedes CL-Class","Mercedes CLA-Class","Mercedes CLE","Mercedes CLK-Class","Mercedes CLS-Class","Mercedes E-Class","Mercedes EQB-Class","Mercedes EQC-Class","Mercedes EQE-Class SUV","Mercedes EQE-Class Sedan","Mercedes EQS-Class SUV","Mercedes EQS-Class Sedan","Mercedes G-Class","Mercedes GL-Class","Mercedes GLA-Class","Mercedes GLB-Class","Mercedes GLC-Class","Mercedes GLE-Class","Mercedes GLK-Class","Mercedes GLS-Class","Mercedes L1013","Mercedes L1113","Mercedes L1116","Mercedes L1117","Mercedes L1316","Mercedes L1317","Mercedes L1319","Mercedes L1418","Mercedes L1419","Mercedes LP1219","Mercedes LP1419","Mercedes LPS1525","Mercedes M-Class","Mercedes ML-Class","Mercedes Metris","Mercedes R-Class","Mercedes S-Class","Mercedes SL-Class","Mercedes SLC-Class","Mercedes SLK-Class","Mercedes SLR McLaren","Mercedes SLS-Class","Mercedes Sprinter","Mercedes eSprinter","Mini Brockway Mini Homes","Mini Carolina Trikes & Minis","Mini Clubman","Mini Cooper","Mini Cooper Convertible","Mini Cooper Coupe","Mini Cooper Roadster","Mini Countryman","Mini Delta Waseca Mini","Mini Dominight LLC","Mini Dominion Motorcycle","Mini FL","Mini GEMINI AUTO & TRAILER INC","Mini Hardtop","Mini KW","Mini Los Lobos Mini Choppers, LLC","Mini MINI MONSOON","Mini Mack","Mini Miller","Mini MiniKamp","Mini MiniMixx","Mini Minitears Company","Mini Mobile Frac Storage Tank","Mini Mobile Mini Inc.","Mini My Mini Trailer LLC.","Mini ODB Trailer","Mini Paceman","Mini Pete","Mini Pony","Mini R.V. Mini Mart, Inc.","Mini Santa Barbara","Porsche 718 Boxster","Porsche 718 Cayman","Porsche 718 Spyder","Porsche 911","Porsche 918","Porsche 924","Porsche 928","Porsche 944","Porsche 968","Porsche Boxster","Porsche Cayenne","Porsche Cayman","Porsche Macan","Porsche Panamera","Porsche Taycan","Rolls-Royce Camargue","Rolls-Royce Corniche","Rolls-Royce Cullinan","Rolls-Royce Dawn","Rolls-Royce Flying Spur","Rolls-Royce Ghost","Rolls-Royce Park Ward","Rolls-Royce Phantom","Rolls-Royce Silver Dawn","Rolls-Royce Silver Seraph","Rolls-Royce Silver Spirit","Rolls-Royce Silver Spur","Rolls-Royce Spectre","Rolls-Royce Touring Limousine","Rolls-Royce Wraith","Tesla Cybercab","Tesla Cybertruck","Tesla Model 3","Tesla Model S","Tesla Model X","Tesla Model Y","Tesla Roadster","Tesla Semi"]; })(typeof window!=="undefined"?window:this);
