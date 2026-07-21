declare global {
  namespace Express {
    interface Request {auth?: {userId: string; tokenId: string}}
  }
}
export {};
