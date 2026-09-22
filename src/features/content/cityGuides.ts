/**
 * Content for the per-city pages (/locations/:slug — see CityPage.tsx),
 * one for each emirate's main city. Written as marketing/SEO content
 * about the cities themselves: only widely-known public facts (what the
 * place is known for, what to see, road/parking basics) — no claims about
 * Bliss Rent's service that the live `locations` data doesn't back up (the
 * page lists the real pickup points from `fetchLocations()`, and says so
 * plainly when a city has none yet).
 *
 * This is a first draft meant to be replaced/extended with the business's
 * own material — keep the shape (a tagline, an intro, four highlights,
 * three driving tips, in both languages) and every page picks it up.
 * `city` must match the `locations.city` value exactly, since that's how a
 * page finds its live pickup points and its photo (CITY_PHOTOS).
 */

export interface CityCopy {
  /** The city's name in this language (also the heading / title). */
  name: string
  /** One line under the page title. */
  tagline: string
  /** The page's <meta name="description"> (aim for under ~160 characters). */
  metaDescription: string
  /** Two short paragraphs. */
  intro: [string, string]
  highlights: { title: string; body: string }[]
  drivingTips: string[]
}

export interface CityGuide {
  /** URL segment: /locations/<slug>. */
  slug: string
  /** Exactly the `locations.city` value this page is about. */
  city: string
  en: CityCopy
  ar: CityCopy
}

export const CITY_GUIDES: CityGuide[] = [
  {
    slug: 'dubai',
    city: 'Dubai',
    en: {
      name: 'Dubai',
      tagline: "The UAE's biggest city — a skyline, beaches and a highway grid built for driving.",
      metaDescription:
        'Rent a car in Dubai with Bliss Rent. Airport pickup, transparent pricing and easy online booking — explore Downtown, the Marina, Old Dubai and Hatta at your own pace.',
      intro: [
        "Dubai is the UAE's largest and best-known city, and one of the world's busiest business and leisure hubs. The distances between Downtown Dubai, Dubai Marina, Jumeirah, Deira and the desert on the city's edge are long enough that a rental car is usually the easiest way to see them — on your own schedule, not a taxi meter's.",
        "Bliss Rent is a Dubai-based business, and Dubai is where you'll find the pickup and drop-off points listed below. Collect your car at the airport or in the city, and return it at any of the points that suit your plans.",
      ],
      highlights: [
        { title: 'Downtown Dubai', body: "Home to the Burj Khalifa, Dubai Mall and the Dubai Fountain — the city's most recognisable district." },
        { title: 'Dubai Marina & JBR', body: 'A waterfront promenade of towers, cafés and beach access along the Gulf coast.' },
        { title: 'Old Dubai & the Creek', body: "Deira, Bur Dubai and Al Fahidi's wind-tower lanes show the city before the skyscrapers — souks, abra rides and heritage museums." },
        { title: 'Hatta & the Hajar foothills', body: 'A day trip out of the city to the Hajar Mountains — dams, hiking and mountain scenery.' },
      ],
      drivingTips: [
        'Some main roads, including Sheikh Zayed Road, use Salik electronic tolls.',
        'Parking is paid in most busy areas — check the signs and the payment method before you leave the car.',
        'Weekday morning and evening rush hours are busy — leave extra time for airport runs.',
      ],
    },
    ar: {
      name: 'دبي',
      tagline: 'أكبر مدن الإمارات — أفق شامخ وشواطئ وشبكة طرق سريعة مصمّمة للقيادة.',
      metaDescription:
        'استأجر سيارة في دبي مع بليس رنت. استلام من المطار وأسعار واضحة وحجز سهل عبر الإنترنت — استكشف وسط المدينة والمارينا ودبي القديمة وحتا بوتيرتك الخاصة.',
      intro: [
        'دبي هي أكبر مدن الإمارات العربية المتحدة وأشهرها، وإحدى أكثر مراكز الأعمال والترفيه حيوية في العالم. المسافات بين وسط مدينة دبي ودبي مارينا والجميرا وديرة والصحراء على أطراف المدينة طويلة بما يكفي لتكون السيارة المستأجرة أسهل وسيلة لاستكشافها — وفق جدولك أنت لا وفق عدّاد سيارة الأجرة.',
        'بليس رنت شركة مقرّها دبي، وفي دبي ستجد نقاط الاستلام والتسليم المدرجة أدناه. استلم سيارتك من المطار أو من المدينة، ثم أعدها في أي من النقاط التي تناسب خطتك.',
      ],
      highlights: [
        { title: 'وسط مدينة دبي', body: 'موطن برج خليفة ودبي مول ونافورة دبي — أشهر أحياء المدينة.' },
        { title: 'دبي مارينا وجي بي آر', body: 'كورنيش مائي تحيط به الأبراج والمقاهي مع وصول مباشر إلى الشاطئ على ساحل الخليج.' },
        { title: 'دبي القديمة والخور', body: 'تُظهر ديرة وبر دبي وأزقة الفهيدي ذات أبراج الرياح المدينة قبل ناطحات السحاب — أسواق وعبور بالعبرة ومتاحف تراثية.' },
        { title: 'حتا وسفوح جبال الحجر', body: 'رحلة يومية خارج المدينة إلى جبال الحجر — سدود ومسارات مشي ومناظر جبلية.' },
      ],
      drivingTips: [
        'تستخدم بعض الطرق الرئيسية، ومنها شارع الشيخ زايد، نظام «سالك» للرسوم الإلكترونية.',
        'مواقف السيارات مدفوعة في معظم المناطق المزدحمة؛ تحقق من اللافتات وطريقة الدفع قبل أن تترك السيارة.',
        'تزدحم الطرق في ساعات الذروة صباحاً ومساءً في أيام العمل — امنح نفسك وقتاً إضافياً لرحلات المطار.',
      ],
    },
  },
  {
    slug: 'abu-dhabi',
    city: 'Abu Dhabi',
    en: {
      name: 'Abu Dhabi',
      tagline: 'The capital — grand architecture, island beaches and wide, easy roads.',
      metaDescription:
        'Rent a car in Abu Dhabi with Bliss Rent. Explore the Sheikh Zayed Grand Mosque, Saadiyat Island and Yas Island at your own pace, with easy online booking.',
      intro: [
        "Abu Dhabi is the capital of the United Arab Emirates and its largest emirate by area. The city sits on an island connected to the mainland by bridges, and its major sights — the Sheikh Zayed Grand Mosque, Saadiyat Island, Yas Island and the Corniche — are spread far enough apart that having your own car makes them simple to combine in a day.",
        "Bliss Rent lists its Abu Dhabi pickup and drop-off points below, so you can start your rental in the capital.",
      ],
      highlights: [
        { title: 'Sheikh Zayed Grand Mosque', body: "One of the world's largest mosques — open to visitors, with white marble courtyards and intricate detail." },
        { title: 'Saadiyat Island', body: 'A cultural island home to the Louvre Abu Dhabi, beaches and resorts.' },
        { title: 'Yas Island', body: 'Theme parks, the Yas Marina Circuit and waterfront dining.' },
        { title: 'The Corniche', body: 'A long seafront promenade with beaches, cycle paths and city views.' },
      ],
      drivingTips: [
        'The Darb road-toll system charges on certain major roads and bridges into and around the city.',
        'Street parking in the city is paid and managed under the Mawaqif system.',
        'Speed cameras are common on the main highways — keep to the posted limits.',
      ],
    },
    ar: {
      name: 'أبوظبي',
      tagline: 'العاصمة — عمارة مهيبة وشواطئ جزرية وطرق واسعة وسهلة.',
      metaDescription:
        'استأجر سيارة في أبوظبي مع بليس رنت. استكشف جامع الشيخ زايد الكبير وجزيرة السعديات وجزيرة ياس بوتيرتك الخاصة مع حجز سهل عبر الإنترنت.',
      intro: [
        'أبوظبي هي عاصمة دولة الإمارات العربية المتحدة وأكبر إماراتها مساحةً. تقع المدينة على جزيرة ترتبط بالبر بجسور، وأبرز معالمها — جامع الشيخ زايد الكبير وجزيرة السعديات وجزيرة ياس والكورنيش — متباعدة بما يجعل امتلاك سيارة يسهّل الجمع بينها في يوم واحد.',
        'تجد أدناه نقاط الاستلام والتسليم التي يوفّرها بليس رنت في أبوظبي، لتبدأ إيجارك من العاصمة.',
      ],
      highlights: [
        { title: 'جامع الشيخ زايد الكبير', body: 'من أكبر مساجد العالم، مفتوح للزوار بساحاته الرخامية البيضاء وتفاصيله الدقيقة.' },
        { title: 'جزيرة السعديات', body: 'جزيرة ثقافية تضم متحف اللوفر أبوظبي وشواطئ ومنتجعات.' },
        { title: 'جزيرة ياس', body: 'متنزهات ترفيهية وحلبة ياس مارينا ومطاعم على الواجهة البحرية.' },
        { title: 'الكورنيش', body: 'ممشى طويل على البحر مع شواطئ ومسارات للدراجات وإطلالات على المدينة.' },
      ],
      drivingTips: [
        'يفرض نظام «درب» رسوماً على بعض الطرق والجسور الرئيسية المؤدية إلى المدينة وفي محيطها.',
        'مواقف الشوارع في المدينة مدفوعة وتُدار ضمن نظام «مواقف».',
        'الكاميرات الرادارية شائعة على الطرق السريعة الرئيسية — التزم بحدود السرعة المعلنة.',
      ],
    },
  },
  {
    slug: 'sharjah',
    city: 'Sharjah',
    en: {
      name: 'Sharjah',
      tagline: "The UAE's cultural capital — museums, heritage quarters and canal-side evenings.",
      metaDescription:
        'Rent a car in Sharjah with Bliss Rent. Museums, Al Qasba and the Heart of Sharjah heritage area, an easy drive from Dubai.',
      intro: [
        "Sharjah, next to Dubai on the Gulf coast, is known as the UAE's cultural capital for its museums, heritage quarters and arts scene.",
        "Its sights are spread between the Corniche, Al Qasba, the Heart of Sharjah heritage area and Al Noor Island, so a car is the easiest way to link them — and it's an easy drive from Dubai. Bliss Rent's Sharjah pickup and drop-off points are listed below.",
      ],
      highlights: [
        { title: 'Al Qasba', body: "A canal lined with cafés and the Eye of the Emirates observation wheel — a favourite evening spot." },
        { title: 'Heart of Sharjah', body: 'A restored heritage quarter of souks, museums and traditional houses.' },
        { title: 'Museums & arts', body: 'The Sharjah Art Museum, the Museum of Islamic Civilization and more.' },
        { title: 'Al Noor Island', body: 'A calm island with a butterfly house, sculpture and green spaces.' },
      ],
      drivingTips: [
        "Sharjah has stricter local rules than neighbouring Dubai — for example, alcohol isn't sold or served.",
        'The roads between Dubai and Sharjah are among the busiest in the UAE at peak times — avoid weekday rush hours if you can.',
        'Parking is paid in much of central Sharjah — check the signs and the payment method.',
      ],
    },
    ar: {
      name: 'الشارقة',
      tagline: 'عاصمة الثقافة في الإمارات — متاحف وأحياء تراثية وأمسيات على ضفاف القناة.',
      metaDescription:
        'استأجر سيارة في الشارقة مع بليس رنت. متاحف والقصباء ومنطقة قلب الشارقة التراثية، على مقربة من دبي.',
      intro: [
        'الشارقة، المجاورة لدبي على ساحل الخليج، معروفة بأنها عاصمة الثقافة في الإمارات بمتاحفها وأحيائها التراثية وحركتها الفنية.',
        'تتوزع معالمها بين الكورنيش والقصباء ومنطقة قلب الشارقة التراثية وجزيرة النور، فتكون السيارة أسهل وسيلة للتنقل بينها، والرحلة من دبي قصيرة. نقاط الاستلام والتسليم في الشارقة مدرجة أدناه.',
      ],
      highlights: [
        { title: 'القصباء', body: 'قناة مائية تحفّ بها المقاهي وعجلة «عين الإمارات» للمشاهدة — وجهة مسائية محبوبة.' },
        { title: 'قلب الشارقة', body: 'حي تراثي مرمَّم يضم أسواقاً ومتاحف وبيوتاً تقليدية.' },
        { title: 'المتاحف والفنون', body: 'متحف الشارقة للفنون ومتحف الحضارة الإسلامية وغيرهما.' },
        { title: 'جزيرة النور', body: 'جزيرة هادئة تضم بيت الفراشات وأعمالاً نحتية ومساحات خضراء.' },
      ],
      drivingTips: [
        'للشارقة أنظمة محلية أكثر تحفظاً من دبي المجاورة — فالكحول مثلاً لا يُباع ولا يُقدَّم فيها.',
        'تُعد الطرق بين دبي والشارقة من أكثر طرق الدولة ازدحاماً في أوقات الذروة — تجنّب ساعات الذروة في أيام العمل إن أمكن.',
        'المواقف مدفوعة في معظم وسط الشارقة؛ تحقق من اللافتات وطريقة الدفع.',
      ],
    },
  },
  {
    slug: 'ajman',
    city: 'Ajman',
    en: {
      name: 'Ajman',
      tagline: "The UAE's smallest emirate — a laid-back corniche, a fort museum and quick access to Dubai and Sharjah.",
      metaDescription:
        'Rent a car in Ajman with Bliss Rent. A relaxed corniche, a museum in a historic fort and beaches, a short drive from Dubai and Sharjah.',
      intro: [
        "Ajman is the smallest of the seven emirates, on the Gulf coast between Sharjah and Umm Al Quwain. It's a relaxed base of beaches, a waterfront corniche and traditional dhow yards, and just a short drive from Dubai's northern edge.",
        "A car makes it easy to combine Ajman with its neighbours in a day. Bliss Rent's Ajman pickup and drop-off points are listed below.",
      ],
      highlights: [
        { title: 'Ajman Corniche', body: 'A beachfront promenade with cafés and views across the Gulf.' },
        { title: 'Ajman Museum', body: "Housed in an 18th-century fort, showing the emirate's heritage." },
        { title: 'Ajman Marina', body: 'A waterfront area for leisure and evening walks.' },
        { title: 'Dhow yards', body: 'Traditional wooden dhows are still built by hand in Ajman.' },
      ],
      drivingTips: [
        'Ajman is compact — most sights are a short drive apart.',
        'The roads towards Dubai are busy at weekday rush hours — allow extra time.',
        'Corniche parking can fill up on evenings and weekends.',
      ],
    },
    ar: {
      name: 'عجمان',
      tagline: 'أصغر إمارات الدولة — كورنيش هادئ ومتحف في قلعة وقرب من دبي والشارقة.',
      metaDescription:
        'استأجر سيارة في عجمان مع بليس رنت. كورنيش هادئ ومتحف في قلعة تاريخية وشواطئ، على مقربة من دبي والشارقة.',
      intro: [
        'عجمان هي أصغر الإمارات السبع، تقع على ساحل الخليج بين الشارقة وأم القيوين. هي قاعدة هادئة للشواطئ والكورنيش المطل على البحر وورش بناء السفن الشراعية التقليدية، وعلى بعد مسافة قصيرة بالسيارة من أطراف دبي الشمالية.',
        'تسهّل السيارة الجمع بين عجمان وجاراتها في يوم واحد. نقاط الاستلام والتسليم في عجمان مدرجة أدناه.',
      ],
      highlights: [
        { title: 'كورنيش عجمان', body: 'ممشى على الشاطئ ومقاهٍ وإطلالات على الخليج.' },
        { title: 'متحف عجمان', body: 'يقع في قلعة تعود إلى القرن الثامن عشر ويعرض تراث الإمارة.' },
        { title: 'مرسى عجمان', body: 'واجهة بحرية للترفيه والمشي في المساء.' },
        { title: 'ورش السفن الشراعية', body: 'ما زالت عجمان تصنع السفن الخشبية التقليدية (الداو) يدوياً.' },
      ],
      drivingTips: [
        'عجمان صغيرة الحجم — معظم معالمها تبعد مسافات قصيرة بالسيارة.',
        'تزدحم الطرق المؤدية إلى دبي في ساعات الذروة في أيام العمل — امنح نفسك وقتاً إضافياً.',
        'قد تمتلئ مواقف الكورنيش في المساء وعطلات نهاية الأسبوع.',
      ],
    },
  },
  {
    slug: 'umm-al-quwain',
    city: 'Umm Al Quwain',
    en: {
      name: 'Umm Al Quwain',
      tagline: "Quiet lagoons, mangroves and a fishing-harbour pace — the UAE's calmest coast.",
      metaDescription:
        'Rent a car in Umm Al Quwain with Bliss Rent. Mangroves, lagoons and a quiet coast, within reach of Dubai.',
      intro: [
        'Umm Al Quwain is the least populated of the seven emirates, on the Gulf coast between Ajman and Ras Al Khaimah. It is known for its mangroves and lagoons, a working fishing harbour and a slower pace than the big cities.',
        "A car gives you the freedom to reach its quieter corners — the Khor Al Beidah lagoon, the coast and the old fort — and to carry on up the coast or back towards Dubai. Bliss Rent's Umm Al Quwain points are listed below.",
      ],
      highlights: [
        { title: 'Mangroves & Khor Al Beidah', body: 'A lagoon and mangrove reserve good for wildlife-watching and kayaking.' },
        { title: 'Dreamland Aqua Park', body: "A large water park and one of the emirate's best-known family days out." },
        { title: 'Umm Al Quwain Fort & Museum', body: "An old fort turned museum telling the emirate's history." },
        { title: 'The fishing harbour', body: "A working harbour where the day's catch comes in." },
      ],
      drivingTips: [
        'Distances are short, but services are more spread out than in the big cities — fill up and plan meals before longer drives.',
        'The road north to Ras Al Khaimah is a straightforward coastal drive.',
        'Beach and lagoon areas can be sandy or unpaved — stay on marked roads.',
      ],
    },
    ar: {
      name: 'أم القيوين',
      tagline: 'بحيرات هادئة وأشجار القرم وإيقاع ميناء الصيد — أهدأ سواحل الدولة.',
      metaDescription:
        'استأجر سيارة في أم القيوين مع بليس رنت. أشجار القرم والبحيرات والساحل الهادئ على مقربة من دبي.',
      intro: [
        'أم القيوين أقل الإمارات السبع سكاناً، وتقع على ساحل الخليج بين عجمان ورأس الخيمة. تشتهر بأشجار القرم والبحيرات وميناء صيد عامل وإيقاع أهدأ من المدن الكبرى.',
        'تمنحك السيارة حرية الوصول إلى أركانها الأهدأ — بحيرة خور البيضاء والساحل والقلعة القديمة — ومواصلة الطريق شمالاً أو العودة إلى دبي. نقاط أم القيوين مدرجة أدناه.',
      ],
      highlights: [
        { title: 'أشجار القرم وخور البيضاء', body: 'بحيرة ومحمية من أشجار القرم مناسبة لمراقبة الطبيعة والتجديف.' },
        { title: 'دريم لاند أكوا بارك', body: 'حديقة مائية كبيرة ومن أشهر وجهات الترفيه العائلي في الإمارة.' },
        { title: 'قلعة أم القيوين ومتحفها', body: 'قلعة قديمة تحوّلت إلى متحف يروي تاريخ الإمارة.' },
        { title: 'ميناء الصيد', body: 'ميناء عامل يصل إليه صيد اليوم.' },
      ],
      drivingTips: [
        'المسافات قصيرة لكن الخدمات أكثر تباعداً منها في المدن الكبرى — عبّئ الوقود وخطّط لوجباتك قبل الرحلات الطويلة.',
        'الطريق شمالاً إلى رأس الخيمة قيادة ساحلية مباشرة.',
        'قد تكون مناطق الشواطئ والبحيرات رملية أو غير معبّدة — التزم بالطرق المخصصة.',
      ],
    },
  },
  {
    slug: 'ras-al-khaimah',
    city: 'Ras Al Khaimah',
    en: {
      name: 'Ras Al Khaimah',
      tagline: "Mountains, mangroves and beaches in one emirate — Jebel Jais is the UAE's highest peak.",
      metaDescription:
        'Rent a car in Ras Al Khaimah with Bliss Rent. Jebel Jais, Al Marjan Island and the old town, an easy trip from Dubai.',
      intro: [
        'Ras Al Khaimah is the northernmost of the seven emirates. Its coast, mangroves and the Hajar Mountains sit close together, so a car lets you go from the beach to a mountain viewpoint in a single day.',
        "Jebel Jais, the UAE's highest peak, and Al Marjan Island are the headline draws, alongside the old town and its forts. Bliss Rent's Ras Al Khaimah pickup and drop-off points are listed below.",
      ],
      highlights: [
        { title: 'Jebel Jais', body: "The UAE's highest peak, with wide views and adventure activities including a long zipline." },
        { title: 'Al Marjan Island', body: 'An artificial island of resorts and beaches.' },
        { title: 'Dhayah Fort', body: 'A hilltop fort overlooking the palm oasis and the coast.' },
        { title: 'Old town & National Museum', body: "The Ras Al Khaimah National Museum, in the former ruler's fort, tells the emirate's story." },
      ],
      drivingTips: [
        'The road up Jebel Jais is a winding mountain drive — take it slowly, and expect cooler, sometimes misty conditions at the top.',
        'Beach areas can be busy on weekends and holidays.',
        'Fill up before heading into the mountains.',
      ],
    },
    ar: {
      name: 'رأس الخيمة',
      tagline: 'جبال وأشجار قرم وشواطئ في إمارة واحدة — جبل جيس أعلى قمة في الإمارات.',
      metaDescription:
        'استأجر سيارة في رأس الخيمة مع بليس رنت. جبل جيس وجزيرة المرجان والبلدة القديمة، على مقربة من دبي.',
      intro: [
        'رأس الخيمة هي أقصى الإمارات السبع شمالاً. ساحلها وأشجار القرم فيها وجبال الحجر متقاربة، فتتيح لك السيارة الانتقال من الشاطئ إلى إطلالة جبلية في يوم واحد.',
        'جبل جيس، أعلى قمة في الإمارات، وجزيرة المرجان هما أبرز الوجهات، إلى جانب البلدة القديمة وقلاعها. نقاط الاستلام والتسليم في رأس الخيمة مدرجة أدناه.',
      ],
      highlights: [
        { title: 'جبل جيس', body: 'أعلى قمة في الإمارات، بإطلالات واسعة وأنشطة مغامرات منها خط انزلاق طويل.' },
        { title: 'جزيرة المرجان', body: 'جزيرة اصطناعية تضم منتجعات وشواطئ.' },
        { title: 'قلعة ضاية', body: 'قلعة على تلّ تطل على واحة النخيل والساحل.' },
        { title: 'البلدة القديمة والمتحف الوطني', body: 'المتحف الوطني لرأس الخيمة في قلعة الحاكم السابق يروي تاريخ الإمارة.' },
      ],
      drivingTips: [
        'الطريق إلى جبل جيس جبلي متعرّج — قُد ببطء، وتوقّع طقساً أبرد وضباباً أحياناً في الأعلى.',
        'قد تزدحم مناطق الشواطئ في عطلات نهاية الأسبوع والإجازات.',
        'عبّئ الوقود قبل التوجّه إلى الجبال.',
      ],
    },
  },
  {
    slug: 'fujairah',
    city: 'Fujairah',
    en: {
      name: 'Fujairah',
      tagline: 'The east coast — Gulf of Oman beaches backed by the Hajar Mountains.',
      metaDescription:
        'Rent a car in Fujairah with Bliss Rent. East-coast beaches, historic forts and the Hajar Mountains.',
      intro: [
        'Fujairah sits on the UAE\'s east coast, on the Gulf of Oman, with the Hajar Mountains rising right behind its beaches.',
        "It's a scenic drive over the mountains from Dubai, and a car is the easiest way to reach the coast's forts, beaches and dive spots. Bliss Rent's Fujairah points are listed below.",
      ],
      highlights: [
        { title: 'Fujairah Fort', body: "One of the UAE's oldest and largest forts, overlooking the old town." },
        { title: 'Al Bidyah Mosque', body: "Often described as the UAE's oldest mosque." },
        { title: 'Snoopy Island', body: 'A well-known snorkelling and diving spot just off the coast.' },
        { title: 'Wadis & mountain roads', body: 'Mountain wadis and hiking in the Hajar, including Wadi Wurayah National Park.' },
      ],
      drivingTips: [
        'The drive from Dubai crosses the Hajar Mountains, with bends and tunnels — allow extra time.',
        'Weather on the east coast can differ from the Gulf coast — check conditions before you set out.',
        'Beach and diving areas fill up on weekends.',
      ],
    },
    ar: {
      name: 'الفجيرة',
      tagline: 'الساحل الشرقي — شواطئ خليج عُمان تحت جبال الحجر.',
      metaDescription:
        'استأجر سيارة في الفجيرة مع بليس رنت. شواطئ الساحل الشرقي والقلاع التاريخية وجبال الحجر.',
      intro: [
        'تقع الفجيرة على الساحل الشرقي للإمارات على خليج عُمان، وترتفع جبال الحجر خلف شواطئها مباشرة.',
        'الرحلة إليها من دبي عبر الجبال جميلة، والسيارة أسهل وسيلة للوصول إلى قلاع الساحل وشواطئه ومواقع الغوص فيه. نقاط الفجيرة مدرجة أدناه.',
      ],
      highlights: [
        { title: 'قلعة الفجيرة', body: 'من أقدم القلاع وأكبرها في الإمارات، تطل على البلدة القديمة.' },
        { title: 'مسجد البدية', body: 'يوصف غالباً بأنه أقدم مسجد في الإمارات.' },
        { title: 'جزيرة سنوبي', body: 'وجهة معروفة للغوص والسنوركلينغ قبالة الساحل.' },
        { title: 'الأودية وطرق الجبال', body: 'أودية ومسارات مشي في جبال الحجر، منها محمية وادي ورّاية الوطنية.' },
      ],
      drivingTips: [
        'الطريق من دبي يعبر جبال الحجر بمنعطفات وأنفاق — امنح نفسك وقتاً إضافياً.',
        'قد يختلف الطقس على الساحل الشرقي عنه في ساحل الخليج — تحقق من الأحوال قبل الانطلاق.',
        'تمتلئ مناطق الشواطئ والغوص في عطلات نهاية الأسبوع.',
      ],
    },
  },
  {
    slug: 'al-ain',
    city: 'Al Ain',
    en: {
      name: 'Al Ain',
      tagline: 'The Garden City — oases, forts and the winding road up Jebel Hafeet.',
      metaDescription:
        'Rent a car in Al Ain with Bliss Rent. Oases, forts and Jebel Hafeet — an easy day trip from Abu Dhabi and Dubai.',
      intro: [
        "Al Ain, in the Abu Dhabi emirate near the Omani border, is the UAE's inland \"Garden City\" — known for its oases, forts and mountain scenery. Its cultural sites are UNESCO-listed, and it's an easy day trip from either Abu Dhabi or Dubai.",
        "A car is the natural way to see it: the oasis, the fort, the zoo and the mountain are all a drive apart. Bliss Rent's Al Ain pickup and drop-off points are listed below.",
      ],
      highlights: [
        { title: 'Al Ain Oasis', body: 'UNESCO-listed shaded palm groves watered by the traditional falaj system.' },
        { title: 'Al Jahili Fort', body: 'A late-19th-century fort with an exhibition on the explorer Wilfred Thesiger.' },
        { title: 'Jebel Hafeet', body: 'A mountain of about 1,200 metres with a winding road popular with drivers and cyclists.' },
        { title: 'Al Ain Zoo', body: 'A large zoo that works well for families.' },
      ],
      drivingTips: [
        'The Jebel Hafeet road climbs in long switchbacks — take it steadily, and expect more wind at the top.',
        'Summers are very hot — plan outdoor stops for the morning or evening.',
        "Al Ain's roads are wide and quieter than the big coastal cities'.",
      ],
    },
    ar: {
      name: 'العين',
      tagline: 'مدينة الحدائق — واحات وقلاع وطريق متعرّج إلى جبل حفيت.',
      metaDescription:
        'استأجر سيارة في العين مع بليس رنت. الواحات والقلاع وجبل حفيت — رحلة يوم سهلة من أبوظبي ودبي.',
      intro: [
        'العين، في إمارة أبوظبي بالقرب من الحدود العُمانية، هي «مدينة الحدائق» الداخلية في الإمارات — تشتهر بواحاتها وقلاعها ومناظرها الجبلية. مواقعها الثقافية مدرجة ضمن قائمة اليونسكو للتراث العالمي، وهي رحلة يوم سهلة من أبوظبي أو دبي.',
        'السيارة هي الوسيلة الطبيعية لاستكشافها: الواحة والقلعة وحديقة الحيوان والجبل تفصل بينها مسافات قصيرة بالسيارة. نقاط الاستلام والتسليم في العين مدرجة أدناه.',
      ],
      highlights: [
        { title: 'واحة العين', body: 'مزارع نخيل ظليلة مدرجة ضمن اليونسكو تُروى بنظام الأفلاج التقليدي.' },
        { title: 'قلعة الجاهلي', body: 'قلعة من أواخر القرن التاسع عشر تضم معرضاً عن المستكشف ويلفريد ثيسيجر.' },
        { title: 'جبل حفيت', body: 'جبل يرتفع نحو 1200 متر وطريق متعرّج مشهور بين السائقين وراكبي الدراجات.' },
        { title: 'حديقة حيوان العين', body: 'حديقة حيوان كبيرة مناسبة للعائلات.' },
      ],
      drivingTips: [
        'يصعد طريق جبل حفيت بمنعطفات طويلة — قُد بثبات وتوقّع رياحاً أكثر في الأعلى.',
        'الصيف شديد الحرارة — خطّط للتوقفات الخارجية صباحاً أو مساءً.',
        'طرق العين واسعة وأهدأ من طرق المدن الساحلية الكبرى.',
      ],
    },
  },
]

export function findGuideBySlug(slug: string | undefined): CityGuide | undefined {
  return slug ? CITY_GUIDES.find((guide) => guide.slug === slug) : undefined
}

/** The city page path for a `locations.city` value, or null when that city has no page. */
export function cityPagePath(city: string): string | null {
  const guide = CITY_GUIDES.find((g) => g.city === city)
  return guide ? `/locations/${guide.slug}` : null
}
