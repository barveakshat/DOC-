import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export const useChatSessions = (sessionType?: string) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('chat_sessions')
        .select('*')
        .or(`participant_1_id.eq.${user.auth_user_id || user.id},participant_2_id.eq.${user.auth_user_id || user.id}`) // Use auth user ID
        .order('last_message_at', { ascending: false });

      if (sessionType) {
        query = query.eq('session_type', sessionType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (sessionType: string, title?: string, participantId?: string) => {
    if (!user) return null;

    try {
      const sessionData = {
        session_type: sessionType,
        participant_1_id: user.auth_user_id || user.id, // Use auth user ID
        participant_2_id: participantId || null,
        title: title || `New ${sessionType.replace('-', ' ')} session`,
      };

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creating chat session:', error);
      return null;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(session => session.id !== sessionId));
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user, sessionType]);

  return {
    sessions,
    loading,
    fetchSessions,
    createSession,
    deleteSession,
  };
};

export const useMessages = (sessionId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      console.log('Fetching messages for session:', sessionId);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        // If the table doesn't exist, just set empty messages
        if (error.code === '42P01') { // Table doesn't exist
          console.warn('Messages table does not exist yet');
          setMessages([]);
        } else {
          throw error;
        }
      } else {
        console.log('Messages fetched successfully:', data?.length || 0, 'messages');
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const sendMessage = async (content: string, isAiMessage = false) => {
    if (!sessionId) {
      console.error('No sessionId provided to sendMessage');
      return null;
    }

    console.log('sendMessage called with:', { content, isAiMessage, sessionId });

    if (!user) {
      console.error('No authenticated user found from AuthContext');
      return null;
    }

    try {
      const messageData = {
        session_id: sessionId,
        sender_id: user.auth_user_id || user.id, // Use auth_user_id for database compatibility
        content,
        is_ai_message: isAiMessage,
      };
      console.log('Inserting message data:', messageData);

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        console.error('Database error inserting message:', error);
        // If the table doesn't exist, show a helpful error
        if (error.code === '42P01') { // Table doesn't exist
          throw new Error('Chat functionality is not available yet. Please contact support.');
        }
        throw error;
      }

      console.log('Message inserted successfully:', data);
      // Don't add to local state immediately - let real-time subscription handle it
      // This prevents duplicate messages and ensures real-time delivery works properly
      // setMessages(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!sessionId) {
      console.log('useMessages: No sessionId provided, skipping real-time subscription setup');
      return;
    }

    console.log('useMessages: Setting up real-time subscription for messages in session:', sessionId);

    const channelName = `chat-messages-${sessionId}-${Date.now()}`;
    console.log('Creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('useMessages: Real-time new message received:', payload);
          setMessages(prev => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some(msg => msg.id === payload.new.id);
            if (exists) {
              console.log('useMessages: Message already exists, skipping duplicate');
              return prev;
            }
            console.log('useMessages: Adding new message to messages array');
            return [...prev, payload.new as Message];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('useMessages: Message updated:', payload);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id
                ? { ...msg, ...payload.new } as Message
                : msg
            )
          );
        }
      )
      .subscribe((status, err) => {
        console.log('useMessages: Real-time subscription status:', status);
        if (err) {
          console.error('Realtime subscription error details:', err);
          console.error('Error message:', err.message);
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime updates for messages in session:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription CHANNEL_ERROR for messages in session:', sessionId, err);
        }
      });

    return () => {
      console.log('useMessages: Cleaning up real-time subscription for messages in session:', sessionId);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return {
    messages,
    loading,
    sendMessage,
    fetchMessages,
  };
};