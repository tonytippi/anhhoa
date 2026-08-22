declare global {
  namespace Express {
    interface Request { oauthRedirect?: string; parentOauthRedirect?: string; }
  }
}
export {};
