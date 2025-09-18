import { z } from 'zod';

export const acceptMessageSchema = z.object({

            acceptMessages: z.string().length(24, 'Invalid message ID'),
            
            });