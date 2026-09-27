# The spoken script, one entry per slide. Used for the speaker notes in the .pptx and for the script .docx.
# Written to be read aloud: short sentences, plain words. [Brackets] are stage directions, not spoken.

SCRIPT = [
    dict(title="Project Introduction", speaker="L. Vishwa", time="0:30",
         say=[
             "Good morning, everyone. We are Team Prahari, team ID ST-911. I'm Vishwa, and with me are Vikranth and Yateesh.",
             "Our problem statement is PS-13-S3: finding India's methane super-emitters from orbit.",
             "We call our project Vāyu Lekha. It means \"the air ledger\". In one line: it finds India's biggest methane leaks "
             "from free satellite data, proves each one with statistics, and ranks them by how much warming we can stop for every rupee spent.",
             "One thing before we start: this is not a mock-up. It is running right now, on real satellite data, and we'll show you.",
         ],
         show=["Stay on the title slide while you introduce the team. Point to each teammate as you say their name."]),

    dict(title="Problem Statement", speaker="L. Vishwa", time="1:00",
         say=[
             "So why methane?",
             "Tonne for tonne, methane traps about 80 times more heat than carbon dioxide over twenty years. The IEA says it's behind "
             "roughly 30 percent of all the warming since the Industrial Revolution. And India released about 30 million tonnes of it in 2023. "
             "That's second in the world, after China.",
             "There's good news hidden in that. Methane only stays in the air for about 12 years. So if we cut it today, we feel it within our own lifetime.",
             "But when we tried to find out where India's methane actually comes from, we hit three walls.",
             "One: India reports methane as one national number. There's no public list that says: this landfill, this coal field, this many tonnes.",
             "Two: the satellites exist, but raw satellite data is not an answer. Look at this chart. It's our own count from 2,597 satellite files. "
             "In December we get about 26 thousand clear pixels a day over India. In July, about 600. The monsoon simply hides the country. "
             "Bright deserts and haze fool the instrument too.",
             "Three: if you point at a site and say \"you are leaking\", you had better be right. One bright pixel is not proof.",
             "And this matters most for landfills. We have 2,438 old dumpsites, and waste methane is expected to nearly quadruple by 2030.",
         ],
         show=["Point at the orange monsoon bars when you say \"about 600\".",
               "Hand over: \"Vikranth will show you what we built.\""]),

    dict(title="Proposed Solution", speaker="Vikranth Jayasarathy", time="1:15",
         say=[
             "Here is our answer in one sentence: Vāyu Lekha turns every clear Sentinel-5P pass over India into a checked, ranked list of the "
             "methane sources worth fixing first. It refreshes every three hours, and anyone can read it.",
             "We told the story through Jantar Mantar in Jaipur. Those instruments were built to read the sky, so we made each one a step of our pipeline.",
             "Step one, ingest. Every three hours a job picks up the newest satellite pass and checks each file's checksum against the official Copernicus catalogue. If it doesn't match, we throw it away.",
             "Step two, clean. Bright ground and haze bend the methane reading. We remove that, and we trust each pass according to how noisy it is.",
             "Step three, seasons. We don't guess the monsoon months. We leave them out and say so. And we subtract the background from rice paddies and the region around each site.",
             "Step four, find. We use the continuity equation. In simple words: if more methane leaves a place than arrives, something there is emitting.",
             "Step five, measure. We turn every satellite pass to face its own wind, stack hundreds of them, and calibrate the rate in tonnes per hour.",
             "Step six, decide. A strict statistical gate, an independent check, and then a ranking by warming avoided per rupee.",
             "Each feature answers one of the three problems Vishwa showed you: a site-level ledger instead of a national total; a method that reads through cloud, bias and noise; and proof before blame.",
             "And the size of it: 2,597 verified files, 17.3 million clear pixels, three and a half years of data, 54 places tested, 12 confirmed, and 7 of them in India.",
         ],
         show=["Move your hand left to right across the six pictures as you go through the steps.",
               "Finish on the orange \"12 confirmed · 7 in India\"."]),

    dict(title="Technical Architecture", speaker="Vikranth Jayasarathy", time="2:30",
         say=[
             "The data flows left to right. Satellite methane and carbon monoxide from Copernicus, wind from ERA5, facilities from OpenStreetMap, "
             "and exchange rates from the European Central Bank. GitHub Actions pulls and verifies the data. Our Python code does the science. "
             "It writes versioned files, and the website only reads those files. So what you see on screen is exactly what the pipeline computed. Nothing is typed in by hand.",
             "We designed 19 algorithms. For each one we wrote down a pass mark before we ran it on real data. Ten passed, and those ten run on every refresh. "
             "Five failed, and we publish the failures too. Let me explain four of them.",
             "First, the core: flux divergence, with wind rotation and footprint drizzle. The satellite takes a picture of methane in the air. "
             "Methane from a landfill drifts with the wind, so on every day the plume points a different way. We rotate each day's picture so the wind always blows the same direction, "
             "then stack them. A real source stays in one place and adds up. Noise points everywhere and cancels out. "
             "Drizzle means each pixel is spread over the real patch of ground it saw, not dropped into one grid box. "
             "The chart on the right shows each step on the same six known sites. Raw data can only pick out a leak of about 7.3 tonnes an hour. "
             "Turning to the wind brings that to 5.9. That's the biggest single jump. Drizzle brings it to 5.4, and it's the step that lifts every known emitter above three sigma.",
             "Second, KPW. This one comes from Indian mathematics. The satellite's orbit repeats every 16 days, 227 orbits. So a landfill does not sit in the same spot of its pixel every day. "
             "Sometimes it's near the edge, sometimes in the middle. If one position happens to get more clear days, the stack gets smeared toward it. "
             "Working out which orbit lands the site on which spot is a whole-number puzzle, and Āryabhaṭa solved exactly this kind of puzzle in 499 CE with his method called Kuṭṭaka, the pulveriser. "
             "KPW sorts every pass into nine spots and weighs them so each spot counts the same. The result: average significance went from 4.06 to 4.37, and the smallest detectable leak dropped from 4.96 to 4.76 tonnes an hour. "
             "To be exact about it: we measure the spot directly on every pass, and we use Kuṭṭaka to plan which future orbits will fill the gaps.",
             "Third, OBC, our calibration. How do you check your numbers when there's no meter on the landfill? We take real satellite data, add a fake plume of a known size, "
             "run the whole pipeline, and see what comes out. We get back 99.2 percent of what we put in, with an R-squared of 0.9999. That also tells us our honest limit: "
             "we catch a 10 tonne-per-hour leak about half the time, and 20 tonnes an hour every time.",
             "Fourth, the gate. When you test 54 places, a few will look significant just by luck. The Benjamini-Yekutieli method keeps the expected share of false entries under 5 percent, "
             "even when sites are related to each other. We tested it with 36 fake sites. The statistics alone let 2 through. Add our independent check, and only 1 of 36 got through, while 4 of 5 real emitters were confirmed.",
             "The other six are on the slide: noise weighting, bias removal, the carbon monoxide leg, the CO-to-methane fingerprint, the warming-per-rupee ranking, and tasking, which we'll come back to.",
         ],
         show=["Point at the flow row first, then the yellow KPW card, then the ladder chart.",
               "If time is short (Round 2), explain only the core method and KPW, and say \"the rest are on the slide and in our repository\"."]),

    dict(title="Prototype & Demo", speaker="Yateesh", time="1:30 (live) / 0:45 (recording)",
         say=[
             "Now let me show you the product. [Switch to the browser, full screen.]",
             "This is the opening screen: Jantar Mantar under the real night sky. Top right, you can see when the last satellite pass over India was processed. "
             "The headline says 7 of 35 places tested in India are confirmed.",
             "[Scroll through two or three stages.] Each stage is one step of the pipeline, and the small tags under the title are the algorithms running at that step.",
             "[Open /ledger.] This is the live part. The map is the newest pass over India. Gaps are clouds. Below it, the full inventory, ranked. "
             "These four boxes are the four independent checks: found again in separate years, a second method agrees, carbon monoxide found, and found by the blind screen.",
             "[Open the Ghazipur dossier.] Ghazipur in Delhi: about 30 tonnes an hour, z-score 8.9. The carbon monoxide ratio is 0.54, which points to rotting waste, not fire.",
             "[Open /partner, sign in with the demo key, reopen the dossier.] The public sees locations rounded to about 25 kilometres. A verified partner, like a pollution control board, sees the exact coordinates and the plume image. Every view is logged.",
             "If the internet fails, we have the same walk-through recorded, and we'll play that instead.",
         ],
         show=["Demo tabs open in advance: home, /ledger, /site/ghazipur, /partner. Demo key: vayu-lekha-partner-demo.",
               "If the 3D is slow, add ?render=static to the URL.",
               "If the network is down, play the backup recording straight away. Don't troubleshoot on stage."]),

    dict(title="Impact & Sustainability", speaker="Yateesh", time="1:00",
         say=[
             "So what does it add up to?",
             "Seven super-emitter clusters confirmed in India. Together they put out about 187 tonnes of methane an hour. That's around 1.6 million tonnes a year, "
             "roughly five percent of India's total, from just seven places. To be fair about it, these are totals for a 20 kilometre circle, so they include everything in that circle, not only the landfill.",
             "Fixing them is cheap. At landfills, capturing the gas costs about 160 rupees per tonne of CO2-equivalent avoided. If 50 to 85 percent of it were captured at these seven, that avoids about 84 million tonnes of CO2-equivalent a year, on a 20-year basis.",
             "And we're not the only ones who see this. Carbon Mapper's 2025 satellite data named landfills in Hyderabad and Mumbai among the 25 biggest methane emitters in the world. "
             "We flag both of them using only free public data.",
             "On the SDGs: Goal 13, climate action, is the main one, because methane is the fastest lever on warming in the next twenty years. "
             "Goal 11, because these are city dumpsites. Goal 3, because landfill fires and smoke hurt the people living next to them. And Goal 12, because it shows where waste diversion and gas capture pay off most.",
             "And the system itself is sustainable. Free public data, free-tier computing and open code. Today it costs us about zero rupees a month to run.",
         ],
         show=["Point at the Deonar and Ghazipur bars, then the yellow Carbon Mapper box."]),

    dict(title="Business Approach", speaker="Yateesh", time="1:00",
         say=[
             "Who would use this, and who would pay?",
             "Four groups. Regulators: the Central and State Pollution Control Boards need to know which sites to inspect first. "
             "Cities: municipal corporations are spending money to clean up 2,438 old dumpsites, and they need to show it cut methane. "
             "Coal and oil-and-gas companies, to find leaks across a whole field before sending crews. "
             "And the carbon market: under India's Carbon Credit Trading Scheme, projects need independent measurement.",
             "Our value is simple. We're the cheapest first look. A free satellite screen tells you where to send an expensive aircraft or high-resolution satellite, and later proves the fix worked.",
             "And that targeting works. When we back-tested our tasking ranking, the sites it put on top were found again 54 percent of the time, against 18 percent for the rest.",
             "The model has four levels. The public ledger stays free. Partners, like pollution boards, pay about 8 lakh rupees a year for exact locations and alerts. "
             "Verification reports for capture projects, about 2 lakh per site per year. And we can broker targets for commercial high-resolution satellites.",
             "These are planning estimates, and the working is on the slide: about 1 crore in year one, 3.4 in year two, and 8 crore in year three. "
             "Even in year three that covers less than 5 percent of India's old dumpsites, so there's plenty of room.",
         ],
         show=["Point at the four user cards, then the price steps, then the chart."]),

    dict(title="Feasibility & Roadmap", speaker="L. Vishwa", time="1:00",
         say=[
             "Is this practical? It's already running. The site is live, the pipeline runs every three hours, and the data costs nothing.",
             "We also want to be honest about the limits, because you'd find them anyway.",
             "The satellite's pixels are about 7 kilometres wide, so we see clusters, not single chimneys. That's why our tasking step sends the top five sites to high-resolution satellites like Carbon Mapper, EMIT or GHGSat.",
             "The monsoon hides India for four months. We report those months as unobserved. We never fill them in.",
             "A wrong accusation would hurt people. So we have the 5 percent gate, an independent check, a human sign-off, and rounded public locations.",
             "One of our own algorithms failed. It tried to name the sector from OpenStreetMap, and the map is too thin in India. So it's switched off, and our next step is official facility lists from the pollution boards.",
             "This chart is our honest detection limit: about half of 10 tonne-per-hour leaks, and every leak of 20 tonnes an hour or more.",
             "The roadmap: a pilot with one State Pollution Control Board early next year, with the first human-reviewed entries. Then facility registries, a nitrogen dioxide leg and high-resolution tasking. "
             "And by 2028, a measurement layer for India's carbon market.",
             "Our ask is simple: one pilot partner to review our first entries with us.",
             "Thank you. We're Team Prahari, and we're happy to take your questions.",
         ],
         show=["End on the yellow \"Ask\" box. Everyone steps forward for questions."]),
]

NOTES = []
for s in SCRIPT:
    NOTES.append(f"{s['speaker']} · about {s['time']}\n\n" + "\n\n".join(s["say"]) +
                 "\n\nOn screen: " + " ".join(s["show"]))

QA = [
    ("Is this real data or a simulation?",
     "Real. Open the GitHub Actions page and click the latest \"live\" run: the log lists the actual Copernicus file names and checksums. Then show /ledger, the live panel at the top."),
    ("Who checks the results before a site is named?",
     "A person does. Every entry is a machine candidate until an analyst or regulator records a decision, with name and date, in the repository. Show /responsible section 1 and any dossier's \"Human review\" box."),
    ("What if you flag a site wrongly?",
     "Three layers: a 5 percent false-discovery gate across all sites; an independent check whose own false-pass rate we measure on 24 pseudo-sites every run; and rounded public coordinates. We also publish what failed, like the wind-direction test."),
    ("Why are your rates higher than Carbon Mapper's for the same landfills?",
     "Ours are totals for a 20 km circle around the site, seen by a 7 km satellite pixel. Carbon Mapper measures a single plume at about 30 metres. They answer different questions, and that's why we hand our top sites to them."),
    ("What is actually new here?",
     "KPW (the Kuṭṭaka phase weighting), the albedo/aerosol debiasing for this use, the CO-to-methane fingerprint, the warming-per-rupee ranking and the tasking score are new. Flux divergence and FDR are known methods; we adapted them and say so."),
    ("How small a leak can you see?",
     "About 10 tonnes an hour is caught half the time over the stacked record; 20 tonnes an hour every time. Smaller leaks need high-resolution satellites, and our tasking step picks where to point them."),
    ("What about security and misuse?",
     "The public view rounds locations to about 25 km and hides plume images and orbit lists. Verified partners sign in for the full package, and every view is logged. Show a dossier signed out, then signed in."),
    ("Why Jantar Mantar and Āryabhaṭa? Isn't that just decoration?",
     "The story is decoration, but KPW is not. Kuṭṭaka is a real algorithm for whole-number congruences, and the orbit-repeat problem is exactly that kind of problem. It passed its test on real data: significance 4.06 to 4.37."),
    ("How will you make money if the data is free?",
     "The data is free; the work is not. Partners pay for exact locations, alerts and verification reports they can use in enforcement or carbon-credit claims."),
]

RECORDING = [
    "Record at 1920×1080, browser in full screen, sound off. Aim for about 2 minutes 30 seconds.",
    "0:00 Home page. Let the night sky load; hold 5 seconds on the headline and the \"last pass\" pill.",
    "0:10 Click \"Begin the reading\". Scroll slowly through 13:30, Observe, Seasons, Anomalies and Attribution, about 8 seconds each.",
    "0:55 On Attribution, click \"Open this site's dossier\" (Jawaharnagar). Scroll slowly to the numbers.",
    "1:15 Open /ledger. Hold on the live map, then scroll to the inventory table and the check boxes.",
    "1:40 Scroll to \"The algorithms running in this inventory\" and hold on the KPW card.",
    "1:55 Open /site/ghazipur signed out (rounded location), then /partner, sign in with vayu-lekha-partner-demo, reopen Ghazipur (exact location and plume).",
    "2:25 End on /responsible.",
    "Save as MP4 on the laptop desktop and on a USB drive. Test that it plays offline before the round.",
]
