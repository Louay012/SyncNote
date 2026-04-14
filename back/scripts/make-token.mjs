import { signToken } from '../src/utils/auth.js';

const userId = process.argv[2] || null;
if (!userId) {
  console.error('Usage: node make-token.mjs <userId>');
  process.exit(1);
}

const token = signToken(userId);
console.log(token);
