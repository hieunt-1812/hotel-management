import * as dotenv from 'dotenv';
import { join } from 'path';

process.env.NODE_ENV = 'test';
dotenv.config({ path: join(__dirname, '..', '.env.test') });
