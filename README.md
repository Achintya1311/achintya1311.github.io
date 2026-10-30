# achintya1311.github.io

Static personal site, served by GitHub Pages from `main`. One `index.html`, one stylesheet, PDFs and images in folders. No build step, no JavaScript framework, no server.

Built and maintained by the "Portfolio fixes" routine. Its plan lives in the private `finance-portfolio-hub` repo (`PLAN.md` §5).

## Where each chart comes from

Each chart under `assets/charts/` is a repo's own output, resized for the page. The repo commit is the one its `main` was at when the chart was made (the last commit before the site commit that added it); the data are the repo's committed fixtures at that commit.

| Chart | Card | Repo, commit | Command | Data | Added |
|---|---|---|---|---|---|
| `reverse-dcf.png` | Reverse DCF | reverse-dcf-engine `1ba4df9` | `python -m reverse_dcf.sensitivity` (tornado) | GULFOILLUB FY2023-24 financials, 12 Sep 2026 price capture | `f85c915`, 17 Oct 2026 |
| `factor-model.png` | Factor exposure | fama-french-factor-model `3cdf095` | `python -m factors.rolling_chart --portfolio hitec` | Ken French US HiTec industry portfolio and US factors (method illustration, not GULFOILLUB) | `2c3f15a`, 17 Oct 2026 |
| `risk-lab.png` | Risk | monte-carlo-risk-lab `8796513` | `python -m mcsim.portfolio --drawdown-plot` | RELIANCE daily bars, 4 Sep 2024 to 4 Sep 2026 | `2c3f15a`, 17 Oct 2026 |
| `iv-surface.png` | Options | implied-vol-surface `857e7e9` | `python -m volsurface.solve --provider nse_raw --surface --plot` | RELIANCE NSE chain captured 16 Oct 2026 | `2c3f15a`, 17 Oct 2026 |
| `sentiment.png` | Headline sentiment | headline-sentiment-vs-price `12d7dd8` | `python -m sentiment.overlay` | the first scrape, 28-29 Sep 2026, three headlines above the threshold | `2c3f15a`, 17 Oct 2026 |
| `stockstalker-screen.png` | Technical screen | STOCKSTALKER `171a7d0` | `python -m stockstalker.backtest --offline --chart` | RELIANCE, TATACHEM, CROMPTON fixtures to 4 Sep 2026, 2,000 seeded draws each | `454542d`, 30 Oct 2026 |
| `markowitz.png` | Portfolio optimisation | markowitz-portfolio-optimizer `bf609d3` | `optimizer.report` frontier plot (`report.run()`/`plot_frontier()` called directly: the CLI's 29-ticker filename is too long) | 29 large caps, daily bars 1 Jan 2015 to 15 Oct 2026 | `2c3f15a`, 17 Oct 2026 |

Card numbers change more often than charts. When a card's text and its chart come from different data, the chart's caption says so.

Educational research on historical data. Not investment advice. Not a SEBI-registered research analyst.
