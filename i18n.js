/*
 * Complete Localization (exact AR & EN dictionaries from block.youtest.me),
 * 25 language picker entries, 248 ISO countries, Promo quizzes, and FormattedText parser.
 */
(function () {
  const LANGUAGES = [
    { code: "en", label: "English", native: "English" },
    { code: "es", label: "Spanish", native: "Español" },
    { code: "fr", label: "French", native: "Français" },
    { code: "ms", label: "Malay", native: "Bahasa Melayu" },
    { code: "th", label: "Thai", native: "ไทย" },
    { code: "pt", label: "Portuguese", native: "Português" },
    { code: "ar", label: "Arabic", native: "العربية" },
    { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
    { code: "fil", label: "Filipino", native: "Filipino" },
    { code: "ko", label: "Korean", native: "한국어" },
    { code: "de", label: "German", native: "Deutsch" },
    { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
    { code: "hi", label: "Hindi", native: "हिंदी" },
    { code: "bn", label: "Bengali", native: "বাংলা" },
    { code: "ta", label: "Tamil", native: "தமிழ்" },
    { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { code: "nl", label: "Dutch", native: "Nederlands" },
    { code: "ja", label: "Japanese", native: "日本語" },
    { code: "it", label: "Italian", native: "Italiano" },
    { code: "tr", label: "Turkish", native: "Türkçe" },
    { code: "ne", label: "Nepali", native: "नेपाली" },
    { code: "pl", label: "Polish", native: "Polski" },
    { code: "sv", label: "Swedish", native: "Svenska" },
    { code: "nb", label: "Norwegian Bokmål", native: "Norsk bokmål" },
    { code: "sw", label: "Swahili (Kiswahili)", native: "Kiswahili" }
  ];

  /* Exact ISO-3166 country list (248 entries) */
  const COUNTRY_RAW = [
    ["AF","Afghanistan"],["AX","Åland Islands"],["AL","Albania"],["DZ","Algeria"],["AS","American Samoa"],
    ["AD","Andorra"],["AO","Angola"],["AI","Anguilla"],["AQ","Antarctica"],["AG","Antigua and Barbuda"],
    ["AR","Argentina"],["AM","Armenia"],["AW","Aruba"],["AU","Australia"],["AT","Austria"],
    ["AZ","Azerbaijan"],["BS","Bahamas"],["BH","Bahrain"],["BD","Bangladesh"],["BB","Barbados"],
    ["BY","Belarus"],["BE","Belgium"],["BZ","Belize"],["BJ","Benin"],["BM","Bermuda"],
    ["BT","Bhutan"],["BO","Bolivia"],["BQ","Bonaire, Sint Eustatius and Saba"],["BA","Bosnia and Herzegovina"],["BW","Botswana"],
    ["BV","Bouvet Island"],["BR","Brazil"],["IO","British Indian Ocean Territory"],["BN","Brunei Darussalam"],["BG","Bulgaria"],
    ["BF","Burkina Faso"],["BI","Burundi"],["CV","Cabo Verde"],["KH","Cambodia"],["CM","Cameroon"],
    ["CA","Canada"],["KY","Cayman Islands"],["CF","Central African Republic"],["TD","Chad"],["CL","Chile"],
    ["CN","China"],["CX","Christmas Island"],["CC","Cocos (Keeling) Islands"],["CO","Colombia"],["KM","Comoros"],
    ["CG","Congo"],["CD","Congo (Democratic Republic)"],["CK","Cook Islands"],["CR","Costa Rica"],["CI","Côte d'Ivoire"],
    ["HR","Croatia"],["CU","Cuba"],["CW","Curaçao"],["CY","Cyprus"],["CZ","Czechia"],
    ["DK","Denmark"],["DJ","Djibouti"],["DM","Dominica"],["DO","Dominican Republic"],["EC","Ecuador"],
    ["EG","Egypt"],["SV","El Salvador"],["GQ","Equatorial Guinea"],["ER","Eritrea"],["EE","Estonia"],
    ["SZ","Eswatini"],["ET","Ethiopia"],["FK","Falkland Islands"],["FO","Faroe Islands"],["FJ","Fiji"],
    ["FI","Finland"],["FR","France"],["GF","French Guiana"],["PF","French Polynesia"],["TF","French Southern Territories"],
    ["GA","Gabon"],["GM","Gambia"],["GE","Georgia"],["DE","Germany"],["GH","Ghana"],
    ["GI","Gibraltar"],["GR","Greece"],["GL","Greenland"],["GD","Grenada"],["GP","Guadeloupe"],
    ["GU","Guam"],["GT","Guatemala"],["GG","Guernsey"],["GN","Guinea"],["GW","Guinea-Bissau"],
    ["GY","Guyana"],["HT","Haiti"],["HM","Heard Island and McDonald Islands"],["VA","Holy See"],["HN","Honduras"],
    ["HK","Hong Kong"],["HU","Hungary"],["IS","Iceland"],["IN","India"],["ID","Indonesia"],
    ["IR","Iran"],["IQ","Iraq"],["IE","Ireland"],["IM","Isle of Man"],["IL","Israel"],
    ["IT","Italy"],["JM","Jamaica"],["JP","Japan"],["JE","Jersey"],["JO","Jordan"],
    ["KZ","Kazakhstan"],["KE","Kenya"],["KI","Kiribati"],["KP","North Korea"],["KR","South Korea"],
    ["KW","Kuwait"],["KG","Kyrgyzstan"],["LA","Laos"],["LV","Latvia"],["LB","Lebanon"],
    ["LS","Lesotho"],["LR","Liberia"],["LY","Libya"],["LI","Liechtenstein"],["LT","Lithuania"],
    ["LU","Luxembourg"],["MO","Macao"],["MG","Madagascar"],["MW","Malawi"],["MY","Malaysia"],
    ["MV","Maldives"],["ML","Mali"],["MT","Malta"],["MH","Marshall Islands"],["MQ","Martinique"],
    ["MR","Mauritania"],["MU","Mauritius"],["YT","Mayotte"],["MX","Mexico"],["FM","Micronesia"],
    ["MD","Moldova"],["MC","Monaco"],["MN","Mongolia"],["ME","Montenegro"],["MS","Montserrat"],
    ["MA","Morocco"],["MZ","Mozambique"],["MM","Myanmar"],["NA","Namibia"],["NR","Nauru"],
    ["NP","Nepal"],["NL","Netherlands"],["NC","New Caledonia"],["NZ","New Zealand"],["NI","Nicaragua"],
    ["NE","Niger"],["NG","Nigeria"],["NU","Niue"],["NF","Norfolk Island"],["MK","North Macedonia"],
    ["MP","Northern Mariana Islands"],["NO","Norway"],["OM","Oman"],["PK","Pakistan"],["PW","Palau"],
    ["PS","Palestine"],["PA","Panama"],["PG","Papua New Guinea"],["PY","Paraguay"],["PE","Peru"],
    ["PH","Philippines"],["PN","Pitcairn"],["PL","Poland"],["PT","Portugal"],["PR","Puerto Rico"],
    ["QA","Qatar"],["RE","Réunion"],["RO","Romania"],["RU","Russia"],["RW","Rwanda"],
    ["BL","Saint Barthélemy"],["SH","Saint Helena"],["KN","Saint Kitts and Nevis"],["LC","Saint Lucia"],["MF","Saint Martin"],
    ["PM","Saint Pierre and Miquelon"],["VC","Saint Vincent and the Grenadines"],["WS","Samoa"],["SM","San Marino"],["ST","Sao Tome and Principe"],
    ["SA","Saudi Arabia"],["SN","Senegal"],["RS","Serbia"],["SC","Seychelles"],["SL","Sierra Leone"],
    ["SG","Singapore"],["SX","Sint Maarten"],["SK","Slovakia"],["SI","Slovenia"],["SB","Solomon Islands"],
    ["SO","Somalia"],["ZA","South Africa"],["GS","South Georgia"],["SS","South Sudan"],["ES","Spain"],
    ["LK","Sri Lanka"],["SD","Sudan"],["SR","Suriname"],["SJ","Svalbard and Jan Mayen"],["SE","Sweden"],
    ["CH","Switzerland"],["SY","Syria"],["TW","Taiwan"],["TJ","Tajikistan"],["TZ","Tanzania"],
    ["TH","Thailand"],["TL","Timor-Leste"],["TG","Togo"],["TK","Tokelau"],["TO","Tonga"],
    ["TT","Trinidad and Tobago"],["TN","Tunisia"],["TR","Turkey"],["TM","Turkmenistan"],["TC","Turks and Caicos Islands"],
    ["TV","Tuvalu"],["UG","Uganda"],["UA","Ukraine"],["AE","United Arab Emirates"],["GB","United Kingdom"],
    ["US","United States"],["UM","US Minor Outlying Islands"],["UY","Uruguay"],["UZ","Uzbekistan"],["VU","Vanuatu"],
    ["VE","Venezuela"],["VN","Vietnam"],["VG","Virgin Islands (British)"],["VI","Virgin Islands (U.S.)"],["WF","Wallis and Futuna"],
    ["EH","Western Sahara"],["YE","Yemen"],["ZM","Zambia"],["ZW","Zimbabwe"]
  ];

  function codeToFlag(code) {
    return String(code || "EG")
      .toUpperCase()
      .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
  }

  const COUNTRIES = COUNTRY_RAW.map(([code, name]) => ({
    code,
    name,
    flag: codeToFlag(code)
  }));

  const TRANSLATIONS = {
    ar: {
      common: {
        contact: {
          backHome: "العودة إلى الصفحة الرئيسية",
          closeMenu: "إغلاق القائمة",
          deletion: {
            button: "احذف رابطي",
            cancel: "إلغاء",
            confirm: "حذف",
            confirmDescription: "إذا حذفت الاختبار ما تقدر ترجّعه. متأكد من الحذف؟",
            confirmTitle: "حذف اختبارك؟",
            deleting: "جارٍ الحذف...",
            error: "ما قدرنا نحذف اختبارك. حاول مرة ثانية.",
            redirecting: "نرجعك للصفحة الرئيسية…",
            success: "تم حذف رابط اختبارك!",
            title: "حاب تحذف اختبارك؟",
            warning: "بعد الحذف، أنت وأصحابك ما تقدرون تفتحون هذا الاختبار."
          },
          description: "لو تحتاج مساعدة أو عندك ملاحظة، راسلنا على إنستغرام. وحتى لو بس حاب تسلّم، حياك!",
          whatsappButton: "التواصل عبر WhatsApp · 01125674359",
          whatsappMessage: "مرحبًا، أحتاج مساعدة بخصوص اختبار Don't Block Me.",
          information: {
            enjoy: {
              fun: "استمتع! 😊",
              share: "شارك الاختبار مع أصحابك وشوف قد إيش يعرفونك.",
              title: "استمتع مع أصحابك!"
            },
            privacy: {
              delete: "إذا ما تحتاج إجابات إضافية، تقدر تحذف رابط الاختبار بأي وقت.",
              entertainment: "الموقع للتسلية فقط. ما فيه تحقق من الهوية أو تتبع.",
              personalInfo: "ما نجمع أو نحفظ معلومات شخصية، لذلك ما نقدر نتتبع اللاعبين أو نعرف هويتهم.",
              safety: "شارك رابط اختبارك فقط مع ناس تثق فيهم.",
              title: "الخصوصية والأمان"
            },
            title: "كم شغلة تحتاج تعرفها",
            userContent: {
              guesses: "ما نتحكم بإجابات اللاعبين — هي تخميناتهم الخاصة.",
              manage: "أنت أنشأت الاختبار؟ تقدر تحذف أو تتجاهل أي إجابات ما تعجبك.",
              names: "بعض اللاعبين ممكن يستخدمون أسماء غريبة أو غير مناسبة وهم يجاوبون على اختبارك.",
              title: "محتوى المستخدمين"
            }
          },
          openInstagram: "افتح إنستغرام",
          opensNewTab: "يفتح في علامة تبويب جديدة",
          subtitle: "عندك سؤال عن الاختبار؟ اكتب لنا.",
          title: "راسلنا على إنستغرام",
          toggleMenu: "فتح القائمة أو إغلاقها"
        },
        language: {
          ar: "العربية",
          en: "الإنجليزية",
          select: "اختيار لغتك",
          close: "إغلاق"
        },
        loading: "جارٍ التحميل...",
        nav: {
          back: "رجوع",
          confirmNewQuiz: "إنشاء اختبار جديد سيفقدك اختبارك الحالي. هل نتابع؟",
          contactUs: "التواصل معنا",
          createMyQuiz: "إنشاء اختباري",
          createQuizAgain: "إنشاء اختبار آخر",
          followInstagram: "متابعتنا على Instagram"
        },
        notFound: {
          description: "لا أثر لها رغم بحث Bubu في كل مكان.",
          home: "العودة للرئيسية",
          imageAlt: "Bubu في استراحة على بقعة بلون فيروزي",
          title: "أوه! الصفحة غير موجودة."
        }
      },
      player: {
        completed: {
          conversation: {
            creator_1: "هل <s>أحظرك</s>؟🤬",
            creator_3: "إذن، أريد دليلًا على أن صداقتك <s>حقيقية</s>😏",
            creator_5: "حسنًا... *لنرَ*👀",
            player_2: "لكن... لا <s>زيف</s> في _صداقتي_ معك🥺",
            player_4: "يكفي النظر إلى *درجتي*🫣"
          },
          createYourQuiz: "إنشاء اختبارك الخاص",
          modal: {
            challengeCompleted: "اكتمل التحدي 🎉",
            close: "إغلاق دعوة الاختبار",
            createYourQuiz: "كشف أصدقائي المزيفين",
            cta: "إنشاء اختبارك",
            headingFirstLine: "كشف و_حظر_",
            headingSecondLine: "أصدقائك المزيفين",
            mainTitle: "إنشاء\n_اختبارك_ الخاص",
            subtitle: "لنكشف أصدقاءك المزيفين ونحظرهم"
          },
          nowYourTurn: "*الآن دورك*",
          replyForYou: "رد {{userName}}\nعليك👇",
          replyText: {
            high: "جعلتني *أبتسم*😆... لن <s>أحظرك</s> أبدًا🙂",
            low: "وداعًا! وداعًا! … <s>سأحظرك</s>… هه🤬",
            medium: "لن <s>أحظرك</s>... لكن أريد أن أبقى _وحدي_، أرجوك😕"
          },
          youScored: "<s>درجتك</s>"
        },
        home: {
          cta: "بدء الاختبار",
          heading: "هل ينتظرك _حظر_\nمن {{userName}}؟",
          loadingMessage: "جارٍ التحميل...",
          subHeading: "لنرَ مدى معرفتك بـ{{userName}}",
          thoughtBubble: "سأكشف\nو<s>أحظر</s> أصدقائي\n*المزيفين*"
        },
        name: {
          continue: "متابعة",
          enterYourName: "ما _اسمك_؟",
          errorNameRequired: "يرجى إدخال اسمك...",
          namePlaceholder: "اسمك..."
        },
        playing: {
          loadingText: "جارٍ التحميل...",
          savingAnswers: "جارٍ حفظ إجاباتك..."
        },
        scoreboard: {
          emptyDescription: "لم يشارك أحد بعد. يمكنك بدء الاختبار وتسجيل أول درجة!",
          emptyTitle: "فرصتك للمشاركة أولًا! 🎯"
        }
      },
      user: {
        creating: {
          bottomTxt: "مشاركة الاختبار مع أصدقاء أكثر تكشف من يعرفك فعلًا!",
          celebrationTitle: "*يا سلام!*",
          challengeReady: "الاختبار جاهز! 🎉",
          funFooter: "كلما شارك أصدقاء أكثر، زادت المتعة! 🎮",
          question: "السؤال",
          quizIsReady: "اختبارك >>جاهز<<!",
          share: "مشاركة",
          shareButtonText: "مشاركة الآن!",
          shareMessage: "إرساله لأصدقائك\nيكشف\nمن يعرفك _فعلًا_! 😎",
          shareNow: "مشاركة اختبارك الآن!",
          skipQuestion: "تخطي السؤال",
          subHead1: "مشاركة ~اختبارك~\nتكشف من يعرفك فعلًا!"
        },
        home: {
          cta: "إنشاء اختبار",
          heading: "إنشاء اختبارك\n<s>و</s>\n>>حظر<< أصدقائك <s>المزيفين</s>",
          howToPlay: {
            kicker: "كيف نلعب؟",
            steps: {
              createQuiz: {
                description: "إجاباتك عن 10 أسئلة سريعة عنك تكشف مدى معرفة الآخرين بك.",
                title: "إنشاء اختبارك"
              },
              findFakeFriends: {
                description: "بعد الاطلاع على درجاتهم، يمكنك حظر كل من حصل على درجة منخفضة.",
                title: "كشف الأصدقاء المزيفين"
              },
              shareWithFriends: {
                description: "تحدّ لأصدقائك ليثبتوا أن صداقتهم حقيقية! يمكنك إرسال الاختبار عبر WhatsApp أو Instagram أو Snapchat.",
                title: "مشاركة مع الأصدقاء"
              }
            },
            title: "لنكشف أصدقاءك المزيفين، والقرار لك: من يستحق الحظر؟🚫"
          },
          loadingMessage: "جارٍ التحميل...",
          tagline: "كشف أصدقائك المزيفين"
        },
        name: {
          continue: "متابعة",
          countryPicker: {
            close: "إغلاق اختيار البلد",
            empty: "لا توجد بلدان تطابق البحث",
            open: "تغيير البلد",
            search: "البحث عن بلد...",
            selected: "تم الاختيار",
            title: "اختيار بلدك"
          },
          errorGenderRequired: "يرجى اختيار جنسك",
          errorNameRequired: "يرجى إدخال اسمك...",
          female: "أنثى",
          hi: "أهلًا",
          male: "ذكر",
          name: "اسمك",
          selectYourGender: "اختيار _جنسك_",
          whatYourName: "ما\n<s>اسمك؟</s>"
        },
        scoreboard: {
          backToShare: "العودة للمشاركة",
          cancel: "إلغاء",
          confirmDeletion: "حذف المشاركة؟",
          delete: "حذف",
          deleteConfirmation: "لا يمكن التراجع عن هذا الإجراء.",
          emptyDescription: "مشاركة اختبارك مع أصدقائك تكشف مدى معرفتهم بك!",
          emptyTitle: "أوه، لم يشارك أصدقاؤك بعد!",
          loadError: "تعذّر تحميل النتائج.",
          loadMore: "تحميل المزيد",
          loadMoreError: "تعذّر تحميل المزيد من النتائج.",
          loading: "جارٍ التحميل...",
          moreInteresting: "كلما شارك أصدقاء أكثر في اختبارك، زادت الحماسة!",
          nextPage: "التالي",
          previousPage: "السابق",
          remove_action: "إزالة",
          retry: "حاول مجددًا",
          scoresAdded: "تم تحميل {{count}} من النتائج.",
          shareYourQuiz: "مشاركة اختبارك",
          title: "لوحة الدرجات",
          topFriends: "أفضل 10 أصدقاء",
          totalFriends: "عدد الأصدقاء المشاركين: {{count}}",
          totalFriendsOne: "عدد الأصدقاء المشاركين: 1",
          unsavedScore: "لم يتم حفظ هذه النتيجة.",
          view_action: "عرض",
          you: "أنت 👇",
          yourScore: "نتيجتك"
        },
        share: {
          bubble: "لنكشف الأصدقاء\n~المزيفين~ ونحظرهم",
          challengeNotFound: "التحدي غير موجود. يرجى إنشاء تحدّ جديد.",
          checkScores: "عرض الدرجات",
          copied: "تم النسخ!",
          copy: "نسخ",
          heading: {
            line1: "مشاركة _رابطك_",
            line2: "و",
            line3: "كشف أصدقائك ~المزيفين~"
          },
          linkCopiedAlert: "تم نسخ الرابط إلى الحافظة!",
          nativeShareText: "أنا أحظر🚫📱 أصدقائي المزيفين، هل أحظرك أيضًا؟",
          nativeShareTitle: "كشف الأصدقاء المزيفين وحظرهم",
          otherApps: "تطبيقات أخرى",
          shareOn: "مشاركة عبر",
          shareText_f: "🎭 \n\n{{USERNAME}} *تحظر* 🚫📱 \nأصدقاءها _المزيفين_ \n\nهل *ستحظرك* أيضًا؟\n\nلنرَ👇\n{{LINK}}",
          shareText_m: "🎭 \n\n{{USERNAME}} *يحظر* 🚫📱 \nأصدقاءه _المزيفين_ \n\nهل *سيحظرك* أيضًا؟\n\nلنرَ👇\n{{LINK}}"
        },
        viewAnswers: {
          answersTitle: "إجابات _{{playerName}}_",
          backToScoreboard: "العودة للدرجات",
          correctAnswer: "صحيحة",
          correctAnswerLabel: "الإجابة الصحيحة:",
          incorrectAnswer: "خاطئة",
          noAnswers: "لا توجد إجابات لهذه المشاركة.",
          question: "السؤال {number}:",
          score: "الدرجة:",
          theirAnswer: "الإجابة المختارة:"
        }
      }
    },
    en: {
      common: {
        contact: {
          backHome: "Back to home",
          closeMenu: "Close menu",
          deletion: {
            button: "Delete my link",
            cancel: "Cancel",
            confirm: "Delete",
            confirmDescription: "Are you sure you want to delete your quiz? You can’t undo this.",
            confirmTitle: "Delete your quiz?",
            deleting: "Deleting…",
            error: "Couldn’t delete your quiz. Try again.",
            redirecting: "Taking you back to the homepage…",
            success: "Your quiz link is deleted!",
            title: "Want to delete your quiz?",
            warning: "Once it’s deleted, you and your friends won’t be able to open this quiz."
          },
          description: "Need help, have something to share, or just stopping by to say hi? Our Instagram is right here.",
          whatsappButton: "Chat on WhatsApp · 01125674359",
          whatsappMessage: "Hi, I need help with the Don't Block Me quiz.",
          information: {
            enjoy: {
              fun: "Have fun! 😊",
              share: "Send your quiz to your friends and see how well they know you.",
              title: "Have fun with it"
            },
            privacy: {
              delete: "Don’t want any more answers? You can delete your quiz link anytime.",
              entertainment: "This site is just for fun. There’s no identity check or tracking.",
              personalInfo: "We don’t collect or save personal info, so we can’t track players or tell who they are.",
              safety: "Keep your quiz link between you and people you trust.",
              title: "Privacy & Security"
            },
            title: "A few things to know",
            userContent: {
              guesses: "We don’t control what players answer — they’re sharing their own guesses.",
              manage: "Made the quiz? You can delete or ignore any answers you’re not happy with.",
              names: "Some players might use weird or inappropriate names when taking your quiz.",
              title: "User Content"
            }
          },
          openInstagram: "Open Instagram",
          opensNewTab: "Opens in a new tab",
          subtitle: "Questions about your quiz? Send us a message.",
          title: "DM us on Instagram",
          toggleMenu: "Toggle menu"
        },
        language: {
          ar: "Arabic",
          en: "English",
          select: "Select Your Language",
          close: "Close"
        },
        loading: "Loading...",
        nav: {
          back: "Back",
          confirmNewQuiz: "Are you sure you want to create a new quiz? You'll lose your current quiz.",
          contactUs: "Contact Us",
          createMyQuiz: "Create My Quiz",
          createQuizAgain: "Create Another Quiz",
          followInstagram: "Follow on Instagram"
        },
        notFound: {
          description: "Bubu looked everywhere, but couldn't find it.",
          home: "Take me to the homepage",
          imageAlt: "Bubu resting on a turquoise splash",
          title: "Oops! This page is missing."
        }
      },
      player: {
        completed: {
          conversation: {
            creator_1: "should i <s>block</s> you?🤬",
            creator_3: "then prove you're <s>real</s> friend😏",
            creator_5: "okay... *let's see*👀",
            player_2: "but...I'm not your <s>fake</s> _friend_🥺",
            player_4: "just look at my *score*🫣"
          },
          createYourQuiz: "create your own quiz",
          modal: {
            challengeCompleted: "Challenge Completed 🎉",
            close: "Close quiz invitation",
            createYourQuiz: "Find My Fake Friends",
            cta: "create your quiz",
            headingFirstLine: "find & _block_",
            headingSecondLine: "your fake friends",
            mainTitle: "create your own\n_quiz_",
            subtitle: "Lets find your fake friends and block them"
          },
          nowYourTurn: "*now, it's your turn*",
          replyForYou: "{{userName}}'s reply\nto you👇",
          replyText: {
            high: "you made me *smile*😆... i'll never <s>block</s> you🙂",
            low: "bye! bye! … i will <s>block</s> you… huh🤬",
            medium: "i won't <s>block</s> you... but plz leave me _alone_😕"
          },
          youScored: "your <s>score</s>"
        },
        home: {
          cta: "start quiz",
          heading: "will {{userName}}\n_block_ you?",
          loadingMessage: "loading...",
          subHeading: "let's see how well you know {{userName}}",
          thoughtBubble: "i will\nfind & <s>block</s>\nmy *fake* friends"
        },
        name: {
          continue: "continue",
          enterYourName: "what's your _name_?",
          errorNameRequired: "Please enter your name...",
          namePlaceholder: "name..."
        },
        playing: {
          loadingText: "loading...",
          savingAnswers: "saving your answers..."
        },
        scoreboard: {
          emptyDescription: "No one has played yet. Take the quiz and set the first score!",
          emptyTitle: "Be the First! 🎯"
        }
      },
      user: {
        creating: {
          bottomTxt: "Get more friends to play and see who really knows you!",
          celebrationTitle: "*WOOHOO!*",
          challengeReady: "Quiz Ready! 🎉",
          funFooter: "The more friends play, the more fun! 🎮",
          question: "Question",
          quizIsReady: "your quiz is >>Ready<<!",
          share: "Share",
          shareButtonText: "SHARE NOW!",
          shareMessage: "send it to your friends\nand see\nwho _REALLY_ knows you! 😎",
          shareNow: "Share Your Quiz Now!",
          skipQuestion: "Skip Question",
          subHead1: "Share your ~quiz~ and \n see who really knows you!"
        },
        home: {
          cta: "create quiz",
          heading: "create your quiz\n <s>&</s>\n >>block<< your <s>fake</s> friends",
          howToPlay: {
            kicker: "how to play?",
            steps: {
              createQuiz: {
                description: "Answer 10 quick questions about yourself that reveal how well others know you.",
                title: "CREATE YOUR QUIZ"
              },
              findFakeFriends: {
                description: "Check their scores, and block all friends who have low scores.",
                title: "FIND FAKE FRIENDS"
              },
              shareWithFriends: {
                description: "Challenge friends to prove they're not faking it! Send via WhatsApp, Instagram, or Snapchat.",
                title: "SHARE WITH FRIENDS"
              }
            },
            title: "find your fake friends & decide who to block🚫"
          },
          loadingMessage: "loading...",
          tagline: "Find your Fake Friends"
        },
        name: {
          continue: "continue",
          countryPicker: {
            close: "Close country selector",
            empty: "No countries match that search",
            open: "Change country",
            search: "Search countries...",
            selected: "Selected",
            title: "choose your country"
          },
          errorGenderRequired: "Please select your gender",
          errorNameRequired: "Please enter your name...",
          female: "Female",
          hi: "hi",
          male: "Male",
          name: "name",
          selectYourGender: "choose your _gender_",
          whatYourName: "what's your\n<s>name?</s>"
        },
        scoreboard: {
          backToShare: "Back to Share",
          cancel: "Cancel",
          confirmDeletion: "Delete Player?",
          delete: "Delete",
          deleteConfirmation: "This action cannot be undone.",
          emptyDescription: "Share your quiz with friends to see how well they know you!",
          emptyTitle: "Oh, you have no friends yet!",
          loadError: "Couldn’t load scores.",
          loadMore: "Load more",
          loadMoreError: "Couldn’t load more scores.",
          loading: "Loading...",
          moreInteresting: "The more friends take your quiz, the more interesting it becomes!",
          nextPage: "Next",
          previousPage: "Previous",
          remove_action: "remove",
          retry: "Try again",
          scoresAdded: "{{count}} scores loaded.",
          shareYourQuiz: "Share Your Quiz",
          title: "Scoreboard",
          topFriends: "Top 10 Friends",
          totalFriends: "{{count}} friends played",
          totalFriendsOne: "1 friend played",
          unsavedScore: "This score wasn’t saved.",
          view_action: "view",
          you: "YOU 👇",
          yourScore: "Your score"
        },
        share: {
          bubble: "let's find &\nblock ~fake~ friends",
          challengeNotFound: "Challenge not found. Create a new one.",
          checkScores: "Check Scores",
          copied: "copied!",
          copy: "copy",
          heading: {
            line1: "share your _link_",
            line2: "&",
            line3: "find your ~fake~ friends"
          },
          linkCopiedAlert: "Link copied to clipboard!",
          nativeShareText: "i'm blocking🚫📱 my fake friends, should I block you?",
          nativeShareTitle: "find & block fake friends",
          otherApps: "Other Apps",
          shareOn: "Share on",
          shareText_f: "🎭 \n\n{{USERNAME}} is *blocking* 🚫📱 \nher _fake_ friends \n\nwill she *block* you as well?\n\nlet’s see👇\n{{LINK}}",
          shareText_m: "🎭 \n\n{{USERNAME}} is *blocking* 🚫📱 \nhis _fake_ friends \n\nwill he *block* you as well?\n\nlet’s see👇\n{{LINK}}"
        },
        viewAnswers: {
          answersTitle: "_{{playerName}}_'s Answers",
          backToScoreboard: "Back to Scoreboard",
          correctAnswer: "Correct",
          correctAnswerLabel: "Correct answer:",
          incorrectAnswer: "Incorrect",
          noAnswers: "No answers available for this player.",
          question: "Question {number}:",
          score: "Score:",
          theirAnswer: "Their Answer:"
        }
      }
    }
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  /* Exact inline SVG underline / brush-highlight generators from module 60060 */
  function underlineSvgUrl(color, variant) {
    const c = encodeURIComponent(color || "#0093ff");
    if (variant === "wavy") {
      return `url("data:image/svg+xml,%3Csvg width='100' height='64' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23a)'%3E%3Cpath d='M-17 30.5C-1 22 72-4 54 13 37.9 28.2-2.5 57.5 16 55.5s72-29 104-40' stroke='${c}' stroke-width='10'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='a'%3E%3Cpath fill='%23fff' d='M0 0h100v64H0z'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E")`;
    }
    return `url("data:image/svg+xml,%3Csvg fill='none' height='11' viewBox='0 0 94 11' width='94' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath clip-rule='evenodd' d='m32 1.50498c-19.503 1.75-30.998 3.16-31.729 3.891-1.645 1.645 1.789 1.855 12.491.766 32.858-3.344 79.417-3.804 81.554-.806.448.629.505.019.125-1.356-.379-1.375-.895-2.725-1.147-3-1.005-1.099-47.709-.714-61.294.505zm18.5 3.555c-11.36.918-33.681 3.871-34.417 4.553-1.494 1.387 2.381 1.527 12.649.458 6.472-.674 19.98-1.483 30.018-1.797 10.037-.314 18.25-.907 18.25-1.316 0-2.248-11.75-3.09-26.5-1.898z' fill='${c}' fill-rule='evenodd'/%3E%3C/svg%3E")`;
  }

  function formatRichText(raw, opts = {}) {
    let text = String(raw ?? "");
    const vars = opts.vars || {};
    const varKeys = Object.keys(vars);
    varKeys.forEach((key, idx) => {
      text = text.replaceAll(`{{${key}}}`, `\uE000V${idx}\uE001`);
    });

    const sClasses = opts.sClasses || ["text-accent-pink"];
    const underlineColor = opts.underlineColor || "#ff942d";
    const underlineVariant = opts.underlineVariant || "default";
    const underlineClass = opts.underlineClass || "";
    const highlightBg = opts.highlightBg || "#FFE8A1";
    const brushBg = opts.brushBg || "#f8d83a";
    const tildeClass = opts.tildeClass || "fancy-tilde";

    let sIdx = 0;
    const escaped = escapeHtml(text);

    // Replace custom tokens in safe escaped HTML
    let html = escaped
      .replace(/&gt;&gt;([^&<>]+?)&lt;&lt;/g, (_, inner) =>
        `<span class="fancy-brush" style="--brush-color:${brushBg}"><span>${inner}</span></span>`
      )
      .replace(/&lt;s&gt;([\s\S]*?)&lt;\/s&gt;/g, (_, inner) => {
        const cls = sClasses[Math.min(sIdx++, sClasses.length - 1)] || "text-accent-pink";
        return `<span class="${cls}">${inner}</span>`;
      })
      .replace(/~([^~]+)~/g, (_, inner) =>
        `<span class="${tildeClass}" style="--highlight-bg:${highlightBg}"><span>${inner}</span></span>`
      )
      .replace(/\*([^*]+)\*/g, (_, inner) =>
        `<span class="fancy-highlight" style="--highlight-bg:${highlightBg}"><span>${inner}</span></span>`
      )
      .replace(/_([^_]+)_/g, (_, inner) =>
        `<span class="fancy-underline ${underlineClass}" style="--u-img:${underlineSvgUrl(underlineColor, underlineVariant)}">${inner}</span>`
      )
      .replace(/\n/g, "<br>");

    varKeys.forEach((key, idx) => {
      const val = vars[key];
      const varCls = opts.varClasses?.[key];
      const safeVal = escapeHtml(val);
      const rendered = varCls ? `<span class="${varCls}">${safeVal}</span>` : safeVal;
      html = html.replaceAll(`\uE000V${idx}\uE001`, rendered);
    });
    return html;
  }

  function getTranslation(lang, ns, keyPath) {
    const effective = lang === "ar" ? "ar" : "en";
    const root = TRANSLATIONS[effective]?.[ns] || TRANSLATIONS.en[ns];
    const parts = keyPath.split(".");
    let cur = root;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return keyPath;
    }
    return cur;
  }

  window.dbmI18n = {
    LANGUAGES,
    COUNTRIES,
    TRANSLATIONS,
    escapeHtml,
    underlineSvgUrl,
    formatRichText,
    t: getTranslation
  };
})();
