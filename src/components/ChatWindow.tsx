import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Stethoscope, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useChatSessions';
import { supabase } from '@/integrations/supabase/client';
import { ChatAPI } from '@/integrations/supabase/chat-api';
import { useToast } from '@/hooks/use-toast';
import { OpenRouterService } from '@/services/openRouterService';
import type { Database } from '@/integrations/supabase/types';

type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type Patient = Database['public']['Tables']['patients']['Row'];

interface ChatWindowProps {
  session: ChatSession | null;
  onSessionUpdate?: () => void;
  onNewSession?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ session, onSessionUpdate, onNewSession }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbContext, setDbContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { messages, sendMessage, fetchMessages } = useMessages(session?.id || null);

  // @ mention state - only for doctors in ai-doctor sessions
  const isDoctorAIChat = user?.role === 'doctor' && session?.session_type === 'ai-doctor';
  const [showPatientList, setShowPatientList] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch database context when session changes or patient is selected
  useEffect(() => {
    const fetchDatabaseContext = async () => {
      if (!session || !user) return;

      try {
        const context: any = {
          sessionType: session.session_type,
          patientInfo: null,
          doctorInfo: null
        };

        // For AI-doctor sessions, fetch patient info if one is selected via @ mention
        if (session.session_type === 'ai-doctor' && user.role === 'doctor') {
          // Use selected patient from @ mention if available
          if (selectedPatient) {
            context.patientInfo = selectedPatient;
          }
          // Also fetch doctor's own info
          const doctorInfo = await OpenRouterService.fetchDoctorContext(user.id);
          if (doctorInfo) context.doctorInfo = doctorInfo;
        }

        // For AI-patient sessions, fetch both patient and their assigned doctor info
        if (session.session_type === 'ai-patient' && user.role === 'patient') {
          const patientInfo = await OpenRouterService.fetchPatientContext(user.id);
          if (patientInfo) {
            context.patientInfo = patientInfo;
            
            // Fetch assigned doctor info if available
            if (patientInfo.assigned_doctor_id) {
              const doctorInfo = await OpenRouterService.fetchDoctorContext(patientInfo.assigned_doctor_id);
              if (doctorInfo) context.doctorInfo = doctorInfo;
            }
          }
        }

        // For doctor-patient sessions, fetch both
        if (session.session_type === 'doctor-patient') {
          if (user.role === 'doctor') {
            const doctorInfo = await OpenRouterService.fetchDoctorContext(user.id);
            if (doctorInfo) context.doctorInfo = doctorInfo;
            
            if (session.participant_2_id) {
              const patientInfo = await OpenRouterService.fetchPatientContext(session.participant_2_id);
              if (patientInfo) context.patientInfo = patientInfo;
            }
          } else {
            const patientInfo = await OpenRouterService.fetchPatientContext(user.id);
            if (patientInfo) {
              context.patientInfo = patientInfo;
              
              if (patientInfo.assigned_doctor_id) {
                const doctorInfo = await OpenRouterService.fetchDoctorContext(patientInfo.assigned_doctor_id);
                if (doctorInfo) context.doctorInfo = doctorInfo;
              }
            }
          }
        }

        console.log('Database context fetched:', { 
          hasPatient: !!context.patientInfo, 
          hasDoctor: !!context.doctorInfo,
          patientName: context.patientInfo?.name 
        });
        setDbContext(context);

      } catch (error) {
        console.error('Error fetching database context:', error);
      }
    };

    fetchDatabaseContext();
  }, [session, user, selectedPatient]); // Re-fetch when selectedPatient changes

  // Fetch patients for @ mention - only for doctors
  const fetchPatients = async (searchTerm: string = '') => {
    if (!isDoctorAIChat) return;
    
    try {
      let query = supabase.from('patients').select('*');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(10);
      
      if (error) {
        console.error('Error fetching patients:', error);
        return;
      }
      
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  // Get patient context for AI
  const getPatientContext = (patient: Patient): string => {
    return `Patient Context:
Name: ${patient.name}
Age: ${patient.age || 'Not specified'}
Gender: ${patient.gender || 'Not specified'}
Medical History: ${patient.medical_history || 'Not available'}
Current Medications: ${patient.current_medications || 'None specified'}
Allergies: ${patient.allergies || 'None specified'}
Phone: ${patient.phone || 'Not provided'}
Email: ${patient.email || 'Not provided'}
Emergency Contact: ${patient.emergency_contact_name || 'Not provided'} (${patient.emergency_contact_phone || 'Not provided'})
Address: ${patient.address || 'Not provided'}`;
  };

  // Handle @ mention input - only for doctors
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setNewMessage(value);
    setCursorPosition(cursorPos);
    
    if (!isDoctorAIChat) return;
    
    // Check if @ is typed
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const searchTerm = textBeforeCursor.substring(atIndex + 1);
      setPatientSearch(searchTerm);
      setShowPatientList(true);
      fetchPatients(searchTerm);
    } else {
      setShowPatientList(false);
      setPatientSearch('');
    }
  };

  // Handle patient selection - only for doctors
  const handlePatientSelect = (patient: Patient) => {
    if (!isDoctorAIChat) return;
    
    const textBeforeAt = newMessage.substring(0, newMessage.lastIndexOf('@'));
    const textAfterCursor = newMessage.substring(cursorPosition);
    const newText = `${textBeforeAt}@${patient.name} ${textAfterCursor}`;
    
    setNewMessage(newText);
    setSelectedPatient(patient);
    setShowPatientList(false);
    setPatientSearch('');
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = textBeforeAt.length + patient.name.length + 1;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear selected patient when session changes - only for doctors
  useEffect(() => {
    if (isDoctorAIChat) {
      setSelectedPatient(null);
      setShowPatientList(false);
      setPatientSearch('');
    }
  }, [session?.id, isDoctorAIChat]);

  // Mark messages as read when session changes or new messages arrive
  useEffect(() => {
    if (session?.id && user?.id && messages.length > 0) {
      const markAsRead = async () => {
        const { error } = await ChatAPI.markMessagesAsRead(session.id, user.auth_user_id || user.id);
        if (error) {
        }
      };
      markAsRead();
    }
  }, [session?.id, user?.id, messages.length]);

  // Real-time subscription is now handled by the useMessages hook
  // No need for additional subscription here as it's already implemented in the hook

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !session) return;

    if (!user?.id) {
      setError('You must be logged in to send messages.');
      return;
    }

    const messageContent = newMessage;
    setNewMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Use the hook's sendMessage function to send the user message and update local state
      const sentMessage = await sendMessage(messageContent, false); // false = not AI message

      if (!sentMessage) {
        toast({
          title: "Failed to send message",
          description: "Could not send message. Please try again.",
          variant: "destructive",
        });
        setNewMessage(messageContent);
        setIsLoading(false);
        return;
      }

      // Generate AI response if this is an AI session
      if (session.session_type.includes('ai')) {
        try {
          const aiResult = await OpenRouterService.generateDoctorResponse(
            messageContent,
            messages, // Pass conversation history
            session.session_type,
            dbContext  // Pass database context with patient/doctor info
          );

          if (aiResult.success && aiResult.response) {
            // Send AI response using the hook's sendMessage function
            await sendMessage(aiResult.response, true); // true marks it as AI message
          } else {
            setError(`AI Response Error: ${aiResult.error}`);
          }
        } catch (aiError) {
          setError('Failed to generate AI response. Please try again.');
        }
      }

      // Only set loading to false after everything is complete
      setIsLoading(false);
      onSessionUpdate?.();

    } catch (error) {
      toast({
        title: "Network Error",
        description: "Failed to send message. Please check your connection and try again.",
        variant: "destructive",
      });
      setNewMessage(messageContent);
      setIsLoading(false);
    }
  };

  const getMessageIcon = (message: Message) => {
    if (message.is_ai_message) {
      return <Bot className="h-4 w-4" />;
    }
    
    const isDoctorPatientChat = session?.session_type === 'doctor-patient';
    const isCurrentUserMessage = message.sender_id === (user?.auth_user_id || user?.id);
    
    if (isDoctorPatientChat) {
      if (user?.role === 'doctor') {
        return isCurrentUserMessage ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />;
      } else {
        return isCurrentUserMessage ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />;
      }
    } else {
      return isCurrentUserMessage ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />;
    }
  };

  const getMessageStyle = (message: Message) => {
    // This function is no longer used since we handle styling in JSX
    return '';
  };

  const getSenderName = (message: Message) => {
    if (message.is_ai_message) {
      return session?.session_type === 'ai-doctor' ? 'AI Assistant' : 'AI Support';
    } 
    
    const isDoctorPatientChat = session?.session_type === 'doctor-patient';
    const isCurrentUserMessage = message.sender_id === (user?.auth_user_id || user?.id);
    
    if (isDoctorPatientChat) {
      // For doctor-patient chat
      if (user?.role === 'doctor') {
        return isCurrentUserMessage ? 'You' : 'Patient';
      } else {
        return isCurrentUserMessage ? 'You' : 'Doctor';
      }
    } else {
      // For AI chats
      return isCurrentUserMessage ? 'You' : (user?.role === 'doctor' ? 'Patient' : 'Doctor');
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <Stethoscope className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Select a Patient to Start Chatting
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a patient from the sidebar to begin a conversation and provide care.
          </p>
          {onNewSession && (
            <Button
              onClick={onNewSession}
              className="bg-primary hover:bg-primary-hover"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Start New Chat
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              {session.session_type.includes('ai') ? (
                <Bot className="h-6 w-6 text-blue-500" />
              ) : (
                <Stethoscope className="h-6 w-6 text-green-500" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                {session.session_type === 'ai-patient' 
                  ? 'Talk to AI Support' 
                  : session.session_type === 'ai-doctor'
                    ? 'AI Medical Assistant'
                    : session.title || 'Chat Session'
                }
              </h3>
              <p className="text-sm text-gray-500">
                {session.session_type === 'ai-patient' && 'AI Support Chat'}
                {session.session_type === 'ai-doctor' && 'AI Medical Assistant'}
                {session.session_type === 'doctor-patient' && (
                  user?.role === 'doctor' ? 'Patient Communication' : 'Doctor Communication'
                )}
              </p>
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                {session.session_type === 'ai-patient' 
                  ? "I'm here to provide emotional support and stress relief. How are you feeling today?"
                  : "Ask me anything about medical cases, treatments, or patient care."
                }
              </p>
            </div>
          )}
          
          {messages.map((message) => {
            const isCurrentUserMessage = message.sender_id === (user?.auth_user_id || user?.id) && !message.is_ai_message;
            const isDoctorPatientChat = session?.session_type === 'doctor-patient';
            
            // For doctor-patient chat, doctor's messages should appear on right as "You"
            // For patients, doctor's messages appear on left as "Doctor"
            // For doctors, patient's messages appear on left as "Patient"
            const isUserMessage = isDoctorPatientChat 
              ? (user?.role === 'doctor' ? isCurrentUserMessage : false)
              : isCurrentUserMessage;
            
            const isAIMessage = message.is_ai_message;
            
            return (
              <div
                key={message.id}
                className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${
                  isUserMessage ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isUserMessage
                      ? 'bg-blue-500 text-white'
                      : isAIMessage
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-500 text-white'
                  }`}>
                    {getMessageIcon(message)}
                  </div>

                  {/* Message Content */}
                  <div className={`flex flex-col ${
                    isUserMessage ? 'items-end' : 'items-start'
                  }`}>
                    {/* Sender Name & Time */}
                    <div className={`flex items-center space-x-2 mb-1 ${
                      isUserMessage ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <span className="text-sm font-medium text-gray-700">
                        {getSenderName(message)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    
                    {/* Message Bubble */}
                    <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                      isUserMessage
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : isAIMessage
                          ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                          : 'bg-green-100 text-green-800 rounded-bl-md'
                    }`}>
                      {isAIMessage ? (
                        <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-800 prose-strong:text-gray-900 prose-code:text-gray-700 prose-pre:bg-gray-200 prose-pre:text-gray-900">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-[80%]">
                {/* AI Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>

                {/* Typing Indicator */}
                <div className="flex flex-col items-start">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {session.session_type === 'ai-patient' ? 'AI Support' : 'AI Assistant'}
                    </span>
                  </div>
                  
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-gray-100 shadow-sm">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-500 ml-2">AI is typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="px-6 py-4 border-t bg-white relative">
        <div className="max-w-3xl mx-auto">
          {/* Patient List Dropdown - only for doctors */}
          {isDoctorAIChat && showPatientList && patients.length > 0 && (
            <div className="absolute bottom-full mb-2 left-6 right-6 max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {patients.map((patient) => (
                <div
                  key={patient.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handlePatientSelect(patient)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-500">
                        {patient.age && `${patient.age} years old`}
                        {patient.gender && ` • ${patient.gender}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              placeholder={isDoctorAIChat ? "Type your message... (use @ to mention patients)" : "Type your message..."}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && (!isDoctorAIChat || !showPatientList)) {
                  handleSendMessage();
                } else if (e.key === 'Escape' && isDoctorAIChat) {
                  setShowPatientList(false);
                }
              }}
              disabled={isLoading}
              className="flex-1 border-gray-200 rounded-full px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !newMessage.trim()}
              className="bg-blue-500 hover:bg-blue-600 rounded-full w-12 h-12 p-0 shadow-sm"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>

          {/* Selected Patient Indicator - only for doctors */}
          {isDoctorAIChat && selectedPatient && (
            <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
              <span>Context: {selectedPatient.name}</span>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;