// models/Chat.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  data?: unknown[] | unknown; // Allow both array and any other type
  visualizationData?: unknown;
}

export interface Chat extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const MessageSchema = new Schema<Message>({
  id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  sqlQuery: { type: String },
  data: { type: Schema.Types.Mixed }, // Changed from array to Mixed to accept any structure
  visualizationData: { type: Schema.Types.Mixed }
}, { 
  strict: false, // Allow additional fields not defined in schema
  minimize: false // Ensure empty objects are saved
});

const ChatSchema = new Schema<Chat>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// Update timestamp on save
ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate title from first message if not provided
ChatSchema.pre('save', function(next) {
  if (!this.title && this.messages.length > 0) {
    const firstMessage = this.messages.find(msg => msg.role === 'user');
    if (firstMessage) {
      this.title = firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
    }
  }
  next();
});

const ChatModel = (mongoose.models.Chat as mongoose.Model<Chat>) || 
                  mongoose.model<Chat>('Chat', ChatSchema);

export default ChatModel;