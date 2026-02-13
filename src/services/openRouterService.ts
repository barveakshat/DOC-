import type { Database } from '@/integrations/supabase/types';

type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: number;
  };
}

export class OpenRouterService {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1';
  private static readonly MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
  private static readonly API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

  /**
   * Test OpenRouter API connection
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.API_KEY) {
        return { success: false, error: 'OpenRouter API key not found. Please check your environment variables.' };
      }

      console.log('Testing OpenRouter connection...');
      console.log('API Key available:', !!this.API_KEY);

      const response = await fetch(`${this.BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
      });

      console.log('OpenRouter models endpoint response:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Available models:', data);
        return { success: true };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Connection failed with status:', response.status, errorData);
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`
        };
      }
    } catch (error) {
      console.error('OpenRouter connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Generate AI response for doctor chat
   */
  static async generateDoctorResponse(
    userMessage: string,
    conversationHistory: Message[] = [],
    sessionType: string = 'ai-doctor',
    patientContext?: string,
    fileContext?: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      if (!this.API_KEY) {
        return { success: false, error: 'OpenRouter API key not found. Please check your environment variables.' };
      }

      console.log('Generating AI response for:', { userMessage, sessionType });

      // Build conversation context
      const messages: OpenRouterMessage[] = [];

      // Add system prompt based on session type
      if (sessionType === 'ai-doctor') {
        let systemPrompt = `You are a medical AI assistant that helps doctors by providing medical information, clinical guidance, and patient-related insights.

${patientContext ? patientContext : ''}

${fileContext ? `Attached Files Context:\n${fileContext}` : ''}

Your responsibilities:
- Answer questions about patient information, medical conditions, treatments, and clinical guidance
- Analyze and provide insights about uploaded medical documents, images, and files
- Provide summaries of patient context and medical history when requested
- Give answers that are precise, clear, and human-friendly
- Focus on medical knowledge, clinical guidance, and patient-related insights
- Suggest practical next steps in a way that is understandable for both the doctor and the patient
- Help with useful medical tasks, such as:
  • Making treatment plans (step-by-step with clear explanations)
  • Generating diet or lifestyle plans appropriate for the condition
  • Summarizing patient context into quick overviews
  • Analyzing medical images and documents
  • Suggesting diagnostic tests or follow-up actions where medically relevant
  • Providing information about medications, symptoms, and medical procedures
- Always cite reputable medical sources when providing information

Tone:
- Be professional but supportive
- Avoid unnecessary jargon; explain complex terms in simple ways if needed
- Prioritize accuracy and brevity

Guidelines:
- Always provide helpful medical information when asked
- If you have patient context available, incorporate it into your responses
- For patient information requests, provide relevant details from the patient context
- When analyzing files, explain your findings clearly and suggest clinical implications
- If asked about something outside your medical knowledge, politely explain your limitations

${patientContext ? 'Always incorporate the patient context provided above in your reasoning and response when relevant.' : ''}
${fileContext ? 'Always consider the attached files in your analysis and responses.' : ''}`;

        messages.push({
          role: 'system',
          content: systemPrompt
        });
      } else if (sessionType === 'ai-patient') {
        let systemPrompt = `You are an AI assistant focused on providing emotional support, stress relief, and mental health guidance to patients.

${patientContext ? patientContext : ''}

${fileContext ? `Patient's Uploaded Files:\n${fileContext}` : ''}

Your Role and Responsibilities:
- Act as a supportive therapist focused on stress relief and emotional well-being
- Provide empathetic, non-judgmental listening and guidance
- Help patients manage stress, anxiety, and emotional challenges
- Offer practical coping strategies and relaxation techniques
- Encourage healthy lifestyle habits that support mental health
- Guide patients toward professional help when appropriate

Core Principles:
- Maintain absolute confidentiality - never discuss other patients or doctors
- Focus exclusively on the patient's own experiences and concerns
- Remember and reference previous conversations with this specific patient
- Build therapeutic rapport and trust
- Use active listening and validation techniques
- Provide evidence-based stress management strategies

Therapeutic Approach:
- Practice mindfulness and present-moment awareness
- Teach breathing exercises and relaxation techniques
- Help identify stress triggers and coping mechanisms
- Support emotional regulation and resilience building
- Encourage self-care and work-life balance
- Promote positive thinking and cognitive reframing

Boundaries and Ethics:
- Never provide medical diagnoses or treatment recommendations
- Do not prescribe medications or alter treatment plans
- Always recommend professional medical help for serious concerns
- Respect patient privacy and maintain therapeutic confidentiality
- If patient shows signs of crisis, encourage immediate professional help

Communication Style:
- Warm, empathetic, and genuinely caring
- Use simple, accessible language
- Be patient and allow time for emotional processing
- Ask open-ended questions to encourage self-reflection
- Validate feelings and experiences
- Provide hope and encouragement

Remember: You are having a private, confidential conversation with this specific patient. Focus entirely on their individual needs, experiences, and journey toward better mental health and stress management.

${patientContext ? 'Always incorporate this patient\'s specific context and history in your therapeutic responses.' : ''}
${fileContext ? 'Consider any uploaded files or documents in your therapeutic guidance.' : ''}`;

        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Add conversation history (last 10 messages for context)
      const recentMessages = conversationHistory.slice(-10);
      for (const msg of recentMessages) {
        if (!msg.is_ai_message) {
          messages.push({
            role: 'user',
            content: msg.content
          });
        } else {
          messages.push({
            role: 'assistant',
            content: msg.content
          });
        }
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      const requestBody: OpenRouterRequest = {
        model: this.MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      };

      console.log('Sending request to OpenRouter:', {
        model: requestBody.model,
        messageCount: messages.length,
        lastMessage: userMessage.substring(0, 100) + '...'
      });

      const response = await fetch(`${this.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('OpenRouter response status:', response.status);
      console.log('OpenRouter response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData: OpenRouterError = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error('OpenRouter API error:', response.status, errorData);

        return {
          success: false,
          error: `API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const data: OpenRouterResponse = await response.json();
      console.log('OpenRouter response received:', {
        id: data.id,
        model: data.model,
        usage: data.usage,
        responseLength: data.choices[0]?.message?.content?.length || 0
      });

      const aiResponse = data.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        return {
          success: false,
          error: 'No response generated by AI'
        };
      }

      return {
        success: true,
        response: aiResponse
      };

    } catch (error) {
      console.error('Error generating AI response:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get available models (for debugging)
   */
  static async getAvailableModels(): Promise<{ success: boolean; models?: any[]; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, models: data.data || [] };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}
