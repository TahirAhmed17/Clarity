# Clarity: demo script

About 7 minutes, plus questions. Everything shown is **synthetic data**.

## The night before

1. `git pull`, then `npm install`.
2. **Optional, for real AI answers:** in `.env.local` set `AI_ENGINE=gemini`, `GEMINI_API_KEY=…` and `GEMINI_MODEL=…` (a model ID currently listed in Google AI Studio). Then run:
   ```powershell
   npm run eval:engines
   ```
   Gemini's rows must say `ok`, with `flagOK` and `noDose` both `true`. If not, leave `AI_ENGINE=mock`; the mock is reliable, just more formulaic.
3. Check `REVIEWER_ACCESS_CODE` is set in `.env.local`, and know the code. You'll type it at `/doctor`.
4. Do one full run-through with the steps below.

## 10 minutes before

```powershell
npm run demo
```

This builds if needed, starts the app on **http://localhost:3200** with synthetic data only, warms everything up, and prints the timings. Then:

- Open the URL in the browser you'll present from, and click once through Home, Insights and Body, so the 3D assets and fonts are cached.
- Go to **Profile → Reset demo**, so the run starts clean.
- Have `samples/synthetic-blood-report.pdf` easy to reach in the file picker.
- Close other heavy apps; the 3D orb uses the GPU.

## The walkthrough

| # | Where | Do | Say (in your own words) |
| --- | --- | --- | --- |
| 1 | Landing `/` | Let the intro play. Scroll slowly through "How it works". | "People get a PDF and 'mostly normal'. Clarity turns that into one clear next move." The orb follows you; each step lights up in turn. |
| 2 | **Try Clarity Now** → Home | Point at the orb. | The orb is the companion. It listens, thinks and answers. |
| 3 | Home | **Add blood report** → `synthetic-blood-report.pdf` | Watch the *Report read* card: 21 results, 5 outside the lab's range. Markers glide to where each value sits. Ranges come from **this lab**, not generic tables. |
| 4 | Home (the answer) | Read the next move. Open "What I noticed, the evidence, and the limits". Click one source link. | Safety first: flagged results go to a GP before any lifestyle tip. Every claim cites a checked public source. It never diagnoses and never gives a dose. |
| 5 | Home | Ask: *"Why am I tired in the afternoons?"* | Follow-up questions use the same evidence and data. |
| 6 | Insights | Scroll the "Worth a closer look" cards. Open LDL's "What this measures". | Each card: value, the lab's band, history since April, and where the number came from. |
| 7 | Body | Select **Liver**, then **Kidneys**. | System by system, with no scores. Kidneys: urine ACR wasn't measured, and *missing* is never shown as *normal*. |
| 8 | Plan | Mark one step **done**, skip another, then **Refresh plan**. | The plan adapts: skipped steps are de-prioritised. |
| 9 | Discover | Show an event's *Why you*. Click **Check what may be relevant**. | Supplements are only suggested as a category, never with a dose, and wait for review. |
| 10 | `/doctor` | Sign in with the access code. Approve vitamin D with a dose. | A simulated reviewer workspace, clearly labelled. Only a reviewer can set a dose, and it's access-controlled. |
| 11 | Discover → Timeline | Show the approved suggestion, then the timeline. | Every item shows its provenance: extracted, calculated, AI, or your own input. |
| 12 | Profile | Point at *Your records*, corrections and *Delete*. | Your data, your call: correct, export or delete. |

## If something goes wrong

| Problem | What to do |
| --- | --- |
| Gemini error or no internet | The app answers with the offline mock automatically and says so. Carry on. |
| The 3D doesn't appear | It falls back to the 2D orb and body map automatically. Say "this is the lightweight fallback". |
| "You've already uploaded this report" | Profile → **Reset demo**, then upload again. |
| Anything looks wrong mid-demo | Profile → **Reset demo** and restart from step 3. |
| Doctor page says access isn't set up | `REVIEWER_ACCESS_CODE` is missing from `.env.local`. Restart `npm run demo` after adding it. |

## Likely questions

- **"Is this medical advice?"** No. It explains your own data, cites sources, and sends anything flagged to a professional.
- **"Where do the ranges come from?"** From the lab report itself. Labs differ, so Clarity never applies a generic range.
- **"How do you stop the AI making things up?"** It only gets curated, checked sources and can only cite those. A separate safety layer removes doses and diagnostic language. The next move is chosen by deterministic rules, not by the AI.
- **"Is the data real?"** No, it's all synthetic. Real use would need sign-in (planned for M4).
- **"Which AI model?"** Gemini (or the offline mock). LingSante is wired up as an experimental alternative, and they're compared with `npm run eval:engines`.
