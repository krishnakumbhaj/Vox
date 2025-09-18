// app/api/query/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import ChatModel from '@/models/Chat';
import UserModel from '@/models/User';
import { Types } from 'mongoose';

// In your route.ts file, change this line:
const FASTAPI_BASE_URL = 'https://vox-9xr7.onrender.com'; // Instead of localhost

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

// POST: Process query through FastAPI and save to chat
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    // Step 1: Check if FastAPI is available
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

    // Step 2: Send query to FastAPI for processing
    console.log('🚀 Sending query to FastAPI...');
    let fastApiResult;
    
    try {
      const fastApiResponse = await fetch(`${FASTAPI_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          user_id: session.user.email, // For FastAPI logging
          chat_id: chatId // Pass chat ID to FastAPI
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout for query processing
      });

      if (!fastApiResponse.ok) {
        const errorText = await fastApiResponse.text();
        throw new Error(`FastAPI error: ${fastApiResponse.status} - ${errorText}`);
      }

      fastApiResult = await fastApiResponse.json();
      console.log('✅ FastAPI response received:', fastApiResult.success);
      
    } catch (fetchError) {
      console.error('❌ FastAPI request failed:', fetchError);
      
      // Create a fallback response
      fastApiResult = {
        success: false,
        response: '',
        error: 'Failed to process query with database service',
        sql_query: null,
        data: null,
        visualization_data: null
      };
    }

    // Step 3: Save conversation to MongoDB
    const userMessageId = new Types.ObjectId().toString();
    const assistantMessageId = new Types.ObjectId().toString();

    // Add user message
    chat.messages.push({
      id: userMessageId,
      role: 'user',
      content: query.trim(),
      timestamp: new Date()
    });

    // Add assistant response
    const assistantContent = fastApiResult.success 
      ? (fastApiResult.response || 'Query processed successfully')
      : (fastApiResult.error || 'Failed to process query');

    chat.messages.push({
      id: assistantMessageId,
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
      sqlQuery: fastApiResult.sql_query,
      data: fastApiResult.data,
      visualizationData: fastApiResult.visualization_data
    });

    // Update chat title if it's the first real conversation
    if (chat.messages.length === 2 && chat.title === 'New Database Query') {
      chat.title = query.substring(0, 50) + (query.length > 50 ? '...' : '');
    }

    await chat.save();
    console.log('💾 Chat saved successfully');

    // Step 4: Return response to frontend
    return NextResponse.json({
      success: fastApiResult.success || false,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content: query.trim(),
        timestamp: new Date()
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        sqlQuery: fastApiResult.sql_query,
        data: fastApiResult.data,
        visualizationData: fastApiResult.visualization_data
      },
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length
      },
      error: fastApiResult.success ? null : (fastApiResult.error || 'Query processing failed')
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
