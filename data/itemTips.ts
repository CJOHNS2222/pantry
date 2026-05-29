/**
 * Curated tips for common pantry staples.
 * Each entry has a list of lowercase match terms (checked against the item name)
 * and an array of sections, each with a title and content paragraph.
 */

export interface ItemTipSection {
  title: string;
  content: string;
}

export interface ItemTips {
  /** Lowercase substrings — if any appear in the normalised item name, this entry is used. */
  matches: string[];
  sections: ItemTipSection[];
}

export const ITEM_TIPS: ItemTips[] = [
  {
    matches: ['salt', 'sodium chloride', 'sea salt', 'himalayan', 'kosher salt', 'rock salt', 'fleur de sel'],
    sections: [
      {
        title: 'Health',
        content:
          'Salt is by far the biggest dietary source of sodium, and the words "salt" and "sodium" are often used interchangeably. The essential minerals in salt act as important electrolytes in the body — they help with fluid balance, nerve transmission, and muscle function. Most adults need around 2,300 mg of sodium per day (about 1 teaspoon of salt), but the average diet contains significantly more. Excess sodium is linked to raised blood pressure and increased cardiovascular risk.',
      },
      {
        title: 'Eating',
        content:
          'Choose unprocessed or minimally processed foods — canned, processed, and frozen foods are often loaded with added salt. Read labels and choose lower-sodium products; a useful rule of thumb is to pick items where the sodium content (mg) is less than or equal to the calories per serving. When eating out, sauces, soups, and bread are common hidden sodium sources. Try finishing dishes with a small pinch of flaky sea salt rather than seasoning throughout cooking — you\'ll use less but taste it more.',
      },
      {
        title: 'Storage',
        content:
          'Salt should not be stored in plastic or metal containers. Plastic can leach chemicals into the salt over time, especially in hot or humid conditions, and metal containers may rust or react with iodised salt. Glass, ceramic, or wooden salt boxes are ideal. Keep salt away from direct heat and moisture — a damp environment causes it to clump. Properly stored, plain salt lasts indefinitely; iodised salt is best used within 5 years as the iodine can degrade.',
      },
    ],
  },
  {
    matches: ['sugar', 'caster sugar', 'icing sugar', 'brown sugar', 'raw sugar', 'demerara', 'turbinado', 'powdered sugar', 'confectioners'],
    sections: [
      {
        title: 'Health',
        content:
          'Added sugars provide calories but essentially no nutrients, which is why they are often called "empty calories." The WHO recommends keeping added sugar below 10% of total daily energy intake (about 50 g for the average adult), with additional benefits if you cut below 5%. Excess sugar intake is associated with tooth decay, weight gain, elevated triglycerides, and increased risk of type 2 diabetes over time.',
      },
      {
        title: 'Eating',
        content:
          'Brown and raw sugars are not significantly healthier than white sugar — the difference in mineral content is negligible. When baking, you can often reduce the sugar in a recipe by 10–25% without noticeably affecting the result. Vanilla extract, cinnamon, and nutmeg can heighten perceived sweetness and let you use less sugar. Natural sugars in whole fruit come packaged with fibre, which slows absorption — a far better choice than fruit juice or sweetened drinks.',
      },
      {
        title: 'Storage',
        content:
          'White granulated sugar keeps indefinitely if stored in a sealed, airtight container away from moisture and strong odours. Brown sugar hardens when it dries out — store it in an airtight bag or container, and if it hardens, place a slice of bread or a damp paper towel in the container overnight to re-soften it. Icing sugar can absorb moisture and form lumps; sieve it before use. Keep all sugars away from heat sources and out of direct sunlight.',
      },
    ],
  },
  {
    matches: ['flour', 'all-purpose flour', 'plain flour', 'self-raising flour', 'bread flour', 'wholemeal flour', 'whole wheat flour', 'cake flour', 'almond flour', 'rice flour'],
    sections: [
      {
        title: 'Health',
        content:
          'Whole wheat flour retains the bran and germ of the grain, providing more fibre, B vitamins, iron, and antioxidants than refined white flour, which has these removed during milling. Higher fibre intake supports digestive health and helps stabilise blood sugar. If you have coeliac disease or non-coeliac gluten sensitivity, choose certified gluten-free alternatives such as rice flour, almond flour, or oat flour (certified GF). Almond flour is high in healthy fats and vitamin E but is also calorie-dense.',
      },
      {
        title: 'Eating',
        content:
          'For baking, the protein content of flour matters: bread flour is high-protein (12–14%) and creates chewy, well-structured loaves; cake flour is low-protein (7–9%) and produces tender, fine crumbs. You can substitute up to half the all-purpose flour in most recipes with whole wheat flour without dramatically changing texture. When measuring flour, spoon it into the measuring cup rather than scooping directly — scooping packs the flour down and can add 20–30% more than intended.',
      },
      {
        title: 'Storage',
        content:
          'White all-purpose flour keeps for 1–2 years in a cool, dry pantry in an airtight container. Whole wheat and wholemeal flours contain oils from the wheat germ that go rancid — store them in the fridge (up to 6 months) or freezer (up to 1 year) for best results. Always let chilled flour come to room temperature before baking. Keep flour away from strong-smelling foods as it can absorb odours. A bay leaf placed in the container deters weevils.',
      },
    ],
  },
  {
    matches: ['rice', 'basmati', 'jasmine rice', 'arborio', 'brown rice', 'white rice', 'sushi rice', 'wild rice', 'long grain', 'short grain'],
    sections: [
      {
        title: 'Health',
        content:
          'Rice is a staple for over half the world\'s population and is naturally gluten-free. Brown rice is a whole grain that retains its bran and germ, providing more fibre, magnesium, and B vitamins than white rice. White rice has the bran removed, giving it a longer shelf life but a higher glycaemic index, meaning it raises blood sugar more quickly. Arsenic naturally accumulates in rice — rinsing rice before cooking and using extra water (then draining) can reduce arsenic content by 40–70%.',
      },
      {
        title: 'Eating',
        content:
          'The 1:1.5 ratio (one cup rice to one and a half cups water) works well for most long-grain white rice on the stovetop. Let rice rest off the heat, covered, for 5–10 minutes after cooking — the residual steam finishes cooking and separates the grains. Cooling cooked rice rapidly and refrigerating it converts some starch into "resistant starch," which behaves more like fibre and has a lower glycaemic impact when reheated. Sushi rice and risotto rice require specific techniques; swapping them for long-grain varieties changes the result significantly.',
      },
      {
        title: 'Storage',
        content:
          'Uncooked white rice keeps for 4–5 years in a sealed container in a cool, dry location. Uncooked brown rice has a much shorter shelf life of 6–12 months due to its oil content; refrigerate or freeze it for longer storage. Cooked rice must be cooled quickly (within an hour), refrigerated in a covered container, and eaten within 3–4 days. Reheating rice must be done thoroughly — Bacillus cereus, a common food-poisoning bacteria, thrives when cooked rice is left at room temperature.',
      },
    ],
  },
  {
    matches: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'rigatoni', 'fusilli', 'farfalle', 'tagliatelle', 'macaroni', 'noodle'],
    sections: [
      {
        title: 'Health',
        content:
          'Pasta is a good source of complex carbohydrates, and contrary to popular belief, a standard portion (75–80 g dry) is moderate in calories. Whole wheat pasta provides roughly double the fibre of regular pasta and has a lower glycaemic index, supporting more stable blood sugar. Pasta is low in fat and a useful source of B vitamins and iron when made from enriched flour. The sauce you pair it with has far more impact on the meal\'s overall nutrition than the pasta itself.',
      },
      {
        title: 'Eating',
        content:
          'Cook pasta in a large pot of well-salted, rapidly boiling water — the salt seasons it from the inside. Cook to al dente (firm to the bite), usually 1–2 minutes less than the packet suggests, as it continues cooking in the sauce. Save a cup of pasta cooking water before draining — the starchy water is excellent for loosening sauces and helping them cling to the pasta. Fresh pasta cooks in 2–4 minutes; dried pasta takes longer but keeps almost indefinitely.',
      },
      {
        title: 'Storage',
        content:
          'Dried pasta keeps for 2 years or more in a sealed container in a cool, dry cupboard. Once opened, transfer to an airtight container to prevent it absorbing moisture and odours. Fresh pasta (refrigerated) should be used within 1–2 days or can be frozen for up to 1 month. Cooked pasta refrigerates well for 3–5 days — toss it with a little olive oil before storing to prevent clumping.',
      },
    ],
  },
  {
    matches: ['olive oil', 'extra virgin', 'evoo'],
    sections: [
      {
        title: 'Health',
        content:
          'Extra virgin olive oil (EVOO) is one of the healthiest fats you can consume. It is rich in monounsaturated oleic acid and contains powerful antioxidants including oleocanthal, which has anti-inflammatory properties similar to ibuprofen. Regular consumption is associated with reduced risk of heart disease, stroke, and certain cancers. Despite being calorie-dense (about 120 calories per tablespoon), EVOO is a cornerstone of the Mediterranean diet, consistently ranked among the healthiest eating patterns.',
      },
      {
        title: 'Eating',
        content:
          'Extra virgin olive oil has a smoke point of around 190–210°C (375–410°F) — suitable for most stovetop cooking. It is ideal for dressings, dipping, finishing dishes, and sautéing. For high-heat deep frying, refined olive oil or avocado oil is a better choice. Drizzling good EVOO over finished dishes (pasta, soup, grilled vegetables) preserves its flavour compounds and antioxidants. Peppery, grassy notes indicate high polyphenol content — a sign of quality oil.',
      },
      {
        title: 'Storage',
        content:
          'Olive oil\'s biggest enemies are light, heat, and oxygen. Store it in a dark, cool cupboard away from the stove — not on the counter next to a heat source. A dark glass bottle or tin is better than clear glass. Once opened, use within 4–6 weeks for best flavour, and within 2 years of the harvest date (printed on quality bottles). Rancid olive oil loses its health benefits and tastes bitter and waxy. Never refrigerate olive oil — it will solidify and go cloudy, though it returns to normal at room temperature.',
      },
    ],
  },
  {
    matches: ['butter', 'unsalted butter', 'salted butter', 'margarine'],
    sections: [
      {
        title: 'Health',
        content:
          'Butter is high in saturated fat — about 7 g per tablespoon — and current dietary guidelines recommend limiting saturated fat to reduce cardiovascular disease risk. However, recent research has been more nuanced, and butter consumed in moderation as part of a balanced diet is unlikely to be harmful for most people. Butter contains fat-soluble vitamins A, D, E, and K2, and grass-fed butter has higher levels of conjugated linoleic acid (CLA) and omega-3 fatty acids. Margarine made with trans fats is generally considered more harmful than butter; choose margarines with no trans fats.',
      },
      {
        title: 'Eating',
        content:
          'Unsalted butter is preferred for baking — it gives you control over the salt level in the recipe, and salted butter varies widely in salt content between brands. For cooking, butter adds rich flavour but burns more easily than oil due to its milk solids; clarified butter (ghee) has a higher smoke point and works better for high-heat cooking. Bringing butter to room temperature before baking ensures it creams properly with sugar. Cold butter cut into pastry creates flaky layers.',
      },
      {
        title: 'Storage',
        content:
          'Salted butter can be kept on the counter in a covered butter dish for up to 2 weeks without spoiling — the salt acts as a mild preservative. Unsalted butter should be refrigerated and used within 1–2 months, or frozen for up to 6 months. Wrap butter tightly as it absorbs odours from the fridge readily. To soften butter quickly, cut it into small pieces or grate it — it reaches room temperature in minutes rather than hours.',
      },
    ],
  },
  {
    matches: ['egg', 'eggs', 'free range egg', 'chicken egg'],
    sections: [
      {
        title: 'Health',
        content:
          'Eggs are one of the most nutritionally complete foods available — a single large egg contains around 6 g of high-quality protein with all nine essential amino acids. They are rich in choline (critical for brain health), lutein and zeaxanthin (important for eye health), vitamins D, B12, and selenium. While eggs are high in cholesterol (about 185 mg each), dietary cholesterol has less impact on blood cholesterol for most people than saturated fat does. Current guidelines generally support eating up to one egg per day as part of a healthy diet.',
      },
      {
        title: 'Eating',
        content:
          'The freshness of an egg significantly affects cooking results. Fresh eggs have firm, round yolks and thick whites — ideal for poaching and frying. Older eggs have thinner whites that spread more, but are actually better for hard-boiling because the slight air gap makes them easier to peel. To test freshness: place the egg in a glass of water — fresh eggs sink and lay flat; slightly older eggs stand upright; eggs that float should be discarded. Room temperature eggs emulsify better into batters and scrambled eggs cook more evenly.',
      },
      {
        title: 'Storage',
        content:
          'In the UK and EU, eggs are sold unwashed and can be stored at room temperature for up to 3 weeks. In the US, eggs are washed during processing (which removes the protective cuticle) and must be refrigerated. Once refrigerated, always keep them that way — temperature fluctuations cause condensation that encourages bacterial growth. Store eggs pointed-end down to keep the yolk centred and away from the air pocket at the wide end. Eggs absorb odours, so keep them in their original carton and away from strong-smelling foods.',
      },
    ],
  },
  {
    matches: ['milk', 'whole milk', 'semi-skimmed', 'skimmed milk', 'skim milk', '2% milk', 'full fat milk', 'oat milk', 'almond milk', 'soy milk', 'plant milk'],
    sections: [
      {
        title: 'Health',
        content:
          'Cow\'s milk is an excellent source of calcium, protein (about 8 g per 250 ml), phosphorus, and vitamins D and B12. Full-fat milk contains more calories and saturated fat than skimmed, but also more fat-soluble vitamins and conjugated linoleic acid. Plant milks vary widely — oat milk is higher in carbs, almond milk is very low in protein, and soy milk most closely mirrors dairy milk\'s protein profile. Many plant milks are fortified with calcium and vitamin D to approximate dairy, but check labels as quantities vary.',
      },
      {
        title: 'Eating',
        content:
          'For cooking and baking, whole milk produces richer results than lower-fat alternatives — the fat carries flavour and creates smoother sauces and custards. Plant milks can generally be substituted 1:1 for dairy milk in most recipes; full-fat oat milk or soy milk work best in cooking applications. When heating milk, do so gently and stir frequently to prevent scorching on the bottom of the pan. Scalding milk (heating to just below boiling) before adding to custards and puddings results in a silkier texture.',
      },
      {
        title: 'Storage',
        content:
          'Keep milk refrigerated at 4°C (40°F) or below and store it towards the back of the fridge, not in the door where temperatures fluctuate. Milk can typically be safely used 3–5 days past the "sell by" date if it has been properly refrigerated. Once opened, UHT (long-life) milk should be treated the same as fresh and used within 3–5 days. Freeze milk if you need to extend its life — it keeps for up to 3 months frozen; shake well after thawing as it can separate slightly.',
      },
    ],
  },
  {
    matches: ['garlic', 'garlic bulb', 'garlic clove', 'garlic head'],
    sections: [
      {
        title: 'Health',
        content:
          'Garlic has been used medicinally for thousands of years, and modern research supports several of its traditional uses. Allicin — the compound responsible for garlic\'s pungent smell, released when garlic is crushed or chopped — has antimicrobial, antioxidant, and anti-inflammatory properties. Regular garlic consumption is associated with modest reductions in blood pressure and LDL cholesterol. Garlic is also a good source of manganese, vitamin B6, vitamin C, and selenium. Note: cooking reduces allicin content; crushing and leaving garlic to rest for 10 minutes before cooking preserves more of its beneficial compounds.',
      },
      {
        title: 'Eating',
        content:
          'The way you prepare garlic dramatically changes its flavour. Sliced garlic is mild; minced garlic is more pungent; crushed or pressed garlic is the most intense. Roasted whole garlic heads become sweet, soft, and nutty — a completely different flavour profile from raw garlic. Blooming garlic in warm oil at the start of cooking is the foundation of countless cuisines. To remove garlic odour from your hands, rub them on stainless steel under running water, or use lemon juice and salt.',
      },
      {
        title: 'Storage',
        content:
          'Whole, unpeeled garlic bulbs store best at room temperature in a cool, dry, well-ventilated location — not in the fridge or a sealed container. A mesh bag, ceramic garlic keeper, or simply a bowl works well. Stored this way, a whole bulb keeps for 3–6 months. Once you break the bulb, individual cloves should be used within 10 days. Pre-peeled garlic should be refrigerated in an airtight container and used within a week. Peeled garlic immersed in olive oil must be refrigerated and used within 4 days; never store garlic in oil at room temperature due to botulism risk.',
      },
    ],
  },
  {
    matches: ['onion', 'red onion', 'white onion', 'yellow onion', 'brown onion', 'spring onion', 'shallot', 'scallion'],
    sections: [
      {
        title: 'Health',
        content:
          'Onions are rich in quercetin, a powerful antioxidant and anti-inflammatory flavonoid, as well as sulfur compounds that support heart health by helping to reduce blood pressure and platelet aggregation. They also provide vitamin C, vitamin B6, folate, and potassium. Red onions contain the highest levels of quercetin and anthocyanins (the pigments that give them their colour). Onions are prebiotic — they feed beneficial gut bacteria — and are a good source of inulin, a type of soluble fibre.',
      },
      {
        title: 'Eating',
        content:
          'Raw onions are sharp and pungent; cooking transforms them into sweet, soft, complex flavour. Caramelising onions (low heat, 30–45 minutes with a pinch of salt) concentrates their natural sugars and produces a deeply sweet, jammy result — nothing should be labelled "caramelised onions" in 10 minutes. To reduce the sharpness of raw onions for salads, soak sliced rings in cold water for 10 minutes, or toss with a splash of vinegar. Sweet varieties like Vidalia or Walla Walla are better raw; sharp brown onions are better for cooking.',
      },
      {
        title: 'Storage',
        content:
          'Whole uncut onions should be stored in a cool, dark, well-ventilated location — not in the fridge, and never near potatoes (they release gases that cause each other to deteriorate faster). Properly stored, whole onions last 1–3 months. Once cut, wrap the unused portion tightly in cling film or place in an airtight container in the fridge and use within 5–7 days. Avoid storing cut onions near butter, cheese, or other moisture-sensitive foods as the odour transfers easily.',
      },
    ],
  },
  {
    matches: ['honey', 'raw honey', 'manuka honey'],
    sections: [
      {
        title: 'Health',
        content:
          'Honey is primarily fructose and glucose, making it nutritionally similar to sugar, though it has a slightly lower glycaemic index than refined sugar. Raw honey contains trace amounts of antioxidants, enzymes, amino acids, and minerals that are diminished or removed by pasteurisation. Manuka honey (from New Zealand and Australia) has particularly high levels of methylglyoxal (MGO) and is used clinically for wound healing due to its antibacterial properties. Children under 12 months should never be given honey — it can contain Clostridium botulinum spores that their immune systems are not yet equipped to handle.',
      },
      {
        title: 'Eating',
        content:
          'Honey is about 1.5 times sweeter than sugar, so you can use less of it when substituting. In baking, replace 1 cup of sugar with 3/4 cup honey and reduce other liquids by 1/4 cup; also add a pinch of baking soda (honey is acidic) and lower the oven temperature by 15°C (25°F), as honey causes faster browning. Avoid stirring honey into very hot liquids — above 40°C it begins to lose its enzymes and some aromatic compounds. Pairing honey with aged cheese, charcuterie, or strong blue cheese highlights its floral notes.',
      },
      {
        title: 'Storage',
        content:
          'Honey essentially never expires — archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible. Its low moisture content and slightly acidic pH make it inhospitable to bacteria. Store honey in a sealed container at room temperature, away from heat and direct sunlight. If honey crystallises (a natural process for most raw honeys), it has not gone bad — simply place the jar in warm water and stir gently to reliquefy. Do not microwave honey as it can overheat and destroy beneficial enzymes; avoid metal utensils as they can affect flavour.',
      },
    ],
  },
  {
    matches: ['olive', 'olives', 'black olive', 'green olive', 'kalamata'],
    sections: [
      {
        title: 'Health',
        content:
          'Olives are a rich source of oleic acid (a heart-healthy monounsaturated fat), vitamin E, and plant compounds with antioxidant and anti-inflammatory effects. They are one of the few whole foods that are a significant source of healthy fat in their natural state. However, olives are also high in sodium, as they are typically brined or salt-cured during processing — a small serving can contribute 15–20% of the daily sodium recommendation. Opt for low-sodium varieties or rinse brine-packed olives to reduce sodium content.',
      },
      {
        title: 'Eating',
        content:
          'Olives are excellent on cheese boards, in salads (Niçoise, Greek), tapenade, pizza, and pasta. Kalamata olives have a rich, meaty flavour ideal for Mediterranean cooking; green olives tend to be firmer and more bitter, pairing well with gin and mild cheeses. Warm olives briefly in olive oil with garlic, thyme, and lemon zest for an instantly elevated appetiser. Pitting olives yourself from whole olives tends to give better flavour than pre-pitted versions.',
      },
      {
        title: 'Storage',
        content:
          'Unopened jarred or tinned olives can be stored at room temperature for 1–2 years. Once opened, keep olives submerged in their brine in a covered container in the fridge and use within 2–4 weeks. Loose deli olives should be refrigerated and consumed within 1–2 weeks. If the brine grows cloudy or the olives smell off, discard them. You can extend refrigerated shelf life by topping up with fresh brine (mix 1 tsp salt per 250 ml water) if the level drops.',
      },
    ],
  },
  {
    matches: ['coffee', 'ground coffee', 'coffee beans', 'espresso', 'instant coffee'],
    sections: [
      {
        title: 'Health',
        content:
          'Coffee is one of the most studied foods in the world, and the evidence is largely positive. Regular moderate coffee consumption (3–4 cups per day) is associated with reduced risk of type 2 diabetes, Parkinson\'s disease, Alzheimer\'s disease, and several liver conditions. Coffee contains antioxidants — in Western diets it is often the single biggest dietary source of antioxidants. Caffeine improves alertness, reaction time, and physical performance. However, high intake can cause anxiety, disrupt sleep, and temporarily raise blood pressure. Those who are pregnant, have heart conditions, or are caffeine-sensitive should limit intake.',
      },
      {
        title: 'Eating',
        content:
          'Water temperature for brewing matters — the ideal range is 90–96°C (195–205°F). Boiling water over-extracts the coffee, creating bitterness; too-cool water under-extracts it, producing sour, weak flavours. Grind size should match your brew method: coarse for French press, medium for drip/pour-over, fine for espresso. Coffee begins going stale within 15–20 minutes of grinding, so grinding fresh makes a noticeable difference. Adding a small pinch of salt to the grounds reduces perceived bitterness without making the coffee taste salty.',
      },
      {
        title: 'Storage',
        content:
          'The enemies of coffee are air, moisture, heat, and light. Store whole beans or ground coffee in an airtight, opaque container at room temperature — not the fridge, where condensation forms every time you open the container. Whole beans stay fresh for 2–3 weeks after roasting; ground coffee for 1–2 weeks. For longer-term storage, freeze coffee in an airtight container in portion-sized amounts; remove what you need and let it come to room temperature before opening. Never refreeze coffee once thawed.',
      },
    ],
  },
  {
    matches: ['tea', 'green tea', 'black tea', 'herbal tea', 'chai tea', 'white tea', 'oolong'],
    sections: [
      {
        title: 'Health',
        content:
          'Tea (from the Camellia sinensis plant — green, black, white, and oolong) is rich in catechins and other flavonoid antioxidants that may reduce inflammation and lower the risk of cardiovascular disease. Green tea has a higher catechin content than black tea, as black tea is fermented, converting catechins to theaflavins and thearubigins (also beneficial). Tea contains caffeine (less than coffee) and L-theanine — an amino acid that promotes calm alertness and may offset some of caffeine\'s jittery effects. Herbal "teas" are technically tisanes and have varied health profiles depending on the plant.',
      },
      {
        title: 'Eating',
        content:
          'Water temperature matters greatly: green and white teas should be brewed at 70–80°C (160–180°F) — boiling water makes them bitter; black tea tolerates near-boiling water well. Steep green tea for 1–2 minutes, black tea for 3–5 minutes. Do not squeeze the tea bag — it releases tannins that make the tea astringent. Adding milk to black tea reduces the bioavailability of its antioxidants slightly, but the effect is modest. Tea is an excellent cooking ingredient — try using brewed black tea as a liquid for braises, or green tea as a light poaching liquid for fish.',
      },
      {
        title: 'Storage',
        content:
          'Store tea in an airtight, opaque container away from light, heat, and strong odours — tea absorbs surrounding smells very readily. Never store tea near spices, coffee, or strong-smelling foods. Loose-leaf tea keeps for up to 2 years; teabags for 1–2 years if stored well. Green tea is more delicate and best used within 6–12 months. You can refrigerate green tea for extended freshness, but always use a completely airtight container. Correctly stored tea does not go "bad" but its flavour and antioxidant content diminish over time.',
      },
    ],
  },
  {
    matches: ['olive oil', 'vegetable oil', 'sunflower oil', 'canola oil', 'rapeseed oil', 'coconut oil', 'avocado oil'],
    sections: [
      {
        title: 'Health',
        content:
          'Cooking oils vary significantly in their fatty acid profile and therefore their health effects. Oils high in monounsaturated fats (olive, avocado, rapeseed) are associated with heart health. Oils high in polyunsaturated omega-6 fats (sunflower, corn) are also heart-healthy in moderation but should be balanced with omega-3 sources. Coconut oil is high in saturated fat and should be used in moderation. Refined oils have higher smoke points but may lose some beneficial compounds; cold-pressed or extra virgin oils retain more nutrients.',
      },
      {
        title: 'Eating',
        content:
          'Smoke point is the temperature at which an oil begins to smoke and break down, creating harmful compounds and bitter flavours. Match the oil to the cooking method: delicate oils (extra virgin olive oil, flaxseed) for dressings and low-heat cooking; refined oils (refined avocado, refined coconut) for high-heat searing and frying. Never reuse oil that has been heated past its smoke point. A small amount of oil in cooking goes a long way — swirling the pan coats it with very little oil.',
      },
      {
        title: 'Storage',
        content:
          'Store oils in a cool, dark cupboard in their original sealed containers or in dark glass bottles. Exposure to heat, light, and air causes oils to go rancid — rancid oil tastes bitter and waxy and has reduced nutritional value. Polyunsaturated oils (flaxseed, walnut, hemp) go rancid quickly and should be refrigerated. Most other oils keep for 1–2 years unopened and 6–12 months once opened. Pour oils rather than dipping into the bottle with utensils, as this introduces moisture and bacteria.',
      },
    ],
  },
  {
    matches: ['potato', 'potatoes', 'sweet potato', 'yam'],
    sections: [
      {
        title: 'Health',
        content:
          'Potatoes are a good source of vitamin C, potassium (more per serving than a banana), vitamin B6, and folate — particularly when eaten with the skin. Despite their reputation as a "bad carb," plain boiled or baked potatoes are quite nutritious and satiating; it\'s typically the cooking method (deep frying) or additions (butter, cream, cheese) that increase their calorie load. Cooling cooked potatoes converts some starch to resistant starch, which has a lower glycaemic impact and feeds beneficial gut bacteria. Sweet potatoes are particularly high in beta-carotene (vitamin A precursor) and antioxidants.',
      },
      {
        title: 'Eating',
        content:
          'Starchy potatoes (Russet, King Edward) are best for baking, roasting, and mashing — they become fluffy and absorb flavours well. Waxy potatoes (Charlotte, Jersey Royals, red-skinned varieties) hold their shape better and are better for salads, boiling, and gratins. All-purpose potatoes (Yukon Gold, Maris Piper) work for most cooking methods. Salt the water generously when boiling potatoes — it seasons them from the inside. Allow mashed potatoes to steam dry briefly before mashing to prevent a gluey texture from excess moisture.',
      },
      {
        title: 'Storage',
        content:
          'Store potatoes in a cool, dark, well-ventilated location — a paper bag or hessian sack in a cool cupboard or garage is ideal. Never store potatoes in the fridge; cold temperatures convert starch to sugars (making them taste sweet and causing them to brown faster when cooked). Never store potatoes with onions — they produce gases that cause each other to deteriorate. Remove any that are starting to sprout or go soft immediately to prevent them affecting others. Green patches on potatoes indicate solanine (a mild toxin) — peel or cut those parts away.',
      },
    ],
  },
  {
    matches: ['chicken', 'chicken breast', 'chicken thigh', 'chicken legs', 'whole chicken', 'chicken wings', 'chicken drumstick'],
    sections: [
      {
        title: 'Health',
        content:
          'Chicken is one of the most popular lean protein sources globally. Chicken breast is particularly low in fat (around 3 g per 100 g cooked) and high in protein (about 31 g per 100 g), making it a staple in many weight-management and muscle-building diets. Thighs and legs have more fat (primarily monounsaturated and saturated) but are also more flavourful and less prone to drying out when cooked. Chicken is a good source of niacin, vitamin B6, phosphorus, and selenium. Remove the skin before eating to significantly reduce saturated fat content.',
      },
      {
        title: 'Eating',
        content:
          'The single biggest mistake when cooking chicken breast is overcooking — it dries out very quickly. The safe internal temperature for chicken is 74°C (165°F); using a meat thermometer removes all guesswork. Brining chicken (soaking in salted water) for 30 minutes before cooking keeps breast meat noticeably juicier. Let chicken rest for 5–10 minutes after cooking before cutting to allow juices to redistribute. Dark meat (thighs, legs) is more forgiving of heat and stays moist longer — great for braises, curries, and stews.',
      },
      {
        title: 'Storage',
        content:
          'Raw chicken should be stored on the lowest shelf of the refrigerator (to prevent cross-contamination from drips), covered, and used within 1–2 days of purchase. If not using within 2 days, freeze it immediately. Frozen raw chicken keeps for 9–12 months. Cooked chicken refrigerates well for 3–4 days in a covered container. Always wash your hands, boards, and utensils thoroughly after handling raw chicken. Never wash raw chicken in the sink — it spreads bacteria to nearby surfaces via water droplets.',
      },
    ],
  },
  {
    matches: ['tomato', 'tomatoes', 'cherry tomato', 'canned tomato', 'tinned tomato', 'plum tomato', 'beefsteak tomato', 'roma tomato', 'passata', 'tomato paste', 'tomato sauce', 'tomato puree'],
    sections: [
      {
        title: 'Health',
        content:
          'Tomatoes are one of the best dietary sources of lycopene — a powerful antioxidant carotenoid associated with reduced risk of prostate cancer and heart disease. Interestingly, lycopene is more bioavailable in cooked and processed tomatoes (tinned, paste, sauce) than in raw tomatoes, because heat breaks down the cell walls that bind it. Tomatoes are also a good source of vitamins C, K1, folate, and potassium. The skin of the tomato contains the highest concentration of flavonoids, so leaving the skin on when possible maximises nutritional benefit.',
      },
      {
        title: 'Eating',
        content:
          'The flavour of tomatoes is fat-soluble — tossing them with olive oil enhances their taste. Roasting tomatoes concentrates their sweetness and adds complexity; even average tomatoes become excellent when slow-roasted. Adding a small pinch of sugar when cooking tinned tomatoes cuts their acidity. Fresh tomatoes should be dressed with salt, given time to rest (10–15 minutes), then drained — this draws out flavour-rich liquid. San Marzano tinned tomatoes are considered the gold standard for pasta sauces due to their low acidity and dense flesh.',
      },
      {
        title: 'Storage',
        content:
          'Never refrigerate ripe fresh tomatoes — the cold damages their cell membranes, destroying their texture and dramatically diminishing flavour. Store them at room temperature, stem-side down, away from direct sunlight. Underripe tomatoes can be left on a sunny windowsill to ripen. Once cut, refrigerate and use within 2 days. Tinned tomatoes keep for 2–5 years unopened. Once opened, transfer to an airtight container and refrigerate; use within 5–7 days. Tomato paste keeps in the fridge for up to 2 weeks after opening.',
      },
    ],
  },
  {
    matches: ['lemon', 'lemons', 'lime', 'limes', 'citrus'],
    sections: [
      {
        title: 'Health',
        content:
          'Lemons and limes are an excellent source of vitamin C — one medium lemon provides about 31 mg (about a third of the daily requirement). Vitamin C is a powerful antioxidant that supports immune function, collagen synthesis, and iron absorption from plant foods. Citrus fruits also contain flavonoids like hesperidin and naringenin, which have anti-inflammatory properties. The zest is particularly rich in flavonoids and essential oils; use it whenever possible. Despite being acidic, citrus fruits have an alkalising effect on the body once metabolised.',
      },
      {
        title: 'Eating',
        content:
          'Always zest before juicing — the zest contains more flavour compounds than the juice itself. Roll the fruit firmly on the counter before juicing to break down the internal membranes and get significantly more juice. A room-temperature lemon yields more juice than a cold one — microwave briefly (10–15 seconds) if needed. Lemon juice brightens dishes, balances sweetness, and is a useful substitute for vinegar in many applications. Add lemon or lime juice right at the end of cooking to preserve its bright flavour; heat destroys the volatile aromatics.',
      },
      {
        title: 'Storage',
        content:
          'Whole lemons and limes keep for 1 week at room temperature or 3–4 weeks in the fridge (ideally in a zip-lock bag or airtight container in the crisper drawer). Cut citrus should be wrapped tightly and refrigerated; use within 2–3 days. Squeeze and freeze juice in ice cube trays for convenient portions — frozen citrus juice keeps for 3–4 months. Zest can be frozen in small batches for up to 6 months. Lemons that are starting to go soft but have not gone mouldy are still perfectly usable for cooking and juicing.',
      },
    ],
  },

  // ─── Produce ────────────────────────────────────────────────────────────────

  {
    matches: ['avocado', 'avocados', 'hass avocado'],
    sections: [
      {
        title: 'Health',
        content:
          'Avocados are one of the few fruits that are high in fat — primarily heart-healthy monounsaturated oleic acid, the same fat found in olive oil. They are an excellent source of potassium (more per serving than a banana), folate, vitamins K, C, B5, and B6, and fibre. The fats in avocado also help absorb fat-soluble nutrients (like beta-carotene from tomatoes or salad greens) from other foods eaten in the same meal.',
      },
      {
        title: 'Eating',
        content:
          'Avocados only ripen after being picked — they won\'t ripen on the tree. A ripe avocado yields to gentle pressure near the stem end; if it feels mushy, it\'s overripe. Toss cut avocado with lemon or lime juice immediately to slow browning — it\'s oxidation, not ripening, and acid retards it. Storing the cut half with the pit in and pressing cling film directly onto the flesh also helps. Use ripe avocado within a day or two.',
      },
      {
        title: 'Storage',
        content:
          'Ripen firm avocados at room temperature; placing them in a paper bag with a banana speeds the process (ethylene gas). Once ripe, transfer to the fridge to slow further ripening — they\'ll keep for 2–3 more days. Cut avocado wrapped tightly in cling film keeps in the fridge for 1–2 days. Frozen avocado (blended or mashed with a little lemon juice) keeps for up to 3 months and is good for smoothies and guacamole.',
      },
    ],
  },
  {
    matches: ['banana', 'bananas', 'plantain'],
    sections: [
      {
        title: 'Health',
        content:
          'Bananas are a convenient source of potassium, vitamin B6, vitamin C, and magnesium. Unripe (green) bananas are high in resistant starch, which acts like fibre in the body and feeds beneficial gut bacteria. As a banana ripens, that starch converts to simple sugars — riper bananas are sweeter and easier to digest but have a higher glycaemic impact. Both ripe and unripe stages have distinct nutritional advantages.',
      },
      {
        title: 'Eating',
        content:
          'Overripe bananas — soft and heavily brown-spotted — are significantly sweeter and produce the best results in banana bread, muffins, and smoothies. Freeze peeled overripe bananas; blended from frozen, they create an incredibly creamy "nice cream" with no added dairy. Green bananas can be cooked as a vegetable in savoury dishes (fried, boiled, or curried) and are a staple in many Caribbean and South Asian cuisines.',
      },
      {
        title: 'Storage',
        content:
          'Store bananas at room temperature away from direct sunlight. They emit high levels of ethylene gas, which accelerates the ripening of nearby produce — keep them away from apples, avocados, and salad greens. Refrigerating bananas turns the skin black (a cold-induced reaction), but the flesh remains good for a few extra days. Freeze peeled ripe bananas whole or sliced in zip-lock bags for up to 3 months — ideal for baking and smoothies.',
      },
    ],
  },
  {
    matches: ['apple', 'apples', 'granny smith', 'gala apple', 'fuji apple', 'braeburn', 'pink lady'],
    sections: [
      {
        title: 'Health',
        content:
          'Apples are a good source of soluble fibre (particularly pectin), vitamin C, and quercetin — an antioxidant flavonoid. Regular apple consumption is associated with reduced risk of type 2 diabetes and better gut health from the prebiotic effect of pectin. The skin contains the majority of the fibre and antioxidants; eat it when possible. "An apple a day" is a simplification, but the general principle has some scientific backing.',
      },
      {
        title: 'Eating',
        content:
          'Tart, firm apples (Granny Smith, Braeburn, Bramley) hold their shape when cooked and are best for pies, tarts, and crumbles. Sweet, softer varieties (Gala, Fuji, Golden Delicious) are better for eating raw. Prevent cut apple browning with a squeeze of lemon juice or a 5-minute soak in lightly salted water. Apples and cheese are a classic pairing — try sharp Cheddar, blue cheese, or Brie with a crisp apple.',
      },
      {
        title: 'Storage',
        content:
          'Apples emit ethylene gas and should be stored separately from other produce to avoid accelerating its ripening. At room temperature they keep for 1–2 weeks; in the fridge crisper drawer they can last 6–8 weeks. Keep them in a perforated bag to maintain humidity without condensation. One bad apple really can affect the others — check regularly and remove any that show soft spots.',
      },
    ],
  },
  {
    matches: ['carrot', 'carrots', 'baby carrot'],
    sections: [
      {
        title: 'Health',
        content:
          'Carrots are one of the richest plant sources of beta-carotene, which the body converts to vitamin A — essential for vision, immune function, and skin health. Cooking carrots increases the bioavailability of beta-carotene by breaking down cell walls, so cooked carrots can be more nutritious in this respect than raw. Pairing with a fat source (olive oil, butter) further boosts absorption, as beta-carotene is fat-soluble.',
      },
      {
        title: 'Eating',
        content:
          'Roasting carrots at high heat concentrates their natural sugars and creates caramelised edges — far more flavourful than boiling. Glazing with honey or maple syrup near the end of roasting enhances their sweetness. The leafy tops are edible: slightly bitter, they work like parsley in pestos, chimichurri, and salads. Baby carrots sold pre-packaged are regular carrots that have been cut and tumbled smooth — they\'re nutritionally identical to full-sized carrots.',
      },
      {
        title: 'Storage',
        content:
          'Remove the leafy tops before storing — they draw moisture from the root and accelerate wilting. Refrigerate in the crisper drawer in a bag or container with a damp paper towel; they keep for 3–4 weeks. Revive limp carrots by trimming the ends and soaking in cold water for 30 minutes. Carrots can be blanched and frozen for up to 1 year — good for soups and cooked dishes but too soft for raw eating after freezing.',
      },
    ],
  },
  {
    matches: ['broccoli', 'broccolini', 'tenderstem'],
    sections: [
      {
        title: 'Health',
        content:
          'Broccoli is one of the most nutrient-dense vegetables, providing vitamin C, vitamin K, folate, fibre, and sulforaphane — a compound with well-documented anti-cancer properties. Sulforaphane is most active when broccoli is eaten raw or lightly cooked; overcooking (boiling until soft) destroys much of it. Chopping or chewing broccoli and letting it sit for a few minutes before cooking activates the enzyme that produces sulforaphane.',
      },
      {
        title: 'Eating',
        content:
          'Don\'t discard the stalks — peeled and sliced, they\'re sweet, crunchy, and delicious. Blanching broccoli briefly (2 minutes in boiling salted water) then plunging into ice water locks in bright colour and crisp texture. Roasting at high heat (220°C, spread in a single layer with olive oil) creates lightly charred, slightly nutty florets. Add a squeeze of lemon and some chilli flakes after cooking to lift the whole dish.',
      },
      {
        title: 'Storage',
        content:
          'Store unwashed broccoli in a loose plastic bag in the fridge crisper and use within 3–5 days — the flavour and nutrition deteriorate noticeably after this. A little yellowing means it\'s past its best. Blanch and freeze for up to 1 year. Broccoli absorbs surrounding odours readily, so keep it away from strong-smelling foods in the fridge.',
      },
    ],
  },
  {
    matches: ['spinach', 'baby spinach', 'kale', 'chard', 'swiss chard', 'pak choi', 'bok choy', 'leafy greens', 'rocket', 'arugula', 'watercress'],
    sections: [
      {
        title: 'Health',
        content:
          'Spinach and leafy greens are among the most nutrient-dense foods on earth, providing iron, calcium, folate, vitamins K, A, and C, and magnesium. Oxalates in raw spinach bind to iron and calcium, reducing their absorption — cooking reduces oxalate content. Pairing leafy greens with vitamin C (lemon juice, tomato) enhances iron absorption significantly. Kale is particularly high in vitamin K, which is important for bone health and blood clotting.',
      },
      {
        title: 'Eating',
        content:
          'Baby spinach is milder and suits salads and raw applications; mature spinach is better cooked as it wilts down to a fraction of its raw volume (500 g raw becomes about 60 g cooked). Always add spinach at the very end of cooking to preserve its bright colour and nutrients. Massaging raw kale with a little olive oil and salt for 2–3 minutes breaks down its tough cell walls and makes it much more tender and pleasant for salads.',
      },
      {
        title: 'Storage',
        content:
          'Store unwashed greens in their original bag in the fridge and wash just before use — excess moisture accelerates decay. Baby spinach and tender greens are best used within 3–5 days. More robust greens like kale and chard keep for 1–2 weeks. Blanch and freeze spinach (squeeze out excess water in a tea towel) for up to 6 months — ideal for adding to cooked dishes, smoothies, and soups.',
      },
    ],
  },
  {
    matches: ['bell pepper', 'capsicum', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper', 'sweet pepper', 'peppers'],
    sections: [
      {
        title: 'Health',
        content:
          'Red bell peppers are one of the richest sources of vitamin C — a single medium pepper contains roughly three times the vitamin C of an orange. Green peppers are simply unripe red, yellow, or orange peppers, harvested early before their sugars and nutrients fully develop, which is why they taste less sweet and have lower vitamin C. All colours provide vitamin A, B6, folate, and antioxidants including capsanthin (in red peppers).',
      },
      {
        title: 'Eating',
        content:
          'Roasting peppers directly on a gas flame or under a very hot grill, turning until charred all over, then steaming in a sealed bag for 10 minutes, produces a sweet, smoky flavour and makes the skin peel away effortlessly. Roasted peppers packed in olive oil keep in the fridge for 1–2 weeks and are excellent in sandwiches, pasta, and antipasto. Raw strips are great for dipping; slice them lengthwise rather than into rings for a satisfying crunch.',
      },
      {
        title: 'Storage',
        content:
          'Store whole peppers unwashed in the crisper drawer; they keep for 1–2 weeks. Once cut, refrigerate in an airtight container and use within 3–4 days. Red, yellow, and orange peppers freeze well diced or sliced (no blanching needed) for direct use in cooked dishes — they will be too soft for raw use after freezing.',
      },
    ],
  },
  {
    matches: ['cucumber', 'cucumbers', 'english cucumber', 'persian cucumber'],
    sections: [
      {
        title: 'Health',
        content:
          'Cucumbers are about 96% water, making them one of the most hydrating foods available. Very low in calories (~16 per 100 g), they provide vitamin K, potassium, and some B vitamins. The skin contains most of the nutrients and fibre — eat it when possible. Cucumber has a mild cooling effect and is used in traditional medicine to soothe skin irritation and reduce puffiness.',
      },
      {
        title: 'Eating',
        content:
          'Salting sliced cucumber and letting it drain for 15–20 minutes removes excess water, concentrates the flavour, and prevents it from diluting dressings in salads. Add cucumbers to salads just before serving for the same reason. A quick Japanese-style pickle (thin-sliced cucumber with rice vinegar, sugar, salt, and sesame oil, rested for 20 minutes) makes a bright, refreshing side with very little effort.',
      },
      {
        title: 'Storage',
        content:
          'Cucumbers are sensitive to cold injury and do best at around 10–13°C — slightly warmer than a standard fridge. Store wrapped in a paper towel in the warmest part of the fridge (the door shelf) and use within 1 week. Keep away from ethylene-producing fruits like tomatoes, bananas, and melons, which accelerate yellowing. Cut cucumber should be wrapped tightly and used within 2–3 days.',
      },
    ],
  },
  {
    matches: ['mushroom', 'mushrooms', 'chestnut mushroom', 'button mushroom', 'portobello', 'shiitake', 'oyster mushroom', 'cremini', 'porcini'],
    sections: [
      {
        title: 'Health',
        content:
          'Mushrooms are the only plant food that naturally produces vitamin D when exposed to sunlight or UV light — and exposing fresh mushrooms gill-side up to direct sunlight for 30–60 minutes can significantly boost their vitamin D content. They provide B vitamins (riboflavin, niacin, pantothenic acid), selenium, potassium, and beta-glucans, polysaccharides that support immune function. Dried mushrooms (especially porcini and shiitake) have concentrated umami flavour and nutrition.',
      },
      {
        title: 'Eating',
        content:
          'Never soak mushrooms to clean them — they absorb water and steam rather than brown when cooked. Wipe with a damp cloth or rinse quickly and dry immediately. The most important rule for cooking mushrooms is a hot, dry, uncrowded pan — overcrowding causes them to steam and become rubbery. Let them sit untouched until they\'re golden, then toss. A splash of soy sauce and a knob of butter at the end is all they need.',
      },
      {
        title: 'Storage',
        content:
          'Store mushrooms in a paper bag in the fridge — paper absorbs excess moisture, while plastic traps it and causes sliminess. Use within 3–7 days. Fresh mushrooms can be frozen raw (they will become soft when thawed but are fine for cooking) or sautéed first and then frozen for up to 3 months. Don\'t wash mushrooms until ready to use.',
      },
    ],
  },
  {
    matches: ['ginger', 'fresh ginger', 'ginger root', 'ground ginger'],
    sections: [
      {
        title: 'Health',
        content:
          'Ginger contains gingerol and shogaol (formed when ginger is dried or cooked), potent anti-inflammatory and antioxidant compounds. It is one of the most evidence-supported natural remedies for nausea — effective for morning sickness, motion sickness, and chemotherapy-related nausea. It may also help with muscle soreness, menstrual pain, and blood sugar regulation. Fresh and dried ginger have different therapeutic profiles; fresh is richer in gingerol, dried in shogaol.',
      },
      {
        title: 'Eating',
        content:
          'Fresh and ground ginger are not direct substitutes — they have different flavour profiles and intensities. Use roughly 1/4 teaspoon ground ginger for 1 tablespoon fresh. Freeze whole ginger root and grate directly from frozen — there\'s no need to peel it first, it grates into fine wisps effortlessly. Add ginger early in cooking for mellow depth, or stir in at the end for a sharper, fresher note.',
      },
      {
        title: 'Storage',
        content:
          'Whole unpeeled ginger keeps for 3 weeks at room temperature or 1 month in the fridge in an unsealed bag. Freeze whole ginger indefinitely — grate directly from frozen as needed. Peeled ginger can be submerged in vodka or dry sherry in a sealed jar in the fridge, where it keeps for several months. Ground ginger keeps for 2–3 years in a sealed container away from heat and light.',
      },
    ],
  },
  {
    matches: ['strawberry', 'blueberry', 'raspberry', 'blackberry', 'berries', 'berry', 'mixed berries'],
    sections: [
      {
        title: 'Health',
        content:
          'Berries are consistently ranked among the most antioxidant-rich foods. Blueberries are particularly high in anthocyanins, linked to improved brain function, reduced cognitive decline, and better cardiovascular health. Strawberries provide more vitamin C per serving than oranges. All berries are low in sugar relative to most fruits and high in fibre. Frozen berries retain their antioxidant content very well — often better than fresh berries that have been shipped and stored for days.',
      },
      {
        title: 'Eating',
        content:
          'Don\'t wash berries until just before eating — moisture accelerates mould growth rapidly. Bring refrigerated berries to room temperature before serving for fuller flavour. Frozen berries are ideal for smoothies, compotes, and baked goods and are more economical than fresh out of season. A quick compote (berries, a little sugar, splash of lemon juice, simmered 5 minutes) elevates yogurt, porridge, pancakes, and cheese.',
      },
      {
        title: 'Storage',
        content:
          'Store unwashed berries in the fridge; use within 2–3 days for raspberries, 5–7 days for blueberries. Removing any bruised or mouldy berries immediately prevents spread. Dry berries before refrigerating (a salad spinner works well) to extend shelf life. Freeze on a baking sheet in a single layer first, then transfer to bags — they keep for up to 1 year frozen and you can take just what you need.',
      },
    ],
  },
  {
    matches: ['zucchini', 'courgette', 'marrow'],
    sections: [
      {
        title: 'Health',
        content:
          'Zucchini is very low in calories (~17 per 100 g) and high in water, making it excellent for adding bulk to meals without significantly increasing calories. It provides vitamin C, vitamin B6, potassium, manganese, and folate. The skin is the most nutritious part and contains antioxidants including lutein and zeaxanthin, important for eye health — eat it rather than peeling.',
      },
      {
        title: 'Eating',
        content:
          'Salt and drain grated zucchini before adding to fritters, bread, or muffins — it contains a lot of water that will otherwise make the result soggy. High heat is key: cook in a hot, uncrowded pan so zucchini browns rather than steams. Thinly shaved raw zucchini with lemon juice, olive oil, shaved Parmesan, and toasted pine nuts makes a bright and simple salad.',
      },
      {
        title: 'Storage',
        content:
          'Store unwashed in a loose bag in the fridge crisper; use within 1 week. Zucchini is cold-sensitive and does best at 10°C — avoid the coldest part of the fridge. Cut zucchini should be wrapped and used within 3–4 days. Blanch and freeze diced zucchini for up to 3 months — it will be soft when thawed but is fine for soups, stews, and sauces.',
      },
    ],
  },
  {
    matches: ['celery', 'celery stalks', 'celery sticks'],
    sections: [
      {
        title: 'Health',
        content:
          'Celery is extremely low in calories (~14 per 100 g) and mostly water. It provides vitamin K, folate, potassium, and luteolin — a flavonoid with anti-inflammatory properties. The leaves are often discarded but are nutritionally rich; use them as you would parsley. Some research suggests celery seed extract may have a modest effect on blood pressure, though whole celery consumed normally is unlikely to have a dramatic effect.',
      },
      {
        title: 'Eating',
        content:
          'Celery forms the classic aromatic base ("mirepoix" with onion and carrot, "soffritto" in Italian cooking) that underpins countless soups, sauces, stews, and braises. The fibrous strings can be removed by snapping the top of the rib and pulling downward along the back. The leaves add a fresh, slightly bitter flavour to stocks, salads, and as a garnish. Celery is excellent for dipping — nut butter, hummus, and cream cheese are classic partners.',
      },
      {
        title: 'Storage',
        content:
          'Wrap celery tightly in aluminium foil (not plastic) and refrigerate — this keeps it crisp for up to 4 weeks, significantly longer than in its original bag. Revive limp celery by trimming the ends and soaking in cold water with a few ice cubes for 30 minutes. Cut celery keeps fresh in a container of cold water in the fridge for 1–2 weeks.',
      },
    ],
  },
  {
    matches: ['orange', 'oranges', 'blood orange', 'navel orange', 'clementine', 'mandarin', 'satsuma', 'tangerine'],
    sections: [
      {
        title: 'Health',
        content:
          'Oranges are an excellent source of vitamin C (one medium orange covers the full daily requirement), folate, and potassium. The white pith, despite tasting bitter, contains significant fibre and flavonoids — don\'t remove all of it. Whole oranges are nutritionally superior to orange juice: a glass of OJ requires 4–5 oranges, concentrating the sugar while removing the fibre that moderates its absorption.',
      },
      {
        title: 'Eating',
        content:
          'Always zest before juicing — the zest contains the aromatic essential oils that carry much of orange\'s flavour. A microplane gives the finest, most fragrant zest. Blood oranges have a distinctive berry-like undertone and a beautiful colour ideal for salads, desserts, and cocktails; they\'re in season roughly November to March. A pinch of salt added to freshly squeezed orange juice enhances the sweetness without tasting salty.',
      },
      {
        title: 'Storage',
        content:
          'Whole oranges keep for 1 week at room temperature or 2–3 weeks in the fridge. Store in a loose mesh bag or perforated bag in the crisper drawer. Cut oranges should be wrapped and refrigerated; use within 2 days. Freshly squeezed juice keeps for 2–3 days refrigerated in a sealed container — exposure to air degrades the vitamin C quickly.',
      },
    ],
  },

  // ─── Dairy & Eggs ───────────────────────────────────────────────────────────

  {
    matches: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'parmigiano', 'brie', 'camembert', 'gouda', 'emmental', 'gruyère', 'feta', 'halloumi', 'ricotta', 'cream cheese', 'goat cheese', 'stilton', 'blue cheese'],
    sections: [
      {
        title: 'Health',
        content:
          'Cheese is an excellent source of protein, calcium, phosphorus, and fat-soluble vitamins A and K2. It\'s calorie-dense — a standard serving is about 30 g (roughly a matchbox). Hard aged cheeses are very low in lactose and are often tolerated well by people who are lactose-intolerant. Fermented cheeses contain bioactive peptides and some beneficial bacteria. Processed cheese slices are nutritionally far inferior to real cheese — they contain far less protein and calcium per calorie.',
      },
      {
        title: 'Eating',
        content:
          'Remove cheese from the fridge 30–60 minutes before serving — cold suppresses flavour significantly. When melting cheese in sauces, add it off the heat or over very low heat and stir in — high heat causes proteins to seize and fat to separate, making the sauce greasy and grainy. Adding a splash of acid (wine, lemon juice) and starch (cornflour slurry) helps prevent this. Grate hard cheese like Parmesan yourself — pre-grated versions contain anti-caking powders that affect how they melt.',
      },
      {
        title: 'Storage',
        content:
          'Wrap cheese in wax paper or parchment rather than cling film — it needs to breathe slightly. Then place in a loose plastic bag in the vegetable crisper (not the coldest zone). Hard cheeses (Parmesan, aged Cheddar) keep for months; fresh cheeses (ricotta, mozzarella) last only a few days. Soft cheeses can be frozen but become crumbly on thawing — best used in cooking after freezing. Hard cheeses freeze well if grated first.',
      },
    ],
  },
  {
    matches: ['yogurt', 'yoghurt', 'greek yogurt', 'greek yoghurt'],
    sections: [
      {
        title: 'Health',
        content:
          'Yogurt is rich in protein, calcium, B vitamins, and phosphorus. Live-culture yogurt (labelled "live and active cultures") contributes beneficial probiotic bacteria to the gut. Greek yogurt is strained to remove whey, making it higher in protein (~10 g per 100 g) and lower in sugar than regular yogurt. Full-fat yogurt is more satiating and contains fat-soluble vitamins; many low-fat yogurts compensate for lost creaminess by adding sugar.',
      },
      {
        title: 'Eating',
        content:
          'Greek yogurt is an excellent substitute for sour cream, mayonnaise, and crème fraîche in dressings, dips, sauces, and baking — it reduces calories without sacrificing creaminess. Don\'t add yogurt to very hot dishes directly — stir it in off the heat or at a gentle simmer to prevent curdling. Strain regular yogurt through a muslin cloth overnight to make labneh, a thick Middle Eastern cheese that\'s delicious drizzled with olive oil and herbs.',
      },
      {
        title: 'Storage',
        content:
          'Keep refrigerated and use by the date on the packaging. Once opened, consume within 5–7 days. A layer of watery liquid on top (whey) is normal — stir it back in rather than pouring it off, as it contains protein. Yogurt can be frozen for up to 2 months; it may separate and become slightly grainy but is fine for cooking, baking, and smoothies.',
      },
    ],
  },
  {
    matches: ['cream', 'double cream', 'heavy cream', 'single cream', 'whipping cream', 'sour cream', 'crème fraîche', 'creme fraiche'],
    sections: [
      {
        title: 'Health',
        content:
          'Cream is calorie-dense — double/heavy cream provides around 340 calories per 100 ml, primarily from saturated fat. A small amount used in cooking goes a long way and provides fat-soluble vitamins A, D, E, and K2. Sour cream and crème fraîche are fermented versions with a pleasant tang; crème fraîche is the most versatile as it\'s stable when heated.',
      },
      {
        title: 'Eating',
        content:
          'Whipped cream doubles in volume — start with well-chilled cream in a cold bowl for the best and fastest results. Stop whipping just at soft peaks for the most stable result; over-whipped cream goes grainy and will eventually become butter. Crème fraîche and double cream can be added directly to hot sauces without curdling; single cream and sour cream may curdle if boiled — add at the very end off the heat. A small pinch of icing sugar in whipped cream stabilises it for longer.',
      },
      {
        title: 'Storage',
        content:
          'Fresh cream keeps refrigerated until its date — typically 1–2 weeks unopened, 3–5 days once opened. Freeze cream for up to 3 months; it may separate slightly on thawing but is fine for cooking and baking. UHT cream keeps for months at room temperature unopened. Never leave cream out of the fridge for more than 2 hours.',
      },
    ],
  },

  // ─── Proteins ───────────────────────────────────────────────────────────────

  {
    matches: ['ground beef', 'beef mince', 'minced beef', 'hamburger meat', 'mince'],
    sections: [
      {
        title: 'Health',
        content:
          'Lean ground beef (90%+ lean) is a good source of protein, highly bioavailable heme iron, zinc, B12, and creatine. Fat content varies significantly: 80/20 is most common in supermarkets, but 70/30 contains considerably more saturated fat. Grass-fed ground beef is higher in omega-3 fatty acids and CLA than grain-fed. The protein in beef is "complete" — it contains all nine essential amino acids.',
      },
      {
        title: 'Eating',
        content:
          'Don\'t overwork ground beef when forming patties or meatballs — handling it too much tightens the proteins and produces a dense, rubbery result. Season with salt just before cooking, not in advance, as pre-salting draws moisture out and changes texture. Cook ground beef to 71°C (160°F) throughout — unlike whole steaks where only the surface is at risk, grinding distributes surface bacteria throughout. For the best browning, cook in small batches in a very hot pan and don\'t stir constantly.',
      },
      {
        title: 'Storage',
        content:
          'Use raw ground beef within 1–2 days of purchase, or freeze immediately for up to 4 months. Spread it flat in freezer bags before freezing — it thaws much faster. Cooked ground beef keeps in the fridge for 3–4 days. Always store raw beef on the bottom shelf of the fridge to prevent drips contaminating other foods.',
      },
    ],
  },
  {
    matches: ['salmon', 'salmon fillet', 'smoked salmon', 'atlantic salmon'],
    sections: [
      {
        title: 'Health',
        content:
          'Salmon is one of the best dietary sources of omega-3 fatty acids (EPA and DHA), which support heart health, reduce inflammation, and are critical for brain function. A 100 g serving provides roughly 150% of the daily recommended omega-3 intake. It\'s also high in protein, B vitamins, selenium, and astaxanthin, the antioxidant carotenoid that gives salmon its pink colour. Health guidelines recommend eating oily fish like salmon 2–3 times per week.',
      },
      {
        title: 'Eating',
        content:
          'Salmon is done at 52°C (125°F) internally for a medium, slightly translucent centre, or 63°C (145°F) fully cooked — overcooking dries it out significantly. The white fat lines running through the flesh are where omega-3s are concentrated; don\'t trim them. Marinating in soy sauce, honey, and ginger for 30 minutes before cooking adds flavour and helps it caramelise. Start cooking skin-side down for crispy skin; press gently with a spatula for the first 30 seconds to prevent curling.',
      },
      {
        title: 'Storage',
        content:
          'Fresh salmon is highly perishable — store in the coldest part of the fridge and use within 1–2 days. Place on a bed of ice in a container for best results. Freeze for up to 3 months tightly wrapped; thaw overnight in the fridge. Smoked salmon keeps refrigerated for up to 2 weeks unopened. Once opened, consume within 3–5 days.',
      },
    ],
  },
  {
    matches: ['tuna', 'canned tuna', 'tinned tuna', 'tuna in brine', 'tuna in oil'],
    sections: [
      {
        title: 'Health',
        content:
          'Canned tuna is high in protein (~25 g per 100 g), omega-3 fatty acids, selenium, and vitamin D. Light tuna (skipjack) is lower in mercury than albacore (white) tuna — health agencies recommend limiting albacore to one serving per week for pregnant women and young children. Tuna in water has fewer calories than tuna in oil, but oil-packed tuna retains omega-3s slightly better. Both are nutritionally excellent.',
      },
      {
        title: 'Eating',
        content:
          'Drain canned tuna well and flake gently with a fork to keep some texture — mashing produces a paste. It pairs well with lemon juice, capers, Dijon mustard, fresh herbs, chilli, and olives. Beyond sandwiches: try it in pasta (pasta al tonno), on bruschetta with tomatoes, stirred into white beans, or in a Niçoise salad. A drizzle of good olive oil over drained tuna in water gives a result close to oil-packed quality.',
      },
      {
        title: 'Storage',
        content:
          'Unopened canned tuna keeps for 3–5 years. Once opened, transfer any unused tuna to an airtight container (never store in the open tin in the fridge) and refrigerate; use within 3–4 days. The flavour begins to change once exposed to air — cover immediately.',
      },
    ],
  },
  {
    matches: ['bacon', 'streaky bacon', 'back bacon', 'pancetta', 'lardons'],
    sections: [
      {
        title: 'Health',
        content:
          'Bacon is high in sodium, saturated fat, and is classified by the WHO as a Group 1 carcinogen (processed meat), meaning there is strong evidence it increases colorectal cancer risk — though the absolute risk increase per daily serving is modest. Cooking at very high heat (charring) produces more potentially harmful compounds. Treat it as an occasional ingredient for flavour rather than a dietary staple, and avoid burning it.',
      },
      {
        title: 'Eating',
        content:
          'Start bacon in a cold pan and bring up to medium heat gradually — this renders the fat slowly and produces crispier results than throwing it into a hot pan. Baking in a single layer on a rack at 200°C for 15–20 minutes produces uniformly crispy bacon without stovetop splatter. Reserve the rendered fat — it\'s an exceptional cooking fat for roasting potatoes, sautéing vegetables, and making dressings with a smoky depth.',
      },
      {
        title: 'Storage',
        content:
          'Keep refrigerated. Unopened packaged bacon keeps for 1–2 weeks; once opened, use within 7 days. Freeze in portions separated by parchment paper so you can remove only what you need — keeps for up to 1 month. Cooked bacon keeps for 4–5 days refrigerated or 1 month frozen.',
      },
    ],
  },
  {
    matches: ['pork', 'pork chop', 'pork loin', 'pork belly', 'pork shoulder', 'pork tenderloin', 'pork ribs'],
    sections: [
      {
        title: 'Health',
        content:
          'Lean cuts of pork (tenderloin, loin chops) are comparable to chicken breast for fat and calorie content — often called "the other white meat." Pork is an excellent source of thiamine (B1), B12, zinc, selenium, and protein. Fattier cuts (belly, shoulder, ribs) are higher in saturated fat and are best enjoyed occasionally. Processed pork products (sausages, ham, bacon) are high in sodium and are classified as Group 1 carcinogens by the WHO.',
      },
      {
        title: 'Eating',
        content:
          'Pork no longer needs to be cooked until grey throughout — current guidelines recommend 63°C (145°F) for whole cuts with a 3-minute rest, allowing a slightly pink, juicy centre. Brining pork (salt water solution) for 1–4 hours before cooking significantly improves moisture retention, especially for lean cuts. Shoulder and leg are ideal for long, slow cooking — the collagen breaks down into gelatin, creating incredibly tender, flavourful pulled pork or roasts.',
      },
      {
        title: 'Storage',
        content:
          'Raw pork refrigerates for 3–5 days; ground pork for 1–2 days. Freeze for 4–6 months. Store on the bottom shelf of the fridge. Cooked pork keeps for 3–4 days refrigerated or up to 3 months frozen. Cured pork products (prosciutto, salami) have longer fridge lives — check packaging dates.',
      },
    ],
  },
  {
    matches: ['lamb', 'lamb chop', 'lamb shoulder', 'lamb leg', 'minced lamb', 'ground lamb', 'rack of lamb', 'lamb mince'],
    sections: [
      {
        title: 'Health',
        content:
          'Lamb provides high-quality protein, heme iron, zinc, B12, and selenium. It contains conjugated linoleic acid (CLA) and more omega-3 fatty acids than most other red meats, particularly grass-fed lamb. It\'s higher in saturated fat than poultry but nutritionally dense. As with all red meat, moderate consumption as part of a varied diet is appropriate.',
      },
      {
        title: 'Eating',
        content:
          'The distinctive flavour of lamb comes from branched-chain fatty acids; younger lamb (under 12 months) is milder and more tender than mutton. Classic flavour pairings include rosemary, garlic, mint, cumin, and pomegranate. Shoulder is best braised or slow-roasted; leg roasts beautifully; chops and rack are best cooked quickly at high heat. Always rest lamb for 10 minutes after cooking — this redistributes the juices and makes a significant difference to juiciness.',
      },
      {
        title: 'Storage',
        content:
          'Fresh lamb refrigerates for 3–5 days; ground lamb for 1–2 days. Freeze for 6–9 months. Store sealed in the coldest part of the fridge — lamb has a stronger odour than beef or pork and can transfer flavour to other foods. Cooked lamb refrigerates for 3–4 days.',
      },
    ],
  },
  {
    matches: ['lentil', 'lentils', 'red lentil', 'green lentil', 'puy lentil', 'french lentil', 'brown lentil'],
    sections: [
      {
        title: 'Health',
        content:
          'Lentils are nutritional powerhouses — about 18 g of plant protein per 100 g cooked, along with fibre, folate, iron, potassium, and magnesium. They are one of the best plant-based iron sources, though pairing with vitamin C (tomatoes, lemon juice) significantly improves absorption. Lentils have a low glycaemic index and act as a prebiotic, supporting beneficial gut bacteria. They cook relatively quickly and don\'t require soaking, unlike most other dried legumes.',
      },
      {
        title: 'Eating',
        content:
          'Red and yellow lentils dissolve when cooked and are perfect for soups, dals, and blended sauces. Green and brown lentils hold their shape and work in salads and pilafs. Puy/French green lentils are the firmest and most flavourful. Rinse before cooking to remove any grit. Don\'t add salt or acidic ingredients until the lentils are almost fully cooked — it toughens their skins and extends cooking time. A bay leaf and half an onion in the cooking water adds depth.',
      },
      {
        title: 'Storage',
        content:
          'Dried lentils keep for 2–3 years in an airtight container in a cool, dry place. Cooked lentils refrigerate for 5–7 days and freeze well for up to 6 months. Batch-cook a large pot and freeze in portions for a quick, nutritious weeknight base.',
      },
    ],
  },
  {
    matches: ['chickpea', 'chickpeas', 'garbanzo', 'kidney bean', 'black bean', 'cannellini', 'butter bean', 'haricot bean', 'borlotti', 'dried beans', 'canned beans', 'tinned beans', 'baked beans'],
    sections: [
      {
        title: 'Health',
        content:
          'Chickpeas and dried beans are among the most nutritious and economical foods available — high in plant protein, complex carbohydrates, fibre, iron, folate, and manganese. Regular bean consumption is associated with lower rates of heart disease, type 2 diabetes, and colorectal cancer. The fibre slows digestion, making beans highly satiating. Canned beans are nearly as nutritious as cooked-from-scratch and are a fantastic convenience food.',
      },
      {
        title: 'Eating',
        content:
          'Cooking dried chickpeas from scratch (soak overnight in cold water, drain, then simmer 60–90 minutes) gives a far superior texture and flavour to canned. Save the cooking liquid — aquafaba (the starchy bean cooking water) is a remarkable vegan substitute for egg whites in meringues and mousses. Roast drained, dried canned chickpeas at 200°C with olive oil and spices for 25 minutes for a crunchy, protein-rich snack.',
      },
      {
        title: 'Storage',
        content:
          'Dried beans keep for 2–3 years in an airtight container. Very old dried beans (5+ years) may never soften fully no matter how long you cook them. Cooked or opened canned beans keep refrigerated in their liquid for 3–5 days. Cooked beans freeze excellently for up to 6 months — batch-cook and freeze in can-sized portions for effortless weeknight cooking.',
      },
    ],
  },

  // ─── Grains & Baking ────────────────────────────────────────────────────────

  {
    matches: ['oat', 'oats', 'oatmeal', 'porridge', 'rolled oats', 'steel cut oats', 'overnight oats'],
    sections: [
      {
        title: 'Health',
        content:
          'Oats are one of the most nutritious whole grains, rich in beta-glucan — a soluble fibre with well-documented ability to lower LDL cholesterol and improve blood sugar control. They provide complex carbohydrates, protein (~17 g per 100 g dry), magnesium, iron, and B vitamins. Oats are naturally gluten-free but are frequently contaminated during processing — buy certified gluten-free if you have coeliac disease.',
      },
      {
        title: 'Eating',
        content:
          'Steel-cut oats take longer to cook (20–30 minutes) but have a chewier, nuttier texture and a lower glycaemic index than rolled oats. For overnight oats, mix equal parts rolled oats and liquid (milk, plant milk, yogurt) and refrigerate overnight — no cooking required. Toast dry oats in a dry pan for 3–4 minutes before using to add a rich, nutty flavour to granola, crumbles, and porridge.',
      },
      {
        title: 'Storage',
        content:
          'Oats keep for up to 2 years in a sealed container at room temperature. Avoid humidity — moisture causes them to go mouldy or rancid. Steel-cut oats have a slightly shorter shelf life than rolled oats due to higher oil content. Cooked porridge refrigerates for 5 days and freezes well for 3 months.',
      },
    ],
  },
  {
    matches: ['bread', 'sourdough', 'whole wheat bread', 'wholemeal bread', 'white bread', 'rye bread', 'baguette', 'ciabatta', 'brioche', 'loaf'],
    sections: [
      {
        title: 'Health',
        content:
          'Whole grain bread provides significantly more fibre, vitamins, and minerals than white bread. Look for "whole wheat" or "whole grain" as the first ingredient — "wheat flour" without "whole" means refined white flour. Sourdough fermentation reduces the glycaemic index, improves mineral absorption, and breaks down some gluten, making it easier to digest for many people (not suitable for coeliac disease).',
      },
      {
        title: 'Eating',
        content:
          'Stale bread should never go in the bin — it\'s the raw material for breadcrumbs, croutons, panzanella, ribollita, French toast, and bread pudding. Revive a day-old baguette by running it quickly under water and baking at 180°C for 8–10 minutes. Freeze half a fresh loaf immediately if you won\'t finish it in 3–4 days — it thaws perfectly at room temperature or toasts directly from frozen.',
      },
      {
        title: 'Storage',
        content:
          'Bread goes stale fastest in the fridge — cold accelerates retrogradation of starch, making it firmer. Keep at room temperature in a bread bin or sealed bag and consume within 3–5 days. Freeze for up to 3 months; slice before freezing so you can take individual slices as needed. A sliced apple stored in the bread bag helps slow staling.',
      },
    ],
  },
  {
    matches: ['quinoa'],
    sections: [
      {
        title: 'Health',
        content:
          'Quinoa is unique among plant foods in being a complete protein — it contains all nine essential amino acids in meaningful amounts. It\'s also gluten-free, and provides fibre, magnesium, iron, zinc, folate, and antioxidants. It has a lower glycaemic index than white rice or pasta. Technically a seed rather than a grain, it is cooked and used as one.',
      },
      {
        title: 'Eating',
        content:
          'Rinse quinoa thoroughly before cooking — it has a natural coating (saponin) that is mildly bitter and soapy-tasting if not washed off. Toast rinsed quinoa in a dry pan for 2–3 minutes before adding water for a nuttier flavour. Cook with a 1:1.75 ratio (one cup quinoa to 1¾ cups water), bring to a boil, cover, and simmer 15 minutes until the water is absorbed and the curly white germ has separated. It\'s done when the germ pops out like a tiny tail.',
      },
      {
        title: 'Storage',
        content:
          'Uncooked quinoa keeps for 2–3 years in a sealed container. Cooked quinoa refrigerates for 5–7 days and freezes for up to 2 months. It reheat excellently in a pan with a splash of water or in the microwave covered with a damp paper towel.',
      },
    ],
  },
  {
    matches: ['baking soda', 'bicarbonate of soda', 'bicarb', 'baking powder'],
    sections: [
      {
        title: 'Health',
        content:
          'Both are used in small quantities as leavening agents and have no significant direct health effects. Baking soda (sodium bicarbonate) is sometimes used as a home remedy for heartburn and indigestion — dissolve 1/4 teaspoon in 250 ml of water. However, it is high in sodium and should not be used regularly.',
      },
      {
        title: 'Eating',
        content:
          'Baking soda (pure bicarbonate) needs an acid in the recipe to activate — buttermilk, yogurt, lemon juice, vinegar, brown sugar, or cocoa powder. Without acid it will leave a soapy, metallic taste. Baking powder contains baking soda plus a built-in dry acid (usually cream of tartar) and activates with moisture and heat — it works without an acidic ingredient. They are not interchangeable without adjustment: use roughly 3× as much baking powder as baking soda if substituting.',
      },
      {
        title: 'Storage',
        content:
          'Both lose potency over time. Test baking soda: add 1 tsp to hot water with a splash of vinegar — it should bubble vigorously. Test baking powder: add 1 tsp to hot water alone — it should bubble. Replace both annually if you bake regularly. Store in a sealed container well away from moisture; even steam from a kettle can start to activate them.',
      },
    ],
  },

  // ─── Condiments & Flavourings ────────────────────────────────────────────────

  {
    matches: ['vinegar', 'apple cider vinegar', 'balsamic', 'balsamic vinegar', 'red wine vinegar', 'white wine vinegar', 'rice vinegar', 'white vinegar', 'malt vinegar'],
    sections: [
      {
        title: 'Health',
        content:
          'Apple cider vinegar has been studied for modest effects on blood sugar — a tablespoon diluted in water before a high-carb meal may slightly reduce the post-meal glucose spike. Balsamic vinegar is low in calories and contains antioxidants from the grape must it\'s made from. All vinegars have antimicrobial properties due to their acidity. Avoid taking undiluted vinegar — its acidity can damage tooth enamel and the oesophagus.',
      },
      {
        title: 'Eating',
        content:
          'A small splash of vinegar brightens almost any savoury dish and balances richness — add it at the very end of cooking for the most impact. Balsamic reduction (simmer balsamic vinegar in a pan until thick and syrupy, about half volume) is a simple, impressive condiment that transforms grilled meat, strawberries, cheese, and salads. Different vinegars have different characters: apple cider is fruity and mild; red wine is robust; rice vinegar is delicate; balsamic is sweet and complex.',
      },
      {
        title: 'Storage',
        content:
          'Vinegar has an essentially unlimited shelf life due to its high acidity. Store sealed at room temperature away from direct light. Balsamic may form a harmless dark sediment over time; shake before using. Raw apple cider vinegar with "the mother" (a harmless cobweb-like culture) is intentionally unfiltered — store as normal.',
      },
    ],
  },
  {
    matches: ['soy sauce', 'tamari', 'shoyu', 'dark soy sauce', 'light soy sauce', 'coconut aminos'],
    sections: [
      {
        title: 'Health',
        content:
          'Soy sauce adds deep umami flavour with very few calories, but is very high in sodium — roughly 1,000 mg per tablespoon, nearly half the daily recommended limit. Low-sodium soy sauce contains about 40% less sodium and is a good substitute. Despite its salt content, fermented soy sauce contains some beneficial bioactive compounds and antioxidants. Tamari is a wheat-free alternative suitable for coeliac disease.',
      },
      {
        title: 'Eating',
        content:
          'Soy sauce added early in cooking integrates into the dish and mellows; added at the end gives a more pronounced soy flavour. Japanese shoyu (lighter, sweeter) suits delicate dishes like sushi and dressings. Chinese dark soy sauce is thicker, less salty, and adds rich colour to braises and stir-fries — use in small amounts. A teaspoon of soy sauce in unexpected places (pasta sauces, stews, fried eggs) adds a background savoury depth without tasting "Asian."',
      },
      {
        title: 'Storage',
        content:
          'Unopened soy sauce keeps indefinitely. Once opened, it keeps at room temperature for up to 3 years, but refrigerating after opening preserves its flavour better, especially for lighter, more delicate varieties. Soy sauce doesn\'t go "bad" in the traditional sense — it just oxidises and loses its nuances over time.',
      },
    ],
  },
  {
    matches: ['cocoa', 'cacao', 'cocoa powder', 'dark chocolate', 'milk chocolate', 'chocolate chips', 'cooking chocolate'],
    sections: [
      {
        title: 'Health',
        content:
          'Dark chocolate (70%+ cacao) is rich in flavanols — particularly epicatechin — which improve blood flow, modestly reduce blood pressure, and have antioxidant effects. Regular small amounts are associated with reduced cardiovascular risk in studies. The higher the cacao percentage, the more flavanols and the less sugar. Milk chocolate has far fewer flavanols and more sugar; white chocolate contains no cacao solids at all.',
      },
      {
        title: 'Eating',
        content:
          'For baking, use unsweetened cocoa powder, not drinking chocolate (which contains sugar and is less chocolatey). Dutch-processed cocoa is darker, milder, and less acidic — best with baking powder; natural cocoa is brighter and more acidic — best with baking soda. Melt chocolate gently in a bain-marie or microwave at 50% power in 30-second bursts, stirring between each — chocolate seizes irreparably if overheated or if water gets into it.',
      },
      {
        title: 'Storage',
        content:
          'Store cocoa powder sealed for up to 2 years. Chocolate bars last 1–2 years (dark), 8–10 months (milk), and 4–6 months (white). Chocolate stored improperly develops "bloom" — white or grey streaks or coating. Fat bloom (cocoa butter recrystallising) and sugar bloom (moisture dissolving then recrystallising sugar) are both harmless and the chocolate is still perfectly safe and usable, though the texture and appearance are affected.',
      },
    ],
  },
  {
    matches: ['peanut butter', 'almond butter', 'nut butter'],
    sections: [
      {
        title: 'Health',
        content:
          'Peanut butter provides protein (~8 g per 2 tablespoons), healthy monounsaturated and polyunsaturated fats, magnesium, potassium, and B vitamins. Natural peanut butter (just peanuts, possibly salt) is superior to processed varieties that add palm oil and sugar. Despite being calorie-dense, moderate nut butter consumption is associated with reduced heart disease risk and better weight management — likely because its fat and protein content is very satiating.',
      },
      {
        title: 'Eating',
        content:
          'Natural peanut butter separates — stir well and then store the jar upside down to minimise future separation. It\'s excellent in savoury cooking: satay sauce, West African peanut stew, cold noodle dressings with soy and sesame. Add a tablespoon to smoothies for protein and creaminess. Thin with a little hot water, soy sauce, lime juice, and chilli for an instant noodle sauce.',
      },
      {
        title: 'Storage',
        content:
          'Natural peanut butter should be refrigerated after opening to prevent the oils from going rancid — it keeps for 3–4 months. Commercial processed varieties keep in a cool pantry for 3 months after opening (or 6–9 months refrigerated). Unopened peanut butter has a shelf life of about 1 year. Almond and other nut butters have shorter shelf lives due to higher polyunsaturated fat content — always refrigerate after opening.',
      },
    ],
  },
  {
    matches: ['almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pecan', 'pecans', 'hazelnut', 'hazelnuts', 'pistachio', 'pistachios', 'mixed nuts', 'brazil nut', 'pine nut', 'macadamia'],
    sections: [
      {
        title: 'Health',
        content:
          'Regular nut consumption is consistently associated with reduced risk of heart disease, lower body weight (despite being calorie-dense — likely due to satiety and incomplete fat absorption), and reduced inflammation. Almonds are high in vitamin E and magnesium; walnuts have the highest omega-3 content of any tree nut; Brazil nuts are the richest dietary source of selenium (1–2 per day covers daily needs). A standard serving is about 30 g — a small palm-sized handful.',
      },
      {
        title: 'Eating',
        content:
          'Toasting nuts dramatically enhances their flavour. Spread in a single layer on a baking sheet at 160–170°C for 8–12 minutes (watch carefully — they go from done to burnt quickly), or toast in a dry pan over medium heat for 3–5 minutes, stirring frequently. Cool before adding to dishes or storing. Toasted nuts can be ground into pestos, sprinkled on salads, or served with cheese, and add crunch to roasted vegetables.',
      },
      {
        title: 'Storage',
        content:
          'Nuts go rancid quickly because of their high fat content — rancid nuts taste bitter and have a paint-like smell. Refrigerate in an airtight container for up to 6 months, or freeze for up to 1 year. Room temperature is suitable for only 1–2 months in a cool, dark place. Taste before adding to finished dishes — rancid nuts will ruin them. Buy in smaller quantities if you don\'t use them regularly.',
      },
    ],
  },

  // ─── Spices & Seasonings ─────────────────────────────────────────────────────

  {
    matches: ['black pepper', 'whole peppercorns', 'peppercorn', 'white pepper', 'pepper'],
    sections: [
      {
        title: 'Health',
        content:
          'Black pepper contains piperine, the compound responsible for its heat. Piperine is a remarkable bioavailability enhancer — it increases the absorption of many nutrients, most notably curcumin (from turmeric) by up to 2000%. It has antioxidant and anti-inflammatory properties and may support digestive health by stimulating digestive enzyme secretion.',
      },
      {
        title: 'Eating',
        content:
          'Freshly ground black pepper is vastly superior to pre-ground in both flavour and aroma — the volatile aromatic compounds begin dispersing within 30 minutes of grinding. Invest in a good pepper mill and whole peppercorns. White pepper (same berry, outer skin removed) has a different earthy, musty flavour and is used in white sauces, cream soups, and mashed potatoes where black specks would be visually distracting.',
      },
      {
        title: 'Storage',
        content:
          'Whole peppercorns keep for 3–4 years in a sealed container; pre-ground pepper loses its aroma significantly within a few weeks of grinding. Never store pepper near the stove — heat accelerates degradation. A well-stocked pepper grinder filled with whole peppercorns is the single most impactful kitchen upgrade for everyday cooking.',
      },
    ],
  },
  {
    matches: ['cinnamon', 'ground cinnamon', 'cinnamon stick', 'cassia'],
    sections: [
      {
        title: 'Health',
        content:
          'Cinnamon has documented effects on blood sugar — a small amount before or with a meal may help reduce post-meal glucose spikes. There are two types: Ceylon (true cinnamon, lighter in colour and more delicate in flavour) and Cassia (most commonly sold, darker and more pungent). Cassia contains high levels of coumarin, which can be harmful to the liver in very large daily amounts — culinary use is well within safe limits, but Ceylon is the safer choice for therapeutic/large doses.',
      },
      {
        title: 'Eating',
        content:
          'Cinnamon is far more versatile than its association with sweet baking suggests — it\'s fundamental to North African, Middle Eastern, and South Asian savoury cooking in tagines, biryanis, and curries. It also enhances the perception of sweetness, allowing you to reduce sugar in recipes. A cinnamon stick simmered in sauces, stews, and drinks gives a more delicate, rounded flavour than ground cinnamon.',
      },
      {
        title: 'Storage',
        content:
          'Ground cinnamon keeps for 2–3 years; cinnamon sticks for 3–4 years. Store in a sealed container away from heat, light, and moisture. Buy in smaller quantities unless you use it frequently — it loses potency over time and a flavourless spice adds no value to cooking.',
      },
    ],
  },
  {
    matches: ['turmeric', 'ground turmeric', 'fresh turmeric'],
    sections: [
      {
        title: 'Health',
        content:
          'Turmeric contains curcumin, one of the most studied natural anti-inflammatory compounds, with promising (if still evolving) evidence for reducing chronic inflammation. Curcumin has very poor bioavailability on its own — consuming it with black pepper (piperine boosts absorption by ~2000%) and a fat source is essential for meaningful effect. Turmeric stains intensely — protect surfaces, clothing, and light-coloured containers when handling it.',
      },
      {
        title: 'Eating',
        content:
          'Use turmeric sparingly — a little provides flavour and its distinctive yellow colour; too much is bitter. It\'s excellent in curries, rice, scrambled eggs, soups, and golden milk. Fresh turmeric root (resembles small orange ginger) is more vibrant and can be grated or sliced. Always pair with black pepper and a fat source to maximise absorption. Golden milk (warm milk, turmeric, black pepper, ginger, honey) is a pleasant way to consume it regularly.',
      },
      {
        title: 'Storage',
        content:
          'Ground turmeric keeps for 2–3 years in a sealed opaque container away from light — light degrades its colour and active compounds. Fresh turmeric refrigerates for 2–3 weeks or can be frozen whole, grated directly from frozen like ginger.',
      },
    ],
  },
  {
    matches: ['cumin', 'ground cumin', 'cumin seeds'],
    sections: [
      {
        title: 'Health',
        content:
          'Cumin is a good source of iron — just one teaspoon provides about 20% of the daily recommended intake. It has been used medicinally for digestive complaints and research suggests it may support digestive enzyme activity. Cumin also contains antioxidants and has shown modest blood-sugar-lowering effects in some studies.',
      },
      {
        title: 'Eating',
        content:
          'Toasting whole cumin seeds in a dry pan for 30–60 seconds until fragrant, then grinding, produces a significantly more complex flavour than pre-ground cumin. Blooming cumin seeds in hot oil at the start of cooking (tempering or tarka) releases their aromatic compounds into the oil, which then infuses the whole dish. Cumin is the backbone of many spice blends: garam masala, taco seasoning, ras el hanout, and baharat.',
      },
      {
        title: 'Storage',
        content:
          'Whole cumin seeds keep for 3–4 years; ground cumin for 2–3 years in a sealed container away from heat and light. Buy whole seeds if you can and grind as needed for the best flavour.',
      },
    ],
  },
  {
    matches: ['vanilla', 'vanilla extract', 'vanilla bean', 'vanilla paste', 'vanilla pod'],
    sections: [
      {
        title: 'Health',
        content:
          'Pure vanilla contains vanillin, which has antioxidant properties, and studies suggest it may have mild anti-inflammatory effects. More practically, vanilla enhances the perception of sweetness and can allow you to reduce sugar in a recipe by up to 25% without noticeably affecting sweetness. This makes it useful in baking for reducing sugar content.',
      },
      {
        title: 'Eating',
        content:
          'Pure vanilla extract and imitation (synthetic vanillin) taste similar in baked goods where other flavours dominate, but the difference is obvious in uncooked or lightly cooked applications like ice cream, custard, and frosting. Vanilla bean paste contains real seeds and gives both intense flavour and visual appeal. After scraping out a vanilla bean, bury the spent pod in a jar of caster sugar — in 1–2 weeks you\'ll have beautifully fragrant vanilla sugar.',
      },
      {
        title: 'Storage',
        content:
          'Pure vanilla extract keeps indefinitely stored in a cool, dark place — it improves with age, like wine. Do not refrigerate: condensation can cause cloudiness. Vanilla beans keep for 2 years wrapped tightly in plastic or an airtight container. If they dry out and become brittle, soak in warm water for 15 minutes before use to restore flexibility.',
      },
    ],
  },
];

/**
 * Look up tips for a given item name. Returns null if no tips are available.
 * Matching is case-insensitive and partial (any match term appearing in the
 * item name, or the item name appearing in a match term, counts as a hit).
 */
export function getItemTips(itemName: string): ItemTips | null {
  if (!itemName) return null;
  const lower = itemName.toLowerCase().trim();
  return (
    ITEM_TIPS.find(tip =>
      tip.matches.some(m => lower.includes(m) || m.includes(lower))
    ) ?? null
  );
}
