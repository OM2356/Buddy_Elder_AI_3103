import type Database from 'better-sqlite3';
import { seedResearchChunksIfNeeded } from '../services/researchRag.ts';

interface SeedCourse {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate';
  description: string;
  estimatedMinutes: number;
  lessons: {
    id: string;
    title: string;
    summary: string;
    steps: string[];
    audioScript: string;
    practicePrompt: string;
  }[];
  quizzes: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export const SEED_COURSES: SeedCourse[] = [
  {
    id: 'course_smartphone_basics',
    slug: 'smartphone-basics',
    title: 'Smartphone Basics & Touch Gestures',
    category: 'Foundations',
    difficulty: 'Beginner',
    description: 'Learn how to unlock your phone, adjust text size and brightness, use Wi-Fi safely, and make clear calls.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_sb_1',
        title: 'Understanding Taps, Swipes, and Volume Buttons',
        summary: 'Master gentle single taps, scrolling up and down, and adjusting ringtone and call volume.',
        steps: [
          'Press the side power button once to wake up the screen.',
          'Tap gently with the flat pad of your finger — never press hard.',
          'Swipe upward from the bottom to see your apps.',
          'Use the volume buttons on the side to raise or lower sound.',
        ],
        audioScript: 'Welcome to Smartphone Basics. To wake your phone, press the side button once. Tap lightly with the pad of your finger rather than your fingernail.',
        practicePrompt: 'Try tapping the Phone icon in our Virtual Smartphone Simulator.',
      },
      {
        id: 'lesson_sb_2',
        title: 'Connecting to Home Wi-Fi & Increasing Font Size',
        summary: 'Save mobile data at home and make every message larger and easier to read.',
        steps: [
          'Open the Settings app (the gear icon).',
          'Tap Network & Internet or Wi-Fi and turn the switch ON.',
          'Choose your home Wi-Fi name and enter the password carefully.',
          'Go to Display -> Font Size and slide it right for larger text.',
        ],
        audioScript: 'Open Settings with the gear icon. Choose Wi-Fi to connect at home, and visit Display to make text larger and more comfortable for your eyes.',
        practicePrompt: 'Open Settings inside the simulator and check Wi-Fi status.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_sb_1',
        question: 'Which icon usually opens your phone Settings to change font size or Wi-Fi?',
        options: ['A camera icon', 'A gear or cogwheel icon', 'A shopping cart icon', 'A trash bin icon'],
        correctIndex: 1,
        explanation: 'The gear icon always leads to Settings where you can adjust text size, brightness, and Wi-Fi.',
      },
    ],
  },
  {
    id: 'course_whatsapp',
    slug: 'whatsapp-essentials',
    title: 'WhatsApp Messages, Voice Notes & Photos',
    category: 'Communication',
    difficulty: 'Beginner',
    description: 'Send text messages, record voice notes when typing feels tiring, share family photos, and block unknown spammers.',
    estimatedMinutes: 18,
    lessons: [
      {
        id: 'lesson_wa_1',
        title: 'Reading Chats & Sending Voice Messages',
        summary: 'Hold the microphone icon to speak your message instead of typing small letters.',
        steps: [
          'Open WhatsApp (green phone-in-bubble icon).',
          'Tap a family member name to open the chat.',
          'Hold down the green microphone button at the bottom right and speak clearly.',
          'Release the button to send your voice message.',
        ],
        audioScript: 'On WhatsApp, you do not have to type every word. Press and hold the green microphone icon, speak naturally, and release to send.',
        practicePrompt: 'Try opening WhatsApp in the Virtual Phone Simulator and tapping Send Voice Note.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_wa_1',
        question: 'If an unknown number sends a prize link on WhatsApp, what is the safest step?',
        options: ['Forward it to 5 friends', 'Click the link immediately', 'Do not tap the link; block and report the sender', 'Send your bank PIN to verify'],
        correctIndex: 2,
        explanation: 'Never tap links from unknown senders. Blocking and reporting protects you and your contacts.',
      },
    ],
  },
  {
    id: 'course_video_calling',
    slug: 'video-calling',
    title: 'Crystal-Clear Family Video Calling',
    category: 'Communication',
    difficulty: 'Beginner',
    description: 'Start one-tap video calls, position your camera comfortably, mute/unmute, and switch between front and back cameras.',
    estimatedMinutes: 12,
    lessons: [
      {
        id: 'lesson_vc_1',
        title: 'Starting & Controlling a Video Call',
        summary: 'Learn what the camera, microphone, and red hang-up buttons mean during a call.',
        steps: [
          'Sit facing a window or lamp so your family can see your face clearly.',
          'Tap the Video Camera icon next to your family member name.',
          'Tap the microphone icon if you need to mute background noise.',
          'Tap the red phone button when you want to end the call.',
        ],
        audioScript: 'Sit facing soft light so your family sees you clearly. Tap the video camera icon to start, and tap the red phone button whenever you are ready to end.',
        practicePrompt: 'Practice starting and ending a safe simulated video call.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_vc_1',
        question: 'Where should light come from for the clearest video call?',
        options: ['From behind your back', 'Facing your face from a window or lamp in front of you', 'In complete darkness', 'Directly under your chin'],
        correctIndex: 1,
        explanation: 'Light in front of you illuminates your face clearly instead of creating a dark shadow.',
      },
    ],
  },
  {
    id: 'course_email',
    slug: 'email-basics',
    title: 'Email Made Simple',
    category: 'Communication',
    difficulty: 'Beginner',
    description: 'Read emails comfortably, reply safely, open trusted attachments, and spot suspicious sender addresses.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_em_1',
        title: 'Reading, Replying & Checking the Sender Address',
        summary: 'Always look at the full email address after the @ sign before trusting urgent emails.',
        steps: [
          'Open your Email app (Gmail or Mail).',
          'Tap an email subject line to read the full message.',
          'Tap the sender name at the top to inspect the actual email address.',
          'Use Reply to respond only to people you know.',
        ],
        audioScript: 'Before trusting an urgent email, tap the sender name to see the real address after the @ symbol. Scammers often disguise names.',
        practicePrompt: 'Inspect an email sender inside the practice panel.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_em_1',
        question: 'An email says "Your Bank" but the sender address is support@prize-win-123.xyz. What should you do?',
        options: ['Reply with your account number', 'Delete or mark as spam without clicking links', 'Download the attached file', 'Call the number inside the email'],
        correctIndex: 1,
        explanation: 'Real banks use their official domain, not random prize websites.',
      },
    ],
  },
  {
    id: 'course_internet_browsing',
    slug: 'internet-browsing',
    title: 'Safe Internet Browsing & Searching',
    category: 'Internet',
    difficulty: 'Beginner',
    description: 'Use Google Search clearly, close unwanted pop-up tabs, check the website address bar, and bookmark favorite pages.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_ib_1',
        title: 'Searching Safely & Reading Website Addresses',
        summary: 'Check for the exact official domain name and avoid fake "Your phone has a virus!" pop-ups.',
        steps: [
          'Open Chrome or Safari and tap the search bar.',
          'Type simple everyday words like "weather in Pune today".',
          'Look closely at the top address bar before entering any details.',
          'If a loud pop-up says your phone is infected, simply close that browser tab.',
        ],
        audioScript: 'Websites cannot scan your phone for viruses. If a pop-up tells you your phone has a virus and asks you to call a number, close the tab right away.',
        practicePrompt: 'Practice closing a fake pop-up tab safely.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_ib_1',
        question: 'A flashing webpage says "Your device has 5 viruses! Call helpline now." What is it?',
        options: ['A real government warning', 'A scareware scam pop-up — close the tab', 'A free antivirus gift', 'A bank alert'],
        correctIndex: 1,
        explanation: 'Genuine browsers never flash virus warnings asking you to call a random phone number.',
      },
    ],
  },
  {
    id: 'course_google_maps',
    slug: 'google-maps',
    title: 'Finding Places & Directions with Google Maps',
    category: 'Daily Utility',
    difficulty: 'Beginner',
    description: 'Search nearby clinics, pharmacies, or parks, check opening hours, and read step-by-step directions.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_gm_1',
        title: 'Searching Nearby & Checking Hours',
        summary: 'Find trusted places near you and confirm whether they are open before travelling.',
        steps: [
          'Open Google Maps (pin icon).',
          'Tap the top search box and type "pharmacy near me" or a clinic name.',
          'Check the Open/Closed hours and tap Directions.',
          'Choose walking, car, or transit icon to see the route.',
        ],
        audioScript: 'With Google Maps, you can check whether a clinic or pharmacy is open before leaving home, and view clear step-by-step directions.',
        practicePrompt: 'Try searching a landmark in the simulator.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_gm_1',
        question: 'Before taking a cab to a shop or clinic, what helpful detail can you check on Google Maps?',
        options: ['Your bank balance', 'Current opening hours and travel time', 'Your electricity bill', 'Your Wi-Fi password'],
        correctIndex: 1,
        explanation: 'Maps shows live opening hours and estimated travel time so you never make a wasted trip.',
      },
    ],
  },
  {
    id: 'course_youtube',
    slug: 'youtube-learning',
    title: 'Watching Music, Recipes & Lectures on YouTube',
    category: 'Daily Utility',
    difficulty: 'Beginner',
    description: 'Search music, bhajans, gardening, or news, turn on captions, pause/rewind, and avoid misleading ads.',
    estimatedMinutes: 12,
    lessons: [
      {
        id: 'lesson_yt_1',
        title: 'Play, Pause, Captions & Fullscreen',
        summary: 'Use big clear playback controls and turn on CC captions for easier listening.',
        steps: [
          'Open YouTube and tap the magnifying glass icon at the top right.',
          'Type or use the microphone icon to speak what you want to watch.',
          'Tap the video once to show Pause, Rewind 10s, and CC (Captions).',
          'Tap Skip Ad after 5 seconds when an advertisement appears.',
        ],
        audioScript: 'Tap the microphone in YouTube search to speak what you would like to watch, and tap CC to turn on helpful text captions.',
        practicePrompt: 'Try toggling captions and playback controls.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_yt_1',
        question: 'Which button turns on readable subtitles on a YouTube video?',
        options: ['The Share arrow', 'The CC (Closed Captions) button', 'The Bell icon', 'The Trash icon'],
        correctIndex: 1,
        explanation: 'CC stands for Closed Captions, displaying spoken words on screen.',
      },
    ],
  },
  {
    id: 'course_upi_safety',
    slug: 'upi-safety',
    title: 'UPI Safety: Receiving vs. Sending Money',
    category: 'Financial Safety',
    difficulty: 'Beginner',
    description: 'Understand the golden rule of UPI: you NEVER enter your UPI PIN to receive money!',
    estimatedMinutes: 20,
    lessons: [
      {
        id: 'lesson_upi_1',
        title: 'The Golden Rule of UPI PINs',
        summary: 'Your 4- or 6-digit UPI PIN is ONLY for paying money out — never for receiving refunds, prizes, or pensions.',
        steps: [
          'Remember: Receiving money NEVER requires scanning a QR code or entering your UPI PIN.',
          'Always read the exact message on your screen before typing your PIN: check if it says "Paying" or "Requesting".',
          'Never install AnyDesk, TeamViewer, or QuickSupport when a caller offers help.',
          'Verify payment requests by calling the family member directly first.',
        ],
        audioScript: 'Remember the golden rule of UPI: you NEVER enter your UPI PIN or scan a QR code to receive money. Entering a PIN always sends money out of your bank account.',
        practicePrompt: 'Test spotting a fake UPI collect request in our simulator.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_upi_1',
        question: 'A buyer on OLX sends you a QR code and says "Scan and enter your UPI PIN to receive Rs 5,000." What happens if you enter your PIN?',
        options: ['You receive Rs 5,000', 'Money is deducted FROM your account to the scammer', 'Nothing happens', 'Your phone updates'],
        correctIndex: 1,
        explanation: 'Scanning a QR code and entering your UPI PIN ALWAYS pays money out — it never deposits money into your account.',
      },
    ],
  },
  {
    id: 'course_digital_payments',
    slug: 'digital-payments',
    title: 'Paying Utility Bills & Checking Bank Balance Safely',
    category: 'Financial Safety',
    difficulty: 'Intermediate',
    description: 'Use official billers, verify merchant names, double-check amounts, and save payment receipts.',
    estimatedMinutes: 18,
    lessons: [
      {
        id: 'lesson_dp_1',
        title: 'Verifying Merchant Name & Amount Before Paying',
        summary: 'Confirm the verified receiver name and decimal point in the amount before confirming.',
        steps: [
          'Use only official bank or well-known UPI apps downloaded from Play Store / App Store.',
          'Check the registered receiver name displayed in bold on screen.',
          'Double-check zeroes (e.g., 500 vs 5,000) before tapping Pay.',
          'Keep a screenshot of your transaction ID for electricity or phone bills.',
        ],
        audioScript: 'Always check the verified receiver name and verify the number of zeroes in the payment amount before entering your PIN.',
        practicePrompt: 'Verify a sample utility bill screen.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_dp_1',
        question: 'Where should you find customer-care numbers for your bank?',
        options: ['From random Google search ads', 'On the back of your bank card or inside the official bank app', 'From WhatsApp forwards', 'From unknown callers'],
        correctIndex: 1,
        explanation: 'Scammers plant fake helpline numbers in search ads. Always use the official bank app or the number printed on your debit card.',
      },
    ],
  },
  {
    id: 'course_cybersecurity',
    slug: 'cybersecurity-essentials',
    title: 'Passwords, Screen Locks & OTP Protection',
    category: 'Safety & Privacy',
    difficulty: 'Beginner',
    description: 'Protect your OTPs, set a strong screen lock PIN, and keep your phone updated.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_cs_1',
        title: 'Why You Must Never Share an OTP',
        summary: 'An OTP (One-Time Password) is like the key to your front door — even bank staff never need it.',
        steps: [
          'Never read out an SMS OTP over a phone call — not even to someone claiming to be from your bank, electricity board, or courier.',
          'Use a 6-digit screen lock PIN or fingerprint so nobody can open your phone if misplaced.',
          'Never write bank passwords in unencrypted notes.',
        ],
        audioScript: 'Your OTP is a secret key meant only for you. No genuine bank employee, police officer, or delivery agent will ever ask you for your OTP.',
        practicePrompt: 'Practice declining an OTP request safely.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_cs_1',
        question: 'A caller says your KYC is expiring tonight and asks for the 6-digit OTP just sent to your phone. What should you do?',
        options: ['Share the OTP quickly', 'Hang up immediately — genuine banks never ask for OTPs', 'Send it on WhatsApp', 'Read only the first 3 digits'],
        correctIndex: 1,
        explanation: 'Fake KYC callers steal OTPs to drain accounts or take over SIM cards. Hang up and verify directly at your bank branch.',
      },
    ],
  },
  {
    id: 'course_online_fraud',
    slug: 'online-fraud-awareness',
    title: 'Spotting Digital Arrest, Lottery & Refund Scams',
    category: 'Safety & Privacy',
    difficulty: 'Beginner',
    description: 'Recognize pressure tactics: fake police "digital arrest" calls, fake courier parcels, and lottery fee scams.',
    estimatedMinutes: 20,
    lessons: [
      {
        id: 'lesson_of_1',
        title: 'Recognizing Urgency & Threat Scams',
        summary: 'Real government agencies and courts never conduct "digital arrests" on WhatsApp video calls.',
        steps: [
          'Indian law enforcement NEVER conducts "digital arrest" via video call or demands money to clear your name.',
          'Never transfer money to "safe government accounts" on a caller instruction.',
          'If pressured to stay on a video call secretly without telling family, disconnect immediately and call 1930 or a trusted family member.',
        ],
        audioScript: 'Indian police and courts never place citizens under digital arrest on video calls. If someone threatens you and tells you not to talk to family, hang up immediately and dial 1930.',
        practicePrompt: 'Analyze a suspicious threat message using Scam Shield.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_of_1',
        question: 'In India, which official helpline number should you call immediately if you face cyber financial fraud?',
        options: ['5555', '1930 (National Cybercrime Helpline)', '9999', '0000'],
        correctIndex: 1,
        explanation: 'Dial 1930 or visit cybercrime.gov.in as quickly as possible to freeze fraudulent transfers.',
      },
    ],
  },
  {
    id: 'course_computer_basics',
    slug: 'computer-basics',
    title: 'Computer & Laptop Basics',
    category: 'Foundations',
    difficulty: 'Beginner',
    description: 'Use a mouse or trackpad comfortably, organize desktop folders, zoom text with Ctrl/Cmd +, and shut down properly.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_cb_1',
        title: 'Mouse Clicks, Scrolling & Enlarging Screen Text',
        summary: 'Learn left-click, double-click, and instant browser zoom shortcuts.',
        steps: [
          'Left-click once to select a button or link; double-click icons on the desktop.',
          'Hold Ctrl (or Cmd on Mac) and press the Plus (+) key to make any webpage larger.',
          'Always use Shut Down from the Start/Apple menu rather than unplugging the power.',
        ],
        audioScript: 'If text on a computer screen looks too small, hold down the Control key and press the Plus key to zoom in comfortably.',
        practicePrompt: 'Use the A / A+ text size toggle at the top of Buddy Elder AI.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_cb_1',
        question: 'Which keyboard shortcut makes webpage text larger on a computer?',
        options: ['Ctrl + Plus (+)', 'Alt + F4', 'Delete', 'Caps Lock'],
        correctIndex: 0,
        explanation: 'Holding Ctrl (or Cmd on Mac) and pressing + zooms into any webpage cleanly.',
      },
    ],
  },
  {
    id: 'course_safe_internet',
    slug: 'safe-internet-usage',
    title: 'Everyday Safe Internet & Privacy Habits',
    category: 'Safety & Privacy',
    difficulty: 'Beginner',
    description: 'Review app permissions, recognize HTTPS lock icons, avoid public Wi-Fi banking, and protect personal photos.',
    estimatedMinutes: 15,
    lessons: [
      {
        id: 'lesson_si_1',
        title: 'Public Wi-Fi, App Permissions & Privacy',
        summary: 'Keep banking and private records on your home Wi-Fi or mobile data.',
        steps: [
          'Avoid checking bank apps or entering passwords on free airport/cafe Wi-Fi.',
          'Only install apps from the official Google Play Store or Apple App Store — never from APK links sent on WhatsApp.',
          'Review who can see your status and profile photo in messaging apps.',
        ],
        audioScript: 'Never download apps from links sent over WhatsApp or SMS. Use only the official Google Play Store or Apple App Store, and save banking for trusted home connections.',
        practicePrompt: 'Review your privacy controls in our Autonomy Engine.',
      },
    ],
    quizzes: [
      {
        id: 'quiz_si_1',
        question: 'Should you install an ".apk" app file sent to you on WhatsApp by a stranger or fake bank agent?',
        options: ['Yes, if they say it updates KYC', 'No — never install apps outside official app stores', 'Only on weekends', 'Yes, if the file is small'],
        correctIndex: 1,
        explanation: 'APK files sent over chat often contain spyware that steals OTPs and banking credentials.',
      },
    ],
  },
];

export const SEED_RESEARCH_PAPERS = [
  {
    id: 'paper_who_decade_healthy_ageing',
    title: 'Decade of Healthy Ageing: Baseline Report & Digital Inclusion',
    authors: 'World Health Organization (WHO)',
    topic: 'Healthy Ageing',
    publishedYear: 2021,
    sourceUrl: 'https://www.who.int/publications/i/item/9789240017900',
    summary: 'WHO baseline framework emphasizing functional ability, age-friendly environments, social participation, and accessible digital technologies that preserve older adults autonomy.',
    contentExcerpt:
      'Healthy ageing is defined by the World Health Organization as developing and maintaining the functional ability that enables well-being in older age. Functional ability depends on intrinsic capacity (physical and mental capacities), the environments people inhabit (home, community, digital tools), and the interactions between them. Age-friendly environments actively remove barriers to participation, foster autonomy and dignity, and ensure assistive and digital technologies are designed around clear communication, accessible typography, and user consent rather than replacing human choice.',
  },
  {
    id: 'paper_rbi_be_aware_fraud',
    title: 'BE(A)WARE: Booklet on Modus Operandi of Financial Fraudsters',
    authors: 'Reserve Bank of India (RBI) — Consumer Education & Protection Dept.',
    topic: 'Financial & Cyber Safety',
    publishedYear: 2023,
    sourceUrl: 'https://www.rbi.org.in/commonman/English/Scripts/Notification.aspx?Id=3349',
    summary: 'Official RBI guide documenting common digital payment scams including QR-code receive scams, fake KYC SMS, remote screen-sharing apps, and impersonated customer-care numbers.',
    contentExcerpt:
      'The Reserve Bank of India warns citizens against common digital payment fraud techniques: (1) UPI Collect / QR Code fraud where fraudsters claim a QR code or PIN entry is needed to receive money—whereas PIN entry only authorizes outgoing payments; (2) Fake KYC updation links sent via SMS or messaging apps threatening immediate account suspension; (3) Screen-sharing apps such as AnyDesk or TeamViewer requested by imposters pretending to be bank support; and (4) Fraudulent customer-care numbers planted in search engine listings. Citizens should never share OTPs, PINs, or CVV numbers, and should immediately report cyber financial fraud via helpline 1930 or cybercrime.gov.in.',
  },
  {
    id: 'paper_certin_senior_cyber',
    title: 'Cyber Hygiene & Safe Digital Practices for Citizens',
    authors: 'CERT-In (Indian Computer Emergency Response Team)',
    topic: 'Cybersecurity',
    publishedYear: 2024,
    sourceUrl: 'https://www.cert-in.org.in/',
    summary: 'Practical cyber hygiene practices covering multi-factor authentication, phishing indicators, official app stores, and timely reporting of cyber incidents.',
    contentExcerpt:
      'CERT-In recommends core cyber hygiene practices for everyday users: verify sender email domains and official URLs before entering credentials; treat unsolicited urgent warnings about account blocking, lottery winnings, or legal notices with suspicion; install applications strictly from official stores; keep operating systems and browsers updated; use distinct strong passphrases with multi-factor authentication; and report suspicious financial fraud promptly at 1930 or https://cybercrime.gov.in.',
  },
  {
    id: 'paper_nia_cognitive_social',
    title: 'Social Isolation, Loneliness, and Cognitive Health in Older Adults',
    authors: 'National Institute on Aging (NIH / NIA)',
    topic: 'Wellness & Cognition',
    publishedYear: 2023,
    sourceUrl: 'https://www.nia.nih.gov/health/loneliness-and-social-isolation',
    summary: 'Evidence summary on how meaningful social connection, daily routine, physical activity, and accessible communication tools support emotional and cognitive well-being.',
    contentExcerpt:
      'Research compiled by the National Institute on Aging shows that chronic social isolation and loneliness can negatively affect sleep, emotional well-being, and long-term cognitive health. Protective habits include staying in regular contact with family and community through accessible phone or video tools, maintaining daily movement and hydration routines, engaging in lifelong learning such as new digital skills, and preserving personal agency in everyday decisions.',
  },
  {
    id: 'paper_helpage_digital_literacy',
    title: 'Digital Empowerment & Elder Safety in India',
    authors: 'HelpAge India Research & Advocacy',
    topic: 'Digital Literacy',
    publishedYear: 2023,
    sourceUrl: 'https://www.helpageindia.org/',
    summary: 'Field insights on bridging the senior digital divide in India through regional-language interfaces, voice assistance, and guided family support.',
    contentExcerpt:
      'HelpAge India studies highlight that older adults adopt smartphones and digital services successfully when interfaces provide large readable fonts, high contrast, regional language support (such as Hindi and Marathi), step-by-step practice without jargon, and trusted scam verification tools. Family support works best when older adults retain control over what they share and learn at their own pace.',
  },
  {
    id: 'paper_w3c_wai_older_users',
    title: 'Developing Websites for Older People: Accessibility Guidelines',
    authors: 'W3C Web Accessibility Initiative (WAI)',
    topic: 'Accessibility',
    publishedYear: 2022,
    sourceUrl: 'https://www.w3.org/WAI/older-users/developing/',
    summary: 'W3C technical guidance on readable typography, predictable navigation, generous touch targets, clear error recovery, and speech-friendly layouts.',
    contentExcerpt:
      'The W3C Web Accessibility Initiative notes that older web users benefit significantly from body text sized comfortably with user-controlled zoom, high foreground-to-background contrast, generous spacing around buttons, consistent single-row navigation, plain language instructions, clear confirmation dialogs for sensitive actions, and compatibility with screen readers and speech synthesis.',
  },
];

export function seedDatabase(db: Database.Database) {
  const existingCourses = db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number };
  if (existingCourses.cnt === 0) {
    const insertCourse = db.prepare(`
      INSERT INTO courses (id, slug, title, category, difficulty, description, estimated_minutes, sort_order, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertLesson = db.prepare(`
      INSERT INTO lessons (id, course_id, title, summary, steps_json, audio_script, practice_prompt, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertQuiz = db.prepare(`
      INSERT INTO quizzes (id, course_id, question, options_json, correct_index, explanation)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      SEED_COURSES.forEach((course, idx) => {
        insertCourse.run(
          course.id,
          course.slug,
          course.title,
          course.category,
          course.difficulty,
          course.description,
          course.estimatedMinutes,
          idx + 1
        );
        course.lessons.forEach((lesson, lIdx) => {
          insertLesson.run(
            lesson.id,
            course.id,
            lesson.title,
            lesson.summary,
            JSON.stringify(lesson.steps),
            lesson.audioScript,
            lesson.practicePrompt,
            lIdx + 1
          );
        });
        course.quizzes.forEach((quiz) => {
          insertQuiz.run(
            quiz.id,
            course.id,
            quiz.question,
            JSON.stringify(quiz.options),
            quiz.correctIndex,
            quiz.explanation
          );
        });
      });
    });
    tx();
  }

  const existingPapers = db.prepare('SELECT COUNT(*) as cnt FROM research_documents').get() as { cnt: number };
  if (existingPapers.cnt === 0) {
    const insertPaper = db.prepare(`
      INSERT INTO research_documents (id, title, authors, topic, published_year, source_url, summary, content_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const p of SEED_RESEARCH_PAPERS) {
        insertPaper.run(p.id, p.title, p.authors, p.topic, p.publishedYear, p.sourceUrl, p.summary, p.contentExcerpt);
      }
    });
    tx();
  }

  seedResearchChunksIfNeeded(db);
}
