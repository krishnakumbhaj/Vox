'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSession, signOut } from 'next-auth/react';
import { 
  Database, Loader2, CheckCircle, XCircle, MessageCircle, 
  Plus, Trash2, Settings, FileText, BarChart3, Copy, X, ChevronDown, Clock, 
  PanelLeftOpen, PanelLeftClose, User, LogOut, ChevronUp, Menu
} from 'lucide-react';
import Image from 'next/image';
import Logo from '@/app/images/Logo.png';
import Logo_name from '@/app/images/Logo_name.png';
import {ClimbingBoxLoader} from 'react-spinners';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { PromptInputCustom } from '@/components/PromptInputCustom';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sqlQuery?: string;
  data?: Record<string, unknown>[];
  visualizationData?: Record<string, unknown>;
}

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

interface ConnectionStatus {
  connected: boolean;
  tables_count: number;
  tables: string[];
  message: string;
}

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

export default function ChatInterface() {
  const { data: session, status } = useSession();
  
  // Chat Management State
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  
  // User Profile Dropdown State
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Delete Confirmation Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; title: string } | null>(null);

  // Database Connection State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false, tables_count: 0, tables: [], message: 'Not connected'
  });
  const [connectionError, setConnectionError] = useState<string>('');
  const [connectionForm, setConnectionForm] = useState({
    db_type: 'postgresql', host: 'localhost', port: '5432',
    database: '', username: '', password: ''
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State to track if user has started typing/querying (for immediate UI transition)
  const [hasStartedChat, setHasStartedChat] = useState(false);
  
  // Processing animation states
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
  const [processingOpacity, setProcessingOpacity] = useState(1);
  
  // Array of processing messages - More engaging and friendly
  const processingMessages = [
    "🔍 Reading your mind...",
    "🧠 Thinking deeply...", 
    "✨ Crafting the perfect query...",
    "⚡ Running database magic...",
    "📊 Crunching numbers...",
    "🎯 Finding insights...",
    "🚀 Almost there...",
    "💫 Polishing results..."
  ];

  // Random greeting messages
  const greetings = [
    "Back at it",
    "Welcome back",
    "Hello again",
    "Great to see you",
    "Ready to explore",
    "Let's dive in",
    "Time to query",
    "Hey there",
    "Good to have you back",
    "Let's get querying",
    "Ready for insights",
    "Let's analyze some data",
    "Time to explore",
    "Looking good",
    "Here we go",
    "Let's make magic happen",
    "Data time",
    "Ready to rock",
    "Let's uncover insights",
    "Another day, another query"
  ];

  // Select random greeting on mount
  const [randomGreeting] = useState(() => 
    greetings[Math.floor(Math.random() * greetings.length)]
  );
  
  // Determine if chat is empty (for dynamic input positioning)
  const isChatEmpty = messages.length === 0 && !hasStartedChat;

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      
      // Small delay to ensure DOM is updated, then scroll to bottom with margin
      setTimeout(() => {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const bottomMargin = 100; // pixels of space from bottom
        
        // Always scroll to bottom with margin when new messages are added
        container.scrollTop = scrollHeight - clientHeight + bottomMargin;
      }, 100);
    }
  }, [messages]);

  // Processing animation effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let opacityIntervalId: NodeJS.Timeout;

    if (isLoading) {
      // Rotate through processing messages every 2 seconds
      intervalId = setInterval(() => {
        setProcessingMessageIndex(prev => 
          (prev + 1) % processingMessages.length
        );
      }, 2000);

      // Animate opacity every 1 second (faster for smooth pulsing effect)
      opacityIntervalId = setInterval(() => {
        setProcessingOpacity(prev => prev === 1 ? 0.4 : 1);
      }, 1000);
    } else {
      // Reset when not loading
      setProcessingMessageIndex(0);
      setProcessingOpacity(1);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (opacityIntervalId) clearInterval(opacityIntervalId);
    };
  }, [isLoading, processingMessages.length]);

  // Load all chats for sidebar
  const loadChats = useCallback(async () => {
    try {
      const response = await fetch('/api/chat');
      if (response.ok) {
        const { success, chats } = await response.json();
        if (success) {
          setChats(chats);
          // Auto-select first chat if none selected
          if (chats.length > 0 && !currentChatId) {
            setCurrentChatId(chats[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  }, [currentChatId]);

  // Load chats and check connection on mount
  useEffect(() => {
    if (session?.user?.email) {
      loadChats();
      checkConnectionStatus();
    }
  }, [session, loadChats]);

  // Load chat history when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      loadChatMessages(currentChatId);
    }
  }, [currentChatId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isMobile) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isMobile]);

  // Load messages for specific chat
  const loadChatMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`);
      if (response.ok) {
        const { success, chat } = await response.json();
        if (success && chat.messages) {
          setMessages(chat.messages);
          // Reset hasStartedChat when loading existing chat with messages
          if (chat.messages.length > 0) {
            setHasStartedChat(true);
          } else {
            setHasStartedChat(false);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

  // Create new chat
  const createNewChat = async (firstMessage?: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: firstMessage ? 
            firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '') : 
            'New Database Query',
          firstMessage
        })
      });

      if (response.ok) {
        const { success, chat } = await response.json();
        if (success) {
          await loadChats(); // Refresh sidebar
          setCurrentChatId(chat.id);
          setMessages(chat.messages || []);
          // Reset hasStartedChat for new empty chat
          setHasStartedChat(false);
          // Close sidebar on mobile after creating chat
          if (isMobile) {
            setIsSidebarOpen(false);
          }
          return chat.id;
        }
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
    return null;
  };

  // Check FastAPI connection status
  const checkConnectionStatus = async () => {
    try {
      setConnectionError('');
      const response = await fetch(`${FASTAPI_BASE_URL}/connection-status`);
      
      if (response.ok) {
        const status = await response.json();
        setConnectionStatus(status);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(`Cannot connect to FastAPI backend: ${errorMessage}`);
      setConnectionStatus({
        connected: false, tables_count: 0, tables: [],
        message: 'Backend connection failed'
      });
    }
  };

  // Connect to database via FastAPI
  const connectToDatabase = async () => {
    setIsLoading(true);
    setConnectionError('');
    
    try {
      const response = await fetch(`${FASTAPI_BASE_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm)
      });

      if (response.ok) {
        const status = await response.json();
        setConnectionStatus(status);
        setShowConnectionModal(false);
        addSystemMessage(`✅ Connected to ${connectionForm.database}! Found ${status.tables_count} tables.`);
      } else {
        const error = await response.json();
        addSystemMessage(`❌ Connection failed: ${error.detail}`, true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(`Cannot connect to FastAPI backend: ${errorMessage}`);
      addSystemMessage('❌ Connection failed: Backend unavailable', true);
    }
    setIsLoading(false);
  };

  // Stop generation function
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      
      // Add a message indicating generation was stopped
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.content) {
          // Remove empty assistant message
          newMessages.pop();
        } else if (lastMessage && lastMessage.role === 'assistant') {
          // Add stopped indicator to existing content
          lastMessage.content += '\n\n_[Generation stopped by user]_';
        }
        return newMessages;
      });
    }
  };

  // Execute query through NextJS API (which calls FastAPI)
  const executeQuery = async (query: string) => {
    if (!query.trim() || isLoading || !session?.user?.email) return;

    // Immediately set hasStartedChat to true to trigger layout change
    setHasStartedChat(true);

    // Add user message immediately to the UI
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    let chatId = currentChatId;
    
    // Create new chat if none exists
    if (!chatId) {
      chatId = await createNewChat(query);
      if (!chatId) {
        addSystemMessage('❌ Failed to create chat', true);
        return;
      }
    }

    setIsLoading(true);
    setCurrentQuery('');

    // Create placeholder assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const placeholderMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, placeholderMessage]);

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query.trim(), 
          chatId 
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status}`);
      }

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';
      let collectedContent = '';
      let collectedSQL: string | null = null;
      let collectedData: Record<string, unknown>[] | null = null;
      let serverMessageId = assistantMessageId;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              
              switch (event.type) {
                case 'assistant_message_id':
                  serverMessageId = event.content;
                  // Update the message ID
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, id: serverMessageId }
                      : msg
                  ));
                  break;

                case 'text':
                  collectedContent += event.content;
                  // Force a new object creation to trigger React re-render
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const index = newMessages.findIndex(msg => msg.id === serverMessageId);
                    if (index !== -1) {
                      newMessages[index] = {
                        ...newMessages[index],
                        content: collectedContent,
                        timestamp: new Date().toISOString() // Update timestamp to force re-render
                      };
                    }
                    return newMessages;
                  });
                  break;

                case 'sql':
                  collectedSQL = event.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const index = newMessages.findIndex(msg => msg.id === serverMessageId);
                    if (index !== -1) {
                      newMessages[index] = {
                        ...newMessages[index],
                        sqlQuery: collectedSQL!
                      };
                    }
                    return newMessages;
                  });
                  break;

                case 'data':
                  collectedData = event.content;
                  console.log('📊 Data received from API:', {
                    dataLength: collectedData?.length,
                    hasVisualization: !!event.visualization,
                    sampleData: collectedData?.slice(0, 2)
                  });
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const index = newMessages.findIndex(msg => msg.id === serverMessageId);
                    if (index !== -1) {
                      newMessages[index] = {
                        ...newMessages[index],
                        data: collectedData!,
                        visualizationData: event.visualization
                      };
                      console.log('✅ Message updated with data:', newMessages[index].data?.length, 'rows');
                    }
                    return newMessages;
                  });
                  break;

                case 'metadata':
                  loadChats();
                  break;

                case 'error':
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const index = newMessages.findIndex(msg => msg.id === serverMessageId);
                    if (index !== -1) {
                      newMessages[index] = {
                        ...newMessages[index],
                        content: `❌ Error: ${event.content}`
                      };
                    }
                    return newMessages;
                  });
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing SSE event:', parseError);
            }
          }
        }
      }    } catch (error) {
      // Check if error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user');
        return; // Don't show error message for user-initiated stops
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: `❌ Query failed: ${errorMessage}` }
          : msg
      ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Delete chat
  // Open delete confirmation dialog
  const openDeleteDialog = (chatId: string, chatTitle: string) => {
    setChatToDelete({ id: chatId, title: chatTitle });
    setDeleteDialogOpen(true);
  };

  // Actual delete function (called after confirmation)
  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`, { method: 'DELETE' });
      if (response.ok) {
        await loadChats();
        if (currentChatId === chatId) {
          setCurrentChatId('');
          setMessages([]);
          // Reset hasStartedChat when clearing current chat
          setHasStartedChat(false);
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  // Handle sidebar toggle with mobile considerations
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when selecting chat on mobile
  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const addSystemMessage = (message: string, isError = false) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, systemMessage]);
    console.log('Connection Status:', isError ? connectionError : connectionStatus);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center text-[#ff4866] justify-center h-screen bg-[#1f1e1d]">
        <div className="text-center text-[#ff4866]">
          <ClimbingBoxLoader color="#ff4866" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br">
        <div className="text-center p-8  rounded-2xl shadow-lg">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Enhanced Sidebar with Mobile Overlay */}
      <div 
        className={`${
          isMobile 
            ? `fixed inset-y-0 left-0 z-50 bg-[#1f1e1d] transition-transform duration-300 ease-in-out ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } w-80`
            : `bg-[#1f1e1d] flex flex-col relative transition-all duration-300 ease-in-out ${
                isSidebarOpen ? '' : 'items-center'
              }`
        } flex flex-col`}
        style={!isMobile ? { 
          width: isSidebarOpen ? `${sidebarWidth}px` : '60px',
          minWidth: isSidebarOpen ? '250px' : '60px'
        } : {}}
      >
        {/* Sidebar Header with Toggle Button */}
        <div className={`p-3 lg:p-2 bg-[#1f1e1d] mt-5 text-white transition-all duration-300 ${
          isSidebarOpen ? '' : 'px-1'
        }`}>
          <div className={`flex items-center mb-4 transition-all duration-300 ${
            isSidebarOpen ? 'justify-between' : 'justify-center flex-col gap-2'
          }`}>
            <div className={`flex items-center transition-all duration-300 ${
              isSidebarOpen ? 'gap-3' : 'flex-col gap-2'
            }`}>
              <Image 
                src={Logo} 
                alt="Logo" 
                width={35} 
                height={35} 
                className="rounded-full transition-all duration-300" 
              />
              {isSidebarOpen && (
                <Image 
                  src={Logo_name} 
                  alt="Logo" 
                  width={75} 
                  height={55} 
                  className="rounded-full transition-opacity duration-300" 
                />
              )}
            </div>
            
            {/* Toggle button - always visible but repositioned */}
            <button
              onClick={toggleSidebar}
              className={`p-2 hover:text-[#ff4866] text-[#ff4866] rounded-xl transition-all duration-300 group ${
                isSidebarOpen ? '' : 'mt-2'
              }`}
              title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {isMobile ? (
                <X className="w-6 h-6 text-white group-hover:text-[#ff4866] group-hover:scale-110 transition-all" />
              ) : isSidebarOpen ? (
                <PanelLeftClose className="w-6 h-6 text-white group-hover:text-[#ff4866] group-hover:scale-110 transition-all" />
              ) : (
                <PanelLeftOpen className="w-6 h-6 text-white group-hover:text-[#ff4866] group-hover:scale-110 transition-all" />
              )}
            </button>
          </div>

          <button
            onClick={() => createNewChat()}
            className={`flex items-center justify-center gap-2 w-10 h-10 bg-[#ff4866] hover:bg-[#ff8c65] text-white rounded-full transition-all duration-200 font-medium hover:scale-[1.02] ${
              isSidebarOpen ? 'w-10' : 'w-10'
            }`}
            title={isSidebarOpen ? '' : 'New Chat'}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
        
        {/* Chat List - Only show when sidebar is open */}
        {isSidebarOpen && (
          <div className="flex-1 bg-[#1f1e1d] overflow-y-auto scrollbar-hidden px-2 transition-all duration-300">
            <div className="space-y-1 bg-[#1f1e1d] py-3">
              {chats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={`group p-3 mx-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    currentChatId === chat.id 
                      ? 'bg-[#30302e] border-l-4 border-l-[#ff9542] shadow-sm' 
                      : 'hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-white truncate mb-1">{chat.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white">
                        <MessageCircle className="w-3 h-3" />
                        <span>{chat.messageCount} messages</span>
                        <Clock className="w-3 h-3 ml-1" />
                        <span>{new Date(chat.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(chat.id, chat.title);
                      }}
                      className="ml-2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {chats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                
              </div>
            )}
          </div>
        )}

        {/* Collapsed state hint - Only show when collapsed and has chats */}
        {!isSidebarOpen && chats.length > 0 && !isMobile && (
          <div className="flex-1 bg-[#1f1e1d] flex flex-col items-center justify-center py-4">
            
          </div>
        )}

        {/* User Profile Section - Adapted for collapsed state */}
        <div className={`p-1 bg-[#1f1e1d] transition-all duration-300 ${
          isSidebarOpen ? '' : 'px-2'
        }`}>
          <div className="relative">
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className={`w-full flex items-center gap-3 py-3 px-1.5 text-white hover:bg-[#30302e] rounded-lg transition-all duration-200 ${
                isSidebarOpen ? '' : 'justify-center flex-col gap-1'
              }`}
            >
              <div className="w-8 h-8 bg-[#ff4866] rounded-full flex items-center justify-center">
                {(session.user?.name || session.user?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
              </div>
              
              {isSidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white truncate">
                      {session.user?.name || session.user?.email?.split('@')[0]}
                    </p>
                  </div>
                  {isProfileDropdownOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </>
              )}
            </button>

            {/* Dropdown Menu - Only show when sidebar is open */}
            {isProfileDropdownOpen && isSidebarOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#30302e] rounded-lg shadow-lg overflow-hidden">
                {/* User Info Section */}
                <div className="p-3 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ff4866] rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {session.user?.username || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowConnectionModal(true);
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-zinc-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Database Settings
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#ff9542] hover:text-red-300 hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle - Only show when sidebar is open and not mobile */}
        {isSidebarOpen && !isMobile && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 hover:bg-gray-300 cursor-col-resize transition-colors"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-[#262624] flex flex-col min-h-screen sm:min-h-0 overflow-x-hidden">
        {/* Mobile Header with Hamburger Menu */}
        {isMobile && (
          <div className="lg:hidden p-4 bg-[#262624] border-b border-gray-800 flex items-center justify-between">
            <button
              onClick={toggleSidebar}
              className="p-2 text-white hover:text-[#ff4866] rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-3">
              {/* Mobile Connection Status */}
              <button
                onClick={() => setShowConnectionModal(true)}
                className={`px-3 py-1.5 rounded-full flex items-center gap-2 transition-all font-medium text-xs ${
                  connectionStatus.connected 
                    ? 'text-[#ffc655] border border-green-200' 
                    : 'text-[#ff4866] border border-red-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {connectionStatus.connected ? 'Connected' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        {/* Desktop Header - Only show when there are messages and not mobile */}
        {!isChatEmpty && !isMobile && (
          <div className="p-6 bg-[#262624] backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-100">
                    Welcome back, <span className="font-medium text-[#ff4866]">{session.user?.name || session.user?.username?.split('@')[0]}</span>
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Connection Status and Button */}
                <button
                  onClick={() => setShowConnectionModal(true)}
                  className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all font-medium text-sm ${
                    connectionStatus.connected 
                      ? 'text-[#ffc655] border border-green-200 hover:bg-green-100' 
                      : 'text-[#ff4866] border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {connectionStatus.connected ? 'Connected' : 'Connect DB'}
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages or Welcome Screen */}
        <div 
          ref={chatContainerRef} 
          className={`flex-1 overflow-y-auto scrollbar-hidden transition-all duration-500 ${
            isChatEmpty 
              ? 'flex items-center justify-center' 
              : 'px-4 sm:px-8 lg:px-48 space-y-6 pb-32'
          }`}
        >
          {isChatEmpty ? (
            <div className="text-center text-gray-500 w-full sm:w-4/5 lg:w-3/5 mx-auto px-4">
              {/* Welcome Content */}
              <div className="inline-flex p-4 rounded-full ">
                <Image src={Logo} alt="Logo" width={isMobile ? 100 : 60} height={isMobile ? 100 : 60} className="rounded-full" />
              </div>
              <h3 className="text-5xl sm:text-5xl lg:text-4xl font-semibold text-white mb-4">
                {randomGreeting}, <span className="font-medium text-[#ff4866]">{session.user?.name || session.user?.username?.split('@')[0]}</span>
              </h3>
              <p className="text-white mb-8 lg:mb-6 text-sm">Connect to a database and ask questions in natural language</p>
              
              {/* Centered Input Bar */}
              <div className="relative w-full max-w-[95%] sm:max-w-3xl lg:max-w-4xl bg-[#30302e] rounded-2xl sm:rounded-3xl mx-auto px-2 sm:px-4 lg:px-0">
                <PromptInputCustom
                  value={currentQuery}
                  onValueChange={setCurrentQuery}
                  onSubmit={() => executeQuery(currentQuery)}
                  onStop={stopGeneration}
                  isLoading={isLoading}
                  disabled={!connectionStatus.connected}
                  placeholder={connectionStatus.connected ? 
                    "Ask something about your database..." : 
                    "Connect to a database first..."
                  }
                />
              </div>
              {/* Connection Status for Empty State - Hidden on mobile header */}
              {!isMobile && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => setShowConnectionModal(true)}
                    className={`px-6 py-3 rounded-full flex items-center gap-3 transition-all font-medium ${
                      connectionStatus.connected 
                        ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' 
                        : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${
                      connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {connectionStatus.connected ? 'Database Connected' : 'Connect to Database'}
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {/* Loading State for Empty Chat */}
              {isLoading && (
                <div className="flex items-center justify-center gap-3 text-white p-4 sm:p-6 rounded-2xl mt-6 sm:mt-8 max-w-md mx-auto shadow-lg">
                  <span 
                    className="text-sm sm:text-base font-medium transition-opacity duration-1000 ease-in-out"
                    style={{ opacity: processingOpacity }}
                  >
                    {processingMessages[processingMessageIndex]}
                  </span> 
                  <ChevronDown className="w-4 h-4 animate-bounce text-white mt-9" />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Existing Messages */}
              {messages.map((msg, index) => (
                <div key={`${msg.id}-${index}`}>
                  {/* Show processing indicator BEFORE the assistant message if it's loading and has no content yet */}
                  {isLoading && index === messages.length - 1 && msg.role === 'assistant' && !msg.content && (
                    <div className="flex items-start gap-3 mb-2">
                      {/* Logo Avatar */}
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#30302e] p-1">
                          <Image src={Logo} alt="Vox AI" width={32} height={32} className="rounded-full" />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-white p-2 sm:p-3 rounded-2xl">
                        <span 
                          className="text-sm sm:text-base font-medium transition-opacity duration-1000 ease-in-out"
                          style={{ opacity: processingOpacity }}
                        >
                          {processingMessages[processingMessageIndex]}
                        </span>
                        <ChevronDown className="w-4 h-4 animate-bounce text-white mt-2" />
                      </div>
                    </div>
                  )}
                  
                  <MessageComponent message={msg} isMobile={isMobile} session={session} />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Bottom Input Bar - Only show when there are messages */}
        {!isChatEmpty && (
          <div className="pb-4 sm:pb-4 pt-1 bg-[#262624] px-3 sm:px-0">
            <div className="relative bg-[#30302e] rounded-2xl sm:rounded-3xl max-w-4xl mx-auto px-2 sm:px-4 lg:px-0 mb-safe animate-slide-down">
              <PromptInputCustom
                value={currentQuery}
                onValueChange={setCurrentQuery}
                onSubmit={() => executeQuery(currentQuery)}
                onStop={stopGeneration}
                isLoading={isLoading}
                disabled={!connectionStatus.connected}
                placeholder={connectionStatus.connected ? 
                  "Ask something about your database..." : 
                  "Connect to a database first..."
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Connection Modal - Wide Modern Design */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-[#1f1e1d] rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-800 max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#ff4866] to-[#ff6b7d] px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg sm:rounded-xl backdrop-blur-sm">
                    <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-xl font-bold text-white">Database Connection</h3>
                    <p className="text-xs sm:text-sm text-white/80 hidden sm:block">Configure your database credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConnectionModal(false)}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* Connection Status Banner */}
              <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 ${
                connectionStatus.connected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl ${
                    connectionStatus.connected ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {connectionStatus.connected ? (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm sm:text-base font-semibold ${
                      connectionStatus.connected ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {connectionStatus.message}
                    </p>
                    {connectionStatus.connected && (
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                        {connectionStatus.tables_count} tables available
                      </p>
                    )}
                  </div>
                </div>
                {connectionError && (
                  <p className="text-xs sm:text-sm text-red-400 mt-2 ml-8 sm:ml-11">{connectionError}</p>
                )}
              </div>

              {/* Connection Form - Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Left Column */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Database Type
                    </label>
                    <select
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none"
                      value={connectionForm.db_type}
                      onChange={(e) => setConnectionForm(prev => ({ 
                        ...prev, db_type: e.target.value,
                        port: e.target.value === 'postgresql' ? '5432' : 
                              e.target.value === 'mysql' ? '3306' : '1433'
                      }))}
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Host Address
                    </label>
                    <input
                      type="text" 
                      placeholder="localhost or IP"
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none placeholder-gray-500"
                      value={connectionForm.host}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                        Port
                      </label>
                      <input
                        type="text" 
                        placeholder="5432"
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none placeholder-gray-500"
                        value={connectionForm.port}
                        onChange={(e) => setConnectionForm(prev => ({ ...prev, port: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                        Database
                      </label>
                      <input
                        type="text" 
                        placeholder="database"
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none placeholder-gray-500"
                        value={connectionForm.database}
                        onChange={(e) => setConnectionForm(prev => ({ ...prev, database: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Username
                    </label>
                    <input
                      type="text" 
                      placeholder="Enter username"
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none placeholder-gray-500"
                      value={connectionForm.username}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                      Password
                    </label>
                    <input
                      type="password" 
                      placeholder="Enter password"
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white bg-[#30302e] border border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#ff4866] focus:border-[#ff4866] transition-all outline-none placeholder-gray-500"
                      value={connectionForm.password}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                    <button
                      onClick={() => setShowConnectionModal(false)}
                      className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base border-2 border-gray-700 text-gray-300 rounded-lg sm:rounded-xl hover:bg-[#30302e] transition-all duration-200 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={connectToDatabase}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-[#ff4866] to-[#ff6b7d] text-white rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-[#ff4866]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          <span className="hidden sm:inline">Connecting...</span>
                          <span className="sm:hidden">Connect...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="hidden sm:inline">Connect Database</span>
                          <span className="sm:hidden">Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => chatToDelete && deleteChat(chatToDelete.id)}
        chatTitle={chatToDelete?.title}
      />

      {/* Global Styles */}
      <style jsx global>{`
        .scrollbar-hidden {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;     /* Firefox */
        }

        .scrollbar-hidden::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }

        /* Animation for input bar sliding from center to bottom */
        @keyframes slideDown {
          from {
            transform: translateY(-50vh);
            opacity: 0.9;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-down {
          animation: slideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}

// Enhanced Message Component - Mobile Responsive
const MessageComponent: React.FC<{ message: Message; isMobile?: boolean; session: { user?: { name?: string | null; email?: string | null; username?: string | null } } | null }> = ({ message, isMobile = false, session }) => {
  const [showSql, setShowSql] = useState(false);
  const [showData, setShowData] = useState(true); // ALWAYS show data by default - user can hide if needed

  // Keep data visible when it arrives (for streaming messages)
  useEffect(() => {
    if (message.data !== undefined && message.data !== null && Array.isArray(message.data) && message.data.length > 0) {
      setShowData(true); // Force show when data arrives
      console.log('🔄 Data arrived, forcing showData to true:', message.data.length, 'rows');
    }
  }, [message.data]);

  const isUserMessage = message.role === 'user';
  const isSystemMessage = message.content.includes('✅') || message.content.includes('❌') || message.content.includes('🗑️');

  if (isUserMessage) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-2xl">
          <div className="bg-[#30302e] text-white rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-lg">
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {/* User Avatar */}
        <div className="flex-shrink-0 mt-2">
          <div className="w-8 h-8 rounded-full bg-[#ff4866] flex items-center justify-center text-white font-semibold text-sm">
            {(session?.user?.name || session?.user?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  if (isSystemMessage) {
    return (
      <div className="flex">
        <div className="max-w-md bg-[#30302e] text-white rounded-xl px-4 py-3 text-sm text-center">
          {message.content}
        </div>
      </div>
    );
  }

  // Check if there's SQL or data to show - Always show if data property exists (even if empty array)
  const hasDataContent = !!message.sqlQuery || (message.data !== undefined && message.data !== null);
  
  // Debug logging - CRITICAL for production debugging
  if (message.role === 'assistant' && hasDataContent) {
    console.log('🎨 Rendering message:', {
      id: message.id,
      hasData: !!message.data,
      dataIsArray: Array.isArray(message.data),
      dataLength: Array.isArray(message.data) ? message.data.length : 'NOT AN ARRAY',
      dataType: typeof message.data,
      showData: showData,
      hasSql: !!message.sqlQuery,
      firstItem: Array.isArray(message.data) && message.data.length > 0 ? message.data[0] : null
    });
  }
  
  // Don't render anything if message has no content (still loading - processing indicator will show instead)
  if (!message.content && !hasDataContent) {
    return null;
  }

  return (
    <div className="flex justify-start gap-3">
      {/* Logo Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-[#30302e] overflow-hidden mt-[-6] p-1">
          <Image src={Logo} alt="Vox AI" width={32} height={32} className="rounded-full" />
        </div>
      </div>
      
      <div className={`${isMobile ? 'max-w-full' : 'max-w-4xl'} w-full`}>
        {/* Text Response - No card, blends with background */}
        {message.content && (
          <div className="mb-4 text-white prose prose-invert max-w-none text-sm sm:text-base
            prose-headings:text-white prose-headings:font-bold prose-headings:mb-3 prose-headings:mt-4
            prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
            prose-p:text-gray-200 prose-p:leading-relaxed prose-p:mb-3
            prose-strong:text-[#ff9542] prose-strong:font-semibold
            prose-em:text-gray-300 prose-em:italic
            prose-ul:list-disc prose-ul:ml-5 prose-ul:my-3 prose-ul:space-y-2
            prose-ol:list-decimal prose-ol:ml-5 prose-ol:my-3 prose-ol:space-y-2
            prose-li:text-gray-200 prose-li:leading-relaxed prose-li:pl-1
            prose-code:text-[#ffc655] prose-code:bg-[#1f1e1d] prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
            prose-pre:bg-[#1f1e1d] prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
            prose-blockquote:border-l-4 prose-blockquote:border-[#ff4866] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-300
            prose-a:text-[#ff4866] prose-a:underline prose-a:hover:text-[#ff6b7d]
            prose-table:border-collapse prose-table:w-full prose-table:my-4
            prose-th:bg-[#1f1e1d] prose-th:text-white prose-th:font-semibold prose-th:px-4 prose-th:py-2 prose-th:border prose-th:border-gray-700
            prose-td:text-gray-200 prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-gray-700
            prose-hr:border-gray-700 prose-hr:my-4
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            {/* Show cursor effect when message is empty (streaming just started) or very short */}
            {message.content.length < 10 && (
              <span className="inline-block w-2 h-4 bg-[#ff9542] animate-pulse ml-1"></span>
            )}
          </div>
        )}

        {/* SQL + Data Combined Card - Only show if either exists */}
        {hasDataContent && (
          <div className="rounded-2xl bg-[#30302e] text-white shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6">
              {/* SQL Query Section */}
              {message.sqlQuery && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowSql(!showSql)}
                    className="flex items-center gap-2 text-sm text-[#ff4866] font-medium transition-colors mb-3"
                  >
                    <FileText className="w-4 h-4" />
                    {showSql ? 'Hide' : 'Show'} SQL Query
                    <ChevronDown className={`w-4 h-4 transition-transform ${showSql ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showSql && (
                    <div className="mt-3 bg-[#30302e] relative rounded-xl">
                      <pre className={`text-white ${isMobile ? 'text-xs' : 'text-sm'} overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4`}>
                        {message.sqlQuery}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(message.sqlQuery!)}
                        className="absolute top-3 right-3 p-2 text-white hover:text-white hover:bg-zinc-600/50 rounded-xl transition-colors"
                        title="Copy SQL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Data Table Section */}
              {message.data !== undefined && message.data !== null && (
                <div className="mt-4 border-t border-[#ff4866] pt-4">
                  <button
                    onClick={() => setShowData(!showData)}
                    className="flex items-center gap-2 text-sm text-[#ff4866] font-medium transition-colors mb-3"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {showData ? 'Hide' : 'Show'} Data ({Array.isArray(message.data) ? message.data.length : 0} rows)
                    <ChevronDown className={`w-4 h-4 transition-transform ${showData ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showData && (
                    <div className="bg-[#30302e] rounded-xl p-2 sm:p-4">
                      {Array.isArray(message.data) && message.data.length > 0 ? (
                        <div className={`overflow-x-auto ${isMobile ? 'max-h-60' : 'max-h-80'} overflow-y-auto rounded-lg border border-gray-200`}>
                          <div className="min-w-max">
                            <table className="w-full text-sm bg-[#30302e]">
                              <thead className="bg-[#30302e] sticky top-0">
                                <tr>
                                  {Object.keys(message.data[0]).map((key) => (
                                    <th key={key} className={`px-2 sm:px-4 py-1.5 sm:py-3 text-left border-b border-gray-200 font-semibold text-white whitespace-nowrap ${
                                      isMobile ? 'text-xs' : 'text-sm'
                                    }`}>
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {message.data.slice(0, 100).map((row, index) => (
                                  <tr key={index} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                                    {Object.values(row).map((value, colIndex) => (
                                      <td key={colIndex} className={`px-2 sm:px-4 py-1.5 sm:py-3 text-white whitespace-nowrap ${
                                        isMobile ? 'text-xs' : 'text-sm'
                                      }`}>
                                        {value !== null ? String(value) : (
                                          <span className="text-gray-400 italic">null</span>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {message.data.length > 100 && (
                            <div className="p-3 bg-yellow-50 border-t border-yellow-200 text-center">
                              <p className="text-xs text-yellow-700 font-medium">
                                Showing first 100 rows of {message.data.length} total rows
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-sm">No data returned from this query</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message Footer */}
            <div className="px-4 sm:px-6 py-3 bg-[#30302e] border-t border-white">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex items-center gap-2">
                  {message.sqlQuery && (
                    <span className="text-xs text-white px-2 py-1 rounded-full">
                      SQL
                    </span>
                  )}
                  {message.data && message.data.length > 0 && (
                    <span className="text-xs text-white px-2 py-1 rounded-full">
                      {message.data.length} rows
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
