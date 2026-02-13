import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

// Types and Interfaces
type DoctorPatientChatSession = Database['public']['Tables']['chat_sessions']['Row'] & { session_type: 'doctor-patient' };
type DoctorPatientMessage = Database['public']['Tables']['messages']['Row'];

interface HookReturn {
  sessions: DoctorPatientChatSession[];
  messages: DoctorPatientMessage[];
  loading: boolean;
  fetchSessions: () => Promise<void>;
  fetchMessages: () => Promise<void>;
  createSession: (doctorId: string, patientId: string, title?: string) => Promise<DoctorPatientChatSession | null>;
  sendMessage: (content: string) => Promise<DoctorPatientMessage | null>;
  markMessagesAsRead: () => Promise<void>;
  getOrCreateSession: (doctorId: string, patientId: string) => Promise<string | null>;
}

export const useDoctorPatientChat = (sessionId: string | null) => {
  // State and Context
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DoctorPatientChatSession[]>([]);
  const [messages, setMessages] = useState<DoctorPatientMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Constants
  const CHAT_SESSIONS_TABLE = 'chat_sessions';
  const MESSAGES_TABLE = 'messages';

  const getOrCreateSession = useCallback(async (doctorId: string, patientId: string): Promise<string | null> => {
    try {
      console.log('Calling getOrCreateSession with:', { doctorId, patientId });

      const { data, error } = await (supabase.rpc as any)('get_or_create_doctor_patient_session', {
        p_doctor_id: doctorId,
        p_patient_id: patientId,
      });

      if (error) {
        console.error('Error in getOrCreateSession RPC:', error);
        throw error;
      }

      console.log('RPC response:', data);

      if (data && Array.isArray(data) && data.length > 0) {
        const sessionId = data[0]; // data[0] is the session_id directly
        console.log('getOrCreateSession returned session ID:', sessionId);
        return sessionId;
      }

      console.warn('getOrCreateSession returned no session ID');
      return null;

    } catch (error) {
      console.error('Error in getOrCreateSession:', error);
      return null;
    }
  }, []);
  const fetchSessions = useCallback(async () => {
    if (!user?.id) {
      console.log('fetchSessions: User not available');
      setSessions([]);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching doctor-patient sessions for user:', user.id);

      const { data, error } = await supabase
        .from(CHAT_SESSIONS_TABLE)
        .select('*')
        .eq('session_type', 'doctor-patient')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        setSessions([]);
        return;
      }

      console.log('Sessions fetched successfully:', data?.length || 0, 'sessions');
      setSessions(data as DoctorPatientChatSession[] || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
     if (!user?.id) {
      console.log('fetchMessages: User not available');
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching doctor-patient messages for session:', sessionId);

      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
        return;
      }

      console.log('Messages fetched successfully:', data?.length || 0, 'messages');
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  const createSession = useCallback(async (doctorId: string, patientId: string, title?: string) => {
    if (!user?.id) {
      console.error('createSession: User not available');
      return null;
    }

    try {
      setLoading(true);
      console.log('Creating doctor-patient session:', { doctorId, patientId, title });

      const { data, error } = await supabase
        .from(CHAT_SESSIONS_TABLE)
        .insert({
          participant_1_id: doctorId,
          participant_2_id: patientId,
          title: title || `Chat with patient`,
          session_type: 'doctor-patient',
        })
        .select()
        .maybeSingle(); // Use maybeSingle to avoid JSON coercion errors

      if (error) {
        console.error('Error creating doctor-patient session:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to create session - no data returned');
      }

      console.log('Session created successfully:', data.id);
      await fetchSessions();
      return data as DoctorPatientChatSession;
    } catch (error) {
      console.error('Error creating doctor-patient session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchSessions]);

  const sendMessage = useCallback(async (content: string, sessionId: string) => {
    if (!sessionId || !user?.id) {
      console.error('Missing sessionId or user for sending message');
      return null;
    }

    try {
      console.log('Sending message:', { sessionId, senderId: user.id });

      // Get the session to determine the receiver
      const { data: sessionData, error: sessionError } = await supabase
        .from(CHAT_SESSIONS_TABLE)
        .select('participant_1_id, participant_2_id')
        .eq('id', sessionId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid JSON coercion errors

      if (sessionError) {
        console.error('Error fetching session for receiver:', sessionError);
        throw sessionError;
      }

      if (!sessionData) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Determine receiver ID (the other participant)
      const receiverId = sessionData.participant_1_id === user.id
        ? sessionData.participant_2_id
        : sessionData.participant_1_id;

      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .insert({
          session_id: sessionId,
          sender_id: user.id, // Fixed: sender should be the current user
          receiver_id: receiverId,
          content: content,
        })
        .select()
        .maybeSingle(); // Use maybeSingle to avoid JSON coercion errors

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to send message - no data returned');
      }

      console.log('Message sent successfully:', data.id);
      // The realtime subscription will handle adding the message to the state
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [user?.id]);

  const markMessagesAsRead = useCallback(async () => {
    if (!sessionId || !user?.id) return;

    try {
      console.log('Marking messages as read:', { sessionId });

      const { error } = await supabase
        .from(MESSAGES_TABLE)
        .update({ is_read: true })
        .eq('session_id', sessionId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        throw error;
      }

      console.log('Messages marked as read successfully');
      setMessages(prev =>
        prev.map(msg =>
          msg.sender_id !== user.id && !msg.is_read
            ? { ...msg, is_read: true }
            : msg
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }, [sessionId, user?.id]);

  // Effect Hooks
  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
  }, [user?.id, fetchSessions]);

  useEffect(() => {
    if (sessionId && user?.id) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [sessionId, user?.id, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId || !user?.id) {
      console.log('Missing sessionId or user, skipping realtime subscription');
      return;
    }

    const channelName = `doctor-patient-chat-${sessionId}-${Date.now()}`;
    console.log('Setting up realtime subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: MESSAGES_TABLE,
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('🎉 Realtime message received:', payload);

          const newMessage = payload.new as DoctorPatientMessage;

          if (!newMessage || !newMessage.id) {
            console.warn('Invalid payload received:', payload);
            return;
          }

          setMessages(prev => {
            // Check for duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              console.log('Message already exists, skipping:', newMessage.id);
              return prev;
            }
            console.log('✅ Adding new message to state:', newMessage.id);
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime subscription status for ${channelName}:`, status);

        if (err) {
          console.error('Realtime subscription error details:', err);
          return;
        }

        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime updates for session:', sessionId);
        }
      });

    // Cleanup function to unsubscribe when component unmounts or sessionId changes
    return () => {
      console.log('🧹 Cleaning up realtime subscription for session:', sessionId);
      supabase.removeChannel(channel);
    };
  }, [sessionId, user?.id]);

  return {
    sessions,
    messages,
    loading,
    fetchSessions,
    fetchMessages,
    createSession,
    sendMessage,
    markMessagesAsRead,
    getOrCreateSession,
  };
};