import mongoose from "mongoose";

// Connection configuration
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds

const connectWithRetry = async (mongoURI, retries = 0) => {
  try {
    await mongoose.connect(mongoURI);
    console.log(`✅ Successfully connected to MongoDB`);
    return true;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`⚠️  Connection attempt ${retries + 1} failed. Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(mongoURI, retries + 1);
    }
    throw error;
  }
};

export const connectDB = async () => {
  try {
    const dbName = "go-wheels";
    const mongoURI = `mongodb://127.0.0.1:27017/${dbName}?retryWrites=true&w=majority`;
    
    console.log(`🔌 Attempting to connect to MongoDB at ${mongoURI}...`);
    
    await connectWithRetry(mongoURI);
    
    console.log(`✅ Successfully connected to MongoDB database: ${dbName}`);
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB after multiple attempts:', error.message);
    console.log('\nTroubleshooting steps:');
    console.log('1. Make sure MongoDB is installed and running');
    console.log('2. Check if the MongoDB service is started');
    console.log('3. Verify that port 27017 is not blocked by a firewall');
    console.log('4. Try running "mongod" in a separate terminal');
    
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('ℹ️  Mongoose disconnected');
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('ℹ️  MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});