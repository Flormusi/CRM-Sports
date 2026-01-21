import jwt, { Secret, SignOptions } from 'jsonwebtoken';

export const signToken = (payload: object, expiresIn?: string) => {
  const secret = process.env.JWT_SECRET as Secret;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  const exp: SignOptions['expiresIn'] = (expiresIn || process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
  const options: SignOptions = { expiresIn: exp };
  return jwt.sign(payload, secret, options);
};
