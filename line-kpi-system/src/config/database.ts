import mongoose from 'mongoose';
import { config } from './index';

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => console.log('[DB] MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('[DB] MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected'));

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
}
