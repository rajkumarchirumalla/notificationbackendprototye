// Extend Request interface if needed
declare namespace Express {
  export interface Request {
    user?: any;
  }
}
