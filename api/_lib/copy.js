// Everything Reset says on WhatsApp, in English and Arabic.
// WhatsApp limits: list row title <= 24 chars, button title <= 20 chars.

const OPTIONS = {
  mind: {
    en: ["Work", "A person", "Money", "Health", "A decision", "Everything"],
    ar: ["الشغل", "شخص", "فلوس", "الصحة", "قرار", "كل شي"],
  },
  avoid: {
    en: ["Starting", "A message", "A call", "A decision", "A hard task", "Resting"],
    ar: ["البداية", "رسالة", "مكالمة", "قرار", "مهمة صعبة", "الراحة"],
  },
  move: {
    en: ["Open it", "Send it", "2 min on it", "Write 1 line", "Make the call", "Step away 5 min"],
    ar: ["افتحها", "أرسلها", "دقيقتين عليها", "اكتب سطر", "اتصل", "ابتعد 5 دقايق"],
  },
};

const T = {
  en: {
    welcome: "I'm Reset. When your head is full and you can't start, message me. Three taps, one small move, done.\n\nYour first 7 days are free.",
    askMind: "What's in your head right now?",
    askAvoid: "What are you avoiding?",
    askMove: "What's the smallest move? Do it in the next 2 minutes.",
    listButton: "Choose",
    typeOwn: "Type my own",
    typeIt: "Type it in one line.",
    go: (move) => `Go. ${move} — now.\n\nI'll check in 5 minutes.`,
    followup: "5 minutes. Is it still done?",
    stillDone: "Still done",
    slipped: "It slipped",
    doneReply: (n) => `Good. That's ${n} move${n === 1 ? "" : "s"} kept. Message me whenever you're stuck again.`,
    slippedReply: "That's data, not failure. The move was probably too big. Next time pick a smaller one. Message me to reset again.",
    voice: "Tap or type for now — I can't read voice notes yet.",
    paywall: (monthly, yearly) =>
      `Your 7 free days are over.\n\nKeep Reset:\n• 29 AED / month: ${monthly}\n• 249 AED / year (save 28%): ${yearly}\n\nCancel anytime.`,
    trialEnding: (monthly) => `Your free trial ends tomorrow. Keep Reset for 29 AED / month: ${monthly}`,
    activated: "You're in. Reset is yours. Message me whenever you're stuck.",
    ended: "Your Reset subscription has ended. Message me if you want it back.",
    manage: (url) => `Manage or cancel your subscription here: ${url}`,
    manageMissing: "To cancel, reply with your email and we'll do it for you.",
    help: "Send any message to start a reset.\n• \"cancel\" — manage your subscription\n• \"عربي\" — switch to Arabic",
    nudge: "Morning. Anything you're avoiding today? Tap to reset.",
    startButton: "Reset now",
    switched: "Switched to English.",
  },
  ar: {
    welcome: "أنا Reset. لما يكون راسك مليان وما تقدر تبدأ، ارسل لي. ثلاث ضغطات، خطوة صغيرة، وخلصنا.\n\nأول 7 أيام مجاناً.",
    askMind: "شو اللي في راسك الحين؟",
    askAvoid: "شو اللي تتهرب منه؟",
    askMove: "شو أصغر خطوة؟ سوّها خلال دقيقتين.",
    listButton: "اختر",
    typeOwn: "أكتب بنفسي",
    typeIt: "اكتبها في سطر واحد.",
    go: (move) => `يلا. ${move} — الحين.\n\nبرجع لك بعد 5 دقايق.`,
    followup: "مرت 5 دقايق. للحين سويتها؟",
    stillDone: "سويتها",
    slipped: "ما صارت",
    doneReply: (n) => `ممتاز. هذي ${n} خطوة التزمت فيها. ارسل لي أي وقت تعلق.`,
    slippedReply: "هذي معلومة، مو فشل. الخطوة كانت كبيرة. المرة الجاية اختار أصغر. ارسل لي وقت ما تبي.",
    voice: "اضغط أو اكتب الحين — ما أقدر أقرأ الرسائل الصوتية بعد.",
    paywall: (monthly, yearly) =>
      `خلصت أيامك المجانية السبعة.\n\nكمّل مع Reset:\n• 29 درهم / شهر: ${monthly}\n• 249 درهم / سنة (توفير 28%): ${yearly}\n\nتقدر تلغي أي وقت.`,
    trialEnding: (monthly) => `تجربتك المجانية تخلص بكرة. كمّل بـ 29 درهم / شهر: ${monthly}`,
    activated: "تم. Reset صار لك. ارسل لي أي وقت تعلق.",
    ended: "انتهى اشتراكك في Reset. ارسل لي إذا تبي ترجعه.",
    manage: (url) => `تقدر تدير أو تلغي اشتراكك من هنا: ${url}`,
    manageMissing: "للإلغاء، ارسل إيميلك ونلغيه لك.",
    help: "ارسل أي رسالة عشان تبدأ.\n• \"الغاء\" — إدارة الاشتراك\n• \"English\" — للإنجليزي",
    nudge: "صباح الخير. في شي تتهرب منه اليوم؟ اضغط وابدأ.",
    startButton: "ابدأ الحين",
    switched: "تم التحويل للعربي.",
  },
};

const ARABIC = /[؀-ۿ]/;
const detectLang = (text) => (ARABIC.test(text || "") ? "ar" : "en");

const CANCEL_WORDS = ["cancel", "stop", "unsubscribe", "الغاء", "إلغاء", "الغ", "وقف"];
const HELP_WORDS = ["help", "?", "مساعدة"];

module.exports = { OPTIONS, T, detectLang, CANCEL_WORDS, HELP_WORDS };
