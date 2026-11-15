export type SupportedLang = 'en' | 'hi' | 'mr';

export const TRANSLATIONS: Record<
  SupportedLang,
  {
    brand: string;
    tagline: string;
    nav: {
      home: string;
      assistant: string;
      scamShield: string;
      ocrReader: string;
      wellness: string;
      academy: string;
      research: string;
      reminders: string;
      family: string;
      autonomy: string;
      emergency: string;
      backup: string;
      caregiver: string;
      admin: string;
      settings: string;
      signOut: string;
    };
    common: {
      loading: string;
      retry: string;
      save: string;
      cancel: string;
      delete: string;
      speak: string;
      stopSpeaking: string;
      listenMic: string;
      textSize: string;
      themeToggle: string;
      language: string;
    };
    home: {
      greeting: string;
      subtitle: string;
      ctaAssistant: string;
      ctaScam: string;
      ctaEmergency: string;
    };
  }
> = {
  en: {
    brand: 'Buddy Elder AI',
    tagline: 'Your Trusted Digital Companion',
    nav: {
      home: 'Home',
      assistant: 'AI Buddy',
      scamShield: 'Scam Shield',
      ocrReader: 'Audio & OCR Reader',
      wellness: 'Wellness Center',
      academy: 'Learning Academy',
      research: 'Research Hub',
      reminders: 'Smart Reminders',
      family: 'Family Hub',
      autonomy: 'Autonomy Engine',
      emergency: 'Emergency SOS',
      backup: 'Encrypted Backup',
      caregiver: 'Caregiver View',
      admin: 'Admin Console',
      settings: 'Settings',
      signOut: 'Sign Out',
    },
    common: {
      loading: 'Loading...',
      retry: 'Try Again',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      speak: 'Read Aloud',
      stopSpeaking: 'Stop Reading',
      listenMic: 'Speak Now',
      textSize: 'Text Size',
      themeToggle: 'Theme',
      language: 'Language',
    },
    home: {
      greeting: 'Good day. How can Buddy help you today?',
      subtitle: 'Simple, safe, and respectful digital assistance designed around your independence.',
      ctaAssistant: 'Ask AI Buddy',
      ctaScam: 'Check a Suspicious Message',
      ctaEmergency: 'Emergency Assistance',
    },
  },
  hi: {
    brand: 'Buddy Elder AI',
    tagline: 'आपका विश्वसनीय डिजिटल साथी',
    nav: {
      home: 'मुख्य पृष्ठ',
      assistant: 'एआई साथी',
      scamShield: 'स्कैम सुरक्षा',
      ocrReader: 'ऑडियो व पाठक',
      wellness: 'स्वास्थ्य केंद्र',
      academy: 'डिजिटल अकादमी',
      research: 'शोध पुस्तकालय',
      reminders: 'स्मार्ट रिमाइंडर',
      family: 'परिवार केंद्र',
      autonomy: 'सहमति व नियंत्रण',
      emergency: 'आपातकालीन सहायता',
      backup: 'सुरक्षित बैकअप',
      caregiver: 'देखभालकर्ता दृश्य',
      admin: 'प्रशासक पैनल',
      settings: 'सेटिंग्स',
      signOut: 'लॉग आउट',
    },
    common: {
      loading: 'लोड हो रहा है...',
      retry: 'पुनः प्रयास करें',
      save: 'सहेजें',
      cancel: 'रद्द करें',
      delete: 'हटाएं',
      speak: 'सुनें',
      stopSpeaking: 'पढ़ना रोकें',
      listenMic: 'बोलकर लिखें',
      textSize: 'अक्षर आकार',
      themeToggle: 'थीम',
      language: 'भाषा',
    },
    home: {
      greeting: 'नमस्ते। आज आपका डिजिटल साथी आपकी क्या मदद कर सकता है?',
      subtitle: 'आपकी स्वतंत्रता और सुरक्षा को ध्यान में रखकर बनाया गया सरल, सुरक्षित सहयोग।',
      ctaAssistant: 'एआई साथी से पूछें',
      ctaScam: 'संदिग्ध संदेश जांचें',
      ctaEmergency: 'आपातकालीन मदद',
    },
  },
  mr: {
    brand: 'Buddy Elder AI',
    tagline: 'तुमचा विश्वासू डिजिटल सोबती',
    nav: {
      home: 'मुख्य पान',
      assistant: 'एआय सोबती',
      scamShield: 'फसवणूक सुरक्षा',
      ocrReader: 'ऑडिओ व वाचक',
      wellness: 'आरोग्य केंद्र',
      academy: 'डिजिटल अकादमी',
      research: 'संशोधन केंद्र',
      reminders: 'स्मार्ट स्मरणपत्र',
      family: 'कुटुंब केंद्र',
      autonomy: 'संमती व नियंत्रण',
      emergency: 'तातडीची मदत',
      backup: 'सुरक्षित बॅकअप',
      caregiver: 'काळजीवाहू डॅशबोर्ड',
      admin: 'प्रशासक पॅनेल',
      settings: 'सेटिंग्ज',
      signOut: 'बाहेर पडा',
    },
    common: {
      loading: 'लोड होत आहे...',
      retry: 'पुन्हा प्रयत्न करा',
      save: 'जतन करा',
      cancel: 'रद्द करा',
      delete: 'काढून टाका',
      speak: 'वाचून दाखवा',
      stopSpeaking: 'वाचन थांबवा',
      listenMic: 'बोलून लिहा',
      textSize: 'अक्षरांचा आकार',
      themeToggle: 'रंग थीम',
      language: 'भाषा',
    },
    home: {
      greeting: 'नमस्कार. आज तुमचा डिजिटल सोबती तुम्हाला कशी मदत करू शकतो?',
      subtitle: 'तुमच्या स्वातंत्र्याचा आणि सुरक्षिततेचा पूर्ण आदर करणारी सोपी डिजिटल मदत.',
      ctaAssistant: 'एआय सोबत्याला विचारा',
      ctaScam: 'संशयास्पद संदेश तपासा',
      ctaEmergency: 'तातडीची मदत',
    },
  },
};
