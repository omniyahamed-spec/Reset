// Everything Reset says on WhatsApp, in English and Arabic.
// WhatsApp limits: list row title <= 24 chars, button title <= 20 chars.

const OPTIONS = {
  mind: {
    en: ["Work", "A person", "Money", "Health", "A decision", "Everything"],
    ar: ["العمل", "شخص ما", "المال", "الصحة", "قرار", "كل شيء"],
  },
  avoid: {
    en: ["Starting", "A message", "A call", "A decision", "A hard task", "Resting"],
    ar: ["البدء", "رسالة", "مكالمة", "قرار", "مهمة صعبة", "الراحة"],
  },
  move: {
    en: ["Open it", "Send it", "2 min on it", "Write 1 line", "Make the call", "Step away 5 min"],
    ar: ["افتحها", "أرسلها", "دقيقتان عليها", "اكتب سطرًا واحدًا", "أجرِ المكالمة", "ابتعد 5 دقائق"],
  },
};

const T = {
  en: {
    welcome: "I'm Reset. When your head is full and you can't start, message me. Three taps, one small move, done.\n\nYour first 7 days are free. I'll send one short reminder a day, at 9 AM (Dubai time) to begin with, then at the hour you usually get stuck. Reply \"time\" to choose the hour, or \"no reminders\" to turn it off.",
    welcomeBack: "Welcome back to Reset. Your free trial was already used on this number.",
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
    recap: (r, k) => `In your free days: ${r} reset${r === 1 ? "" : "s"}, ${k} move${k === 1 ? "" : "s"} kept.\n\n`,
    paywall: (monthly, yearly, recap = "") =>
      `Your 7 free days are over.\n\n${recap}Keep Reset:\n• 29 AED / month: ${monthly}\n• 249 AED / year (save 28%): ${yearly}\n\nCancel anytime.`,
    trialEnding: (monthly, recap = "") => `Your free trial ends tomorrow.\n\n${recap}Keep Reset for 29 AED / month: ${monthly}`,
    plans: (monthly, yearly, recap = "") =>
      `Your trial is still on.\n\n${recap}To keep Reset after it ends:\n• 29 AED / month: ${monthly}\n• 249 AED / year (save 28%): ${yearly}\n\nCancel anytime.`,
    activated: "You're in. Reset is yours. Message me whenever you're stuck.",
    ended: "Your Reset subscription has ended. Message me if you want it back.",
    manage: (url) => `Manage or cancel your subscription here: ${url}`,
    manageMissing: "To cancel, reply with your email and we'll do it for you.",
    help: "Send any message to start a reset.\n• \"cancel\" — manage your subscription\n• \"calm\" — one calm minute before you start\n• \"time\" — choose when I remind you\n• \"stop\" — stop the daily reminder\n• \"delete my data\" — erase everything\n• \"عربي\" — switch to Arabic",
    nudge: "Anything you're avoiding right now? Tap to reset.",
    timeAsk: "When should I remind you each day? Pick the hour you usually get stuck (Dubai time).",
    timeButton: "Pick a time",
    timeOff: "No reminders",
    timeSet: (h) => `Done. I'll remind you every day at ${h}.`,
    timeLearned: (h) => `You usually reset around ${h}, so from tomorrow I'll remind you then instead. Reply "time" to pick another hour.`,
    hour: (h) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`),
    startButton: "Reset now",
    calmButton: "Calm first",
    calm: (url) => `One calm minute.\n\nBreathe in for 4… out for 6. Three times. Let your shoulders drop.\n\nWant the full minute with rain and a breathing circle? ${url}\n\nWhen you're ready, tap below.`,
    calmReady: "Ready? One small move.",
    switched: "Switched to English.",
    deleteAsk: "Delete everything Reset has about you: your resets, your history and this number's account? This can't be undone.",
    deleteYes: "Yes, delete",
    deleteNo: "Keep it",
    deleted: "Done. Everything is deleted. If you message again, you start fresh.",
    deletedPaid: (url) => `Done. Your data is deleted. Your subscription is separate: cancel it here so you're not charged again: ${url}`,
    deleteKept: "Kept. Nothing was deleted.",
    stopped: "Stopped. No more daily reminders. I'll only reply when you message me.",
    stoppedPaid: (url) => `Stopped. No more daily reminders. To cancel your subscription too: ${url}`,
  },
  ar: {
    welcome: "أنا Reset. عندما يمتلئ ذهنك ولا تستطيع البدء، راسلني: ثلاث ضغطات، وخطوة صغيرة، وانتهى الأمر.\n\nالأيام السبعة الأولى مجانية. سأرسل إليك تذكيرًا قصيرًا واحدًا كل يوم، في الساعة 9 صباحًا (بتوقيت دبي) في البداية، ثم في الساعة التي تتعثّر فيها عادةً. أرسل \"الوقت\" لتختار الساعة، أو \"إيقاف التذكير\" لإيقافه.",
    welcomeBack: "مرحبًا بعودتك إلى Reset. لقد استُخدمت التجربة المجانية سابقًا على هذا الرقم.",
    askMind: "ما الذي يشغل ذهنك الآن؟",
    askAvoid: "ما الذي تتجنبه؟",
    askMove: "ما أصغر خطوة ممكنة؟ نفّذها خلال دقيقتين.",
    listButton: "اختر",
    typeOwn: "سأكتبها بنفسي",
    typeIt: "اكتبها في سطر واحد.",
    go: (move) => `ابدأ الآن: ${move}.\n\nسأعود إليك بعد 5 دقائق.`,
    followup: "مرّت 5 دقائق. هل أنجزتها؟",
    stillDone: "أنجزتها",
    slipped: "لم أنجزها",
    doneReply: (n) => `أحسنت. هذه خطوتك رقم ${n} التي التزمت بها. راسلني متى شعرت بالتعثّر.`,
    slippedReply: "هذه معلومة مفيدة، وليست فشلًا: كانت الخطوة أكبر من اللازم. اختر في المرة القادمة خطوة أصغر. راسلني متى شئت.",
    voice: "يُرجى الضغط على أحد الخيارات أو الكتابة؛ لا أستطيع قراءة الرسائل الصوتية حاليًا.",
    recap: (r, k) => `خلال أيامك المجانية: ${r} من جلسات Reset، و${k} من الخطوات أنجزتها.\n\n`,
    paywall: (monthly, yearly, recap = "") =>
      `انتهت أيامك المجانية السبعة.\n\n${recap}للاستمرار مع Reset:\n• 29 درهمًا شهريًا: ${monthly}\n• 249 درهمًا سنويًا (توفير 28%): ${yearly}\n\nيمكنك الإلغاء في أي وقت.`,
    trialEnding: (monthly, recap = "") => `تنتهي تجربتك المجانية غدًا.\n\n${recap}للاستمرار بـ 29 درهمًا شهريًا: ${monthly}`,
    plans: (monthly, yearly, recap = "") =>
      `تجربتك المجانية ما زالت سارية.\n\n${recap}للاستمرار مع Reset بعدها:\n• 29 درهمًا شهريًا: ${monthly}\n• 249 درهمًا سنويًا (توفير 28%): ${yearly}\n\nيمكنك الإلغاء في أي وقت.`,
    activated: "تم تفعيل اشتراكك في Reset. راسلني متى شعرت بالتعثّر.",
    ended: "انتهى اشتراكك في Reset. راسلني إذا رغبت في تجديده.",
    manage: (url) => `يمكنك إدارة اشتراكك أو إلغاؤه من هنا: ${url}`,
    manageMissing: "للإلغاء، أرسل بريدك الإلكتروني وسنلغي الاشتراك نيابةً عنك.",
    help: "أرسل أي رسالة لتبدأ.\n• \"إلغاء\": إدارة الاشتراك\n• \"هدوء\": دقيقة هدوء قبل أن تبدأ\n• \"الوقت\": اختيار موعد التذكير\n• \"توقف\": إيقاف التذكير اليومي\n• \"احذف بياناتي\": حذف كل بياناتك\n• \"English\": التحويل إلى الإنجليزية",
    nudge: "هل هناك أمر تتجنبه الآن؟ اضغط وابدأ.",
    timeAsk: "متى تريد أن أذكّرك كل يوم؟ اختر الساعة التي تتعثّر فيها عادةً (بتوقيت دبي).",
    timeButton: "اختر الوقت",
    timeOff: "بدون تذكير",
    timeSet: (h) => `تم. سأذكّرك كل يوم في ${h}.`,
    timeLearned: (h) => `لاحظت أنك تبدأ Reset عادةً نحو ${h}، لذا سأذكّرك في هذا الوقت بدءًا من الغد. أرسل "الوقت" لتختار ساعة أخرى.`,
    hour: (h) => {
      const n = h % 12 === 0 ? 12 : h % 12;
      const part = h < 12 ? "صباحًا" : h < 15 ? "ظهرًا" : h < 18 ? "عصرًا" : "مساءً";
      return `الساعة ${n} ${part}`;
    },
    startButton: "ابدأ الآن",
    calmButton: "لحظة هدوء أولًا",
    calm: (url) => `دقيقة هدوء.\n\nخذ شهيقًا لأربع ثوانٍ… وزفيرًا لست ثوانٍ. ثلاث مرات. ودع كتفيك يسترخيان.\n\nأتريد الدقيقة كاملة مع صوت المطر ودائرة التنفس؟ ${url}\n\nعندما تكون مستعدًا، اضغط أدناه.`,
    calmReady: "هل أنت مستعد؟ خطوة صغيرة واحدة.",
    switched: "تم التحويل إلى العربية.",
    deleteAsk: "هل تريد حذف كل ما لدينا عنك: خطواتك وسجلك وحساب هذا الرقم؟ لا يمكن استرجاع البيانات بعد الحذف.",
    deleteYes: "نعم، احذف",
    deleteNo: "لا، أبقِها",
    deleted: "تم حذف كل بياناتك. إذا راسلتنا مجددًا، فستبدأ من جديد.",
    deletedPaid: (url) => `تم حذف بياناتك. الاشتراك منفصل عن البيانات، فيُرجى إلغاؤه من هنا حتى لا تُخصم منك رسوم أخرى: ${url}`,
    deleteKept: "حسنًا، لم يُحذف شيء.",
    stopped: "تم الإيقاف. لن تصلك تذكيرات يومية بعد الآن، ولن أرد إلا عندما تراسلني.",
    stoppedPaid: (url) => `تم الإيقاف. لن تصلك تذكيرات يومية بعد الآن. ولإلغاء اشتراكك أيضًا: ${url}`,
  },
};

const ARABIC = /[؀-ۿ]/;
const detectLang = (text) => (ARABIC.test(text || "") ? "ar" : "en");

const CANCEL_WORDS = ["cancel", "unsubscribe", "الغاء", "إلغاء", "الغ", "إلغاء الاشتراك"];
// WhatsApp users expect "STOP" to stop messages (Meta opt-out practice): it turns off reminders.
const STOP_WORDS = ["stop", "توقف", "وقف", "أوقف", "اوقف", "no reminders", "بدون تذكير", "إيقاف التذكير", "ايقاف التذكير"];
const HELP_WORDS = ["help", "?", "مساعدة", "؟"];
// Opens the reminder-hour picker.
const TIME_WORDS = ["time", "reminder time", "remind me", "الوقت", "وقت", "وقت التذكير", "موعد التذكير"];
// Hours offered in the picker (Dubai time).
const NUDGE_HOURS = [8, 10, 13, 16, 19, 21];
// One calm minute (breathing + a calm picture), then the reset.
const CALM_WORDS = ["calm", "relax", "breathe", "calm first", "هدوء", "استرخاء", "تنفس", "تنفّس", "لحظة هدوء"];
const DELETE_WORDS = ["delete my data", "delete", "احذف بياناتي", "احذف"];

module.exports = { OPTIONS, T, detectLang, CANCEL_WORDS, STOP_WORDS, HELP_WORDS, DELETE_WORDS, TIME_WORDS, NUDGE_HOURS, CALM_WORDS };
