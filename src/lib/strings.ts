// Member-screen text in English and Tamil. Plain, everyday Tamil — the way the
// group would say it — not word-for-word translation. Admin screens stay English.

const S = <K extends string>(o: Record<K, { en: string; ta: string }>) => o;

export const STRINGS = S({
  // Tabs and common
  'tab.verses': { en: 'Verses', ta: 'வசனங்கள்' },
  'tab.practice': { en: 'Practice', ta: 'பயிற்சி' },
  'tab.record': { en: 'Record', ta: 'பதிவு' },
  'tab.group': { en: 'Group', ta: 'குழு' },
  'tab.settings': { en: 'Settings', ta: 'அமைப்புகள்' },
  'common.refresh': { en: 'Refresh', ta: 'புதுப்பி' },
  'common.loading': { en: 'Loading…', ta: 'ஏற்றுகிறது…' },
  'common.share': { en: 'Share', ta: 'பகிர்' },
  'common.copy': { en: 'Copy', ta: 'நகலெடு' },
  'common.tryAgain': { en: 'Try again', ta: 'மீண்டும் முயற்சி செய்' },
  'common.back': { en: 'Back', ta: 'பின்செல்' },
  'common.on': { en: 'On', ta: 'இயக்கத்தில்' },
  'common.off': { en: 'Off', ta: 'அணைப்பில்' },
  'common.today': { en: 'Today', ta: 'இன்று' },

  // Verses (home)
  'today.title': { en: "This week's verses", ta: 'இந்த வார வசனங்கள்' },
  'today.recordOpen': { en: 'Recording is open', ta: 'பதிவு செய்யும் நேரம் இது' },
  'today.recordUntil': { en: 'Until {when} — tap to record', ta: '{when} வரை — பதிவு செய்யத் தொடுங்கள்' },
  'today.notifOff': { en: 'Notifications are off', ta: 'அறிவிப்புகள் அணைக்கப்பட்டுள்ளன' },
  'today.notifOffBody': { en: 'Turn them on to get the verse every day at {time}.', ta: 'தினமும் {time} மணிக்கு வசனம் வர, அறிவிப்புகளை இயக்குங்கள்.' },
  'today.turnOn': { en: 'Turn on notifications', ta: 'அறிவிப்புகளை இயக்கு' },
  'today.thisWeek': { en: 'This week', ta: 'இந்த வாரம்' },
  'today.nextWeek': { en: 'Next week', ta: 'அடுத்த வாரம்' },
  'today.getting': { en: "Getting this week's verses…", ta: 'இந்த வார வசனங்களைப் பெறுகிறது…' },
  'today.notPublished': { en: 'Not published yet', ta: 'இன்னும் வெளியிடப்படவில்லை' },
  'today.notPublishedBody': { en: 'Your group admin publishes the 7 verses each week. Check back soon.', ta: 'குழு நிர்வாகி ஒவ்வொரு வாரமும் 7 வசனங்களை வெளியிடுவார். சிறிது நேரம் கழித்துப் பாருங்கள்.' },
  'today.noVerse': { en: 'No verse for this day', ta: 'இந்த நாளுக்கு வசனம் இல்லை' },
  'today.reminderAt': { en: 'Daily reminder at {time} · change it in Settings', ta: 'தினசரி நினைவூட்டல் {time} · அமைப்புகளில் மாற்றலாம்' },

  // Practice
  'practice.title': { en: 'Practice', ta: 'பயிற்சி' },
  'practice.subtitle': { en: 'Recite from memory, then check yourself. Nothing here is sent to the admin.', ta: 'மனப்பாடமாகச் சொல்லிப் பார்த்து, பிறகு சரிபாருங்கள். இங்கே எதுவும் நிர்வாகிக்கு அனுப்பப்படாது.' },
  'practice.none': { en: 'No verses yet', ta: 'இன்னும் வசனங்கள் இல்லை' },
  'practice.noneBody': { en: 'Verses appear here once your admin publishes the week.', ta: 'நிர்வாகி இந்த வார வசனங்களை வெளியிட்டதும் இங்கே தெரியும்.' },
  'practice.hidden': { en: 'Hidden', ta: 'மறைத்து' },
  'practice.letters': { en: 'First letters', ta: 'முதல் எழுத்து' },
  'practice.words': { en: 'Words', ta: 'சொல் சொல்லாக' },
  'practice.nextWord': { en: 'Next word', ta: 'அடுத்த சொல்' },
  'practice.showAll': { en: 'Show all', ta: 'முழுவதும் காட்டு' },
  'practice.check': { en: 'Check — show the verse', ta: 'சரிபார் — வசனத்தைக் காட்டு' },
  'practice.hide': { en: 'Hide again', ta: 'மீண்டும் மறை' },
  'practice.tip': { en: 'Tip: say the reference ({ref}) before the verse, just like in the recording.', ta: 'குறிப்பு: பதிவில் சொல்வது போலவே, வசனத்துக்கு முன் அதன் இடத்தையும் ({ref}) சொல்லுங்கள்.' },
  'practice.voiceTitle': { en: 'Voice check', ta: 'குரல் சரிபார்ப்பு' },
  'practice.voiceHint': { en: 'Say this verse aloud and see how closely it matches. Not sent to the admin.', ta: 'இந்த வசனத்தைச் சத்தமாகச் சொல்லுங்கள்; எவ்வளவு சரியாக இருக்கிறது என்று பார்க்கலாம். நிர்வாகிக்கு அனுப்பப்படாது.' },
  'practice.voiceStart': { en: 'Start voice check', ta: 'குரல் சரிபார்ப்பைத் தொடங்கு' },
  'practice.voiceStop': { en: 'Stop and check', ta: 'நிறுத்திச் சரிபார்' },
  'practice.checking': { en: 'Checking…', ta: 'சரிபார்க்கிறது…' },
  'practice.match': { en: '{pct}% match', ta: '{pct}% சரி' },
  'practice.missed': { en: 'Words to practise', ta: 'இன்னும் பழக வேண்டிய சொற்கள்' },
  'practice.allGood': { en: 'Every word was there. Well done!', ta: 'எல்லாச் சொற்களும் சரியாக இருந்தன. அருமை!' },
  'practice.almost': { en: 'Nearly there — some words were unclear or out of order. Say it once more, slowly.', ta: 'கிட்டத்தட்ட சரி — சில சொற்கள் தெளிவாக இல்லை அல்லது வரிசை மாறியது. மெதுவாக இன்னொரு முறை சொல்லுங்கள்.' },
  'practice.left': { en: '{n} voice checks left today', ta: 'இன்று இன்னும் {n} முறை சரிபார்க்கலாம்' },
  'practice.heard': { en: 'What the app heard', ta: 'ஆப் கேட்டது' },
  'practice.refOk': { en: 'Reference said ✓', ta: 'வசன இடம் சொல்லப்பட்டது ✓' },
  'practice.refMissing': { en: 'Reference not heard — say it before the verse', ta: 'வசன இடம் கேட்கவில்லை — வசனத்துக்கு முன் சொல்லுங்கள்' },
  'practice.listening': { en: 'Listening… say the verse now', ta: 'கேட்கிறது… இப்போது வசனத்தைச் சொல்லுங்கள்' },

  // Record
  'record.title': { en: 'Record', ta: 'பதிவு' },
  'record.hi': { en: 'Hi {name}', ta: 'வணக்கம் {name}' },
  'record.sentTitle': { en: "This week's recording is sent", ta: 'இந்த வாரப் பதிவு அனுப்பப்பட்டது' },
  'record.sentNote': { en: 'Your admin will listen and mark it. Marks are seen only by the admin.', ta: 'நிர்வாகி கேட்டு மதிப்பெண் போடுவார். மதிப்பெண்களை நிர்வாகி மட்டுமே பார்ப்பார்.' },
  'record.closed': { en: 'Recording is closed now', ta: 'இப்போது பதிவு செய்ய முடியாது' },
  'record.closedBody': { en: "Opens {open} · closes {close}. You'll get a notification when it opens.", ta: 'திறக்கும் நேரம்: {open} · மூடும் நேரம்: {close}. திறந்ததும் அறிவிப்பு வரும்.' },
  'record.open': { en: 'Recording is open', ta: 'பதிவு செய்யலாம்' },
  'record.hoursLeft': { en: '{n} hours left', ta: 'இன்னும் {n} மணி நேரம்' },
  'record.minsLeft': { en: '{n} minutes left', ta: 'இன்னும் {n} நிமிடம்' },
  'record.intro': { en: 'Recite all 7 verses from memory, Monday to Sunday, with each reference.', ta: 'திங்கள் முதல் ஞாயிறு வரை உள்ள 7 வசனங்களையும், ஒவ்வொன்றின் இடத்துடன், மனப்பாடமாகச் சொல்லுங்கள்.' },
  'record.rule1': { en: 'Verses are hidden while recording.', ta: 'பதிவு செய்யும்போது வசனங்கள் மறைக்கப்படும்.' },
  'record.rule2': { en: 'Tap “Next verse” when you move to the next one.', ta: 'அடுத்த வசனத்துக்குச் செல்லும்போது “அடுத்த வசனம்” என்பதைத் தொடுங்கள்.' },
  'record.rule3': { en: 'No pause. If a phone call or the app closing stops you, you get that try back ({n} more this week).', ta: 'இடையில் நிறுத்த முடியாது. அழைப்பு வந்தோ ஆப் மூடியோ பதிவு நின்றால், அந்த முயற்சி திரும்பக் கிடைக்கும் (இந்த வாரம் இன்னும் {n} முறை).' },
  'record.rule3none': { en: "No pause. Leaving the app now uses up the try (this week's free retries are used).", ta: 'இடையில் நிறுத்த முடியாது. இந்த வாரத்துக்கான இலவச மறுவாய்ப்புகள் முடிந்துவிட்டன; ஆப்பை விட்டு வெளியேறினால் முயற்சி வீணாகும்.' },
  'record.rule4': { en: 'You have {left} of {max} tries left. You can listen before sending.', ta: '{max} முயற்சிகளில் {left} மீதம் உள்ளன. அனுப்பும் முன் கேட்டுப் பார்க்கலாம்.' },
  'record.ready': { en: "I'm ready and I'll recite from memory", ta: 'நான் தயார்; மனப்பாடமாகச் சொல்வேன்' },
  'record.start': { en: 'Start recording', ta: 'பதிவைத் தொடங்கு' },
  'record.noTries': { en: 'No tries left', ta: 'முயற்சிகள் முடிந்துவிட்டன' },
  'record.askAdmin': { en: 'Ask the admin for one more try', ta: 'நிர்வாகியிடம் இன்னொரு வாய்ப்பு கேள்' },
  'record.asked': { en: "Your admin has been told. You'll get a notification when they give you a try.", ta: 'நிர்வாகிக்குத் தெரிவிக்கப்பட்டது. அவர் வாய்ப்பு தந்ததும் அறிவிப்பு வரும்.' },
  'record.getReady': { en: 'Get ready — recite from memory', ta: 'தயாராகுங்கள் — மனப்பாடமாகச் சொல்லுங்கள்' },
  'record.recording': { en: 'Recording', ta: 'பதிவாகிறது' },
  'record.max': { en: 'max {t}', ta: 'அதிகபட்சம் {t}' },
  'record.nowReciting': { en: 'Now reciting', ta: 'இப்போது சொல்வது' },
  'record.verseOf': { en: 'Verse {n} of {total}', ta: 'வசனம் {n} / {total}' },
  'record.daysVerse': { en: "{day}'s verse — say the reference too", ta: '{day} வசனம் — அதன் இடத்தையும் சொல்லுங்கள்' },
  'record.next': { en: 'Next verse →', ta: 'அடுத்த வசனம் →' },
  'record.finish': { en: 'Finish', ta: 'முடித்தேன்' },
  'record.finishEarly': { en: 'Finish early', ta: 'இப்போதே முடி' },
  'record.noPause': { en: "Pausing isn't possible. The screen stays on while you record.", ta: 'இடையில் நிறுத்த முடியாது. பதிவு செய்யும்போது திரை அணையாது.' },
  'record.listen': { en: 'Listen to your recording', ta: 'உங்கள் பதிவைக் கேளுங்கள்' },
  'record.marked': { en: '{n} of {total} verses marked', ta: '{total} வசனங்களில் {n} குறிக்கப்பட்டன' },
  'record.retry': { en: 'Record again ({n} left)', ta: 'மீண்டும் பதிவு ({n} மீதம்)' },
  'record.send': { en: 'Send to admin', ta: 'நிர்வாகிக்கு அனுப்பு' },
  'record.sending': { en: 'Sending…', ta: 'அனுப்புகிறது…' },
  'record.sentToast': { en: 'Recording sent to the admin 🙏', ta: 'பதிவு நிர்வாகிக்கு அனுப்பப்பட்டது 🙏' },
  'record.micNeeded': { en: 'Microphone permission is needed to record.', ta: 'பதிவு செய்ய மைக்ரோஃபோன் அனுமதி தேவை.' },
  'record.unsent': { en: "Not sent yet — it's saved on this phone. Send it when you have internet.", ta: 'இன்னும் அனுப்பப்படவில்லை — இந்த ஃபோனில் சேமிக்கப்பட்டுள்ளது. இணையம் கிடைத்ததும் அனுப்புங்கள்.' },
  'record.refunded': { en: 'The recording was interrupted, so you got that try back.', ta: 'பதிவு தடைபட்டதால், அந்த முயற்சி உங்களுக்குத் திரும்பக் கிடைத்தது.' },
  'record.cancelled': { en: 'The recording was cancelled and that try is used.', ta: 'பதிவு ரத்தானது; அந்த முயற்சி கணக்கில் சேர்ந்தது.' },
  'record.discardConfirm': { en: 'Delete this recording and record again?', ta: 'இந்தப் பதிவை நீக்கிவிட்டு மீண்டும் பதிவு செய்யவா?' },
  'record.lastTryConfirm': { en: 'This is your last try. Delete this recording?', ta: 'இதுவே உங்கள் கடைசி முயற்சி. இந்தப் பதிவை நீக்கவா?' },

  // Progress
  'streak.title': { en: 'Your progress', ta: 'உங்கள் முன்னேற்றம்' },
  'streak.weeks': { en: '{n} weeks in a row', ta: 'தொடர்ந்து {n} வாரங்கள்' },
  'streak.week': { en: '1 week — keep going!', ta: '1 வாரம் — தொடருங்கள்!' },
  'streak.total': { en: '{n} recordings sent in total', ta: 'மொத்தம் {n} பதிவுகள் அனுப்பியுள்ளீர்கள்' },
  'streak.totalOne': { en: '1 recording sent so far', ta: 'இதுவரை 1 பதிவு அனுப்பியுள்ளீர்கள்' },
  'streak.start': { en: "Send this week's recording to start your streak.", ta: 'இந்த வாரப் பதிவை அனுப்பித் தொடரைத் தொடங்குங்கள்.' },
  'streak.last8': { en: 'Last 8 weeks', ta: 'கடந்த 8 வாரங்கள்' },

  // Group
  'group.title': { en: 'Group', ta: 'குழு' },
  'group.sub': { en: 'Week of {date} · {sent} of {total} sent', ta: '{date} வாரம் · {total} பேரில் {sent} பேர் அனுப்பியுள்ளனர்' },
  'group.none': { en: 'No members yet', ta: 'இன்னும் உறுப்பினர்கள் இல்லை' },
  'group.sent': { en: '✓ Sent', ta: '✓ அனுப்பியுள்ளார்' },
  'group.notYet': { en: 'Not yet', ta: 'இன்னும் இல்லை' },
  'group.you': { en: 'You', ta: 'நீங்கள்' },
  'group.marksPrivate': { en: 'Marks are seen only by the admin.', ta: 'மதிப்பெண்களை நிர்வாகி மட்டுமே பார்ப்பார்.' },

  // Settings
  'settings.title': { en: 'Settings', ta: 'அமைப்புகள்' },
  'settings.display': { en: 'Display', ta: 'தோற்றம்' },
  'settings.language': { en: 'Language', ta: 'மொழி' },
  'settings.textSize': { en: 'Text size', ta: 'எழுத்தின் அளவு' },
  'size.normal': { en: 'Normal', ta: 'சாதாரணம்' },
  'size.large': { en: 'Large', ta: 'பெரியது' },
  'size.xl': { en: 'Extra large', ta: 'மிகப்பெரியது' },
  'settings.theme': { en: 'Theme', ta: 'திரை நிறம்' },
  'theme.system': { en: 'Same as phone', ta: 'ஃபோன் போல' },
  'theme.light': { en: 'Light', ta: 'வெளிச்சம்' },
  'theme.dark': { en: 'Dark', ta: 'இருள்' },
  'settings.reminder': { en: 'Daily reminder', ta: 'தினசரி நினைவூட்டல்' },
  'settings.reminderTime': { en: 'Reminder time', ta: 'நினைவூட்டும் நேரம்' },
  'settings.ownTime': { en: 'Your own time.', ta: 'நீங்கள் தேர்ந்தெடுத்த நேரம்.' },
  'settings.groupTime': { en: "Using your group's send time.", ta: 'குழுவின் நேரமே பயன்படுகிறது.' },
  'settings.useGroupTime': { en: "Use the group's time instead", ta: 'குழுவின் நேரத்தையே பயன்படுத்து' },
  'settings.reminderSet': { en: 'Reminder set for {time}', ta: 'நினைவூட்டல் {time} மணிக்கு அமைக்கப்பட்டது' },
  'settings.verses': { en: 'Verses', ta: 'வசனங்கள்' },
  'settings.lastUpdated': { en: 'Last updated {when}.', ta: 'கடைசியாகப் புதுப்பித்தது: {when}.' },
  'settings.notDownloaded': { en: 'Not downloaded yet.', ta: 'இன்னும் பதிவிறக்கப்படவில்லை.' },
  'settings.updateNow': { en: 'Update verses now', ta: 'வசனங்களை இப்போது புதுப்பி' },
  'settings.updating': { en: 'Updating…', ta: 'புதுப்பிக்கிறது…' },
  'settings.updated': { en: 'Verses updated', ta: 'வசனங்கள் புதுப்பிக்கப்பட்டன' },
  'settings.account': { en: 'Account', ta: 'கணக்கு' },
  'settings.loggedInAs': { en: 'Logged in as {name}.', ta: '{name} என்ற பெயரில் உள்நுழைந்துள்ளீர்கள்.' },
  'settings.logout': { en: 'Log out', ta: 'வெளியேறு' },
  'settings.logoutConfirm': { en: 'Log out of this phone?', ta: 'இந்த ஃபோனிலிருந்து வெளியேறவா?' },
  'mode.title': { en: 'App mode', ta: 'ஆப் பயன்முறை' },
  'mode.isMember': { en: 'This phone is in member mode.', ta: 'இந்த ஃபோன் உறுப்பினர் பயன்முறையில் உள்ளது.' },
  'mode.imAdmin': { en: "I'm the group admin", ta: 'நான் குழு நிர்வாகி' },
  'mode.password': { en: 'Admin password', ta: 'நிர்வாகி கடவுச்சொல்' },
  'mode.switch': { en: 'Switch to admin', ta: 'நிர்வாகியாக மாறு' },
  'about.nonCommercial': { en: 'For non-commercial use', ta: 'வணிக நோக்கமில்லாத பயன்பாட்டுக்கு மட்டும்' },

  // Notifications card
  'notif.title': { en: 'Notifications', ta: 'அறிவிப்புகள்' },
  'notif.allowed': { en: 'Allowed', ta: 'அனுமதி உண்டு' },
  'notif.blocked': { en: 'Blocked', ta: 'தடுக்கப்பட்டுள்ளது' },
  'notif.notAllowed': { en: 'Not allowed', ta: 'அனுமதி இல்லை' },
  'notif.allow': { en: 'Allow', ta: 'அனுமதி' },
  'notif.exact': { en: 'Exact time', ta: 'சரியான நேரம்' },
  'notif.onTime': { en: 'On time', ta: 'சரியான நேரத்தில்' },
  'notif.mayBeLate': { en: 'May be late', ta: 'தாமதமாகலாம்' },
  'notif.fix': { en: 'Fix', ta: 'சரிசெய்' },
  'notif.scheduled': { en: '{n} upcoming daily notifications are scheduled.', ta: 'அடுத்து வரும் {n} தினசரி அறிவிப்புகள் அமைக்கப்பட்டுள்ளன.' },
  'notif.blockedHelp': { en: 'Notifications are blocked. Open phone Settings → Apps → Powerful Weapon → Notifications and turn them on.', ta: 'அறிவிப்புகள் தடுக்கப்பட்டுள்ளன. ஃபோனின் Settings → Apps → Powerful Weapon → Notifications சென்று இயக்குங்கள்.' },
  'notif.test': { en: 'Send a test', ta: 'சோதனை அறிவிப்பு' },
  'notif.battery': { en: 'Battery tips', ta: 'பேட்டரி குறிப்புகள்' },
  'notif.testTitle': { en: 'Test notification', ta: 'சோதனை அறிவிப்பு' },
  'notif.testBody': { en: 'If you can see this, daily verses will arrive here.', ta: 'இது தெரிந்தால், தினசரி வசனங்கள் இங்கே வந்து சேரும்.' },
  'notif.testToast': { en: 'A test notification will arrive in 5 seconds — you can lock the phone.', ta: '5 விநாடிகளில் சோதனை அறிவிப்பு வரும் — ஃபோனைப் பூட்டி வைக்கலாம்.' },
  'notif.batteryIntro': { en: 'Some phones stop apps in the background to save battery, which delays the daily verse. Allow Powerful Weapon to run:', ta: 'சில ஃபோன்கள் பேட்டரியைச் சேமிக்கப் பின்னணியில் ஆப்களை நிறுத்திவிடும்; அதனால் தினசரி வசனம் தாமதமாகலாம். Powerful Weapon இயங்க அனுமதியுங்கள்:' },
  'notif.batteryAfter': { en: 'Then tap “Send a test” and lock the phone to check.', ta: 'பிறகு “சோதனை அறிவிப்பு” என்பதைத் தொட்டு, ஃபோனைப் பூட்டிச் சரிபாருங்கள்.' },
  'notif.tapToRead': { en: "Tap to read today's verse.", ta: 'இன்றைய வசனத்தைப் படிக்கத் தொடுங்கள்.' },

  // Welcome / login
  'welcome.tagline': { en: "Study the week's verses, get them every morning, and send your recitation from the app.", ta: 'வார வசனங்களைப் படியுங்கள், தினமும் காலையில் பெறுங்கள், ஆப்பிலேயே ஒப்புவித்து அனுப்புங்கள்.' },
  'welcome.member': { en: "I'm a group member", ta: 'நான் குழு உறுப்பினர்' },
  'welcome.admin': { en: "I'm the group admin", ta: 'நான் குழு நிர்வாகி' },
  'welcome.who': { en: 'Who are you?', ta: 'நீங்கள் யார்?' },
  'welcome.search': { en: 'Search your name', ta: 'உங்கள் பெயரைத் தேடுங்கள்' },
  'welcome.loadingNames': { en: 'Loading names…', ta: 'பெயர்களை ஏற்றுகிறது…' },
  'welcome.noMembers': { en: 'No members yet — ask your admin to add you.', ta: 'இன்னும் உறுப்பினர்கள் இல்லை — உங்களைச் சேர்க்கும்படி நிர்வாகியிடம் கேளுங்கள்.' },
  'welcome.pin': { en: 'Enter your PIN', ta: 'உங்கள் PIN-ஐ உள்ளிடுங்கள்' },
  'welcome.hello': { en: 'Hello', ta: 'வணக்கம்' },
  'welcome.pinFrom': { en: 'Your 4-digit PIN comes from your group admin.', ta: '4 இலக்க PIN-ஐ உங்கள் குழு நிர்வாகி தருவார்.' },
  'err.wrongPin': { en: 'Wrong PIN', ta: 'தவறான PIN' },
  'err.locked': { en: 'Too many wrong PINs. Try again in 15 minutes.', ta: 'பலமுறை தவறான PIN. 15 நிமிடம் கழித்து முயற்சி செய்யுங்கள்.' },
  'err.offline': { en: 'Could not reach the server. Check your internet.', ta: 'சர்வரை அணுக முடியவில்லை. இணைய இணைப்பைச் சரிபாருங்கள்.' },
});

export type StringKey = keyof typeof STRINGS;
export type Lang = 'en' | 'ta';

/** Translate a member-screen string. `{name}` placeholders are filled from `vars`. */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  let s: string = (lang === 'ta' ? entry.ta : entry.en) ?? entry.en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

const DAY_TA = ['திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி', 'ஞாயிறு'];
const DAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day name for slot 1..7 (Monday..Sunday). */
export function dayName(slot: number, lang: 'en' | 'ta'): string {
  return (lang === 'ta' ? DAY_TA : DAY_EN)[(slot - 1 + 7) % 7];
}

/** "Mon, 26 Oct" / "திங்கள், 26 அக்." from an ISO date. */
export function dateLabel(iso: string, lang: 'en' | 'ta'): string {
  const d = new Date(`${iso}T00:00:00`);
  if (lang === 'en') return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const slot = d.getDay() || 7;
  return `${DAY_TA[slot - 1]}, ${d.toLocaleDateString('ta-IN', { day: 'numeric', month: 'short' })}`;
}

/** Date + time, e.g. for the recording window. */
export function whenLabel(ms: number, lang: 'en' | 'ta'): string {
  const d = new Date(ms);
  if (lang === 'en') return d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const slot = d.getDay() || 7;
  return `${DAY_TA[slot - 1]}, ${d.toLocaleDateString('ta-IN', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
