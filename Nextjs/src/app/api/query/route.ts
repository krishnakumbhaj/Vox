// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import ChatModel from '@/models/Chat';
import UserModel from '@/models/User';
import { Types } from 'mongoose';

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on Windows
const FASTAPI_BASE_URL = 'https://vox-9xr7.onrender.com';

// Helper function to check FastAPI connection
async function checkFastAPIConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${FASTAPI_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('FastAPI connection check failed:', error);
    return false;
  }
}

// POST: Process query through FastAPI with streaming and save to chat
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Processing query request...');
    
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, chatId } = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!chatId || !Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Valid chat ID is required' }, { status: 400 });
    }

    console.log(`📝 Query from ${session.user.email}: ${query.substring(0, 50)}...`);

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify chat exists and belongs to user
    const chat = await ChatModel.findOne({
      _id: chatId,
      userId: user._id,
      isActive: true
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Check if FastAPI is available
    console.log(`🔗 Checking FastAPI connection at ${FASTAPI_BASE_URL}...`);
    const isFastAPIConnected = await checkFastAPIConnection();
    
    if (!isFastAPIConnected) {
      console.error('❌ FastAPI is not available');
      
      // Save error message to chat
      const errorMessageId = new Types.ObjectId().toString();
      const userMessageId = new Types.ObjectId().toString();

      // Add user message
      chat.messages.push({
        id: userMessageId,
        role: 'user',
        content: query.trim(),
        timestamp: new Date()
      });

      // Add error response
      chat.messages.push({
        id: errorMessageId,
        role: 'assistant',
        content: 'I apologize, but the database analysis service is currently unavailable. Please try again later or contact support.',
        timestamp: new Date(),
        sqlQuery: undefined,
        data: undefined,
        visualizationData: undefined
      });

      await chat.save();

      return NextResponse.json({
        success: false,
        userMessage: {
          id: userMessageId,
          role: 'user',
          content: query.trim(),
          timestamp: new Date()
        },
        assistantMessage: {
          id: errorMessageId,
          role: 'assistant',
          content: 'Database analysis service is currently unavailable. Please try again later.',
          timestamp: new Date(),
          sqlQuery: null,
          data: null,
          visualizationData: null
        },
        chat: {
          id: chat._id.toString(),
          title: chat.title,
          updatedAt: new Date(),
          messageCount: chat.messages.length
        },
        error: 'Database analysis service unavailable'
      });
    }

    // Step 2: Send query to FastAPI with streaming and forward events to client
    console.log('🚀 Sending streaming query to FastAPI...');
    
    const userMessageId = new Types.ObjectId().toString();
    const assistantMessageId = new Types.ObjectId().toString();

    // Add user message immediately
    chat.messages.push({
      id: userMessageId,
      role: 'user',
      content: query.trim(),
      timestamp: new Date()
    });

    // Create a streaming response that collects data for MongoDB
    const encoder = new TextEncoder();
    let collectedResponse = '';
    let collectedSQL: string | null = null;
    let collectedData: Record<string, unknown>[] | null = null;
    let collectedVisualization: Record<string, unknown> | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send user message ID
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'user_message_id', content: userMessageId })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'assistant_message_id', content: assistantMessageId })}\n\n`));

          const fastApiResponse = await fetch(`${FASTAPI_BASE_URL}/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: query.trim(),
              user_id: session.user.email,
              chat_id: chatId
            }),
            signal: AbortSignal.timeout(60000) // 60 second timeout
          });

          if (!fastApiResponse.ok) {
            throw new Error(`FastAPI error: ${fastApiResponse.status}`);
          }

          const reader = fastApiResponse.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No reader available from FastAPI response');
          }

          // Read and forward the stream
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                  const event = JSON.parse(data);
                  
                  // Collect data for MongoDB
                  if (event.type === 'text') {
                    collectedResponse += event.content;
                  } else if (event.type === 'sql') {
                    collectedSQL = event.content;
                  } else if (event.type === 'data') {
                    collectedData = event.content;
                    collectedVisualization = event.visualization;
                  } else if (event.type === 'error') {
                    collectedResponse = event.content;
                  }
                  
                  // Forward to client
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (parseError) {
                  console.error('Error parsing SSE event:', parseError);
                }
              }
            }
          }

          // Save to MongoDB after streaming completes
          console.log('💾 Saving to MongoDB:', {
            hasData: !!collectedData,
            dataLength: collectedData?.length,
            dataType: Array.isArray(collectedData) ? 'array' : typeof collectedData,
            sampleData: collectedData?.slice(0, 2)
          });

          chat.messages.push({
            id: assistantMessageId,
            role: 'assistant',
            content: collectedResponse || 'Query processed',
            timestamp: new Date(),
            sqlQuery: collectedSQL || undefined,
            data: collectedData || undefined,
            visualizationData: collectedVisualization || undefined
          });

          // Mark messages as modified (critical for nested arrays in Mongoose)
          chat.markModified('messages');

          // Update chat title if it's the first real conversation
          if (chat.messages.length === 2 && chat.title === 'New Database Query') {
            chat.title = query.substring(0, 50) + (query.length > 50 ? '...' : '');
          }

          await chat.save();
          console.log('💾 Chat saved successfully with', collectedData?.length || 0, 'data rows');

          // Send final metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'metadata', 
            content: {
              chatId: chat._id.toString(),
              title: chat.title,
              messageCount: chat.messages.length
            }
          })}\n\n`));

          controller.close();

        } catch (error) {
          console.error('❌ Streaming error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Streaming failed';
          
          // Send error event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`));
          
          // Try to save error to MongoDB
          try {
            chat.messages.push({
              id: assistantMessageId,
              role: 'assistant',
              content: `Error: ${errorMsg}`,
              timestamp: new Date(),
              sqlQuery: undefined,
              data: undefined,
              visualizationData: undefined
            });
            await chat.save();
          } catch (saveError) {
            console.error('Failed to save error message:', saveError);
          }
          
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ Error processing query:', error);
    
    // Try to save error message to chat if possible
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process query', 
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET: Health check for query processing
export async function GET() {
  try {
    console.log('🔍 Health check requested');
    
    // Check if FastAPI is reachable
    const fastApiHealthy = await checkFastAPIConnection();
    
    return NextResponse.json({
      success: true,
      status: 'Query service online',
      fastapi_status: fastApiHealthy ? 'connected' : 'disconnected',
      fastapi_url: FASTAPI_BASE_URL,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return NextResponse.json({ 
      success: false,
      status: 'Query service has issues',
      fastapi_status: 'disconnected',
      fastapi_url: FASTAPI_BASE_URL,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
