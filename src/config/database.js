const mongoose = require('mongoose');

let baseConnection = null;
let threeSpeakDb = null;
let encoderDb = null;

const connectDatabases = async () => {
  try {
    console.log('🔌 Connecting to MongoDB server...');
    
    // Single connection to MongoDB server (without specifying database)
    baseConnection = mongoose.createConnection(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: true
    });

    // Wait for connection to be established
    await baseConnection.asPromise();
    console.log('✅ Connected to MongoDB server');

    // Access specific databases using useDb
    threeSpeakDb = baseConnection.useDb(process.env.THREESPEAK_DB_NAME || 'threespeak');
    encoderDb = baseConnection.useDb(process.env.ENCODER_DB_NAME || 'spk-encoder-gateway');

    console.log('✅ Connected to ThreeSpeak database');
    console.log('✅ Connected to Encoder Gateway database');
    
    // Setup connection event handlers
    setupConnectionHandlers(baseConnection, 'MongoDB');
    
    console.log('✅ Database connections established');
    
    return { baseConnection, threeSpeakDb, encoderDb };
  } catch (error) {
    console.error('Database connection setup failed:', error);
    throw error;
  }
};

const setupConnectionHandlers = (connection, name) => {
  connection.on('connected', () => {
    console.log(`📊 ${name} connected`);
  });
  
  connection.on('error', (error) => {
    console.error(`❌ ${name} error:`, error);
  });
  
  connection.on('disconnected', () => {
    console.log(`⚠️ ${name} disconnected`);
  });
  
  connection.on('reconnected', () => {
    console.log(`🔄 ${name} reconnected`);
  });
};

const closeConnections = async () => {
  if (baseConnection) {
    await baseConnection.close();
    console.log('✅ Database connection closed');
  }
};

const getConnections = () => {
  if (!baseConnection || !threeSpeakDb || !encoderDb) {
    throw new Error('Databases not connected. Call connectDatabases() first.');
  }
  
  return {
    baseConnection,
    threeSpeakDb,
    encoderDb,
    // Legacy compatibility
    threeSpeakConnection: threeSpeakDb,
    encoderConnection: encoderDb
  };
};

module.exports = {
  connectDatabases,
  closeConnections,
  getConnections,
  get baseConnection() {
    return baseConnection;
  },
  get threeSpeakDb() {
    return threeSpeakDb;
  },
  get encoderDb() {
    return encoderDb;
  },
  // Legacy compatibility getters
  get threeSpeakConnection() {
    return threeSpeakDb;
  },
  get encoderConnection() {
    return encoderDb;
  }
};