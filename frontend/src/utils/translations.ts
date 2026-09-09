export type SupportedLanguage = 'mr' | 'hi' | 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  { code: 'en', label: 'English', nativeName: 'English', flag: '🌐' },
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  mr: {
    // Navigation & General
    app_title: 'स्वास्थ्यसेतू AI',
    active_node: 'सक्रिय नोड',
    verified_node: 'सत्यापित नोड',
    secure_terminate: 'सुरक्षित बाहेर पडा',
    language_select: 'भाषा निवडा',
    preferred_lang: 'प्राधान्य भाषा',

    // Assistant Header & States
    assistant_title: 'स्वास्थ्यसेतू बहुभाषिक सहाय्यक',
    assistant_status: 'AI न्यूरल लिंक सक्रिय',
    assistant_welcome: 'नमस्कार! मी आपला स्वास्थ्यसेतू AI आरोग्य सहाय्यक आहे. आपण मला मराठीत बोलून किंवा टाईप करून प्रश्न विचारू शकता.',
    listening_state: 'तुमचा आवाज ऐकत आहे... (Listening)',
    speaking_state: 'AI उत्तर वाचून दाखवत आहे...',
    processing_state: 'माहिती तपासत आहे...',
    type_placeholder: 'आरोग्य विषयक प्रश्न विचारा किंवा बोला...',
    speak_btn_tooltip: 'माईक चालू करा आणि मराठीत बोला',
    stop_speak_tooltip: 'बोलणे थांबवा',
    cancel: 'रद्द करा',
    send: 'पाठवा',
    clear_chat: 'संभाषण साफ करा',

    // Explain Simply
    explain_simply_title: 'सोप्या भाषेत समजा (Explain Simply)',
    explain_simply_btn: 'सोप्या भाषेत समजा',
    explain_simply_placeholder: 'डॉक्टरांच्या सूचना, प्रिस्क्रिप्शन किंवा अहवाल येथे पेस्ट करा...',
    explain_simply_desc: 'डॉक्टरांच्या वैद्यकीय सूचना रुग्णाला सहज समजेल अशा साध्या मराठीत रूपांतरित करा. औषधाचे नाव, डोस आणि तारीख तंतोतंत ठेवली जाते.',
    explain_action_steps: 'तुम्हाला काय करावे लागेल:',
    explain_preserved: 'महत्त्वाचे वैद्यकीय तपशील (बदललेले नाहीत):',
    explain_warning: 'तातडीची मदत कधी घ्यावी:',

    // Healthcare Data Cards
    vaccination_card_title: 'लसीकरण नोंदी (Vaccination Records)',
    followup_card_title: 'फॉलो-अप आणि अपॉइंटमेंट्स (Follow-Up Care Plan)',
    medicine_card_title: 'औषध साठा उपलब्धता (Medicine Inventory)',
    diagnostic_card_title: 'निदान चाचण्या (Diagnostic Services)',
    emergency_card_title: 'आपत्कालीन माहिती व मदत (Emergency Guidance)',
    facility_card_title: 'रुग्णालय व आरोग्य केंद्र डिरेक्टरी (Healthcare Facilities)',

    // Actions
    open_module: 'सविस्तर पहा',
    open_map: 'थेट मॅप आणि डिरेक्टरी पहा',
    listen_audio: 'ऐका (Listen)',
    stop_audio: 'थांबवा (Stop)',
    copied: 'कॉपी झाले',
    copy: 'कॉपी करा',

    // Quick Prompts
    prompt_vaccine: 'माझी कोणती लस बाकी आहे?',
    prompt_medicine: 'पॅरासिटामॉल गोळी कुठे मिळेल?',
    prompt_followup: 'माझा पुढील फॉलो-अप कधी आहे?',
    prompt_hospital: 'जवळचे शासकीय रुग्णालय / PHC शोधा',
    prompt_emergency: 'आपत्कालीन मदत आणि रुग्णवाहिका',
    prompt_explain: 'वैद्यकीय चिठ्ठी सोप्या भाषेत समजावा',

    // Fallbacks & Alerts
    mic_permission_denied: 'मायक्रोफोन परवानगी नाकारली आहे. कृपया ब्राउझरमध्ये मायक्रोफोन चालू करा किंवा खाली टाईप करा.',
    mic_not_supported: 'तुमच्या ब्राउझरमध्ये स्पीच रेकग्निशन उपलब्ध नाही. ऑडिओ रेकॉर्ड करून पाठवले जाईल.',
    no_records_found: 'डेटाबेसमध्ये कोणतीही जुळणारी नोंद सापडली नाही.',
    safety_disclaimer: 'सूचना: स्वास्थ्यसेतू AI हे केवळ आरोग्य मार्गदर्शन आणि माहितीसाठी आहे. कोणत्याही आपत्कालीन परिस्थितीत लगेच १०८ वर संपर्क साधा किंवा डॉक्टरांचा सल्ला घ्या.',

    // Voice State Labels
    voice_state_transcribing: 'ऑडिओ लिखित करत आहे...',
    voice_state_ready: 'बोलण्यासाठी तयार',
    voice_state_error: 'आवाज ओळखता आला नाही',
    voice_tap_to_speak: 'बोलण्यासाठी दाबा',
    voice_release_to_send: 'थांबवण्यासाठी पुन्हा दाबा',
    voice_lang_detected: 'भाषा आढळली',
    voice_lang_switch_prompt: 'बोलण्याची भाषा आढळली:',
    voice_lang_switch_yes: 'भाषा बदला',
    voice_lang_switch_no: 'ठेवा',

    // Voice Flow Step Indicator
    voice_flow_ask: '🎤 विचारा',
    voice_flow_transcribe: '📝 लिखित',
    voice_flow_process: '🧠 AI उत्तर',
    voice_flow_listen: '🔊 ऐका',
    voice_review_badge: 'आवाज आढळला — तपासा आणि पाठवा',
    voice_review_or_edit: 'खाली पाहा, संपादित करा किंवा पाठवा',
    voice_dictate_tooltip: 'वैद्यकीय मजकूर सांगण्यासाठी दाबा',
    mic_not_available: 'मायक्रोफोन उपलब्ध नाही. कृपया खाली टाईप करा.',
    voice_demo_title: 'आवाजाने विचारा',
    voice_demo_subtitle: 'बोला, ऐका — आरोग्य माहिती मराठीत',

    // ASHA/ANM Field Note Mode
    asha_mode_tab: 'क्षेत्र नोंद',
    asha_mode_title: 'ASHA/ANM क्षेत्र नोंद',
    asha_mode_desc: 'रुग्णाच्या निरीक्षणांचे बोला किंवा टाईप करा — AI संरचित नोंद तयार करेल. तुम्ही तपासून पुष्टी केल्यावरच ती वापरता येईल.',
    asha_mode_placeholder: 'उदा: रुग्णाचे नाव राधा, वय ३२, ताप १०१ डिग्री, डोकेदुखी, उलटी, बीपी सामान्य...',
    asha_structure_btn: 'नोंद संरचित करा',
    asha_structuring: 'नोंद तयार होत आहे...',
    asha_confirm_title: 'AI-संरचित नोंद तपासा',
    asha_confirm_desc: 'ही नोंद AI ने बोललेल्या माहितीवरून तयार केली आहे. कृपया तपासून पुष्टी करा.',
    asha_confirm_save: 'नोंद पुष्टी करा',
    asha_confirm_edit: 'संपादित करा',
    asha_confirm_cancel: 'रद्द करा',
    asha_confirmed_label: 'नोंद पुष्टी झाली',
    asha_disclaimer: 'AI-संरचित नोंद: केवळ क्षेत्र कार्यकर्त्याच्या पुष्टीनंतर वापरा. हे वैद्यकीय निदान नाही.',
    asha_urgency_emergency: 'तातडी — तातडीने डॉक्टरांकडे पाठवा',
    asha_urgency_urgent: 'जरुरी — लवकर तपासणी आवश्यक',
    asha_urgency_routine: 'नियमित — PHC भेटीत समाविष्ट करा',
  },

  hi: {
    // Navigation & General
    app_title: 'स्वास्थ्यसेतु AI',
    active_node: 'सक्रिय नोड',
    verified_node: 'सत्यापित नोड',
    secure_terminate: 'सुरक्षित बाहर निकलें',
    language_select: 'भाषा चुनें',
    preferred_lang: 'प्राथमिक भाषा',

    // Assistant Header & States
    assistant_title: 'स्वास्थ्यसेतु बहुभाषी सहायक',
    assistant_status: 'AI न्यूरल लिंक सक्रिय',
    assistant_welcome: 'नमस्ते! मैं आपका स्वास्थ्यसेतु AI स्वास्थ्य सहायक हूँ। आप मुझसे हिंदी में बोलकर या लिखकर प्रश्न पूछ सकते हैं।',
    listening_state: 'आपकी आवाज़ सुन रहा हूँ... (Listening)',
    speaking_state: 'AI उत्तर पढ़ रहा है...',
    processing_state: 'डेटाबेस में जानकारी खोजी जा रही है...',
    type_placeholder: 'स्वास्थ्य प्रश्न पूछें या बोलें...',
    speak_btn_tooltip: 'माइक चालू करें और हिंदी में बोलें',
    stop_speak_tooltip: 'बोलना समाप्त करें',
    cancel: 'रद्द करें',
    send: 'भेजें',
    clear_chat: 'चैट साफ़ करें',

    // Explain Simply
    explain_simply_title: 'सरल भाषा में समझें (Explain Simply)',
    explain_simply_btn: 'सरल भाषा में समझें',
    explain_simply_placeholder: 'डॉक्टर के निर्देश, पर्चा या रिपोर्ट यहाँ पेस्ट करें...',
    explain_simply_desc: 'डॉक्टर के निर्देशों को सरल और स्पष्ट भाषा में समझें। दवा का नाम, खुराक और तारीख अपरिवर्तित रहती है।',
    explain_action_steps: 'आपको क्या करना होगा:',
    explain_preserved: 'महत्वपूर्ण चिकित्सा विवरण (अपरिवर्तित):',
    explain_warning: 'तत्काल सहायता कब लें:',

    // Healthcare Data Cards
    vaccination_card_title: 'टीकाकरण विवरण (Vaccination Records)',
    followup_card_title: 'फॉलो-अप और अपॉइंटमेंट्स (Care Plan)',
    medicine_card_title: 'दवा उपलब्धता (Medicine Inventory)',
    diagnostic_card_title: 'निदान सेवाएं (Diagnostic Services)',
    emergency_card_title: 'आपातकालीन सहायता (Emergency Guidance)',
    facility_card_title: 'अस्पताल और स्वास्थ्य केंद्र (Healthcare Facilities)',

    // Actions
    open_module: 'विस्तार से देखें',
    open_map: 'लाइव मैप और सूची देखें',
    listen_audio: 'सुनें (Listen)',
    stop_audio: 'रोकें (Stop)',
    copied: 'कॉपी किया गया',
    copy: 'कॉपी करें',

    // Quick Prompts
    prompt_vaccine: 'मेरा कौन सा टीका बाकी है?',
    prompt_medicine: 'पैरासिटामोल दवा कहाँ उपलब्ध है?',
    prompt_followup: 'मेरा अगला फॉलो-अप कब है?',
    prompt_hospital: 'नजदीकी सरकारी अस्पताल या PHC खोजें',
    prompt_emergency: 'आपातकालीन सहायता और एम्बुलेंस',
    prompt_explain: 'डॉक्टर की पर्ची सरल भाषा में समझाएं',

    // Fallbacks & Alerts
    mic_permission_denied: 'माइक्रोफ़ोन अनुमति नहीं मिली। कृपया ब्राउज़र में अनुमति दें या नीचे टाइप करें।',
    mic_not_supported: 'ब्राउज़र में स्पीच रिकग्निशन उपलब्ध नहीं है। ऑडियो रिकॉर्ड करके भेजा जाएगा।',
    no_records_found: 'डेटाबेस में कोई रिकॉर्ड नहीं मिला।',
    safety_disclaimer: 'सूचना: स्वास्थ्यसेतु AI केवल स्वास्थ्य मार्गदर्शन और शिक्षा के लिए है। आपातकाल में तुरंत 108 पर कॉल करें या डॉक्टर से संपर्क करें।',

    // Voice State Labels
    voice_state_transcribing: 'ऑडियो लिखित हो रहा है...',
    voice_state_ready: 'बोलने के लिए तैयार',
    voice_state_error: 'आवाज़ पहचानी नहीं गई',
    voice_tap_to_speak: 'बोलने के लिए दबाएं',
    voice_release_to_send: 'रोकने के लिए फिर दबाएं',
    voice_lang_detected: 'भाषा पहचानी गई',
    voice_lang_switch_prompt: 'बोलने की भाषा पहचानी गई:',
    voice_lang_switch_yes: 'भाषा बदलें',
    voice_lang_switch_no: 'रखें',

    // Voice Flow Step Indicator
    voice_flow_ask: '🎤 पूछें',
    voice_flow_transcribe: '📝 लिखित',
    voice_flow_process: '🧠 AI उत्तर',
    voice_flow_listen: '🔊 सुनें',
    voice_review_badge: 'आवाज़ मिली — जांचें और भेजें',
    voice_review_or_edit: 'नीचे देखें, संपादित करें या भेजें',
    voice_dictate_tooltip: 'चिकित्सा पाठ बोलने के लिए दबाएं',
    mic_not_available: 'माइक्रोफ़ोन उपलब्ध नहीं है। कृपया नीचे टाइप करें।',
    voice_demo_title: 'आवाज़ से पूछें',
    voice_demo_subtitle: 'बोलें, सुनें — स्वास्थ्य जानकारी हिंदी में',

    // ASHA/ANM Field Note Mode
    asha_mode_tab: 'फील्ड नोट',
    asha_mode_title: 'ASHA/ANM फील्ड नोट',
    asha_mode_desc: 'रोगी की जानकारी बोलें या टाइप करें — AI संरचित नोट बनाएगा। आपकी पुष्टि के बाद ही उपयोग होगा।',
    asha_mode_placeholder: 'उदा: रोगी का नाम राधा, आयु 32, बुखार 101, सिरदर्द, उल्टी, BP सामान्य...',
    asha_structure_btn: 'नोट संरचित करें',
    asha_structuring: 'नोट बन रहा है...',
    asha_confirm_title: 'AI-संरचित नोट जांचें',
    asha_confirm_desc: 'यह नोट AI ने बोली गई जानकारी से बनाया है। कृपया जांचकर पुष्टि करें।',
    asha_confirm_save: 'नोट पुष्टि करें',
    asha_confirm_edit: 'संपादित करें',
    asha_confirm_cancel: 'रद्द करें',
    asha_confirmed_label: 'नोट पुष्टि हो गई',
    asha_disclaimer: 'AI-संरचित नोट: केवल कार्यकर्ता की पुष्टि के बाद उपयोग करें। यह चिकित्सीय निदान नहीं है।',
    asha_urgency_emergency: 'आपातकाल — तुरंत डॉक्टर को भेजें',
    asha_urgency_urgent: 'जरूरी — जल्द जांच आवश्यक',
    asha_urgency_routine: 'सामान्य — PHC दौरे में शामिल करें',
  },

  en: {
    // Navigation & General
    app_title: 'SwasthyaSetu AI',
    active_node: 'Active Node',
    verified_node: 'Verified Node',
    secure_terminate: 'Secure Terminate',
    language_select: 'Select Language',
    preferred_lang: 'Preferred Language',

    // Assistant Header & States
    assistant_title: 'Multilingual Health Assistant',
    assistant_status: 'AI Neural Node Active',
    assistant_welcome: 'Welcome to SwasthyaSetu AI Health Assistant. Ask questions by typing or speaking in Marathi, Hindi, or English.',
    listening_state: 'Listening to your voice...',
    speaking_state: 'AI reading response aloud...',
    processing_state: 'Retrieving verified healthcare records...',
    type_placeholder: 'Type or speak healthcare query...',
    speak_btn_tooltip: 'Click mic and speak your question',
    stop_speak_tooltip: 'Stop listening',
    cancel: 'Cancel',
    send: 'Send',
    clear_chat: 'Clear Chat',

    // Explain Simply
    explain_simply_title: 'Explain Simply',
    explain_simply_btn: 'Explain Simply',
    explain_simply_placeholder: 'Paste doctor prescription or instructions here...',
    explain_simply_desc: 'Convert complex doctor instructions into simple, patient-friendly guidance while preserving exact drug names and doses.',
    explain_action_steps: 'What you need to do:',
    explain_preserved: 'Preserved Critical Details (Unchanged):',
    explain_warning: 'When to seek emergency care:',

    // Healthcare Data Cards
    vaccination_card_title: 'Vaccination Tracking Records',
    followup_card_title: 'Follow-Up & Care Plan',
    medicine_card_title: 'Medicine Inventory Availability',
    diagnostic_card_title: 'Diagnostic Services',
    emergency_card_title: 'Emergency Profile & Fleet',
    facility_card_title: 'Healthcare Facilities & Bed Availability',

    // Actions
    open_module: 'View Module',
    open_map: 'View Live Map & Directory',
    listen_audio: 'Listen (Audio)',
    stop_audio: 'Stop Audio',
    copied: 'Copied',
    copy: 'Copy',

    // Quick Prompts
    prompt_vaccine: 'Which vaccine is pending for me?',
    prompt_medicine: 'Is Paracetamol available in hospital?',
    prompt_followup: 'When is my next follow-up appointment?',
    prompt_hospital: 'Find nearest civil hospital or PHC',
    prompt_emergency: 'Show emergency profile & ambulance',
    prompt_explain: 'Explain doctor note in simple terms',

    // Fallbacks & Alerts
    mic_permission_denied: 'Microphone permission was denied. Please allow microphone access or type your query below.',
    mic_not_supported: 'Speech recognition is not natively supported in this browser. Audio recording fallback is active.',
    no_records_found: 'No matching records found in the verified database.',
    safety_disclaimer: 'Notice: SwasthyaSetu AI provides guidance only and does not replace professional medical diagnosis. For life-threatening emergencies, dial 108 immediately.',

    // Voice State Labels
    voice_state_transcribing: 'Transcribing audio...',
    voice_state_ready: 'Ready to listen',
    voice_state_error: 'Voice not recognized',
    voice_tap_to_speak: 'Tap to speak',
    voice_release_to_send: 'Tap again to stop',
    voice_lang_detected: 'Language detected',
    voice_lang_switch_prompt: 'Spoken language detected:',
    voice_lang_switch_yes: 'Switch language',
    voice_lang_switch_no: 'Keep current',

    // Voice Flow Step Indicator
    voice_flow_ask: '🎤 Ask',
    voice_flow_transcribe: '📝 Transcribe',
    voice_flow_process: '🧠 AI Response',
    voice_flow_listen: '🔊 Listen',
    voice_review_badge: 'Voice detected — review & send',
    voice_review_or_edit: 'Review below, edit if needed, then send',
    voice_dictate_tooltip: 'Tap to dictate medical text',
    mic_not_available: 'Microphone not available. Please type below.',
    voice_demo_title: 'Ask by Voice',
    voice_demo_subtitle: 'Speak, listen — healthcare info in your language',

    // ASHA/ANM Field Note Mode
    asha_mode_tab: 'Field Note',
    asha_mode_title: 'ASHA/ANM Field Note',
    asha_mode_desc: 'Speak or type field observations — AI will structure them into a note. You MUST review and confirm before any use.',
    asha_mode_placeholder: 'e.g. Patient name Radha, age 32, fever 101°F, headache, vomiting, BP normal...',
    asha_structure_btn: 'Structure Note',
    asha_structuring: 'Structuring note...',
    asha_confirm_title: 'Review AI-Structured Note',
    asha_confirm_desc: 'This note was AI-structured from spoken observations. Please review carefully before confirming.',
    asha_confirm_save: 'Confirm Note',
    asha_confirm_edit: 'Edit',
    asha_confirm_cancel: 'Cancel',
    asha_confirmed_label: 'Note Confirmed',
    asha_disclaimer: 'AI-structured note: Use only after worker confirmation. This is NOT a medical diagnosis.',
    asha_urgency_emergency: 'EMERGENCY — Refer to doctor immediately',
    asha_urgency_urgent: 'URGENT — Examination needed soon',
    asha_urgency_routine: 'ROUTINE — Include in next PHC visit',
  }
};

export const getTranslation = (lang: SupportedLanguage, key: string): string => {
  return translations[lang]?.[key] || translations.mr?.[key] || translations.en?.[key] || key;
};
