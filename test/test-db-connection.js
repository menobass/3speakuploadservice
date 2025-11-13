const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing MongoDB connection...');
  console.log('MONGO_URI:', process.env.MONGO_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  console.log('ENCODER_MONGO_URI:', process.env.ENCODER_MONGO_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  try {
    // Test basic mongoose connection (simple approach)
    console.log('\n📡 Testing basic mongoose connection...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Basic mongoose connection successful');
    
    // Test a simple operation
    console.log('📊 Testing database operation...');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('✅ Database operation successful');
    console.log('📋 Available collections:', collections.map(c => c.name).slice(0, 5).join(', '), '...');
    
    // Test videos collection specifically
    console.log('\n🎥 Testing videos collection...');
    const videosCollection = db.collection('videos');
    const videoCount = await videosCollection.countDocuments();
    console.log(`✅ Videos collection accessible - ${videoCount} documents`);
    
    await mongoose.disconnect();
    console.log('✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();