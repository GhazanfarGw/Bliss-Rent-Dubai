import type { BlogPost } from '@/features/blog/blogPosts'

/**
 * "Driving tips" — tolls, parking, fines and rules of the road. Deliberately
 * descriptive rather than numeric: toll rates, fine amounts and parking
 * hours change, so none is quoted. The one Bliss Rent-specific statement
 * (who pays fines and tolls during a rental) restates section 10 of the
 * Booking Terms.
 */
export const TRAVEL_TIP_POSTS: BlogPost[] = [
  {
    slug: 'salik-parking-and-fines-uae-rental-car',
    category: 'travel-tips',
    publishedAt: '2026-09-19',
    related: ['driving-in-the-uae-first-timers-checklist', 'dubai-in-three-days-by-car', 'dubai-to-abu-dhabi-road-trip'],
    en: {
      title: 'Salik, Parking & Fines in a UAE Rental Car',
      description: 'How Salik tolls, paid parking and traffic fines work when you rent a car in the UAE — and what the Bliss Rent Booking Terms say about who pays.',
      excerpt: 'Electronic tolls, paid parking and traffic cameras — what first-time renters should know, and who pays.',
      intro:
        'Three things surprise first-time renters in the UAE: electronic road tolls, paid parking in busy areas, and how closely traffic rules are enforced. None is hard to handle once you know how they work.',
      sections: [
        {
          heading: 'Salik tolls in Dubai',
          paragraphs: [
            "Salik is Dubai's automatic toll system. There are toll gates on some main roads, including Sheikh Zayed Road — you drive through without stopping, and there is no cash booth. Each crossing is recorded electronically. Rates and gate locations can change, so we don't quote them here.",
          ],
        },
        {
          heading: "Abu Dhabi's Darb tolls",
          paragraphs: ["Abu Dhabi has its own, separate toll system called Darb, with toll points on some main roads and bridges. Driving between the two cities can mean passing through both systems."],
        },
        {
          heading: 'Paid parking',
          paragraphs: [
            'Parking is paid in most busy areas of Dubai, Abu Dhabi (under the Mawaqif system), Sharjah and other cities. Check the signs for the hours that apply and how to pay — meters, a mobile app or SMS depending on the area — before you leave the car.',
          ],
        },
        {
          heading: 'Traffic fines and cameras',
          paragraphs: [
            'Speed and other traffic rules are enforced by cameras and patrols, and a fine is recorded against the vehicle. Under our [Booking Terms](/booking-terms), traffic fines, Salik charges and parking fines incurred during the rental are the renter’s responsibility and may be charged to the payment method on file, with an administration fee. New to the roads here? Read our [first-timer’s driving checklist](/blog/driving-in-the-uae-first-timers-checklist).',
          ],
        },
        {
          heading: 'How to stay clear of fines',
          list: [
            'Follow the posted speed limits — they change between road types.',
            'Never use a handheld phone while driving; use a mount and hands-free.',
            'Read the parking signs and pay for the full time you will be away.',
            'Keep to the lane rules and leave a safe distance from the car in front.',
          ],
        },
      ],
      faqs: [
        { question: 'Who pays for Salik and fines on a rental?', answer: 'Under our [Booking Terms](/booking-terms), tolls, traffic fines and parking fines incurred during the rental are the renter’s responsibility.' },
        { question: 'Can I pay cash at a Salik gate?', answer: 'No. Salik gates are automatic — there are no booths, and charges are recorded electronically.' },
      ],
    },
    ar: {
      title: 'سالك والمواقف والمخالفات في سيارة مستأجرة بالإمارات',
      description: 'كيف تعمل رسوم سالك والمواقف المدفوعة والمخالفات المرورية عند استئجار سيارة في الإمارات — وما تقوله شروط بليس رنت عمن يتحمل التكلفة.',
      excerpt: 'رسوم إلكترونية ومواقف مدفوعة وكاميرات مرورية — ما يجب أن يعرفه المستأجر لأول مرة ومن يتحمل التكلفة.',
      intro:
        'ثلاثة أمور تفاجئ المستأجرين لأول مرة في الإمارات: رسوم الطرق الإلكترونية، والمواقف المدفوعة في المناطق المزدحمة، ودقة تطبيق قواعد المرور. ولا شيء منها صعب بمجرد أن تعرف كيف يعمل.',
      sections: [
        {
          heading: 'رسوم سالك في دبي',
          paragraphs: [
            'سالك نظام الرسوم الآلي في دبي. توجد بوابات على بعض الطرق الرئيسية، ومنها شارع الشيخ زايد — تعبر دون توقف ولا يوجد مكتب لدفع النقد، ويُسجَّل كل عبور إلكترونيًا. ولأن الأسعار ومواقع البوابات قد تتغير فلا نذكرها هنا.',
          ],
        },
        {
          heading: 'رسوم «درب» في أبوظبي',
          paragraphs: ['لأبوظبي نظام رسوم خاص بها ومنفصل يسمى «درب»، وله نقاط على بعض الطرق الرئيسية والجسور. والقيادة بين المدينتين قد تعني المرور بالنظامين.'],
        },
        {
          heading: 'المواقف المدفوعة',
          paragraphs: [
            'المواقف مدفوعة في معظم المناطق المزدحمة في دبي وأبوظبي (ضمن نظام «مواقف») والشارقة ومدن أخرى. تحقق من اللافتات لمعرفة الأوقات المطبقة وطريقة الدفع — عدادات أو تطبيق أو رسالة نصية بحسب المنطقة — قبل أن تترك السيارة.',
          ],
        },
        {
          heading: 'المخالفات المرورية والكاميرات',
          paragraphs: [
            'تُطبّق السرعة وقواعد المرور الأخرى بالكاميرات والدوريات، وتُسجَّل المخالفة على المركبة. وبموجب [شروط وأحكام الحجز](/booking-terms) فإن المخالفات المرورية ورسوم سالك ومخالفات المواقف التي تقع خلال الإيجار تقع على عاتق المستأجر وقد تُخصم من وسيلة الدفع المسجلة مع رسوم إدارية. وإن كنت جديدًا على الطرق هنا فاقرأ [قائمة القيادة للمبتدئين](/blog/driving-in-the-uae-first-timers-checklist).',
          ],
        },
        {
          heading: 'كيف تتجنب المخالفات',
          list: [
            'التزم بحدود السرعة المعلنة — فهي تختلف بحسب نوع الطريق.',
            'لا تستخدم الهاتف بيدك أثناء القيادة؛ استخدم حاملًا وخاصية اليدين الحرتين.',
            'اقرأ لافتات المواقف وادفع عن كامل المدة التي ستغيبها.',
            'التزم بقواعد المسارات واترك مسافة أمان مع السيارة التي أمامك.',
          ],
        },
      ],
      faqs: [
        { question: 'من يدفع سالك والمخالفات في السيارة المستأجرة؟', answer: 'بموجب [شروط وأحكام الحجز](/booking-terms) فإن الرسوم والمخالفات المرورية ومخالفات المواقف خلال الإيجار على عاتق المستأجر.' },
        { question: 'هل يمكنني الدفع نقدًا عند بوابة سالك؟', answer: 'لا. بوابات سالك آلية — لا توجد مكاتب دفع، وتُسجَّل الرسوم إلكترونيًا.' },
      ],
    },
  },

  {
    slug: 'driving-in-the-uae-first-timers-checklist',
    category: 'travel-tips',
    publishedAt: '2026-09-19',
    related: ['salik-parking-and-fines-uae-rental-car', 'dubai-airport-car-rental', 'ras-al-khaimah-jebel-jais-road-trip'],
    en: {
      title: "Driving in the UAE: A First-Timer's Checklist",
      description: 'Rules of the road for visitors driving in the UAE — right-hand traffic, speed cameras, seat belts, phones, roundabouts and what to do in an emergency.',
      excerpt: 'The rules visitors most often need — lanes, cameras, phones, weather and who to call.',
      intro:
        'Driving in the UAE is comfortable — wide roads and clear signs in Arabic and English — but the rules are enforced closely. This checklist covers what visitors most often need to know.',
      sections: [
        {
          heading: 'The basics',
          list: [
            'Traffic drives on the right.',
            'Everyone in the car must wear a seat belt, and young children need an appropriate child seat — check the current rules.',
            'Speed limits are posted and enforced by cameras — watch for the signs as the limit changes between roads.',
            'Use your phone only hands-free.',
          ],
        },
        {
          heading: 'Lanes, roundabouts and following distance',
          paragraphs: [
            'Keep to the right-hand lanes except to overtake, signal before you change lane and give way to traffic already on a roundabout. Tailgating is fined, so leave a safe gap — flashing the car in front is not acceptable.',
          ],
        },
        {
          heading: 'Alcohol and drugs',
          paragraphs: ['The UAE has a strict approach to driving after drinking or taking drugs. The safest rule for a visitor is simple: none at all if you are driving.'],
        },
        {
          heading: 'Weather and road conditions',
          paragraphs: [
            'Fog on winter mornings, blowing sand and sudden heavy rain can cut visibility or flood low roads quickly. Slow down, increase your distance and avoid dry riverbeds when rain is forecast. For mountain roads, see [Jebel Jais by car](/blog/ras-al-khaimah-jebel-jais-road-trip).',
          ],
        },
        {
          heading: 'If something goes wrong',
          paragraphs: [
            'In an emergency call the police on 999 or an ambulance on 998. Then contact [Bliss Rent support](/contact) about the rental. For tolls, parking and fines, read [Salik, parking and fines](/blog/salik-parking-and-fines-uae-rental-car).',
          ],
        },
      ],
      faqs: [
        { question: 'Can I use my phone for navigation?', answer: 'Yes, if it is mounted and hands-free. Holding your phone while driving is fined.' },
        { question: 'Which documents do I need to drive a rental car?', answer: 'See our checklist of [documents needed to rent a car in the UAE](/blog/documents-needed-to-rent-a-car-uae).' },
      ],
    },
    ar: {
      title: 'القيادة في الإمارات: قائمة المبتدئين',
      description: 'قواعد الطريق للزوار الذين يقودون في الإمارات — السير على اليمين وكاميرات السرعة وأحزمة الأمان والهاتف والدوارات وماذا تفعل في الطوارئ.',
      excerpt: 'القواعد التي يحتاجها الزوار غالبًا — المسارات والكاميرات والهاتف والطقس وبمن تتصل.',
      intro: 'القيادة في الإمارات مريحة — طرق واسعة ولافتات واضحة بالعربية والإنجليزية — لكن القواعد تُطبّق بدقة. تغطي هذه القائمة أكثر ما يحتاج الزوار إلى معرفته.',
      sections: [
        {
          heading: 'الأساسيات',
          list: [
            'السير على الجانب الأيمن من الطريق.',
            'يجب على الجميع في السيارة ربط حزام الأمان، ويحتاج الأطفال الصغار إلى مقعد أطفال مناسب — تحقق من القواعد الحالية.',
            'حدود السرعة معلنة وتُطبّق بالكاميرات — انتبه للافتات فالحد يتغير بين الطرق.',
            'استخدم الهاتف عبر خاصية اليدين الحرتين فقط.',
          ],
        },
        {
          heading: 'المسارات والدوارات ومسافة الأمان',
          paragraphs: [
            'التزم بالمسارات اليمنى إلا للتجاوز، وأعطِ الإشارة قبل تغيير المسار، وامنح الأولوية للسيارات الموجودة في الدوار. والالتصاق بالسيارة التي أمامك مخالفة، فاترك مسافة أمان — ولا يجوز وميض الأضواء للسيارة الأمامية.',
          ],
        },
        {
          heading: 'الكحول والمخدرات',
          paragraphs: ['تتبع الإمارات نهجًا صارمًا تجاه القيادة بعد الشرب أو تعاطي المخدرات. والقاعدة الأسلم للزائر بسيطة: لا شيء إطلاقًا إن كنت ستقود.'],
        },
        {
          heading: 'الطقس وحالة الطرق',
          paragraphs: [
            'الضباب في صباحات الشتاء والرمال المتطايرة والأمطار الغزيرة المفاجئة قد تقلل الرؤية أو تغمر الطرق المنخفضة بسرعة. خفف السرعة وزد المسافة وتجنب مجاري الأودية الجافة عند توقع المطر. وللطرق الجبلية راجع [جبل جيس بالسيارة](/blog/ras-al-khaimah-jebel-jais-road-trip).',
          ],
        },
        {
          heading: 'إذا حدث خطأ ما',
          paragraphs: [
            'في الطوارئ اتصل بالشرطة على 999 أو بالإسعاف على 998. ثم تواصل مع [دعم بليس رنت](/contact) بشأن الإيجار. وللرسوم والمواقف والمخالفات اقرأ [سالك والمواقف والمخالفات](/blog/salik-parking-and-fines-uae-rental-car).',
          ],
        },
      ],
      faqs: [
        { question: 'هل يمكنني استخدام هاتفي للملاحة؟', answer: 'نعم، إذا كان مثبتًا وبخاصية اليدين الحرتين. أما حمل الهاتف أثناء القيادة فمخالفة.' },
        { question: 'ما المستندات التي أحتاجها لقيادة سيارة مستأجرة؟', answer: 'راجع قائمة [المستندات المطلوبة لاستئجار سيارة في الإمارات](/blog/documents-needed-to-rent-a-car-uae).' },
      ],
    },
  },
]
