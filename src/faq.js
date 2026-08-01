// Stand-in for the hosting dietitian's real FAQ page. In production each
// clinician's own FAQ would be ingested; for the demo this module IS the
// ingested FAQ, and is the single source of truth for both the rendered page
// and the matching prompt.
//
// Answers here are clinician-authored and vetted. Nothing in this app may
// generate, paraphrase, or summarize them — matching questions to entries is
// the only permitted AI involvement.
export const FAQ_ENTRIES = [
  {
    id: 'sugar-cravings',
    question: 'How can I manage sugar cravings, especially at night?',
    answer:
      'Evening sugar cravings are extremely common and usually reflect eating patterns earlier in the day rather than willpower. Eating enough protein and fiber at dinner, keeping regular meal times, and not restricting too hard during the day all reduce evening cravings. If you want a sweet after dinner, plan for it deliberately — a small portion you chose on purpose beats grazing.',
  },
  {
    id: 'coffee-sugar',
    question: 'Is sugar in my coffee or tea a problem for my blood sugar?',
    answer:
      'A teaspoon or two once a day is a small contributor for most people. It becomes meaningful when it is several sugars across several cups daily. Reducing gradually — one less sugar per cup every week or two — is far more sustainable than cutting to zero overnight, and most people stop noticing the difference within a few weeks.',
  },
  {
    id: 'desk-job-exercise',
    question: 'I sit all day for work. What actually counts as enough activity?',
    answer:
      'You do not need a gym. For blood sugar specifically, short frequent movement beats one intense session: a 10-minute walk after meals measurably lowers post-meal glucose. Aim to break up sitting every 30-60 minutes, even for two minutes. If you can add two or three brisk 10-minute walks across the day, that is a genuinely effective baseline.',
  },
  {
    id: 'nutrition-labels',
    question: 'How do I read a nutrition label?',
    answer:
      'Start with three things: serving size (everything else on the label is per serving, not per package), total carbohydrates (more useful than sugar alone for blood glucose), and fiber (higher fiber slows glucose absorption). Ignore front-of-package claims entirely — the back panel is the only part that is regulated to be accurate.',
  },
  {
    id: 'grocery-list',
    question: 'What should a prediabetes-friendly grocery list look like?',
    answer:
      'Build around: non-starchy vegetables, a protein source you actually like, whole grains over refined (brown rice, oats, whole wheat), legumes, nuts, and fruit — whole fruit, not juice. You do not need special "diabetic" products, which are usually more expensive and no better. The pattern matters more than any single food.',
  },
  {
    id: 'meal-timing',
    question: 'Does when I eat matter, or only what I eat?',
    answer:
      'Both matter, but what and how much still matter more. Very late heavy meals tend to produce higher overnight glucose, and extremely irregular meal timing makes cravings and portion control harder. A consistent rhythm — whatever rhythm fits your life — is the practical goal, not a specific clock time.',
  },
];
