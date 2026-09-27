// Dane startowe: kategorie firm (OpenStreetMap), profile nadawców (white-label)
// i biblioteka szablonów kampanii. Wszystko można edytować w aplikacji.

export const CATEGORIES = [
  { id: 'warsztaty', label: 'Warsztaty samochodowe', filters: ['["shop"="car_repair"]', '["craft"="car_repair"]'] },
  { id: 'wulkanizacje', label: 'Wulkanizacje i sklepy z oponami', filters: ['["shop"="tyres"]'] },
  { id: 'sklepy_moto', label: 'Sklepy motoryzacyjne', filters: ['["shop"="car_parts"]'] },
  { id: 'dealerzy', label: 'Salony i komisy samochodowe', filters: ['["shop"="car"]'] },
  { id: 'skp', label: 'Stacje kontroli pojazdów', filters: ['["amenity"="vehicle_inspection"]'] },
  { id: 'ciezarowe', label: 'Serwisy i sklepy ciężarowe', filters: ['["shop"="truck"]', '["shop"="truck_repair"]'] },
  { id: 'moto2', label: 'Motocykle (sklepy i serwisy)', filters: ['["shop"="motorcycle"]', '["shop"="motorcycle_repair"]'] },
  { id: 'myjnie', label: 'Myjnie i detailing', filters: ['["amenity"="car_wash"]'] },
  { id: 'stacje_paliw', label: 'Stacje paliw', filters: ['["amenity"="fuel"]'] },
  { id: 'transport', label: 'Transport, logistyka, kurierzy (floty)', filters: ['["office"="logistics"]', '["office"="courier"]', '["office"="moving_company"]', '["industrial"="logistics"]'] },
  { id: 'wynajem', label: 'Wypożyczalnie aut i taxi (floty)', filters: ['["amenity"="car_rental"]', '["office"="taxi"]'] },
  { id: 'budowlane', label: 'Firmy budowlane (floty, maszyny)', filters: ['["office"="construction_company"]', '["craft"="builder"]'] },
  { id: 'rolnicze', label: 'Agro: sklepy i serwisy rolnicze', filters: ['["shop"="agrarian"]', '["craft"="agricultural_engines"]'] },
  { id: 'przemysl', label: 'Zakłady przemysłowe', filters: ['["man_made"="works"]', '["industrial"~"factory|manufacturing|machine_shop"]'] },
  { id: 'motorsport', label: 'Tory, kartingi, motorsport', filters: ['["sport"~"motor|karting|motocross|rally|drift"]'] },
  { id: 'szkoly_jazdy', label: 'Szkoły jazdy (floty)', filters: ['["amenity"="driving_school"]'] },
];

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id || '';

const SIGNATURE = '{{imie_nadawcy}}\n{{rola}} | {{nadawca}}\n{{telefon}}\n{{www}}';

export const DEFAULT_SENDERS = [
  {
    id: 's_ktb_tasiem',
    name: 'KTB Media – management Tasiema',
    company: 'KTB Media',
    actingAs: 'menedżer Łukasza „Tasiema” Tasiemskiego',
    shortDescription: 'agencja marketingowa prowadząca współprace sponsorskie Łukasza „Tasiema” Tasiemskiego, zawodowego kierowcy driftingowego i twórcy treści motoryzacyjnych',
    about: 'Łukasz „Tasiem” Tasiemski – zawodowy kierowca driftingowy i influencer motoryzacyjny. KTB Media prowadzi jego współprace sponsorskie. Przygotowane są pakiety sponsorskie (widoczność na aucie, content w social media, obecność na eventach).',
    signerName: '',
    signerRole: 'Menedżer ds. współpracy',
    email: '',
    phone: '',
    website: 'ktbmedia.eu',
    color: '#E4A11B',
    tone: 'partnerski',
    mailMode: 'gmail',
    rodoAdmin: 'KTB Media',
    rodoLink: '',
    signature: SIGNATURE,
  },
  {
    id: 's_bigmot',
    name: 'BIG-MOT',
    company: 'BIG-MOT',
    actingAs: '',
    shortDescription: 'hurtownia części samochodowych',
    about: 'BIG-MOT – hurtownia części motoryzacyjnych. Uzupełnij: zasięg dostaw, liczba dostaw dziennie, marki, warunki dla warsztatów.',
    signerName: '',
    signerRole: 'Dział handlowy',
    email: '',
    phone: '',
    website: '',
    color: '#C8102E',
    tone: 'formalny',
    mailMode: 'gmail',
    rodoAdmin: 'BIG-MOT',
    rodoLink: '',
    signature: SIGNATURE,
  },
  {
    id: 's_janisz',
    name: 'Grupa Janisz',
    company: 'Grupa Janisz',
    actingAs: '',
    shortDescription: 'grupa motoryzacyjna z Pruszcza Gdańskiego, dealer i serwis samochodów',
    about: 'Grupa Janisz – grupa motoryzacyjna z Pruszcza Gdańskiego (m.in. dealer Dongfeng). Uzupełnij: oferta flotowa, marki, serwis.',
    signerName: '',
    signerRole: 'Sprzedaż flotowa',
    email: '',
    phone: '',
    website: 'janisz.pl',
    color: '#1B3A6B',
    tone: 'formalny',
    mailMode: 'gmail',
    rodoAdmin: 'Grupa Janisz',
    rodoLink: '',
    signature: SIGNATURE,
  },
  {
    id: 's_extreme',
    name: 'Extreme Performance Tyres',
    company: 'Extreme Performance Tyres',
    actingAs: '',
    shortDescription: 'producent opon do motorsportu (drift, rallycross, karting)',
    about: 'Extreme Performance Tyres – opony do motorsportu: VRC PRO (drift), VRX PRO (rallycross), VR3, Type-X (treningowa), opony kartingowe.',
    signerName: '',
    signerRole: 'Rozwój sprzedaży',
    email: '',
    phone: '',
    website: '',
    color: '#2E2E2E',
    tone: 'partnerski',
    mailMode: 'gmail',
    rodoAdmin: 'Extreme Performance Tyres',
    rodoLink: '',
    signature: SIGNATURE,
  },
  {
    id: 's_qarmax',
    name: 'Qarmax',
    company: 'Qarmax',
    actingAs: '',
    shortDescription: 'producent płynów chłodniczych',
    about: 'Qarmax – płyny chłodnicze. Uzupełnij: linie produktów, opakowania, warunki dla sklepów i warsztatów.',
    signerName: '',
    signerRole: 'Dział sprzedaży',
    email: '',
    phone: '',
    website: '',
    color: '#0077B6',
    tone: 'formalny',
    mailMode: 'gmail',
    rodoAdmin: 'Qarmax',
    rodoLink: '',
    signature: SIGNATURE,
  },
  {
    id: 's_oleje',
    name: 'Dystrybutor olejów (uzupełnij)',
    company: 'Nazwa dystrybutora',
    actingAs: '',
    shortDescription: 'dystrybutor olejów i środków smarnych',
    about: 'Dystrybutor olejów silnikowych, przekładniowych, hydraulicznych i przemysłowych. Uzupełnij: marki, pojemności (beczki, IBC), dostawy, obsługa flot.',
    signerName: '',
    signerRole: 'Doradca techniczno-handlowy',
    email: '',
    phone: '',
    website: '',
    color: '#2D6A4F',
    tone: 'formalny',
    mailMode: 'eml',
    rodoAdmin: '',
    rodoLink: '',
    signature: SIGNATURE,
  },
];

// Stopka informacyjna RODO – dołączana do pierwszej wiadomości.
export const RODO_TEMPLATE =
  'Administratorem Państwa danych kontaktowych jest {{rodo_admin}}. Adres pozyskaliśmy z publicznie dostępnego źródła ({{zrodlo}}) i używamy go wyłącznie, aby zapytać o zgodę na dalszy kontakt (art. 6 ust. 1 lit. f RODO). Mają Państwo prawo sprzeciwu – wystarczy odpisać „NIE”, a usuniemy adres z naszej bazy.{{rodo_link}}';

// Biblioteka szablonów kampanii.
// step1 = zapytanie o zgodę (bez oferty, bez cen) – legalne jako pierwszy kontakt.
// step2 = właściwa oferta – dostępna dopiero po odnotowaniu zgody.
// followup = jedno uprzejme przypomnienie, nadal bez treści handlowej.
export const CAMPAIGN_TEMPLATES = [
  {
    key: 'sponsoring_tasiem',
    name: 'Sponsoring – Łukasz „Tasiem” Tasiemski',
    senderId: 's_ktb_tasiem',
    goal: 'Pozyskanie sponsorów i partnerów marki dla kierowcy driftingowego Łukasza „Tasiema” Tasiemskiego.',
    audience: 'Marki motoryzacyjne, sklepy i hurtownie moto, producenci części, opon, olejów, firmy z branży tuningu, lokalne firmy chcące dotrzeć do fanów motoryzacji.',
    categories: ['sklepy_moto', 'dealerzy', 'wulkanizacje', 'motorsport'],
    templates: {
      step1: {
        subject: 'Łukasz „Tasiem” Tasiemski × {{firma}} – krótkie pytanie',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i jestem menedżerem Łukasza „Tasiema” Tasiemskiego – zawodowego kierowcy driftingowego i twórcy treści motoryzacyjnych. Współprace Łukasza prowadzi agencja {{nadawca}}.\n\nPrzygotowujemy nadchodzący sezon i szukamy marek, z którymi Łukasz mógłby zbudować długofalową współpracę.\n{{personalizacja}}\n\nCzy mogę przesłać na ten adres krótką prezentację z propozycją współpracy dla {{firma}}? Wystarczy odpowiedź „Tak”. Jeśli temat Państwa nie interesuje, proszę odpisać „Nie” – nie będę się więcej odzywać.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Łukasz „Tasiem” Tasiemski × {{firma}} – krótkie pytanie',
        body: 'Dzień dobry,\n\nuprzejmie przypominam się z pytaniem sprzed kilku dni – czy mogę przesłać prezentację możliwości współpracy z Łukaszem „Tasiemem” Tasiemskim?\n\nJeśli to nie jest dobry moment, proszę dać znać – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Propozycja współpracy – Łukasz „Tasiem” Tasiemski × {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za zgodę na przesłanie propozycji. Poniżej krótko, co możemy zaproponować {{firma}}:\n\n• widoczność marki na aucie i w materiałach z zawodów,\n• treści w social media Łukasza (relacje, rolki, posty z zawodów i warsztatu),\n• obecność na eventach i spotkaniach z fanami,\n• [dopisz: wyniki / zasięgi / terminy sezonu].\n\nPełne pakiety sponsorskie: [link do prezentacji].\n\nChętnie umówię krótką rozmowę i dopasuję pakiet do Państwa celów.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}}, menedżer Łukasza „Tasiema” Tasiemskiego (drift, content moto). Szukamy marek do współpracy na nadchodzący sezon. Czy mogę przesłać krótką prezentację? Jeśli nie – śmiało proszę napisać, nie będę więcej zawracać głowy 🙂',
    },
  },
  {
    key: 'bigmot_warsztaty',
    name: 'BIG-MOT → warsztaty w okolicy',
    senderId: 's_bigmot',
    goal: 'Nawiązanie współpracy z warsztatami i serwisami jako dostawca części.',
    audience: 'Niezależne warsztaty, wulkanizacje, serwisy ciężarowe i motocyklowe w zasięgu dostaw.',
    categories: ['warsztaty', 'wulkanizacje', 'ciezarowe'],
    templates: {
      step1: {
        subject: 'Współpraca z {{firma}} – pytanie od hurtowni {{nadawca}}',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n\nSzukamy warsztatów z Państwa okolicy ({{miasto}}), z którymi moglibyśmy nawiązać stałą współpracę.\n{{personalizacja}}\n\nCzy wyrażają Państwo zgodę na przesłanie na ten adres informacji o warunkach współpracy dla warsztatów? Wystarczy krótka odpowiedź „Tak”. Jeśli temat nie jest dla Państwa interesujący, proszę odpisać „Nie” – nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Współpraca z {{firma}} – pytanie od hurtowni {{nadawca}}',
        body: 'Dzień dobry,\n\nuprzejmie przypominam się z pytaniem, czy mogę przesłać informację o warunkach współpracy z {{nadawca}} dla warsztatów.\n\nJeśli nie – proszę o krótką informację, nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Warunki współpracy {{nadawca}} dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za odpowiedź. Zgodnie z obietnicą przesyłam warunki współpracy dla warsztatów:\n\n• dostawy: [np. X razy dziennie w Państwa rejonie],\n• rabaty warsztatowe: [do uzupełnienia],\n• marki i asortyment: [do uzupełnienia],\n• dostęp do katalogu / platformy zamówień: [link],\n• opiekun handlowy: {{imie_nadawcy}}, {{telefon}}.\n\nChętnie przyjadę do Państwa lub zadzwonię, żeby omówić szczegóły.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}} ({{opis_nadawcy}}). Szukamy warsztatów z Państwa okolicy ({{miasto}}) do stałej współpracy. Czy mogę przesłać informację o warunkach? Jeśli nie – proszę śmiało napisać, nie będę więcej zawracać głowy.',
    },
  },
  {
    key: 'oleje_floty',
    name: 'Oleje → floty, agro, przemysł, sklepy',
    senderId: 's_oleje',
    goal: 'Pozyskanie odbiorców olejów i środków smarnych: floty, gospodarstwa i serwisy rolnicze, zakłady przemysłowe, sklepy motoryzacyjne.',
    audience: 'Firmy transportowe i logistyczne, wypożyczalnie, firmy budowlane, sklepy i serwisy rolnicze, zakłady przemysłowe, sklepy moto, warsztaty.',
    categories: ['transport', 'budowlane', 'rolnicze', 'przemysl', 'sklepy_moto'],
    templates: {
      step1: {
        subject: 'Oleje i środki smarne dla {{firma}} – krótkie pytanie',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n\nWspółpracujemy z firmami z Państwa regionu ({{miasto}}) i chcielibyśmy zapytać, czy moglibyśmy się przedstawić również {{firma}}.\n{{personalizacja}}\n\nCzy wyrażają Państwo zgodę na przesłanie na ten adres informacji handlowej dotyczącej olejów i środków smarnych? Wystarczy odpowiedź „Tak”. Jeśli nie – proszę odpisać „Nie”, a nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Oleje i środki smarne dla {{firma}} – krótkie pytanie',
        body: 'Dzień dobry,\n\nprzypominam się uprzejmie z pytaniem, czy mogę przesłać informację o olejach i środkach smarnych dla {{firma}}.\n\nJeśli temat nie jest aktualny, proszę o krótką informację – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Oleje i środki smarne – propozycja dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za zgodę. Przesyłam propozycję przygotowaną z myślą o firmach z Państwa branży:\n\n• oleje silnikowe i przekładniowe do pojazdów i maszyn: [marki / normy],\n• oleje hydrauliczne i przemysłowe: [do uzupełnienia],\n• opakowania: [np. 20 l, 60 l, 208 l, IBC 1000 l],\n• dostawa i logistyka: [warunki],\n• doradztwo w doborze środków smarnych dla floty/parku maszyn.\n\nChętnie przygotuję wycenę pod Państwa zużycie – wystarczy odpowiedzieć na tę wiadomość.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}} ({{opis_nadawcy}}). Czy mogę przesłać Państwu informację o olejach i środkach smarnych dla floty/maszyn? Jeśli nie – proszę śmiało napisać, nie będę więcej zawracać głowy.',
    },
  },
  {
    key: 'extreme_motorsport',
    name: 'Extreme Performance Tyres → motorsport',
    senderId: 's_extreme',
    goal: 'Nawiązanie współpracy z torami, teamami, sklepami i warsztatami motorsportowymi.',
    audience: 'Tory i kartingi, sklepy i warsztaty tuningowe, wulkanizacje obsługujące motorsport.',
    categories: ['motorsport', 'wulkanizacje', 'sklepy_moto'],
    templates: {
      step1: {
        subject: 'Opony motorsportowe – pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n\nRozwijamy sieć partnerów w Polsce i chcielibyśmy zapytać, czy {{firma}} byłaby zainteresowana rozmową o współpracy.\n{{personalizacja}}\n\nCzy mogę przesłać na ten adres informację o warunkach współpracy? Wystarczy odpowiedź „Tak”. Jeśli nie – proszę odpisać „Nie”, a nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Opony motorsportowe – pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nuprzejmie przypominam się z pytaniem, czy mogę przesłać informację o współpracy z {{nadawca}}.\n\nJeśli to nie jest temat dla Państwa, proszę o krótką informację – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: '{{nadawca}} – warunki współpracy dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za odpowiedź. Krótko o tym, co możemy zaproponować:\n\n• opony do driftu (VRC PRO), rallycrossu (VRX PRO), VR3, treningowe Type-X oraz kartingowe,\n• warunki partnerskie: [do uzupełnienia],\n• wsparcie marketingowe i obecność w serii „Extreme Distributors”: [do uzupełnienia].\n\nChętnie porozmawiam o szczegółach.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}} ({{opis_nadawcy}}). Rozwijamy sieć partnerów w Polsce – czy mogę przesłać informację o współpracy? Jeśli nie, proszę śmiało napisać 🙂',
    },
  },
  {
    key: 'qarmax_sklepy',
    name: 'Qarmax → sklepy i warsztaty',
    senderId: 's_qarmax',
    goal: 'Wprowadzenie płynów chłodniczych Qarmax do sklepów motoryzacyjnych i warsztatów.',
    audience: 'Sklepy motoryzacyjne, warsztaty, stacje paliw, serwisy ciężarowe.',
    categories: ['sklepy_moto', 'warsztaty', 'stacje_paliw'],
    templates: {
      step1: {
        subject: 'Płyny chłodnicze – pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n\nSzukamy partnerów w Państwa regionie ({{miasto}}).\n{{personalizacja}}\n\nCzy mogę przesłać na ten adres informację o warunkach współpracy? Wystarczy odpowiedź „Tak”. Jeśli nie – proszę odpisać „Nie”, a nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Płyny chłodnicze – pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nuprzejmie przypominam się z pytaniem, czy mogę przesłać informację o współpracy z {{nadawca}}.\n\nJeśli temat nie jest aktualny, proszę o krótką informację – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Płyny chłodnicze {{nadawca}} – warunki dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za odpowiedź. Przesyłam informacje:\n\n• asortyment: [linie produktów, normy],\n• opakowania: [do uzupełnienia],\n• warunki handlowe i minimum logistyczne: [do uzupełnienia],\n• materiały POS / ekspozycja: [do uzupełnienia].\n\nChętnie porozmawiam o szczegółach.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}} ({{opis_nadawcy}}). Szukamy partnerów w Państwa regionie ({{miasto}}) – czy mogę przesłać informację o współpracy? Jeśli nie, proszę śmiało napisać.',
    },
  },
  {
    key: 'janisz_floty',
    name: 'Grupa Janisz → floty firmowe',
    senderId: 's_janisz',
    goal: 'Dotarcie do firm z flotami samochodowymi z ofertą flotową i serwisową.',
    audience: 'Firmy transportowe, budowlane, wypożyczalnie, szkoły jazdy, firmy usługowe z flotą.',
    categories: ['transport', 'budowlane', 'wynajem', 'szkoly_jazdy'],
    templates: {
      step1: {
        subject: 'Flota {{firma}} – krótkie pytanie od {{nadawca}}',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n\nWspółpracujemy z firmami z Państwa regionu ({{miasto}}), które korzystają z samochodów w codziennej pracy.\n{{personalizacja}}\n\nCzy mogę przesłać na ten adres informację o ofercie flotowej i serwisowej dla {{firma}}? Wystarczy odpowiedź „Tak”. Jeśli nie – proszę odpisać „Nie”, a nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Flota {{firma}} – krótkie pytanie od {{nadawca}}',
        body: 'Dzień dobry,\n\nprzypominam się uprzejmie z pytaniem, czy mogę przesłać informację o ofercie flotowej {{nadawca}}.\n\nJeśli temat nie jest aktualny, proszę o krótką informację – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Oferta flotowa {{nadawca}} dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za zgodę. W skrócie:\n\n• samochody dla floty: [marki / modele],\n• finansowanie: [leasing / najem – do uzupełnienia],\n• serwis flotowy i auta zastępcze: [do uzupełnienia],\n• dedykowany opiekun: {{imie_nadawcy}}, {{telefon}}.\n\nChętnie przygotuję propozycję pod liczbę i rodzaj Państwa pojazdów.\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}}. Czy mogę przesłać informację o ofercie flotowej i serwisowej dla Państwa firmy? Jeśli nie, proszę śmiało napisać.',
    },
  },
  {
    key: 'pusta',
    name: 'Pusta kampania (własne treści)',
    senderId: '',
    goal: '',
    audience: '',
    categories: [],
    templates: {
      step1: {
        subject: 'Pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nnazywam się {{imie_nadawcy}} i reprezentuję {{nadawca}} ({{opis_nadawcy}}).\n{{personalizacja}}\n\nCzy mogę przesłać na ten adres informację o [temat]? Wystarczy odpowiedź „Tak”. Jeśli nie – proszę odpisać „Nie”, a nie będę się więcej kontaktować.\n\nPozdrawiam\n{{podpis}}\n\n---\n{{klauzula}}',
      },
      followup: {
        subject: 'Re: Pytanie do {{firma}}',
        body: 'Dzień dobry,\n\nuprzejmie przypominam się z pytaniem z poprzedniej wiadomości.\n\nJeśli temat nie jest aktualny, proszę o krótką informację – nie będę więcej pisać.\n\nPozdrawiam\n{{podpis}}',
      },
      step2: {
        subject: 'Informacja dla {{firma}}',
        body: 'Dzień dobry,\n\ndziękuję za zgodę. [Treść oferty]\n\nPozdrawiam\n{{podpis}}',
      },
      dm1: 'Dzień dobry! Tu {{imie_nadawcy}} z {{nadawca}}. Czy mogę przesłać Państwu krótką informację o [temat]? Jeśli nie – proszę śmiało napisać.',
    },
  },
];

// Etapy lejka
export const STATUSES = [
  { id: 'nowy', label: 'Nowy', hint: 'Znaleziony, jeszcze bez kontaktu' },
  { id: 'zapytanie', label: 'Zapytanie wysłane', hint: 'Wysłano prośbę o zgodę (krok 1)' },
  { id: 'przypomnienie', label: 'Przypomnienie wysłane', hint: 'Wysłano jedno przypomnienie' },
  { id: 'zgoda', label: 'Zgoda', hint: 'Zgoda odnotowana – można wysłać ofertę' },
  { id: 'oferta', label: 'Oferta wysłana', hint: 'Wysłano ofertę (krok 2)' },
  { id: 'rozmowy', label: 'Rozmowy', hint: 'Trwa rozmowa handlowa' },
  { id: 'wygrany', label: 'Współpraca', hint: 'Udało się' },
  { id: 'odmowa', label: 'Odmowa', hint: 'Nie chce kontaktu – na liście wykluczeń' },
  { id: 'brak_odp', label: 'Brak odpowiedzi', hint: 'Zamknięty bez odpowiedzi' },
];

export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

export const DEFAULT_SETTINGS = {
  geminiKey: '',
  geminiModel: 'gemini-flash-latest',
  // Client ID Google nie jest tajny – można go ustawić raz dla wszystkich jako VITE_GOOGLE_CLIENT_ID na Netlify
  googleClientId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '',
  dailyLimit: 40,
  followupDays: 7,
  userName: 'Kozak',
};
