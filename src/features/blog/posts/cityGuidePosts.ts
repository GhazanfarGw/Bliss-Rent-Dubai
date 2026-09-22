import type { BlogPost } from '@/features/blog/blogPosts'

/**
 * "City guides" — itineraries for driving around a city or a pair of
 * neighbouring ones. They go deeper than the short pages at
 * /locations/<city> (which they link to) and stick to well-known,
 * slow-changing facts. Anything that moves — opening hours, prices, fees —
 * is described rather than quoted.
 */
export const CITY_GUIDE_POSTS: BlogPost[] = [
  {
    slug: 'dubai-in-three-days-by-car',
    category: 'city-guides',
    city: 'dubai',
    publishedAt: '2026-09-19',
    related: ['car-rental-dubai-complete-guide', 'dubai-to-hatta-road-trip', 'salik-parking-and-fines-uae-rental-car'],
    en: {
      title: 'Dubai in 3 Days by Car: An Itinerary',
      description: 'A three-day Dubai itinerary for drivers — Downtown and the Marina, Old Dubai and Jumeirah, then a day out to Hatta or the desert edge.',
      excerpt: 'Skyline, souks and a day in the mountains — a relaxed 3-day plan built around having your own car.',
      intro:
        'Dubai is spread out, and its best areas are far enough apart that having your own car saves hours. This three-day plan groups the sights by area so you spend more time looking and less time in transit.',
      sections: [
        {
          heading: 'Day 1: Downtown and the Marina',
          paragraphs: [
            'Start in Downtown Dubai, where the Burj Khalifa, Dubai Mall and the Dubai Fountain sit within walking distance of each other — park once and explore on foot. In the afternoon, drive along the coast to Dubai Marina and JBR for the beachfront walk and sunset.',
          ],
        },
        {
          heading: 'Day 2: Old Dubai and Jumeirah',
          paragraphs: [
            "Spend the morning in Al Fahidi and Bur Dubai — wind-tower lanes, museums and the Creek — then cross to Deira for the souks and take an abra water taxi across the water. Finish along Jumeirah's coastal road, with views of the Burj Al Arab.",
          ],
        },
        {
          heading: 'Day 3: out of the city',
          paragraphs: [
            'Head for the Hajar Mountains: the [Dubai to Hatta road trip](/blog/dubai-to-hatta-road-trip) is about an hour and a half each way and swaps skyscrapers for a mountain dam and heritage village. Starting early keeps it comfortable.',
          ],
        },
        {
          heading: 'Driving tips for the trip',
          list: [
            'Some main roads, including Sheikh Zayed Road, use Salik electronic tolls — see [Salik, parking and fines](/blog/salik-parking-and-fines-uae-rental-car).',
            'Parking is paid in most busy areas; check the signs before you leave the car.',
            'Weekday morning and evening rush hours are busy — leave extra time.',
          ],
        },
        {
          heading: 'Getting your car',
          paragraphs: [
            'Book online with airport pickup or a city point — see [car rental in Dubai](/locations/dubai) for the current pickup points, or read the [complete Dubai rental guide](/blog/car-rental-dubai-complete-guide).',
          ],
        },
      ],
      faqs: [
        {
          question: 'Do I need a car in Dubai?',
          answer: 'The centre is well served by metro and taxis, but a car lets you combine areas in one day and reach places like Hatta easily.',
        },
        {
          question: 'Where do I collect my rental car?',
          answer: 'The pickup and drop-off points, including airports, are listed on our [Dubai page](/locations/dubai).',
        },
      ],
    },
    ar: {
      title: 'دبي في 3 أيام بالسيارة: برنامج مقترح',
      description: 'برنامج لثلاثة أيام في دبي للسائقين — وسط المدينة والمارينا ودبي القديمة وجميرا، ثم يوم خارج المدينة إلى حتا أو أطراف الصحراء.',
      excerpt: 'أفق المدينة والأسواق ويوم في الجبال — خطة هادئة لثلاثة أيام مبنية على امتلاكك سيارة.',
      intro:
        'دبي مدينة ممتدة، ومناطقها المميزة متباعدة بما يكفي ليوفر لك امتلاك سيارة ساعات كثيرة. تجمع هذه الخطة المعالم حسب المنطقة لتقضي وقتًا أطول في الاستمتاع ووقتًا أقل في التنقل.',
      sections: [
        {
          heading: 'اليوم الأول: وسط المدينة والمارينا',
          paragraphs: [
            'ابدأ من وسط مدينة دبي حيث يقع برج خليفة ودبي مول ونافورة دبي على مسافة قريبة سيرًا — اصطف مرة واحدة واستكشف مشيًا. وبعد الظهر قُد على طول الساحل إلى دبي مارينا وجي بي آر للتنزه على الواجهة البحرية ومشاهدة الغروب.',
          ],
        },
        {
          heading: 'اليوم الثاني: دبي القديمة وجميرا',
          paragraphs: [
            'اقضِ الصباح في الفهيدي وبر دبي — أزقة البراجيل والمتاحف وخور دبي — ثم اعبر إلى ديرة للأسواق واركب العبرة عبر الخور. واختم يومك على طريق جميرا الساحلي مع إطلالات على برج العرب.',
          ],
        },
        {
          heading: 'اليوم الثالث: خارج المدينة',
          paragraphs: [
            'اتجه إلى جبال الحجر: [رحلة دبي إلى حتا](/blog/dubai-to-hatta-road-trip) تستغرق نحو ساعة ونصف في كل اتجاه، وتستبدل ناطحات السحاب بسد جبلي وقرية تراثية. والبدء مبكرًا يجعلها أكثر راحة.',
          ],
        },
        {
          heading: 'نصائح للقيادة في رحلتك',
          list: [
            'تستخدم بعض الطرق الرئيسية، ومنها شارع الشيخ زايد، رسوم «سالك» الإلكترونية — راجع [سالك والمواقف والمخالفات](/blog/salik-parking-and-fines-uae-rental-car).',
            'المواقف مدفوعة في معظم المناطق المزدحمة؛ تحقق من اللافتات قبل أن تترك السيارة.',
            'ساعات الذروة الصباحية والمسائية في أيام الأسبوع مزدحمة — خصص وقتًا إضافيًا.',
          ],
        },
        {
          heading: 'الحصول على سيارتك',
          paragraphs: [
            'احجز عبر الإنترنت مع استلام من المطار أو من نقطة في المدينة — راجع [تأجير السيارات في دبي](/locations/dubai) لنقاط الاستلام الحالية، أو اقرأ [دليل الإيجار الكامل في دبي](/blog/car-rental-dubai-complete-guide).',
          ],
        },
      ],
      faqs: [
        { question: 'هل أحتاج إلى سيارة في دبي؟', answer: 'وسط المدينة تخدمه المترو وسيارات الأجرة جيدًا، لكن السيارة تتيح لك الجمع بين عدة مناطق في يوم واحد والوصول بسهولة إلى وجهات مثل حتا.' },
        { question: 'أين أستلم سيارتي؟', answer: 'نقاط الاستلام والتسليم، ومنها المطارات، مذكورة في [صفحة دبي](/locations/dubai).' },
      ],
    },
  },

  {
    slug: 'abu-dhabi-weekend-by-car',
    category: 'city-guides',
    city: 'abu-dhabi',
    publishedAt: '2026-09-19',
    related: ['dubai-to-abu-dhabi-road-trip', 'salik-parking-and-fines-uae-rental-car', 'al-ain-day-trip-by-car'],
    en: {
      title: 'A Weekend in Abu Dhabi by Car',
      description:
        "Plan a two-day Abu Dhabi weekend with your own car — Sheikh Zayed Grand Mosque, Saadiyat's museums, the Corniche and Yas Island — plus parking and toll tips.",
      excerpt: 'Grand Mosque, museums and Yas Island — a two-day plan for the capital, with parking and toll tips.',
      intro:
        'Abu Dhabi rewards a car: the Grand Mosque, Saadiyat Island, the Corniche and Yas Island are all in different parts of the city. Two days is enough to see the essentials without rushing.',
      sections: [
        {
          heading: 'Day 1: the mosque, museums and the Corniche',
          paragraphs: [
            'Visit the Sheikh Zayed Grand Mosque in the morning — visitors are asked to dress modestly. After lunch, drive to Saadiyat Island for the Louvre Abu Dhabi, then watch the sun go down along the Corniche.',
          ],
        },
        {
          heading: 'Day 2: Yas Island and the mangroves',
          paragraphs: [
            "Spend the morning on Yas Island — its theme parks and the Yas Marina Circuit are the headline attractions. In the afternoon, slow down with a paddle or a boardwalk stroll among Abu Dhabi's mangroves before heading back.",
          ],
        },
        {
          heading: 'Parking and tolls',
          paragraphs: [
            "Parking in the city is paid under the Mawaqif system, and some main roads and bridges use Darb toll gates — Abu Dhabi's own toll system, separate from Dubai's Salik. Check the signs and how to pay before you leave the car. Read more in [Salik, parking and fines](/blog/salik-parking-and-fines-uae-rental-car).",
          ],
        },
        {
          heading: 'Getting there from Dubai',
          paragraphs: ['Driving up from Dubai? See the [Dubai to Abu Dhabi road trip](/blog/dubai-to-abu-dhabi-road-trip) for the route and stops. Heading further inland afterwards? [Al Ain](/blog/al-ain-day-trip-by-car) is about an hour and a half away.'],
        },
        {
          heading: 'Collecting a car in Abu Dhabi',
          paragraphs: ['Pickup and drop-off points are listed on our [Abu Dhabi page](/locations/abu-dhabi); you can also book from the [booking page](/book).'],
        },
      ],
      faqs: [
        {
          question: 'Can I visit the Grand Mosque in casual clothes?',
          answer: 'The mosque asks visitors to dress modestly and has its own visiting rules, so check the current guidance before you go.',
        },
        { question: 'Is parking free in Abu Dhabi?', answer: 'Parking is paid in most busy areas of the city. Check the signs for hours and how to pay before you leave the car.' },
      ],
    },
    ar: {
      title: 'عطلة نهاية أسبوع في أبوظبي بالسيارة',
      description: 'خطط لعطلة يومين في أبوظبي بسيارتك — جامع الشيخ زايد ومتاحف السعديات والكورنيش وجزيرة ياس — مع نصائح المواقف والرسوم.',
      excerpt: 'الجامع الكبير والمتاحف وجزيرة ياس — خطة ليومين في العاصمة مع نصائح المواقف والرسوم.',
      intro:
        'أبوظبي تكافئ من يملك سيارة: الجامع الكبير وجزيرة السعديات والكورنيش وجزيرة ياس كلها في أجزاء مختلفة من المدينة. ويومان يكفيان لرؤية الأساسيات دون استعجال.',
      sections: [
        {
          heading: 'اليوم الأول: الجامع والمتاحف والكورنيش',
          paragraphs: [
            'زر جامع الشيخ زايد الكبير في الصباح — ويُطلب من الزوار ارتداء ملابس محتشمة. وبعد الغداء اتجه إلى جزيرة السعديات لزيارة متحف اللوفر أبوظبي، ثم شاهد الغروب على الكورنيش.',
          ],
        },
        {
          heading: 'اليوم الثاني: جزيرة ياس والمانغروف',
          paragraphs: [
            'اقضِ الصباح في جزيرة ياس — فالمتنزهات الترفيهية وحلبة ياس مارينا أبرز معالمها. وبعد الظهر استمتع بهدوء التجديف أو بالمشي على الممرات الخشبية بين أشجار المانغروف في أبوظبي قبل العودة.',
          ],
        },
        {
          heading: 'المواقف والرسوم',
          paragraphs: [
            'المواقف في المدينة مدفوعة ضمن نظام «مواقف»، وتستخدم بعض الطرق الرئيسية والجسور بوابات «درب» — نظام الرسوم الخاص بأبوظبي والمنفصل عن «سالك» في دبي. تحقق من اللافتات وطريقة الدفع قبل أن تترك السيارة. اقرأ المزيد في [سالك والمواقف والمخالفات](/blog/salik-parking-and-fines-uae-rental-car).',
          ],
        },
        {
          heading: 'الوصول من دبي',
          paragraphs: ['قادم من دبي؟ راجع [رحلة دبي إلى أبوظبي](/blog/dubai-to-abu-dhabi-road-trip) للمسار والمحطات. وإن أردت التوجه أبعد بعد ذلك فـ[العين](/blog/al-ain-day-trip-by-car) على بعد نحو ساعة ونصف.'],
        },
        {
          heading: 'استلام سيارة في أبوظبي',
          paragraphs: ['نقاط الاستلام والتسليم مذكورة في [صفحة أبوظبي](/locations/abu-dhabi)، ويمكنك الحجز أيضًا من [صفحة الحجز](/book).'],
        },
      ],
      faqs: [
        { question: 'هل يمكنني زيارة الجامع الكبير بملابس عادية؟', answer: 'يطلب الجامع من الزوار ارتداء ملابس محتشمة وله قواعد زيارة خاصة، فتحقق من الإرشادات الحالية قبل الذهاب.' },
        { question: 'هل المواقف مجانية في أبوظبي؟', answer: 'المواقف مدفوعة في معظم المناطق المزدحمة. تحقق من اللافتات لمعرفة الأوقات وطريقة الدفع قبل أن تترك السيارة.' },
      ],
    },
  },

  {
    slug: 'sharjah-and-ajman-by-car',
    category: 'city-guides',
    city: 'sharjah',
    alsoCities: ['ajman'],
    publishedAt: '2026-09-19',
    related: ['umm-al-quwain-by-car', 'salik-parking-and-fines-uae-rental-car', 'driving-in-the-uae-first-timers-checklist'],
    en: {
      title: 'Sharjah & Ajman by Car: A Day Trip Guide',
      description: "Explore Sharjah's museums and heritage quarter and Ajman's corniche in one day by car — routes, parking and local rules to know.",
      excerpt: 'Museums and heritage in Sharjah, a relaxed corniche in Ajman — an easy one-day drive north of Dubai.',
      intro:
        'Sharjah and Ajman sit side by side just north of Dubai, so they combine easily into one day. Sharjah is known for its museums and heritage; Ajman for a relaxed corniche and traditional dhow yards.',
      sections: [
        {
          heading: 'Sharjah: museums and heritage',
          paragraphs: [
            "Start in Sharjah's Heritage Area and Arts Area, where restored old houses now hold museums and galleries. Then take an evening stroll by the Al Qasba canal or across to Al Noor Island. See our [Sharjah page](/locations/sharjah) for more on the city.",
          ],
        },
        {
          heading: 'Ajman: corniche and dhows',
          paragraphs: [
            'Ajman is the UAE\'s smallest emirate. Walk the Ajman Corniche, visit the museum housed in the old fort and watch dhows being built at the traditional yards along the creek. More on the [Ajman page](/locations/ajman).',
          ],
        },
        {
          heading: 'Getting between them',
          paragraphs: [
            'Sharjah and Ajman are only a short drive apart. The Dubai–Sharjah roads are very busy in weekday rush hours, so leaving outside them saves a lot of time. Carrying on north? See [Umm Al Quwain by car](/blog/umm-al-quwain-by-car).',
          ],
        },
        {
          heading: 'Local rules to know',
          list: [
            "Sharjah has stricter local rules than neighbouring Dubai — for example, alcohol isn't sold there.",
            'Dress modestly at heritage sites and in public areas.',
            'Parking is paid in most busy areas; check the signs.',
          ],
        },
        {
          heading: 'Check your rental’s coverage first',
          paragraphs: [
            'Our [Booking Terms](/booking-terms) tie the rental to the pickup and drop-off city agreed at booking. If you plan to drive to another emirate, [contact us](/contact) before you go so we can confirm it works for your booking.',
          ],
        },
      ],
      faqs: [
        {
          question: 'Can I do Sharjah and Ajman in one day?',
          answer: 'Yes — the two are close together, so one day is enough for the main sights of each. Leave outside weekday rush hours for the smoothest drive.',
        },
        { question: 'Is there a museum worth prioritising?', answer: "Sharjah's Heritage Area has several museums within walking distance of each other, so it's an easy place to start." },
      ],
    },
    ar: {
      title: 'الشارقة وعجمان بالسيارة: دليل رحلة ليوم واحد',
      description: 'استكشف متاحف الشارقة وحيّها التراثي وكورنيش عجمان في يوم واحد بالسيارة — الطرق والمواقف والقواعد المحلية التي تستحق المعرفة.',
      excerpt: 'متاحف وتراث في الشارقة وكورنيش هادئ في عجمان — رحلة سهلة ليوم واحد شمال دبي.',
      intro:
        'تقع الشارقة وعجمان متجاورتين شمال دبي، فيسهل الجمع بينهما في يوم واحد. تشتهر الشارقة بمتاحفها وتراثها، وعجمان بكورنيشها الهادئ وأحواض بناء السفن الشراعية التقليدية.',
      sections: [
        {
          heading: 'الشارقة: متاحف وتراث',
          paragraphs: [
            'ابدأ من منطقة التراث ومنطقة الفنون في الشارقة حيث تحتضن البيوت القديمة المرممة متاحف ومعارض. ثم تنزه مساءً عند قناة القصباء أو انتقل إلى جزيرة النور. راجع [صفحة الشارقة](/locations/sharjah) للمزيد عن المدينة.',
          ],
        },
        {
          heading: 'عجمان: الكورنيش والسفن الشراعية',
          paragraphs: [
            'عجمان أصغر إمارات الدولة. تمشَّ على كورنيش عجمان، وزر المتحف الموجود في الحصن القديم، وشاهد بناء السفن الشراعية في الأحواض التقليدية على طول الخور. المزيد في [صفحة عجمان](/locations/ajman).',
          ],
        },
        {
          heading: 'التنقل بينهما',
          paragraphs: ['المسافة بين الشارقة وعجمان قصيرة بالسيارة. وطرق دبي–الشارقة مزدحمة جدًا في ساعات الذروة بأيام الأسبوع، فالانطلاق خارجها يوفر وقتًا كبيرًا. وإن أردت مواصلة الرحلة شمالًا فراجع [أم القيوين بالسيارة](/blog/umm-al-quwain-by-car).'],
        },
        {
          heading: 'قواعد محلية تستحق المعرفة',
          list: [
            'للشارقة قواعد محلية أشد من دبي المجاورة — فمثلًا لا يُباع فيها الكحول.',
            'ارتدِ ملابس محتشمة في المواقع التراثية والأماكن العامة.',
            'المواقف مدفوعة في معظم المناطق المزدحمة؛ تحقق من اللافتات.',
          ],
        },
        {
          heading: 'تحقق أولًا من نطاق استخدام سيارتك',
          paragraphs: [
            'تربط [شروط وأحكام الحجز](/booking-terms) الإيجار بمدينة الاستلام والتسليم المتفق عليها عند الحجز. وإذا كنت تنوي القيادة إلى إمارة أخرى فـ[تواصل معنا](/contact) قبل الانطلاق لنؤكد لك أن ذلك مناسب لحجزك.',
          ],
        },
      ],
      faqs: [
        { question: 'هل يمكنني زيارة الشارقة وعجمان في يوم واحد؟', answer: 'نعم — فهما متقاربتان، ويكفي يوم واحد لأبرز معالم كل منهما. انطلق خارج ساعات الذروة في أيام الأسبوع لقيادة أكثر سلاسة.' },
        { question: 'هل من متحف يستحق البدء به؟', answer: 'في منطقة التراث بالشارقة عدة متاحف على مسافة سير من بعضها، فهي بداية سهلة.' },
      ],
    },
  },

  {
    slug: 'umm-al-quwain-by-car',
    category: 'city-guides',
    city: 'umm-al-quwain',
    publishedAt: '2026-09-19',
    related: ['sharjah-and-ajman-by-car', 'ras-al-khaimah-jebel-jais-road-trip', 'dubai-to-hatta-road-trip'],
    en: {
      title: 'Umm Al Quwain by Car: Mangroves & Beaches',
      description: 'A quiet day out in Umm Al Quwain — mangroves, beaches, the old fort museum and wildlife — with the drive from Dubai and tips for visiting.',
      excerpt: "One of the UAE's quietest emirates — mangroves, long beaches and an old fort, about an hour north of Dubai.",
      intro:
        "Umm Al Quwain is one of the UAE's smallest and quietest emirates, about an hour's drive north of Dubai. It suits a slow day: mangrove lagoons, long beaches and a fort-turned-museum, without the crowds of the bigger cities.",
      sections: [
        {
          heading: 'The drive from Dubai',
          paragraphs: [
            'Head north along the coastal highways, past Sharjah and Ajman — roughly an hour depending on where you start. Leave outside weekday rush hours, when the Dubai–Sharjah roads are busiest. Combine it with [Sharjah and Ajman](/blog/sharjah-and-ajman-by-car) if you want a longer day.',
          ],
        },
        {
          heading: 'Mangroves and wildlife',
          paragraphs: [
            "The emirate's mangrove lagoons and islands are known for birdlife — including flamingos in the cooler months — and are best explored by kayak or on a guided boat trip. Check the operator's current schedule before you set out.",
          ],
        },
        {
          heading: 'The fort and the old town',
          paragraphs: ["Umm Al Quwain Fort, an 18th-century fort, now houses the emirate's museum, and the small old town around it is easy to explore on foot."],
        },
        {
          heading: 'Beaches and family days',
          paragraphs: ['Long, quiet beaches line the coast, and Dreamland Aqua Park, a large water park, is a popular stop for families. More on the [Umm Al Quwain page](/locations/umm-al-quwain).'],
        },
        {
          heading: 'Check your rental’s coverage',
          paragraphs: [
            'Our [Booking Terms](/booking-terms) tie the rental to the pickup and drop-off city agreed at booking. If your trip goes to another emirate, [contact us](/contact) before you book so we can confirm it works for your rental.',
          ],
        },
      ],
      faqs: [
        { question: 'How far is Umm Al Quwain from Dubai?', answer: 'About an hour by road, depending on where you start and the traffic.' },
        { question: 'Is Umm Al Quwain busy?', answer: 'No — it is one of the UAE’s quietest emirates, which is much of its appeal for a slow day out.' },
      ],
    },
    ar: {
      title: 'أم القيوين بالسيارة: المانغروف والشواطئ',
      description: 'يوم هادئ في أم القيوين — المانغروف والشواطئ ومتحف الحصن القديم والحياة البرية — مع الطريق من دبي ونصائح للزيارة.',
      excerpt: 'إحدى أهدأ إمارات الدولة — مانغروف وشواطئ طويلة وحصن قديم، على بعد نحو ساعة شمال دبي.',
      intro:
        'أم القيوين من أصغر إمارات الدولة وأهدئها، وتبعد نحو ساعة بالسيارة شمال دبي. وهي تناسب يومًا هادئًا: بحيرات مانغروف وشواطئ طويلة وحصن تحول إلى متحف، دون زحام المدن الأكبر.',
      sections: [
        {
          heading: 'القيادة من دبي',
          paragraphs: [
            'اتجه شمالًا عبر الطرق الساحلية مرورًا بالشارقة وعجمان — قرابة ساعة بحسب نقطة الانطلاق. وانطلق خارج ساعات الذروة في أيام الأسبوع حين تكون طرق دبي–الشارقة أكثر ازدحامًا. ويمكنك الجمع بينها وبين [الشارقة وعجمان](/blog/sharjah-and-ajman-by-car) ليوم أطول.',
          ],
        },
        {
          heading: 'المانغروف والحياة البرية',
          paragraphs: [
            'تشتهر بحيرات المانغروف وجزرها في الإمارة بالطيور — ومنها طيور الفلامنجو في الأشهر الباردة — ويُفضّل استكشافها بالكاياك أو في رحلة بحرية مع مرشد. تحقق من جدول المشغّل الحالي قبل الانطلاق.',
          ],
        },
        {
          heading: 'الحصن والبلدة القديمة',
          paragraphs: ['يضم حصن أم القيوين، وهو حصن من القرن الثامن عشر، متحف الإمارة اليوم، ويسهل استكشاف البلدة القديمة الصغيرة حوله مشيًا.'],
        },
        {
          heading: 'الشواطئ وأيام العائلة',
          paragraphs: ['تمتد على الساحل شواطئ طويلة وهادئة، ويُعد «دريم لاند أكوا بارك»، وهو منتزه مائي كبير، محطة شائعة للعائلات. المزيد في [صفحة أم القيوين](/locations/umm-al-quwain).'],
        },
        {
          heading: 'تحقق من نطاق استخدام سيارتك',
          paragraphs: [
            'تربط [شروط وأحكام الحجز](/booking-terms) الإيجار بمدينة الاستلام والتسليم المتفق عليها عند الحجز. وإذا كانت رحلتك تشمل إمارة أخرى فـ[تواصل معنا](/contact) قبل الحجز لنؤكد لك أن ذلك مناسب لإيجارك.',
          ],
        },
      ],
      faqs: [
        { question: 'كم تبعد أم القيوين عن دبي؟', answer: 'نحو ساعة بالسيارة، بحسب نقطة الانطلاق والازدحام.' },
        { question: 'هل أم القيوين مزدحمة؟', answer: 'لا — فهي من أهدأ إمارات الدولة، وهذا جزء كبير من جاذبيتها ليوم هادئ.' },
      ],
    },
  },
]
