import mongoose from "mongoose";
let connectionPromise;
export async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    }).then(() => {
      console.log("MongoDB connected");
      return mongoose;
    }).finally(() => { connectionPromise = undefined; });
  }
  return connectionPromise;
}
