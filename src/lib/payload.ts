import { getPayload } from 'payload';
import config from '@/payload.config';

export async function getPayloadInstance() {
  return getPayload({ config });
}
