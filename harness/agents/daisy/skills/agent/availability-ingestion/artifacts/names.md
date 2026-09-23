- **Name — three columns, classified from the source.** Since migration 0040
  the identity is split. Preserve every explicit printed part, then make the
  **best possible evidence-based classification** of the source's displayed
  identity; write the parts, never the whole, except for the intentional
  uncertain fallback below:

  | Column | Holds | Example |
  |---|---|---|
  | `common_name` | the printed common/trade-facing name, or the complete printed identity atom when classification is uncertain | `Forest Pansy Redbud` |
  | `botanical_name` | an explicitly printed botanical / scientific identity | `Cercis canadensis` |
  | `cultivar_variety_trade_name` | explicitly indicated residual cultivar, variety, selection or trade-name part | `Forest Pansy` |

  - **`inventory.name` is derived. Never write it.** A database trigger joins
    the parts it has with **` - `**, in the order common, botanical, cultivar —
    `Forest Pansy Redbud - Cercis canadensis - Forest Pansy` — omitting each
    part the source didn't give: common + botanical → `Eastern Redbud - Cercis
    canadensis`; common + cultivar → `Forest Pansy Redbud - Forest Pansy`;
    botanical + cultivar and no common name → `Acer palmatum - Bloodgood`.
    Anything you put in `name` on a row that has parts is silently overwritten.
    The dash is **spaced**, which is what tells it apart from the hyphen inside
    a name like `KN30-8`; and the separator is a dash rather than a comma
    because the cultivar column is itself comma-separated. `name_key`, `common_name_key`,
    `botanical_name_key` and `cultivar_keys` are derived too — never write those
    either.
  - **Classify from what the source gives you, not from outside knowledge.**
    Preserve explicit printed parts. Use the source's display convention and
    evidence — labels, typography, parentheses, quotation marks, column headers
    and repeated formatting — to separate a common name, an explicitly printed
    botanical identity, and residual cultivar/variety/selection/trade-name
    parts. Never manufacture or complete a botanical identity from knowledge,
    a web lookup, or recognition: `botanical_name` is NULL unless the source
    itself prints it. Likewise, do not invent a cultivar/selection merely
    because you recognise a word.
  - **When classification remains uncertain, use the safe fallback.** Preserve
    the **complete printed identity atom** in `common_name`; set
    `botanical_name` and `cultivar_variety_trade_name` to NULL. Do not split an
    ambiguous atom just because it looks partly botanical or cultivar-like. This
    is intentional preservation, not a parse failure.
  - **Keep an explicit common name.** If the source prints one, it goes in
    `common_name` even when the botanical name is printed too. Nothing else
    records it; dropping it loses it until someone reparses the source.
  - **`cultivar_variety_trade_name` takes an explicitly identifiable residual.**
    Once the printed common and botanical parts have been identified from the
    source's own convention, it holds the remaining explicitly indicated
    cultivar, variety, selection or trade name. Sources do not distinguish those
    residual types reliably, so preserve them together rather than guessing
    which kind each is. **Comma-separate them** when a row explicitly prints
    more than one. If the source gives only one unclassified identity atom, do
    **not** force a residual split; use the `common_name` fallback above.

    | Source prints | `common_name` | `botanical_name` | `cultivar_variety_trade_name` | derived `name` |
    |---|---|---|---|---|
    | `Acer palmatum 'Wolff' - Emperor 1®` | — | `Acer palmatum` | `Wolff, Emperor 1®` | `Acer palmatum - Wolff, Emperor 1®` |
    | `Forest Pansy Redbud (Cercis canadensis 'Forest Pansy')` | `Forest Pansy Redbud` | `Cercis canadensis` | `Forest Pansy` | `Forest Pansy Redbud - Cercis canadensis - Forest Pansy` |
    | `Crape Myrtle - 'Muskogee'` | `Crape Myrtle` | — | `Muskogee` | `Crape Myrtle - Muskogee` |
    | `Purtis Pink Oleander` (a lone, unclassified source cell) | `Purtis Pink Oleander` | — | — | `Purtis Pink Oleander` |

    The comma matters: the database splits on it to build `cultivar_keys`, one
    identity key per name, and that is what a `cultivar` alias edge and the
    app's Cultivar filter match against. Run two names together with a dash and
    they key as one string that matches neither — the row silently stops
    answering searches for either name. (`;` and `|` are tolerated; `-` and `/`
    are **not** split, because `KN30-8` is one cultivar code.)
  - **What never goes in it**, however the source prints it inline: size and
    container, height / width / caliper, form and grade codes (`STD`, `Bush`,
    `Multi-Trunk`, `Clump`, `Globe`, `Low Graft`, `Spec`), pack counts. Those
    have their own columns, or belong in the row's `notes`. `Buxus x 'Green
    Mountain' Globe` is cultivar `Green Mountain` with `Globe` noted, not
    `Green Mountain Globe`; `Prunus serrulata 'Kwanzan' 4' Graft` is cultivar
    `Kwanzan`, height `4'`, `Graft` noted.
