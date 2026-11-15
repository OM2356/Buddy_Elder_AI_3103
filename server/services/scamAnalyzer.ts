import { generateGeminiText, isGeminiConfigured } from './gemini.ts';

export type ScamChannel = 'sms' | 'whatsapp' | 'email' | 'url' | 'payment' | 'phone';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ScamAnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  indicators: string[];
  safetyGuidance: string[];
  aiSummary: string | null;
  cybercrimeHelp: {
    helpline: string;
    portal: string;
    disclaimer: string;
  };
}

interface Rule {
  weight: number;
  label: string;
  pattern: RegExp;
}

const SCAM_RULES: Rule[] = [
  { weight: 35, label: 'Requests OTP, PIN, CVV, or UPI PIN', pattern: /\b(otp|upi\s*pin|cvv|atm\s*pin|mpin|password|verification code)\b/i },
  { weight: 35, label: 'Claims you must scan a QR code or enter PIN to RECEIVE money', pattern: /(receive|get|claim|refund|cashback).*(qr|pin|upi)|(qr|pin).*(receive|refund|prize)/i },
  { weight: 30, label: 'Fake KYC suspension or account-block threat', pattern: /\b(kyc|pan\s*card|aadhaar|account\s*(block|suspend|freeze|deactivat)|sim\s*block)\b/i },
  { weight: 35, label: 'Remote screen-sharing app request (AnyDesk / TeamViewer / QuickSupport)', pattern: /\b(anydesk|teamviewer|quicksupport|rustdesk|screen\s*share|remote\s*access)\b/i },
  { weight: 30, label: 'Urgency, arrest threat, or "digital arrest" impersonation', pattern: /\b(digital\s*arrest|cbi|police|court\s*warrant|customs|parcel\s*seized|within\s*\d+\s*(min|hour)|urgent|immediately)\b/i },
  { weight: 25, label: 'Fake lottery, prize, or unrequested reward claim', pattern: /\b(lottery|winner|won\s*(rs|₹|inr|\$|lakh|crore)|kbc|lucky\s*draw|jackpot|claim\s*prize)\b/i },
  { weight: 20, label: 'Suspicious URL shortener or lookalike/untrusted TLD', pattern: /(bit\.ly|tinyurl\.com|rb\.gy|t\.co|cutt\.ly|\.(xyz|top|tk|ml|ga|cf|click|gq)\b|http:\/\/\d+\.\d+\.\d+\.\d+)/i },
  { weight: 20, label: 'Unverified customer-care or refund phone number pattern', pattern: /(customer\s*care|helpline|refund\s*desk|toll\s*free).{0,40}(\+91|0?\d{10})/i },
  { weight: 15, label: 'Requests secrecy from family members', pattern: /\b(do\s*not\s*tell|don't\s*tell|keep\s*confidential|secretly)\b/i },
];

export async function analyzeScamInput(params: {
  channel: ScamChannel;
  content: string;
  includeAiExplanation?: boolean;
}): Promise<ScamAnalysisResult> {
  const text = params.content.trim();
  const indicators: string[] = [];
  let score = 0;

  for (const rule of SCAM_RULES) {
    if (rule.pattern.test(text)) {
      indicators.push(rule.label);
      score += rule.weight;
    }
  }

  if (params.channel === 'url' && /^http:\/\//i.test(text)) {
    indicators.push('Unencrypted HTTP link (not HTTPS)');
    score += 15;
  }

  if (params.channel === 'url' && /@/.test(text)) {
    indicators.push('URL contains "@" symbol often used to disguise real destination');
    score += 25;
  }

  if (params.channel === 'phone' && /^\+?(?!112$|108$|1930$|100$)\d{8,15}$/.test(text.replace(/[\s-]/g, ''))) {
    indicators.push('Unverified phone number — always cross-check with official card/bank website');
    score += 20;
  }

  const clampedScore = Math.min(100, score);
  let riskLevel: RiskLevel = 'LOW';
  if (clampedScore >= 55) riskLevel = 'HIGH';
  else if (clampedScore >= 25) riskLevel = 'MEDIUM';

  const safetyGuidance = [
    'Never share an OTP, ATM PIN, CVV, or UPI PIN with anyone — even callers claiming to be bank or police staff.',
    'You NEVER need to enter a UPI PIN or scan a QR code to receive money or a refund.',
    'Do not install AnyDesk, TeamViewer, or QuickSupport on any caller’s request.',
    'If pressured or threatened with "digital arrest", disconnect immediately and verify with family.',
    'Even when automated checks show LOW risk, no tool can guarantee a link or message is 100% safe — verify directly via official apps.',
  ];

  let aiSummary: string | null = null;
  if (params.includeAiExplanation && isGeminiConfigured()) {
    try {
      aiSummary = await generateGeminiText({
        systemInstruction:
          'You are Buddy Elder AI Safety & Scam Detection Agent. Explain clearly in 3 simple sentences why the submitted text might be risky or what precautions a senior citizen should take. Never claim a link is 100% safe.',
        contents: `Channel: ${params.channel}\nDeterministic risk: ${riskLevel} (${clampedScore}/100)\nDetected indicators: ${indicators.join('; ') || 'None matched deterministic rules'}\nSubmitted text: ${text.slice(0, 1200)}`,
        lowLatency: true,
      });
    } catch {
      aiSummary = null;
    }
  }

  return {
    riskScore: clampedScore,
    riskLevel,
    indicators,
    safetyGuidance,
    aiSummary,
    cybercrimeHelp: {
      helpline: '1930 (National Cybercrime Financial Fraud Helpline, India)',
      portal: 'https://cybercrime.gov.in',
      disclaimer:
        'Automated analysis assists your judgment and cannot guarantee that any link, number, or message is completely safe.',
    },
  };
}
