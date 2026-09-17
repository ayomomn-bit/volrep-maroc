# Product page content inventory — source of truth for Product Studio migration

Captured **2026-09-01**, before any Product Studio work. This is a verbatim
inventory of what `app/products/[handle]/page.tsx` → `components/product-landing/*`
renders **today**. The "Page produit" CMS must reproduce every item below 1:1:
same sections, same order, same visibility, same text (including curly
apostrophes `’`, non-breaking spaces ` `, guillemets `«  »`), same media
slots, same dynamic-data bindings.

Nothing here may be rewritten, translated, shortened, "improved", reordered or
removed by the migration. Where a string contains emphasis it is noted as
`**bold**` (→ `<strong>`) or `*italic*` (→ `<em>`, rendered in the serif accent
face); `\n` marks a `<br>`. These markers are a notation for this document and
for the CMS rich-text convention — they are not literally in the current source,
which uses JSX `<strong>` / `<em>` / `<br/>`.

## Legend

- **Dynamic** — value comes from live product / review data (backend
  `GET /api/products/:handle`, `GET /api/reviews/:handle`), NOT from the CMS.
  The CMS never owns these.
- **Editorial** — hardcoded string / list in `ProductLanding.tsx` today; becomes
  CMS-owned.
- **Media slot** — an image/GIF/video position. Every slot on the page is an
  unfilled `.lp-ph` "Visuel à venir" placeholder today except the gallery and
  the comparison-table product thumbnail (both **Dynamic**, from product images).

## CSS contract

All styling is `app/products/[handle]/product-landing.css` (1710 lines, every
rule nested under `.plp`). Class names in that file are the contract — the CMS
renderer must emit the same class names and DOM structure. The stylesheet is
**not touched** by this migration.

---

## Section order (as rendered) + visibility

| # | CMS key | Component / DOM | Visible today |
|---|---------|----------------|---------------|
| — | *(promo bar)* | `components/layout/PromoBar.tsx`, above global `<Header>` | **Out of CMS scope** — global path-aware element, stays code-owned |
| 1 | `hero` | `<section class="lp-hero">` → `.lp-hero-grid` (`LpGallery` + info) **and** `.lp-hero-results` (before/after grid) | yes |
| 2 | *(before/after)* | `.lp-hero-results`, **inside** section 1's `<section>`/`.container` | yes — modelled as a nested, independently-toggleable block of `hero` (see note A) |
| 3 | `ugc` | `<section class="customer-say-section">` → `LpVideoSlider` | yes |
| 4 | `descriptionFaq` | `<section class="mini-faq">` → `LpAccordion` (first item open) | yes |
| 5 | `professionals` | `<section class="as-seen-section">` | yes |
| 6 | `bigResult` | `<section class="real-results-section">` | yes |
| 7 | `benefits` | `<section class="smooth-skin-section">` (`.smooth-split` + `.benefit-grid`) | yes |
| 8 | `sayGoodbye` | `<section class="no-cuts-section">` | yes |
| 9 | `endorsement` | `<section class="derm-section">` | yes |
| 10 | `comparison` | `<section class="comparison-section">` → `.comparison-new` | yes |
| 11 | `reviews` | `<section class="reviews-section">` | yes |
| 12 | `trust` | `<section class="trust-section">` | yes |
| 13 | `faq` | `<section class="faq-section">` → `LpAccordion` (first item open) | yes |
| 14 | `problemSolution` | `<section class="prob-sol-section">` | yes |
| 15 | `order` | `<section class="order-section" id="order">` → `LpOrderForm` | yes |
| 16 | `stickyCta` | `<LpStickyCta>` — `position: fixed` bar, direct child of `.plp`, no `<section>` | yes (mobile only, via CSS; slides in after 640px scroll) |

**Note A — hero + before/after are one DOM unit.** `.lp-hero-results` lives
inside the same `<section class="lp-hero">` / `.container` as the hero grid, and
`.lp-hero`'s `linear-gradient` background spans both. Splitting them into two
`<section>`s would change the rendered background and vertical rhythm
(`.lp-hero-results { margin-top: 26px }` / `60px` at ≥1024). For V1 the
before/after block is therefore a nested `hero.beforeAfter` object with its own
`enabled` flag — hideable, but not independently reorderable. Flagged for the
user; can be promoted to a standalone section later with a small scoped CSS
addition.

**Note B — `order` section.** `LpOrderForm` is wired to `submitInlineOrderAction`
(→ `POST /api/cart/lines` → `POST /api/checkout/session`, COD). Per task §15 the
form logic and all its internal copy (pack cards, field labels, urgency line,
social-proof line, payment note, confirmation screen) stay code-owned and
**unchanged**. The CMS owns only the section's `title` and `subtitle` above the
form in V1.

**Note C — `reviews` section.** Renders real reviews from
`GET /api/reviews/:handle` (up to 6). Per the locked decision the CMS controls
only display: `heading`, `enabled`, `maxCount` (6 today), `emptyText`. Review
authors / bodies / ratings / verified badges stay **Dynamic** and are moderated
in the existing `/reviews` admin screen. No review content is ever authored here.

---

## 1. `hero`  — `<section class="lp-hero">` / `.lp-hero-grid`

### Media
- **Gallery** (`LpGallery`, `.gallery-section`): **Dynamic** — `product.images`.
  Main image + in-frame ‹ › arrows + thumbnail strip + dots + tap-to-open
  lightbox (strip / counter / Esc / ← → / outside-click). Zero images →
  `.lp-ph` "Visuel produit".

### Editorial
- Rating row: 5 gold stars `★★★★★` (`.rating-stars`, `aria-hidden`) +
  `.rating-count` text:
  - if the product has ≥1 review → **Dynamic**: `«{reviewCount} avis vérifiés»`
  - else → editorial fallback: `Avis clients vérifiés`
  - CMS fields: `reviewsCountSuffix` = `avis vérifiés`, `reviewsFallbackLabel` = `Avis clients vérifiés`
- `.product-title` = **Dynamic** `product.title`
- `.product-subtitle` = `Masseur de récupération percussive`
- `.price-block` = **Dynamic**: `.price-new` = formatted `product.price`;
  `.price-old` = formatted `product.compareAtPrice` (if any); `.price-save` =
  `-{discountPercent}%` (computed, if compare-at > price)
- `.features-row` — 4 `.feature-item` (`.feature-icon` + `<span>`):
  1. `🖐️` — `Mains libres`
  2. `💪` — `Sans douleur`
  3. `⚙️` — `Design ergonomique`
  4. `🔋` — `Sans fil · USB-C`
- `.main-cta` (anchor to `#order`): `Commander maintenant — {price}` (`{price}`
  = **Dynamic** formatted `product.price`)
- `.cta-subtext`: `⚡ Stock limité, profitez de la promo maintenant`
- `.cta-subtext-small`: `{price} à payer à la livraison · Livraison GRATUITE 🚚`
  (`{price}` **Dynamic**)
- `.guarantees` — 3 `.guarantee-item` (`.guarantee-icon` + `<strong>`):
  1. `🛡️` — `Garantie incluse`
  2. `🔇` — `Puissant & silencieux`
  3. `↩️` — `Retours faciles`
- `.guarantee-box` (`.guarantee-box-icon` `✓`):
  - `<strong>`: `Satisfait ou remboursé 30 jours`
  - `<p>`: `Si vous n’êtes pas 100% satisfait, nous reprenons le produit. Votre achat est protégé à 100%.`
- `.description-text` — 2 `<p>`:
  1. `Le **VOLREP PRM™** est un masseur de récupération percussive 2-en-1 qui combine massage roulant et percussion pour soulager mollets, cuisses, dos et nuque après l’effort. Grâce à son utilisation mains libres, plus besoin de tenir l’appareil pendant de longues minutes.`
  2. `Avec plusieurs niveaux d’intensité et une conception ergonomique, chaque séance s’adapte à votre sensibilité et à vos besoins.`

## 2. before/after  — `.lp-hero-results` (nested `hero.beforeAfter`, `enabled: true`)

- `.hero-title` (`<h2>`): `Une récupération profonde, mains libres`
- `.hero-subtitle`: `Avant / après une séance`
- `.results-grid` — 4 `.result-card`, one per zone; each has a **media slot**
  (`.result-image` → `.lp-ph` label `{zone} · avant / après`), overlay labels
  `.label-before` = `AVANT` / `.label-after` = `APRÈS`, `.result-name` = zone,
  `.result-stars` = `★★★★★`:
  1. `Mollets`
  2. `Nuque`
  3. `Dos`
  4. `Cuisses`
- `.results-disclaimer`: `Les ressentis individuels peuvent varier. Chaque séance s’adapte à votre corps.`

## 3. `ugc`  — `<section class="customer-say-section">`

- `.section-title` (`<h2>`): `Ce que disent *nos clients*`
- `LpVideoSlider` (`.video-slider`) — 5 **media slots** (video). All empty today
  → each renders `.video-empty`: `▶` + `Vidéo client · à venir`. A filled slot
  plays an `mp4` (`<video>` muted/loop/playsInline, tap to play, one at a time)
  with optional `poster`.

## 4. `descriptionFaq`  — `<section class="mini-faq">` → `LpAccordion` (`defaultOpen: 0`)

4 items (`question` / `answer`):

1. **Q** `Description`
   **A** `Le VOLREP PRM™ est un masseur de récupération percussive qui combine massage roulant et percussion pour soulager les muscles fatigués. Il cible mollets, cuisses, dos et nuque avec plusieurs niveaux d’intensité, en usage mains libres ou tenu à la main.`
2. **Q** `Combien de temps pour sentir les effets ?`
   **A** `La plupart des clients ressentent un relâchement dès la première séance de 5 à 10 minutes. Pour un effet plus durable sur la fatigue et les tensions accumulées, une utilisation régulière — idéalement chaque soir la première semaine — est recommandée.`
3. **Q** `Comment l’utiliser ?`
   **A** `Placez le muscle à travailler sur le rouleau, choisissez votre intensité en commençant doucement, puis laissez l’appareil travailler. Vous pouvez aussi le tenir à la main pour cibler d’autres zones comme les épaules ou les avant-bras.`
4. **Q** `Est-il sûr à utiliser ?`
   **A** `Oui, l’appareil est conçu pour un usage quotidien à la maison, avec une intensité adaptable à votre sensibilité. Évitez une zone blessée, une plaie ouverte, ou en cas de problème de circulation sans avis médical préalable.`

## 5. `professionals`  — `<section class="as-seen-section">`

- `.as-seen-title`: `Recommandé par les professionnels`
- `.press-logos` — 4 `.press-logo` text labels:
  1. `Kinésithérapeutes`
  2. `Coachs sportifs`
  3. `Préparateurs physiques`
  4. `Ostéopathes`

## 6. `bigResult`  — `<section class="real-results-section">`

- `.section-title-center` (`<h2>`, wrapped in `Reveal`): `Vrais clients,\n*vrais résultats*`
- `.big-result-img` — 1 **media slot** → `.lp-ph` label `Résultat client · avant / après`
- `.results-disclaimer`: `Les ressentis individuels peuvent varier. Chaque séance de massage est différente et s’adapte à votre corps.`

## 7. `benefits`  — `<section class="smooth-skin-section">`

### `.smooth-split`
- `.smooth-img` — 1 **media slot** → `.lp-ph` label `Démonstration produit`
- `.section-title-center` (`<h2>`): `Dites bonjour à *des muscles enfin détendus*`
- `.section-subtitle`: `Une récupération profonde et sans effort, séance après séance, grâce au VOLREP PRM™.`

### `.benefit-grid` — 3 `.benefit-block` (each wrapped in `Reveal`)
1. `.benefit-title` `Glisse sans effort`
   `.benefit-desc` `Mouvement roulant fluide et continu, efficace sur les mollets, les cuisses, le dos et la nuque.`
   `.benefit-tags` (`.tag`): `Massage profond` · `Utilisation flexible`
2. `.benefit-title` `Moteur puissant & silencieux`
   `.benefit-desc` `Un massage rapide, efficace et sans douleur — une vraie séance de récupération à domicile.`
   `.benefit-tags`: `Récupération rapide` · `Sans douleur`
3. `.benefit-title` `Technologie anti-tension`
   `.benefit-desc` `Conçu pour relâcher les points de tension en profondeur, sans jamais fatiguer vos mains.`
   `.benefit-tags`: `Doux pour le corps` · `Zéro fatigue des mains`

## 8. `sayGoodbye`  — `<section class="no-cuts-section">`

- `.no-cuts-img` — 1 **media slot** → `.lp-ph` label `Le VOLREP PRM™ en action`
- `.no-cuts-title`: `Dites adieu à`
- `.no-cuts-list` (`<h2>`) — 3 `.strike-item` joined by `<br/>`:
  1. `Douleurs musculaires`
  2. `Jambes lourdes`
  3. `Tensions accumulées`
- `.no-cuts-desc`: `Dites au revoir aux douleurs du quotidien et aux tensions accumulées. Des milliers de personnes ont déjà transformé leur routine de récupération grâce au **VOLREP PRM™**.`

## 9. `endorsement`  — `<section class="derm-section">`

- `.derm-card`:
  - `.derm-avatar`: `🩺`
  - `.derm-quote`: `« Je recommande le VOLREP PRM™ pour une récupération musculaire efficace et sûre. La combinaison du mouvement roulant et de la percussion fait une vraie différence. »`
  - `.derm-name`: `— Dr. Amine T., **Kinésithérapeute**`
- `.derm-title` (`<h2>`): `Approuvé par les *kinésithérapeutes*`
- `.derm-desc`: `Pensé avec des kinésithérapeutes, le **VOLREP PRM™** procure un massage doux et efficace, adapté à tous types de muscles, pour une sensation de relâchement durable sans effort.`
- `.pro-tip`:
  - `.pro-tip-badge`: `Commandez maintenant`
  - `<p>`: `Pour profiter du meilleur prix, commandez dès maintenant, avant que le stock ne soit épuisé et que les prix ne reviennent à la normale.`

## 10. `comparison`  — `<section class="comparison-section">`

- `.section-title-center` (`<h2>`): `Pourquoi choisir *VOLREP PRM™* ?`
- `.section-subtitle`: `La meilleure solution pour une récupération parfaite à la maison`
- `.comparison-new` header row:
  - empty cell
  - `.comp-new-product`: `.comp-product-img` = **Dynamic** (`product.featuredImage ?? product.images[0]`), `.comp-product-name` = `VOLREP PRM™`
  - `.comp-alt-name`: `Pistolet de massage`
  - `.comp-alt-name`: `Massage en institut`
- 6 `.comp-new-row` — `.comp-new-label` + 3 cells (`✓` = `comp-yes`, `⚠️` = `comp-partial`, `✕` = `comp-no`):

| # | label | VOLREP PRM™ | Pistolet de massage | Massage en institut |
|---|-------|-------------|---------------------|---------------------|
| 1 | `Mains libres, sans effort` | ✓ | ✕ | ✕ |
| 2 | `Massage roulant + percussif combiné` | ✓ | ✕ | ⚠️ |
| 3 | `Intensité réglable` | ✓ | ⚠️ | ✕ |
| 4 | `Sans fatiguer les bras / mains` | ✓ | ✕ | ✕ |
| 5 | `Résultat comme en institut, à la maison` | ✓ | ⚠️ | ✕ |
| 6 | `2-en-1 : mains libres / à la main` | ✓ | ✕ | ✕ |

## 11. `reviews`  — `<section class="reviews-section">`

- `.section-title-center` (`<h2>`): `Ce que disent *nos clients*`
- If reviews exist: `.reviews-grid` — up to **6** `.review-card`, each **Dynamic**:
  - `.review-stars` = filled/empty stars from `review.rating`
  - `.verified-badge` `✓ Achat vérifié` when `review.verifiedPurchase`
  - `.review-name` `<strong>` = `review.author`
  - `.review-text` = `review.body`
- If no reviews: `.reviews-empty`: `Soyez le premier à partager votre expérience avec le VOLREP PRM™.`
- CMS-owned: `heading`, `maxCount` (6), `emptyText`. Nothing else.

## 12. `trust`  — `<section class="trust-section">`

`.trust-grid` — 4 `.trust-item` (`.trust-icon` + `.trust-title` + `.trust-desc`):

1. `🚚` — `Livraison partout au Maroc` — `48-72h dans toutes les villes`
2. `💵` — `Paiement à la livraison` — `Payez uniquement à la réception`
3. `📞` — `Support client` — `7j/7 par téléphone & WhatsApp`
4. `🔄` — `Satisfait ou remboursé` — `Garantie 30 jours`

## 13. `faq`  — `<section class="faq-section">` → `LpAccordion` (`defaultOpen: 0`)

- `.section-title-center` (`<h2>`): `Questions *fréquentes*`
- 6 items (`question` / `answer`):

1. **Q** `Comment fonctionne le VOLREP PRM™ exactement ?`
   **A** `Il combine deux techniques : un rouleau motorisé qui roule en continu sur la zone à masser, et un mouvement percussif qui presse et relâche le muscle à chaque passage. L’appareil s’adapte à la forme de votre mollet, cuisse ou dos pendant qu’il tourne, pour un massage homogène sans que vous ayez à bouger la main.`
2. **Q** `Puis-je l’utiliser sur des zones sensibles ?`
   **A** `Oui. Plusieurs niveaux d’intensité sont disponibles, de la plus douce à la plus intense. Commencez toujours par le niveau le plus bas les premières fois, puis augmentez progressivement selon votre tolérance.`
3. **Q** `Quelle est l’autonomie de la batterie ?`
   **A** `En usage modéré (séances courtes, intensité basse), l’autonomie couvre largement plusieurs séances. La recharge se fait via le câble USB-C inclus, compatible avec n’importe quel chargeur ou power bank USB-C.`
4. **Q** `Peut-on l’utiliser ailleurs que sur les jambes ?`
   **A** `Oui. Vous pouvez l’utiliser sur les mollets, les cuisses, le dos, les épaules et les avant-bras, en mains libres pour le bas du corps ou tenu à la main pour le reste.`
5. **Q** `Quelle est la garantie ?`
   **A** `Le VOLREP PRM™ est couvert par une garantie. En cas de panne durant cette période, l’appareil est réparé ou remplacé.`
6. **Q** `Que faire si je ne suis pas satisfait après réception ?`
   **A** `Vous disposez de 30 jours pour tester le produit. S’il ne vous convient pas, vous pouvez le retourner et être remboursé intégralement, sans justification compliquée.`

## 14. `problemSolution`  — `<section class="prob-sol-section">`

- `.prob-sol-warning`: `.warning-icon` `⚠️` + `<p>` `Sans mouvement roulant, les tensions reviennent vite`
- `.section-title-center.prob-sol-title` (`<h2>`): `Pourquoi un pistolet de massage *seul ne suffit pas ?*`
- `.problems-list` — 3 `.problem-item` (`.problem-icon` `🔴` + `<strong>` + `<p>`):
  1. `Fatigue des mains` — `La main se fatigue après quelques minutes à tenir l’appareil.`
  2. `Couverture limitée` — `Un seul point de contact à la fois, la séance prend plus de temps.`
  3. `Pas de mouvement roulant` — `La percussion seule ne remplace pas un vrai massage qui glisse et enveloppe le muscle.`
- `.solution-arrow` → `.solution-arrow-label`: `LA SOLUTION`
- `.solution-box` (`.solution-icon` `✓`):
  - `<strong>`: `La combinaison qui change tout`
  - `<p>`: `**VOLREP PRM™** = rouleau motorisé + percussion intégrée. Mains libres, couverture totale, détente immédiate. La routine de récupération qui remplace tous les autres appareils.`

## 15. `order`  — `<section class="order-section" id="order">`

CMS-owned (V1):
- `.order-title` (`<h2>`): `Confirmez votre *commande*`
- `.order-subtitle`: `Remplissez le formulaire — nous vous appelons pour confirmer`

Code-owned / frozen (`LpOrderForm`, see Note B) — recorded here for completeness,
**not** CMS-editable in V1:
- Pack cards: `1 VOLREP PRM™` (badge `★ RECOMMANDÉ`), `2 VOLREP PRM™`
  (note `✔ Idéal pour toute la maison`), `3 VOLREP PRM™`
  (note `✔ Le meilleur prix pour offrir`); per-pack `Économisez {montant}`
- `.pack-title`: `Choisissez votre *offre*` · `.pack-subtitle`:
  `La majorité de nos clients choisissent le pack 1 unité`
- `.pack-social-proof`: `🔥 **68%** de nos clients choisissent le pack 1 unité`
- `.order-urgency`: `⏰ Offre spéciale aujourd’hui — Stock limité`
- Variant pills (`.lp-variant`) — **Dynamic** from `product.options` (Color)
- Fields: `Nom complet *`, `Téléphone *`, `E-mail *`, `Ville *`, `Adresse *`
  (+ placeholders, validation messages)
- Summary rows `Produit (n)` / `Remise` / `Livraison` `Gratuite 🚚` / `TOTAL`
- Submit `Confirmer la commande` / `Envoi en cours…`
- `.payment-info`: `💵 Paiement à la livraison — aucun paiement en ligne`
- Confirmation screen: `Commande confirmée !`, `Merci {prénom}. Nous vous
  appelons très vite au {tel} pour confirmer votre commande {n}.`,
  `Paiement à la livraison`, `Total à payer à la livraison : {total}`,
  `Suivre ma commande →`

## 16. `stickyCta`  — `<LpStickyCta>` (mobile, `position: fixed`)

- `.sticky-price`: `.sticky-new` = **Dynamic** `product.price`; `.sticky-old` =
  **Dynamic** `product.compareAtPrice` (if any)
- `.sticky-btn` (anchor to `#order`): `Commander maintenant`

---

## Dynamic-data bindings summary (never CMS-owned)

| Where | Value |
|-------|-------|
| hero `.product-title`, order product name, comparison product name label | `product.title` (comparison label is the literal `VOLREP PRM™` string, editorial) |
| hero `.price-*`, `.main-cta` price, `.cta-subtext-small` price, sticky CTA prices, order summary/packs | `product.price` / `product.compareAtPrice` / computed discount |
| hero gallery images, comparison thumbnail | `product.images` / `product.featuredImage` |
| hero rating count | `reviewSummary.reviewCount` |
| reviews grid | `reviewSummary.reviews` (real, moderated in `/reviews`) |
| order form variant pills, variant→price, submit | `product.options` / `product.variants` + COD checkout endpoints |
