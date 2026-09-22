import type { BlogPost } from '@/features/blog/blogPosts'

/**
 * "Road trips" — day trips and weekend drives. Distances and times are
 * rounded ("about", "roughly") on purpose. Every one carries the same
 * honest coverage note: the Booking Terms limit use of the car to the
 * pickup/drop-off city agreed at booking, so a trip to another emirate
 * has to be checked with the team first. If that policy changes, change
 * COVERAGE_NOTE_EN / COVERAGE_NOTE_AR here once.
 */
const COVERAGE_NOTE_EN =
  'Our [Booking Terms](/booking-terms) tie the rental to the pickup and drop-off city agreed at booking. If your trip goes to another emirate, [contact us](/contact) before you book so we can confirm it works for your rental.'
const COVERAGE_NOTE_AR =
  'تربط [شروط وأحكام الحجز](/booking-terms) الإيجار بمدينة الاستلام والتسليم المتفق عليها عند الحجز. وإذا كانت رحلتك تشمل إمارة أخرى فـ[تواصل معنا](/contact) قبل الحجز لنؤكد لك أن ذلك مناسب لإيجارك.'

export const ROAD_TRIP_POSTS: BlogPost[] = [
  {
    slug: 'dubai-to-abu-dhabi-road-trip',
    category: 'road-trips',
    city: 'abu-dhabi',
    publishedAt: '2026-09-19',
    related: ['abu-dhabi-weekend-by-car', 'salik-parking-and-fines-uae-rental-car', 'al-ain-day-trip-by-car'],
    en: {
      title: 'Dubai to Abu Dhabi Road Trip Guide',
      description: 'Driving from Dubai to Abu Dhabi: route, journey time, stops on the way and what to see — plus how coverage works on a rental.',
      excerpt: 'About 140 km and an hour and a half on the E11 — the route, the stops and what to check before you go.',
      intro:
        'Dubai and Abu Dhabi are about 140 km apart, and the drive along the E11 highway usually takes around an hour and a half without heavy traffic. It is an easy day trip — or the start of a weekend.',
      sections: [
        {
          heading: 'The route and journey time',
          paragraphs: [
            "The main route is the E11 highway (Sheikh Zayed Road) along the coast, with other highways running parallel inland — a navigation app will pick the fastest for the time of day. Allow more time at weekday rush hours, especially leaving Dubai in the morning and returning in the evening.",
          ],
        },
        {
          heading: 'Stops worth making',
          list: [
            'Sheikh Zayed Grand Mosque — the city’s most famous landmark; visitors dress modestly.',
            "Saadiyat Island — home to the Louvre Abu Dhabi.",
            'Yas Island — theme parks and the Yas Marina Circuit, on the Dubai side of the city.',
            'The Corniche — a long waterfront promenade, ideal at sunset.',
          ],
        },
        {
          heading: 'Tolls and parking',
          paragraphs: [
            "You may pass Salik gates in Dubai and Darb toll points in Abu Dhabi, and parking in both cities is paid in most busy areas. Our [Salik, parking and fines](/blog/salik-parking-and-fines-uae-rental-car) guide explains each.",
          ],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [COVERAGE_NOTE_EN],
        },
        {
          heading: 'One day or a weekend?',
          paragraphs: [
            'A day is enough for the mosque and one more sight. To take it slowly, follow the [Abu Dhabi weekend plan](/blog/abu-dhabi-weekend-by-car) — and see our [Abu Dhabi page](/locations/abu-dhabi) for pickup points if you would rather start the rental there.',
          ],
        },
      ],
      faqs: [
        { question: 'How long does it take to drive from Dubai to Abu Dhabi?', answer: 'Around an hour and a half without heavy traffic; longer at weekday rush hours.' },
        {
          question: 'Are there tolls on the way?',
          answer: "Dubai's Salik gates and Abu Dhabi's Darb toll points apply on some roads — see [Salik, parking and fines](/blog/salik-parking-and-fines-uae-rental-car).",
        },
      ],
    },
    ar: {
      title: 'دليل رحلة دبي إلى أبوظبي بالسيارة',
      description: 'القيادة من دبي إلى أبوظبي: المسار ومدة الرحلة والمحطات في الطريق وما يستحق الزيارة — مع توضيح نطاق استخدام السيارة المستأجرة.',
      excerpt: 'نحو 140 كم وساعة ونصف على طريق E11 — المسار والمحطات وما يجب التحقق منه قبل الانطلاق.',
      intro:
        'تبعد دبي عن أبوظبي نحو 140 كم، وتستغرق القيادة على طريق E11 عادةً نحو ساعة ونصف دون ازدحام شديد. إنها رحلة يوم سهلة — أو بداية عطلة نهاية أسبوع.',
      sections: [
        {
          heading: 'المسار ومدة الرحلة',
          paragraphs: [
            'المسار الرئيسي هو طريق E11 (شارع الشيخ زايد) على طول الساحل، وتوجد طرق سريعة أخرى موازية في الداخل — وسيختار تطبيق الملاحة الأسرع حسب الوقت. خصص وقتًا أطول في ساعات الذروة بأيام الأسبوع، خاصة عند مغادرة دبي صباحًا والعودة مساءً.',
          ],
        },
        {
          heading: 'محطات تستحق التوقف',
          list: [
            'جامع الشيخ زايد الكبير — أشهر معالم المدينة؛ ويرتدي الزوار ملابس محتشمة.',
            'جزيرة السعديات — موطن متحف اللوفر أبوظبي.',
            'جزيرة ياس — متنزهات ترفيهية وحلبة ياس مارينا، من جهة دبي.',
            'الكورنيش — ممشى طويل على الواجهة البحرية، مثالي وقت الغروب.',
          ],
        },
        {
          heading: 'الرسوم والمواقف',
          paragraphs: [
            'قد تمر ببوابات «سالك» في دبي ونقاط «درب» في أبوظبي، والمواقف في المدينتين مدفوعة في معظم المناطق المزدحمة. يشرح دليلنا [سالك والمواقف والمخالفات](/blog/salik-parking-and-fines-uae-rental-car) كل ذلك.',
          ],
        },
        { heading: 'تحقق من نطاق استخدام سيارتك', paragraphs: [COVERAGE_NOTE_AR] },
        {
          heading: 'يوم واحد أم عطلة نهاية أسبوع؟',
          paragraphs: [
            'يكفي يوم للجامع ومعلم آخر. وللاستمتاع بهدوء اتبع [خطة عطلة أبوظبي](/blog/abu-dhabi-weekend-by-car) — وراجع [صفحة أبوظبي](/locations/abu-dhabi) لنقاط الاستلام إن فضّلت بدء الإيجار من هناك.',
          ],
        },
      ],
      faqs: [
        { question: 'كم تستغرق القيادة من دبي إلى أبوظبي؟', answer: 'نحو ساعة ونصف دون ازدحام شديد، وأكثر في ساعات الذروة بأيام الأسبوع.' },
        {
          question: 'هل توجد رسوم في الطريق؟',
          answer: 'تنطبق بوابات «سالك» في دبي ونقاط «درب» في أبوظبي على بعض الطرق — راجع [سالك والمواقف والمخالفات](/blog/salik-parking-and-fines-uae-rental-car).',
        },
      ],
    },
  },

  {
    slug: 'dubai-to-hatta-road-trip',
    category: 'road-trips',
    city: 'dubai',
    // Dubai's skyline photo would be the wrong picture for a mountain-town article.
    noCityPhoto: true,
    publishedAt: '2026-09-19',
    related: ['dubai-in-three-days-by-car', 'economy-sedan-suv-or-luxury-rental-car', 'ras-al-khaimah-jebel-jais-road-trip'],
    en: {
      title: 'Dubai to Hatta Road Trip: Dam & Mountains',
      description: 'A day trip from Dubai to Hatta by car — the drive, Hatta Dam, the heritage village, mountain scenery and tips for a comfortable trip.',
      excerpt: 'About 130 km to the Hajar Mountains — a dam, a heritage village and cooler air, an easy day out of Dubai.',
      intro:
        "Hatta is a mountain town in Dubai's south-east corner, about 130 km from the city — roughly an hour and a half by road. It is one of the easiest ways to swap skyscrapers for the Hajar Mountains in a single day.",
      sections: [
        {
          heading: 'Getting there',
          paragraphs: [
            'The Dubai–Hatta road (E44) is a well-signposted highway that leaves the city and crosses open desert before the mountains appear. Fill up with fuel before you leave and carry water — there are long stretches between services.',
          ],
        },
        {
          heading: 'What to see',
          list: [
            'Hatta Dam — a turquoise reservoir framed by the mountains, popular for kayaking and pedal boats.',
            'Hatta Heritage Village — a reconstructed traditional mountain village with a museum feel.',
            'Hatta Wadi Hub — adventure activities and a base for the area.',
            'Mountain viewpoints — the road itself is scenic; stop where it is safe to do so.',
          ],
        },
        {
          heading: 'Best time to go',
          paragraphs: ['The cooler months, roughly October to April, are the most comfortable for being outdoors. In summer, start early and plan indoor stops for the heat of the day.'],
        },
        {
          heading: 'Which car?',
          paragraphs: [
            'The main road is paved and suits an ordinary car. A higher seating position in an SUV is nice on mountain roads but not required — see [economy, sedan, SUV or luxury](/blog/economy-sedan-suv-or-luxury-rental-car) for how to choose.',
          ],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [COVERAGE_NOTE_EN],
        },
      ],
      faqs: [
        { question: 'How far is Hatta from Dubai?', answer: 'About 130 km, or roughly an hour and a half by road depending on traffic.' },
        {
          question: 'Do I need a 4x4 to visit Hatta?',
          answer: 'No. The main road to Hatta is paved and suits ordinary cars. Check our [Booking Terms](/booking-terms) for where a rental car may be used.',
        },
      ],
    },
    ar: {
      title: 'رحلة دبي إلى حتا: السد والجبال',
      description: 'رحلة يوم من دبي إلى حتا بالسيارة — الطريق وسد حتا والقرية التراثية والمناظر الجبلية ونصائح لرحلة مريحة.',
      excerpt: 'نحو 130 كم إلى جبال الحجر — سد وقرية تراثية وهواء أنقى، ورحلة يوم سهلة خارج دبي.',
      intro:
        'حتا بلدة جبلية في الزاوية الجنوبية الشرقية من إمارة دبي، على بعد نحو 130 كم من المدينة — أي نحو ساعة ونصف بالسيارة. وهي من أسهل الطرق لاستبدال ناطحات السحاب بجبال الحجر في يوم واحد.',
      sections: [
        {
          heading: 'الوصول إلى حتا',
          paragraphs: [
            'طريق دبي–حتا (E44) طريق سريع واضح اللافتات يغادر المدينة ويعبر صحراء مفتوحة قبل أن تظهر الجبال. املأ خزان الوقود قبل الانطلاق واحمل معك ماء — فالمسافات بين محطات الخدمة طويلة.',
          ],
        },
        {
          heading: 'ماذا تشاهد',
          list: [
            'سد حتا — بحيرة فيروزية تحيط بها الجبال، وتشتهر بالتجديف بالكياك وقوارب الدواسة.',
            'قرية حتا التراثية — قرية جبلية تقليدية معاد بناؤها بأجواء متحفية.',
            'حتا وادي هَب — أنشطة مغامرات وقاعدة للمنطقة.',
            'مواقع الإطلالة الجبلية — الطريق نفسه خلاب؛ توقف حيث يكون التوقف آمنًا.',
          ],
        },
        {
          heading: 'أفضل وقت للزيارة',
          paragraphs: ['الأشهر الباردة، من أكتوبر إلى أبريل تقريبًا، هي الأكثر راحة للأنشطة الخارجية. وفي الصيف انطلق مبكرًا وخطط لمحطات مغلقة وقت حرارة النهار.'],
        },
        {
          heading: 'أي سيارة تناسب الرحلة؟',
          paragraphs: [
            'الطريق الرئيسي معبّد ويناسب السيارات العادية. ووضعية الجلوس الأعلى في الدفع الرباعي مريحة على الطرق الجبلية لكنها غير لازمة — راجع [اقتصادية أم سيدان أم دفع رباعي أم فاخرة](/blog/economy-sedan-suv-or-luxury-rental-car) لتعرف كيف تختار.',
          ],
        },
        { heading: 'تحقق من نطاق استخدام سيارتك', paragraphs: [COVERAGE_NOTE_AR] },
      ],
      faqs: [
        { question: 'كم تبعد حتا عن دبي؟', answer: 'نحو 130 كم، أي قرابة ساعة ونصف بالسيارة بحسب الازدحام.' },
        {
          question: 'هل أحتاج إلى سيارة دفع رباعي لزيارة حتا؟',
          answer: 'لا. الطريق الرئيسي إلى حتا معبّد ويناسب السيارات العادية. راجع [شروط وأحكام الحجز](/booking-terms) لمعرفة أين يجوز استخدام السيارة المستأجرة.',
        },
      ],
    },
  },

  {
    slug: 'ras-al-khaimah-jebel-jais-road-trip',
    category: 'road-trips',
    city: 'ras-al-khaimah',
    publishedAt: '2026-09-19',
    related: ['dubai-to-hatta-road-trip', 'fujairah-east-coast-road-trip', 'driving-in-the-uae-first-timers-checklist'],
    en: {
      title: 'Ras Al Khaimah & Jebel Jais by Car',
      description: 'Drive to Ras Al Khaimah and up Jebel Jais, the UAE’s highest peak — the route, the mountain road, Dhayah Fort, Al Marjan Island and tips.',
      excerpt: "Mountains, mangroves and beaches in one emirate — and a famous winding road up the UAE's highest peak.",
      intro:
        "Ras Al Khaimah combines mountains, mangroves and beaches within a short drive. Its star is Jebel Jais, the highest peak in the UAE, reached by a winding mountain road that is a destination in itself.",
      sections: [
        {
          heading: 'The drive from Dubai',
          paragraphs: ['Ras Al Khaimah is roughly an hour to an hour and a half north of Dubai, depending on where you start and the traffic. Head north along the coast, then follow the signs inland for Jebel Jais.'],
        },
        {
          heading: 'Up Jebel Jais',
          paragraphs: [
            'At about 1,934 metres, Jebel Jais is the highest point in the UAE, and the road up winds through hairpin bends with viewpoints along the way. It is noticeably cooler at the top. The mountain is also home to the Jais Flight zip line and other activities — book those in advance and check current opening times.',
          ],
        },
        {
          heading: 'In and around town',
          list: [
            'Dhayah Fort — a hilltop fort with views over the palm groves and coast.',
            'Al Marjan Island — beaches and resorts on a man-made island.',
            "The mangroves — a quiet contrast to the mountains, good for a paddle or a walk.",
          ],
        },
        {
          heading: 'Mountain driving tips',
          list: [
            'Use a lower gear on the descent instead of riding the brakes.',
            'Weather changes quickly at altitude — fog and cooler temperatures are common.',
            'Fill up before you climb and keep a safe distance on the bends.',
          ],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [COVERAGE_NOTE_EN + ' You can also see our [Ras Al Khaimah page](/locations/ras-al-khaimah).'],
        },
      ],
      faqs: [
        { question: 'How high is Jebel Jais?', answer: 'About 1,934 metres — the highest peak in the UAE.' },
        { question: 'Is the Jebel Jais road difficult to drive?', answer: 'It is paved but winding, with hairpin bends. Drive steadily, use a lower gear on the way down and see our [driving checklist](/blog/driving-in-the-uae-first-timers-checklist).' },
      ],
    },
    ar: {
      title: 'رأس الخيمة وجبل جيس بالسيارة',
      description: 'قُد إلى رأس الخيمة وصعودًا إلى جبل جيس، أعلى قمة في الإمارات — المسار والطريق الجبلي وقلعة ضاية وجزيرة المرجان ونصائح.',
      excerpt: 'جبال ومانغروف وشواطئ في إمارة واحدة — وطريق متعرج شهير نحو أعلى قمة في الإمارات.',
      intro:
        'تجمع رأس الخيمة بين الجبال والمانغروف والشواطئ ضمن مسافات قصيرة. ونجمتها جبل جيس، أعلى قمة في الإمارات، الذي يوصل إليه طريق جبلي متعرج يستحق الزيارة بحد ذاته.',
      sections: [
        {
          heading: 'القيادة من دبي',
          paragraphs: ['تبعد رأس الخيمة عن دبي نحو ساعة إلى ساعة ونصف شمالًا بحسب نقطة انطلاقك والازدحام. اتجه شمالًا على الساحل ثم اتبع اللافتات إلى الداخل نحو جبل جيس.'],
        },
        {
          heading: 'صعودًا إلى جبل جيس',
          paragraphs: [
            'يبلغ ارتفاع جبل جيس نحو 1,934 مترًا، وهو أعلى نقطة في الإمارات، ويتعرج الطريق إليه عبر منعطفات حادة مع مواقع إطلالة على الجانب. والجو أبرد بوضوح في القمة. وتوجد على الجبل أيضًا تجربة «جيس فلايت» للانزلاق بالحبل وأنشطة أخرى — احجزها مسبقًا وتحقق من مواعيد العمل الحالية.',
          ],
        },
        {
          heading: 'في المدينة وحولها',
          list: [
            'قلعة ضاية — قلعة على قمة تل تطل على بساتين النخيل والساحل.',
            'جزيرة المرجان — شواطئ ومنتجعات على جزيرة صناعية.',
            'المانغروف — تباين هادئ مع الجبال، مناسب للتجديف أو المشي.',
          ],
        },
        {
          heading: 'نصائح للقيادة الجبلية',
          list: [
            'استخدم سرعة أدنى في النزول بدل الاعتماد على الفرامل باستمرار.',
            'يتغير الطقس بسرعة في المرتفعات — والضباب وانخفاض الحرارة شائعان.',
            'املأ الوقود قبل الصعود وحافظ على مسافة أمان في المنعطفات.',
          ],
        },
        {
          heading: 'تحقق من نطاق استخدام سيارتك',
          paragraphs: [COVERAGE_NOTE_AR + ' ويمكنك أيضًا مطالعة [صفحة رأس الخيمة](/locations/ras-al-khaimah).'],
        },
      ],
      faqs: [
        { question: 'كم يبلغ ارتفاع جبل جيس؟', answer: 'نحو 1,934 مترًا — أعلى قمة في الإمارات.' },
        { question: 'هل طريق جبل جيس صعب القيادة؟', answer: 'الطريق معبّد لكنه متعرج بمنعطفات حادة. قُد بثبات واستخدم سرعة أدنى في النزول وراجع [قائمة القيادة](/blog/driving-in-the-uae-first-timers-checklist).' },
      ],
    },
  },

  {
    slug: 'fujairah-east-coast-road-trip',
    category: 'road-trips',
    city: 'fujairah',
    publishedAt: '2026-09-19',
    related: ['ras-al-khaimah-jebel-jais-road-trip', 'dubai-to-hatta-road-trip', 'monthly-and-weekly-car-rental-uae'],
    en: {
      title: 'Fujairah & the East Coast Road Trip',
      description: 'Cross the Hajar Mountains to the UAE’s east coast — Fujairah Fort, Al Bidyah Mosque, Snoopy Island and Khor Fakkan — with route and driving tips.',
      excerpt: 'Cross the mountains to the Gulf of Oman — forts, beaches and snorkelling on the UAE’s east coast.',
      intro:
        'Cross the Hajar Mountains and the desert gives way to the Gulf of Oman. Fujairah and the east coast are roughly one and a half to two hours from Dubai, with beaches, forts and mountain scenery packed close together.',
      sections: [
        {
          heading: 'The drive',
          paragraphs: [
            'The route heads inland across the mountains and comes out on the coast, and a navigation app will pick the best road for the time of day. The mountain sections are scenic — leave enough daylight to enjoy them, and pair the trip with the [Dubai to Hatta road trip](/blog/dubai-to-hatta-road-trip) if you like mountain scenery.',
          ],
        },
        {
          heading: 'Fujairah highlights',
          list: [
            "Fujairah Fort — among the UAE's oldest surviving forts.",
            "Al Bidyah Mosque — often cited as the country's oldest mosque, tucked against the mountains.",
            'The Corniche — a long seafront walk in Fujairah city.',
          ],
        },
        {
          heading: 'Beaches and snorkelling',
          paragraphs: [
            'Snoopy Island, off the beach at Al Aqah, is a popular snorkelling spot. Khor Fakkan, further up the coast, has a corniche and beach — note that it belongs to Sharjah, not Fujairah — and Dibba sits at the northern end.',
          ],
        },
        {
          heading: 'Safety in the mountains',
          list: [
            'Heavy rain can cause flash floods in wadis — avoid dry riverbeds when rain is forecast.',
            'Carry water and fill up with fuel before the mountain section.',
            'Watch for changing weather and reduced visibility.',
          ],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [COVERAGE_NOTE_EN + ' See also our [Fujairah page](/locations/fujairah).'],
        },
      ],
      faqs: [
        { question: 'Is Khor Fakkan part of Fujairah?', answer: 'No — Khor Fakkan belongs to Sharjah, although it sits on the east coast near Fujairah.' },
        { question: 'How long is the drive from Dubai?', answer: 'Roughly one and a half to two hours, depending on your route and the traffic.' },
      ],
    },
    ar: {
      title: 'رحلة الفجيرة والساحل الشرقي بالسيارة',
      description: 'اعبر جبال الحجر إلى الساحل الشرقي للإمارات — قلعة الفجيرة ومسجد البدية وجزيرة سنوبي وخورفكان — مع المسار ونصائح القيادة.',
      excerpt: 'اعبر الجبال إلى خليج عُمان — قلاع وشواطئ وغوص سطحي على الساحل الشرقي للإمارات.',
      intro:
        'اعبر جبال الحجر لتتحول الصحراء إلى خليج عُمان. تبعد الفجيرة والساحل الشرقي نحو ساعة ونصف إلى ساعتين عن دبي، وتتجاور فيها الشواطئ والقلاع والمناظر الجبلية.',
      sections: [
        {
          heading: 'القيادة',
          paragraphs: ['يتجه المسار إلى الداخل عبر الجبال ثم يصل إلى الساحل، وسيختار تطبيق الملاحة أفضل طريق حسب الوقت. والمقاطع الجبلية خلابة — فاترك وقتًا كافيًا من ضوء النهار للاستمتاع بها، واجمع الرحلة مع [رحلة دبي إلى حتا](/blog/dubai-to-hatta-road-trip) إن أحببت المناظر الجبلية.'],
        },
        {
          heading: 'أبرز معالم الفجيرة',
          list: [
            'قلعة الفجيرة — من أقدم القلاع الباقية في الإمارات.',
            'مسجد البدية — يُذكر غالبًا كأقدم مسجد في الدولة، ويقع عند سفح الجبال.',
            'الكورنيش — ممشى طويل على الواجهة البحرية في مدينة الفجيرة.',
          ],
        },
        {
          heading: 'الشواطئ والغوص السطحي',
          paragraphs: [
            'جزيرة سنوبي قبالة شاطئ العقة مكان شهير للغوص السطحي. وخورفكان، أبعد على الساحل، فيها كورنيش وشاطئ — علمًا بأنها تتبع الشارقة لا الفجيرة — وتقع دبا في الطرف الشمالي.',
          ],
        },
        {
          heading: 'السلامة في الجبال',
          list: [
            'قد تسبب الأمطار الغزيرة سيولًا مفاجئة في الأودية — تجنب مجاري الأودية الجافة عند توقع المطر.',
            'احمل ماء واملأ الوقود قبل المقطع الجبلي.',
            'انتبه لتغير الطقس وانخفاض الرؤية.',
          ],
        },
        {
          heading: 'تحقق من نطاق استخدام سيارتك',
          paragraphs: [COVERAGE_NOTE_AR + ' وراجع أيضًا [صفحة الفجيرة](/locations/fujairah).'],
        },
      ],
      faqs: [
        { question: 'هل خورفكان جزء من الفجيرة؟', answer: 'لا — خورفكان تتبع الشارقة، رغم أنها تقع على الساحل الشرقي قرب الفجيرة.' },
        { question: 'كم تستغرق القيادة من دبي؟', answer: 'نحو ساعة ونصف إلى ساعتين بحسب المسار والازدحام.' },
      ],
    },
  },

  {
    slug: 'al-ain-day-trip-by-car',
    category: 'road-trips',
    city: 'al-ain',
    publishedAt: '2026-09-19',
    related: ['dubai-to-abu-dhabi-road-trip', 'abu-dhabi-weekend-by-car', 'monthly-and-weekly-car-rental-uae'],
    en: {
      title: 'Al Ain Day Trip: Oasis, Forts & Jebel Hafeet',
      description: 'Drive to Al Ain from Dubai or Abu Dhabi — UNESCO-listed oases and tombs, Al Jahili Fort and the Jebel Hafeet mountain road.',
      excerpt: "The 'Garden City' near the Omani border — UNESCO sites, a fort and a mountain road with a view.",
      intro:
        "Al Ain, the \"Garden City\" near the Omani border, is about 140 km from Dubai and about 160 km from Abu Dhabi — roughly an hour and a half to two hours by car. Its UNESCO-listed sites and the road up Jebel Hafeet make it one of the best day trips in the country.",
      sections: [
        {
          heading: 'Getting there',
          paragraphs: ['Well-signposted highways link Al Ain to both cities. Start early — the drive is straightforward, and the day is best spent at the sights rather than on the road. Coming via the capital? Pair it with the [Dubai to Abu Dhabi road trip](/blog/dubai-to-abu-dhabi-road-trip).'],
        },
        {
          heading: 'The oasis and the UNESCO sites',
          paragraphs: [
            "Al Ain's date-palm oasis, with its traditional falaj irrigation channels, is a shaded escape from the heat. The city's cultural sites — Hafit, Hili, Bidaa Bint Saud and the oases — are UNESCO-listed and include ancient tombs and settlements.",
          ],
        },
        {
          heading: 'Jebel Hafeet',
          paragraphs: [
            'The road up Jebel Hafeet winds to a viewpoint at roughly 1,240 metres, with sweeping views over Al Ain and the desert — best at sunset. Take it slowly, and use a lower gear on the way down.',
          ],
        },
        {
          heading: 'Forts and more',
          list: [
            'Al Jahili Fort — an early 20th-century fort with an exhibition inside.',
            'Al Ain Museum — regional history and archaeology.',
            'Al Ain Zoo — a family-friendly stop.',
          ],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [COVERAGE_NOTE_EN + ' You can see our [Al Ain page](/locations/al-ain) too.'],
        },
      ],
      faqs: [
        { question: 'How far is Al Ain from Dubai and Abu Dhabi?', answer: 'About 140 km from Dubai and about 160 km from Abu Dhabi — roughly one and a half to two hours by car.' },
        { question: 'When is the best time to visit?', answer: "The cooler months are most comfortable. In summer, Jebel Hafeet's higher altitude is a little cooler, but start early to avoid the heat of the day." },
      ],
    },
    ar: {
      title: 'رحلة العين: الواحة والقلاع وجبل حفيت',
      description: 'قُد إلى العين من دبي أو أبوظبي — الواحات والمقابر المدرجة في اليونسكو وقلعة الجاهلي وطريق جبل حفيت.',
      excerpt: '«مدينة الحدائق» قرب الحدود العُمانية — مواقع اليونسكو وقلعة وطريق جبلي بإطلالة رائعة.',
      intro:
        'تبعد العين، «مدينة الحدائق» قرب الحدود العُمانية، نحو 140 كم عن دبي ونحو 160 كم عن أبوظبي — أي قرابة ساعة ونصف إلى ساعتين بالسيارة. وتجعلها مواقعها المدرجة في اليونسكو وطريق جبل حفيت من أجمل رحلات اليوم الواحد في الدولة.',
      sections: [
        {
          heading: 'الوصول إلى العين',
          paragraphs: ['تربط طرق سريعة واضحة اللافتات العين بالمدينتين. انطلق مبكرًا — فالقيادة سهلة، والأفضل قضاء اليوم عند المعالم لا على الطريق. وإن كنت قادمًا عبر العاصمة فاجمعها مع [رحلة دبي إلى أبوظبي](/blog/dubai-to-abu-dhabi-road-trip).'],
        },
        {
          heading: 'الواحة ومواقع اليونسكو',
          paragraphs: [
            'واحة العين من نخيل التمر، بأقنية الري التقليدية «الأفلاج»، ملاذ ظليل من الحر. ومواقع المدينة الثقافية — حفيت وهيلي وبدع بنت سعود والواحات — مدرجة في اليونسكو وتضم مقابر ومستوطنات قديمة.',
          ],
        },
        {
          heading: 'جبل حفيت',
          paragraphs: ['يتعرج الطريق إلى جبل حفيت حتى موقع إطلالة على ارتفاع نحو 1,240 مترًا، مع مناظر واسعة على العين والصحراء — وأجمل وقت للزيارة عند الغروب. قُد ببطء واستخدم سرعة أدنى في النزول.'],
        },
        {
          heading: 'القلاع وغيرها',
          list: [
            'قلعة الجاهلي — قلعة من أوائل القرن العشرين وفيها معرض.',
            'متحف العين — تاريخ المنطقة وآثارها.',
            'حديقة حيوان العين — محطة مناسبة للعائلات.',
          ],
        },
        {
          heading: 'تحقق من نطاق استخدام سيارتك',
          paragraphs: [COVERAGE_NOTE_AR + ' ويمكنك أيضًا مطالعة [صفحة العين](/locations/al-ain).'],
        },
      ],
      faqs: [
        { question: 'كم تبعد العين عن دبي وأبوظبي؟', answer: 'نحو 140 كم عن دبي ونحو 160 كم عن أبوظبي — أي قرابة ساعة ونصف إلى ساعتين بالسيارة.' },
        { question: 'ما أفضل وقت للزيارة؟', answer: 'الأشهر الباردة هي الأنسب. وفي الصيف يكون جبل حفيت أبرد قليلًا لارتفاعه، لكن انطلق مبكرًا لتتجنب حر النهار.' },
      ],
    },
  },
]
