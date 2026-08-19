declare global {
  namespace Express {
    interface Request { oauthRedirect?: string; }
  }
}
export {};
