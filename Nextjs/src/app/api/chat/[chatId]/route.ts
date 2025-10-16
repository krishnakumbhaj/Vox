// app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import ChatModel from '@/models/Chat';
import UserModel from '@/models/User';
import { Types } from 'mongoose';

interface RouteParams {
  params: Promise<{
    chatId: string;
  }>;
}

// GET: Fetch specific chat with all messages
export async function GET(_: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;

    if (!Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
    }

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch specific chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      userId: user._id,
      isActive: true
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Log what we're retrieving from MongoDB
    console.log('📥 Loading chat from MongoDB:', {
      chatId: chat._id.toString(),
      messageCount: chat.messages.length,
      messagesWithData: chat.messages.filter(m => m.data).length,
      sampleMessage: chat.messages.find(m => m.data) ? {
        hasData: !!chat.messages.find(m => m.data)?.data,
        dataLength: Array.isArray(chat.messages.find(m => m.data)?.data) ? (chat.messages.find(m => m.data)?.data as unknown[])?.length : undefined,
        dataType: Array.isArray(chat.messages.find(m => m.data)?.data) ? 'array' : typeof chat.messages.find(m => m.data)?.data
      } : 'no data messages'
    });

    return NextResponse.json({
      success: true,
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messages: chat.messages
      }
    });

  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch chat', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST: Add message to existing chat (called by FastAPI)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params;

    if (!Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
    }

    const { 
      userId, 
      message, 
      response, 
      sqlQuery, 
      data, 
      visualizationData 
    } = await request.json();

    await dbConnect();

    // Find the chat
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Verify user owns this chat
    const user = await UserModel.findOne({ email: userId });
    if (!user || !chat.userId.equals(user._id as Types.ObjectId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Add user message
    const userMessageId = new Types.ObjectId().toString();
    chat.messages.push({
      id: userMessageId,
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Add assistant response
    const assistantMessageId = new Types.ObjectId().toString();
    chat.messages.push({
      id: assistantMessageId,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      sqlQuery,
      data,
      visualizationData
    });

    // Update chat title if it's the first message and title is default
    if (chat.messages.length === 2 && chat.title === 'New Database Query') {
      chat.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }

    await chat.save();

    return NextResponse.json({
      success: true,
      messageId: assistantMessageId,
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length
      }
    });

  } catch (error) {
    console.error('Error adding message to chat:', error);
    return NextResponse.json({ 
      error: 'Failed to add message', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT: Update chat title
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    const { title } = await request.json();

    if (!Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update chat title
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId: user._id, isActive: true },
      { title: title.trim() },
      { new: true }
    );

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      chat: {
        id: chat._id.toString(),
        title: chat.title,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating chat title:', error);
    return NextResponse.json({ 
      error: 'Failed to update chat title', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE: Delete specific chat
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;

    if (!Types.ObjectId.isValid(chatId)) {
      return NextResponse.json({ error: 'Invalid chat ID' }, { status: 400 });
    }

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete chat
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId: user._id },
      { isActive: false },
      { new: true }
    );

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ 
      error: 'Failed to delete chat', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}