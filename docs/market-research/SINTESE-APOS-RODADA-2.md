# Synthesis after round 2 (2026-11-27)

Sources: round 1 (`raw/A` to `raw/D`), the owner's own statements ([TESTE-DE-CANAIS-ARQUIVOS.md](TESTE-DE-CANAIS-ARQUIVOS.md)), round 2 (`raw/E` Reddit and communities, `raw/F` Google Play and task steps). Labels as in the report: counts are of our sample only.

## What is now supported

| Finding | Evidence | Strength |
|---|---|---|
| Broken or wrong bank sync / Open Finance is the main complaint | Google Play: recurrent in Mobills, Wallet, Spendee, Toshl, Pierre, Kinvo (F); App Store and Reclame Aqui (A); Reddit and Actual Budget issues (E) | Strong, but selection bias |
| Price, subscription and cancelling hurt | Play: Mobills, Organizze, Kinvo, Pierre (F); Reddit: Organizze price, Mobills ads (E) | Strong |
| A new version can destroy trust (lost data, confusing UI) | Minhas Economias "nova experiência" 2026 (F, A) | Recurrent in that app |
| Manual entry fatigue is a direct user complaint | 3 of 5 Reddit threads read (E); two of them opened by app builders | Weak: "encontrado em alguns relatos" |
| The competitor many people keep is a **spreadsheet** with a weekly ritual | Reddit (E): recurrent as "what I keep using" | Weak-medium, small sample |

## What our own data adds

- Reading statements is exact (22 of 22 statements reconcile; Inter by count), so the app does not need better parsing.
- The effort is categories on a cold start and Pix/TED to people (Bradesco 104 of 184 lines "maybe a transfer").

## What is still not evidenced

- Double counting of own transfers in Brazil, managing a relative's money, a matured CDB reinvested: no user evidence found (E). They are the owner's own cases (n = 1).
- First run to first expense: no competitor documents the steps (F), so there is no baseline to beat.
- Whether "import and confirm" beats the alternatives: nobody evaluated it.

## Baselines for "radically simpler" (steps listed by official help pages, F)

Import an OFX: Actual 2, Mobills (phone) 3, Organizze (web) 5, YNAB 5. Own-account transfer: Mobills 3, Organizze 2. Cancel: Monarch 3 (web), Organizze 5, Mobills 3 (via Play). Where a source did not list steps: not determined.

## Positioning that the evidence supports (hypothesis to validate)

Not "the app knows everything". Instead: **no subscription, no bank connection to break, data stays on the device, exact reading of the statements you bring, own transfers recognised, and a short weekly review that explains each suggestion.** It removes the top complaints by design (sync, price, data loss) and replaces the spreadsheet ritual with a faster one. Whether it is *disruptive* is not proven.

## Next

1. Design the experience on paper (delivery 3), with a measurable goal: monthly work of the user (minutes and taps) vs the baselines above.
2. Measure the owner's current monthly work (the "before").
3. 3 to 5 conversations with people who use several banks, to test whether the pain is more than the owner's.
