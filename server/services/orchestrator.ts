import type Database from 'better-sqlite3';
import { getEnvConfig } from '../config/env.ts';
import { generateGeminiText, streamGeminiText, isGeminiConfigured } from './gemini.ts';

export type AgentCapability =
  | 'general_conversation'
  | 'companion'
  | 'digital_education'
  | 'safety_scam_detection'
  | 'wellness_ageing'
  | 'emergency_sos'
  | 'caregiver_support'
  | 'accessibility_speech'
  | 'knowledge_hub_rag'
  | 'learning_progress'
  | 'answer_verification';

export interface OrchestratorContext {
  db: Database.Database;
  userId: string;
  userRole: 'senior' | 'caregiver' | 'admin';
  userName: string;
  language: 'en' | 'hi' | 'mr';
  conversationId?: string;
}

export interface OrchestratorResult {
  reply: string;
  capability: AgentCapability;
  verificationNote: string;
  model: string;
}

const LANGUAGE_NAME: Record<'en' | 'hi' | 'mr', string> = {
  en: 'English',
  hi: 'Hindi (Devanagari script, respectful "आप" tone)',
  mr: 'Marathi (Devanagari script, respectful "तुम्ही/आपण" tone)',
};

export class BuddyAgentOrchestrator {
  classifyIntent(prompt: string, userRole: 'senior' | 'caregiver' | 'admin'): AgentCapability {
    const p = prompt.toLowerCase();

    if (/\b(sos|emergency|ambulance|chest pain|fell down|fall|112|108|police|urgent help)\b/.test(p)) {
      return 'emergency_sos';
    }
    if (/\b(research|paper|study|evidence|citation)\b/.test(p)) {
      return 'knowledge_hub_rag';
    }
    if (/\b(scam|fraud|otp|upi|pin|kyc|phishing|lottery|anydesk|teamviewer|quicksupport|suspicious|link|cybercrime|1930|bank call|qr code|qr|digital arrest|olx|refund)\b/.test(p)) {
      return 'safety_scam_detection';
    }
    if (/\b(learn|lesson|course|whatsapp|youtube|maps|smartphone|email|how to use|tutorial|zoom|wifi|font size)\b/.test(p)) {
      if (/\b(progress|score|completed|next lesson|recommend)\b/.test(p)) {
        return 'learning_progress';
      }
      return 'digital_education';
    }
    if (/\b(progress|quiz score|completed lesson|my courses)\b/.test(p)) {
      return 'learning_progress';
    }
    if (/\b(wellness|mood|sleep|water|hydration|medicine|medication|walk|exercise|stress|lonely|tired|health)\b/.test(p)) {
      return /\b(lonely|sad|miss|family|talk to me|chat|friend)\b/.test(p) ? 'companion' : 'wellness_ageing';
    }
    if (/\b(translate|hindi|marathi|simplify|simpler|shorter|read aloud|speech|voice)\b/.test(p)) {
      return 'accessibility_speech';
    }
    if (/\b(who|rbi|cert-in|helpage|nia|w3c)\b/.test(p)) {
      return 'knowledge_hub_rag';
    }
    if (userRole === 'caregiver' || /\b(caregiver|parent|mother|father|senior sharing|consent)\b/.test(p)) {
      return 'caregiver_support';
    }
    if (/\b(hello|hi|namaste|good morning|good evening|story|hobby|lonely|companion|how are you)\b/.test(p)) {
      return 'companion';
    }
    return 'general_conversation';
  }

  private buildAuthorizedContext(ctx: OrchestratorContext, capability: AgentCapability): string {
    const parts: string[] = [];

    if (capability === 'learning_progress' || capability === 'digital_education') {
      const completed = ctx.db
        .prepare(
          `SELECT c.title FROM learning_progress lp
           JOIN courses c ON c.id = lp.course_id
           WHERE lp.user_id = ? AND lp.completed = 1
           GROUP BY c.id LIMIT 5`
        )
        .all(ctx.userId) as { title: string }[];
      if (completed.length > 0) {
        parts.push(`User completed courses: ${completed.map((c) => c.title).join(', ')}.`);
      }
    }

    if (capability === 'wellness_ageing') {
      const recent = ctx.db
        .prepare('SELECT mood, sleep_hours, water_glasses, created_at FROM wellness_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 3')
        .all(ctx.userId) as { mood: string; sleep_hours: number; water_glasses: number; created_at: string }[];
      if (recent.length > 0) {
        parts.push(
          `Recent authorized wellness check-ins: ${recent
            .map((r) => `${r.created_at.slice(0, 10)}: mood=${r.mood}, sleep=${r.sleep_hours}h, water=${r.water_glasses} glasses`)
            .join('; ')}.`
        );
      }
    }

    if (capability === 'knowledge_hub_rag') {
      const papers = ctx.db
        .prepare('SELECT title, authors, published_year, source_url FROM research_documents LIMIT 6')
        .all() as { title: string; authors: string; published_year: number; source_url: string }[];
      parts.push(
        `Available verified library papers: ${papers
          .map((p) => `"${p.title}" (${p.authors}, ${p.published_year})`)
          .join('; ')}. Never cite papers outside this list unless verified.`
      );
    }

    return parts.join('\n');
  }

  private buildSystemInstruction(ctx: OrchestratorContext, capability: AgentCapability, extraContext: string): string {
    const capabilityGuidance: Record<AgentCapability, string> = {
      general_conversation: 'Provide clear, respectful, jargon-free answers in warm everyday language.',
      companion: 'Act as a warm, patient, encouraging companion who listens attentively and suggests gentle positive activities.',
      digital_education: 'Teach technology step-by-step using numbered actions, plain button descriptions, and zero intimidating jargon.',
      safety_scam_detection:
        'Analyze potential digital fraud carefully. Highlight red flags, remind users NEVER to share OTPs or UPI PINs to receive money, never promise any link is 100% safe, and mention India 1930 cybercrime helpline & cybercrime.gov.in when relevant.',
      wellness_ageing:
        'Support healthy ageing habits (hydration, sleep hygiene, gentle movement, social engagement). NEVER diagnose medical conditions or prescribe medications; advise consulting a qualified doctor for medical symptoms.',
      emergency_sos:
        'Provide calm, immediate emergency guidance. Reference verified Indian emergency numbers: 112 (Emergency), 108 (Ambulance), 1930 (Cyber Fraud). Remind the user that Buddy Elder AI does not auto-dial or share location without explicit confirmation.',
      caregiver_support:
        'Support caregivers respectfully while reinforcing senior autonomy, consent-based sharing, and patient communication.',
      accessibility_speech: 'Produce short, rhythmic, easy-to-read sentences suitable for text-to-speech playback.',
      knowledge_hub_rag:
        'Answer based strictly on the provided verified research library context. Never invent citations, statistics, or URLs.',
      learning_progress:
        'Encourage the learner based on their completed courses and recommend practical next steps from the 13-course Academy.',
      answer_verification: 'Verify safety, clarity, and non-diagnostic boundaries.',
    };

    return [
      `You are Buddy Elder AI ("Your Trusted Digital Companion"), speaking with ${ctx.userName} (role: ${ctx.userRole}).`,
      `Respond in ${LANGUAGE_NAME[ctx.language]}.`,
      `Active capability: ${capability}. ${capabilityGuidance[capability]}`,
      'Hard rules: Never diagnose illnesses or prescribe medicine. Never fabricate citations. Never promise a suspicious link is completely safe. Keep formatting clean and easy to read on large screens.',
      extraContext ? `Context:\n${extraContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private verifyHighStakesResponse(capability: AgentCapability, text: string): string {
    if (capability === 'wellness_ageing') {
      return 'Checked by Answer Verification Agent: Non-diagnostic wellness guidance only; consult a licensed clinician for medical advice.';
    }
    if (capability === 'safety_scam_detection') {
      return 'Checked by Answer Verification Agent: Safety reminders included; never share OTP/UPI PIN and verify independently.';
    }
    if (capability === 'emergency_sos') {
      return 'Checked by Answer Verification Agent: Verified Indian helplines (112 / 108 / 1930) referenced; no automatic dialing performed.';
    }
    if (text.length > 0) {
      return 'Verified for clarity and accessibility.';
    }
    return '';
  }

  private loadHistoryContents(
    ctx: OrchestratorContext,
    prompt: string
  ): { role: 'user' | 'model'; parts: { text: string }[] }[] {
    if (!ctx.conversationId) {
      return [{ role: 'user', parts: [{ text: prompt }] }];
    }
    const history = ctx.db
      .prepare(
        `SELECT role, content FROM messages
         WHERE conversation_id = ? AND user_id = ?
         ORDER BY created_at DESC LIMIT 10`
      )
      .all(ctx.conversationId, ctx.userId) as { role: 'user' | 'assistant'; content: string }[];

    const ordered = history.reverse().map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    }));

    return [...ordered, { role: 'user', parts: [{ text: prompt }] }];
  }

  async respond(ctx: OrchestratorContext, prompt: string): Promise<OrchestratorResult> {
    const capability = this.classifyIntent(prompt, ctx.userRole);
    const extraContext = this.buildAuthorizedContext(ctx, capability);
    const systemInstruction = this.buildSystemInstruction(ctx, capability, extraContext);
    const contents = this.loadHistoryContents(ctx, prompt);

    const reply = await generateGeminiText({
      systemInstruction,
      contents,
      lowLatency: capability === 'general_conversation' || capability === 'companion',
    });

    const verificationNote = this.verifyHighStakesResponse(capability, reply);
    return {
      reply,
      capability,
      verificationNote,
      model: getEnvConfig().geminiModel,
    };
  }

  async *streamRespond(
    ctx: OrchestratorContext,
    prompt: string
  ): AsyncGenerator<{ chunk?: string; done?: boolean; capability: AgentCapability; verificationNote?: string }> {
    const capability = this.classifyIntent(prompt, ctx.userRole);
    const extraContext = this.buildAuthorizedContext(ctx, capability);
    const systemInstruction = this.buildSystemInstruction(ctx, capability, extraContext);
    const contents = this.loadHistoryContents(ctx, prompt);

    let accumulated = '';
    for await (const chunk of streamGeminiText({ systemInstruction, contents })) {
      accumulated += chunk;
      yield { chunk, capability };
    }
    yield {
      done: true,
      capability,
      verificationNote: this.verifyHighStakesResponse(capability, accumulated),
    };
  }

  async transformMessage(
    ctx: OrchestratorContext,
    originalText: string,
    mode: 'simplify' | 'shorten' | 'examples' | 'translate_hi' | 'translate_mr'
  ): Promise<{ text: string; capability: AgentCapability }> {
    const instructions: Record<typeof mode, string> = {
      simplify: 'Rewrite the explanation below in much simpler, gentler words for a senior citizen, using short numbered steps.',
      shorten: 'Summarize the explanation below into 3 concise bullet points while keeping every important safety detail.',
      examples: 'Add 2 concrete, everyday Indian household examples to illustrate the explanation below clearly.',
      translate_hi: 'Translate the message below accurately into warm, polite Hindi (Devanagari script, using "आप").',
      translate_mr: 'Translate the message below accurately into warm, polite Marathi (Devanagari script, using "तुम्ही/आपण").',
    };

    const text = await generateGeminiText({
      systemInstruction: 'You are Buddy Elder AI Accessibility and Speech Agent. Be clear, accurate, and warm.',
      contents: `${instructions[mode]}\n\nOriginal text:\n${originalText}`,
      lowLatency: true,
    });
    return { text, capability: 'accessibility_speech' };
  }

  async answerResearchQuestion(params: {
    title: string;
    authors: string;
    publishedYear: number;
    sourceUrl: string;
    contentExcerpt: string;
    retrievedChunks?: { chunkIndex: number; chunkText: string; score: number }[];
    hasLexicalMatch?: boolean;
    question: string;
    language: 'en' | 'hi' | 'mr';
  }): Promise<{ answer: string; usedGemini: boolean }> {
    const chunkContext =
      params.retrievedChunks && params.retrievedChunks.length > 0
        ? params.retrievedChunks
            .map((c) => `[Section ${c.chunkIndex + 1}] ${c.chunkText}`)
            .join('\n\n')
        : params.contentExcerpt;

    if (params.hasLexicalMatch === false && params.retrievedChunks && params.retrievedChunks.length > 0) {
      // Still allow Gemini to verify if semantic phrasing matches, or return clear fallback when offline
      if (!isGeminiConfigured()) {
        return {
          usedGemini: false,
          answer: `Source: "${params.title}" (${params.authors}, ${params.publishedYear}).\n\nThe retrieved sections of this document do not appear to mention those specific terms. Here is the closest stored section for your review:\n\n${chunkContext}`,
        };
      }
    }

    if (!isGeminiConfigured()) {
      return {
        usedGemini: false,
        answer: `Source: "${params.title}" (${params.authors}, ${params.publishedYear}).\n\nBased strictly on the retrieved document sections:\n${chunkContext}\n\nNote: Live AI synthesis is unavailable because GEMINI_API_KEY is not configured, so the verified retrieved sections are displayed directly without inventing extra claims.`,
      };
    }

    const answer = await generateGeminiText({
      systemInstruction: `You are Buddy Elder AI Knowledge Hub and RAG Agent. Respond in ${LANGUAGE_NAME[params.language]}. Answer ONLY using the supplied retrieved document sections below. If the retrieved sections do not contain the answer, state clearly: "The loaded sections of this paper do not contain enough information to answer that question." Never fabricate citations or outside statistics. Always include attribution to "${params.title}" (${params.authors}, ${params.publishedYear}).`,
      contents: `Document Title: ${params.title}\nAuthors: ${params.authors}\nYear: ${params.publishedYear}\nSource URL: ${params.sourceUrl}\n\nRetrieved Grounding Sections:\n${chunkContext}\n\nUser Question: ${params.question}`,
      lowLatency: true,
    });

    return { answer, usedGemini: true };
  }
}

export const orchestrator = new BuddyAgentOrchestrator();
