# KTBmatic

Półautomat do pozyskiwania klientów i partnerów dla KTB Media. Znajduje firmy, przygotowuje legalne pierwsze wiadomości w imieniu wybranego klienta (white-label) i prowadzi rozmowę aż do oferty. Kanały: e-mail (szkice w Gmailu albo pliki .eml), Instagram, Facebook i LinkedIn (kopiuj i otwórz czat).

Całość działa na darmowych planach: Netlify, OpenStreetMap, Google Gemini i Gmail API.

## Jak to działa

1. **Nadawcy.** Firma, w imieniu której piszesz, np. KTB Media jako management Tasiema, BIG-MOT, Grupa Janisz, Extreme Performance Tyres, Qarmax albo dowolny nowy klient. Każdy nadawca ma własny podpis, stopkę RODO, kolor i skrzynkę.
2. **Kampania.** Łączy nadawcę, grupę odbiorców i komplet treści. Jest 6 gotowych szablonów, a każdy działa z dowolnym nadawcą.
3. **Znajdź firmy.** Masz trzy źródła:
   - mapa OpenStreetMap: miasto, promień i branże (warsztaty, wulkanizacje, floty, agro, przemysł, motorsport…),
   - import CSV (np. eksport z CEIDG albo lista klientów),
   - propozycje AI: nazwy i strony firm, np. potencjalni sponsorzy.
4. **Pobierz dane ze strony.** Aplikacja wchodzi na stronę firmy i wyciąga e-mail, telefon oraz profile social media.
5. **Krok 1: zapytanie o zgodę.** Pierwsza wiadomość zawiera tylko przedstawienie się i pytanie, czy można przesłać informację. Aplikacja blokuje wysyłkę, jeśli w treści pojawi się cena, rabat, procent, promocja albo inne treści handlowe.
6. **Odpowiedź.** Klikasz „Zgoda” albo „Odmowa”. Zgoda jest zapisywana z datą, kanałem i notatką jako dowód. Odmowa automatycznie dopisuje adres do listy wykluczeń, która obowiązuje we wszystkich kampaniach i dla wszystkich nadawców.
7. **Krok 2: oferta.** Staje się dostępna dopiero po odnotowaniu zgody. Pola w [nawiasach] trzeba uzupełnić przed wysyłką.

Po ustawionej liczbie dni bez odpowiedzi aplikacja podpowiada jedno przypomnienie, również bez oferty.

## Wdrożenie na Netlify (bezpłatnie)

Aplikacja używa funkcji Netlify (pobieranie danych ze stron i AI), więc zwykłe przeciągnięcie folderu na Netlify Drop nie wystarczy. Są dwa sposoby.

**A. Przez GitHub (zalecane, aktualizuje się samo)**
1. Wrzuć folder do nowego repozytorium na GitHubie.
2. Na Netlify wybierz *Add new site → Import an existing project*, a potem wskaż repozytorium. Ustawienia builda są już w `netlify.toml`.
3. Kliknij *Deploy*.

**B. Z komputera, przez Netlify CLI**
```bash
npm install
npx netlify-cli login
npx netlify-cli deploy --build --prod
```

Praca lokalna z działającymi funkcjami: `npx netlify-cli dev`. Sam interfejs bez funkcji uruchomisz przez `npm run dev`.

## Konfiguracja (jednorazowo)

### 1. AI – Google Gemini (darmowe)
1. Wejdź na https://aistudio.google.com/apikey i kliknij *Create API key*.
2. Dla całego zespołu ustaw klucz na Netlify: *Site configuration → Environment variables → `GEMINI_API_KEY`*, a potem zrób ponowny deploy.
   Alternatywnie wklej go w aplikacji w zakładce Ustawienia. Wtedy zadziała tylko w tej przeglądarce.

Model `gemini-flash-latest` zawsze wskazuje aktualny szybki model. Przycisk „Sprawdź” w Ustawieniach pokaże, co jest dostępne na Twoim kluczu.

### 2. Gmail – szkice wiadomości (darmowe)
1. Wejdź na https://console.cloud.google.com i utwórz projekt „KTBmatic”.
2. Otwórz *APIs & Services → Library*, znajdź **Gmail API** i kliknij *Enable*.
3. W *OAuth consent screen* wybierz typ **External** i status **Testing**. W sekcji *Test users* dodaj adresy wszystkich skrzynek, z których będziecie wysyłać (KTB Media, BIG-MOT itd.).
4. W *Credentials* kliknij *Create credentials → OAuth client ID* i wybierz typ **Web application**.
   W *Authorized JavaScript origins* dodaj:
   - `https://TWOJA-NAZWA.netlify.app`
   - `http://localhost:8888` (do pracy lokalnej)
5. Skopiuj *Client ID* i ustaw go na Netlify jako zmienną `VITE_GOOGLE_CLIENT_ID`, a potem zrób ponowny deploy. Dzięki temu będzie działał u wszystkich. Możesz go też wkleić ręcznie w zakładce Ustawienia w aplikacji.

Przy pierwszym logowaniu Google pokaże ostrzeżenie „aplikacja niezweryfikowana”. To normalne w trybie testowym: kliknij *Kontynuuj*. KTBmatic ma tylko uprawnienie do tworzenia szkiców i niczego nie wysyła sam.

Nadawcy bez Gmaila (np. poczta firmowa w home.pl albo Outlook) mogą mieć ustawioną wysyłkę „Pliki .eml”. Pobrany plik otwiera się w Outlooku lub Thunderbirdzie jako gotowa wiadomość: wystarczy kliknąć *Wyślij*.

### 3. Nadawcy
W zakładce **Nadawcy** uzupełnij dla każdej firmy:
- osobę podpisującą,
- e-mail,
- telefon,
- **administratora danych** (pełna nazwa firmy z adresem).

Bez tych danych aplikacja nie pozwoli wysłać wiadomości.

## Dane i kopia zapasowa

W tej wersji dane są zapisywane w przeglądarce (localStorage), osobno na każdym komputerze. W Ustawieniach możesz pobrać i wczytać kopię (JSON). Eksport kontaktów do CSV jest w kampanii i w zakładce Kontakty.

## Zasady prawne wbudowane w aplikację

Informacje poniżej to nie porada prawna. Przy dużych kampaniach warto skonsultować treści z prawnikiem.

- **Prawo komunikacji elektronicznej, art. 398.** Wysłanie informacji handlowej e-mailem wymaga uprzedniej zgody, także w relacjach B2B. Dlatego pierwsza wiadomość i przypomnienie tylko pytają o zgodę.
- **RODO.** Stopka w pierwszej wiadomości zawiera trzy informacje: kto jest administratorem, skąd mamy adres i jak zgłosić sprzeciw.
- **Wolumen.** Aplikacja pilnuje dziennego limitu na nadawcę, domyślnie 40. Chroni to domeny klientów przed filtrami spamu.
- **Social media.** Meta i LinkedIn nie pozwalają zaczynać rozmów przez API, a boty grożą blokadą konta. Dlatego wiadomość DM zawsze wysyła człowiek: aplikacja kopiuje treść i otwiera czat.
- **Wybór adresu.** Aplikacja preferuje ogólne adresy firm (biuro@, kontakt@) zamiast adresów imiennych.

## Limity darmowych usług

| Usługa | Limit | Wystarczy na |
|---|---|---|
| Netlify Free | 125 tys. wywołań funkcji miesięcznie | tysiące firm |
| OpenStreetMap (Nominatim, Overpass) | uczciwe użycie | nie wyszukuj w pętli, max ok. 80 km promienia |
| Gemini Free | limit dzienny zależny od modelu | przy seryjnej personalizacji aplikacja robi przerwy |
| Gmail API | bardzo wysokie limity | limit wyznacza rozsądna wysyłka, nie API |

## Struktura projektu

```
src/lib/defaults.js     nadawcy, branże, szablony kampanii
src/lib/templates.js    zmienne {{…}}, kontrola legalności treści
src/lib/osm.js          wyszukiwanie firm na mapie
src/lib/mail.js         Gmail (szkice), pliki .eml, mailto
src/lib/ai.js           Gemini: personalizacja, przepisywanie, propozycje firm
src/lib/store.js        dane (localStorage), zgody, lista wykluczeń
netlify/functions/      enrich (dane ze stron www), ai (pośrednik Gemini)
scripts/test-logic.mjs  testy logiki: npm test
```

## Możliwe kolejne kroki

- Wspólna baza w Firestore, żeby cały zespół KTB widział te same kampanie.
- Automatyczne wykrywanie odpowiedzi w Gmailu, czyli podpowiedź „ta firma odpisała”.
- Załączniki w kroku 2, np. PDF z pakietami sponsorskimi Tasiema.
