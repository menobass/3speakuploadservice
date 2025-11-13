const mongoose = require('mongoose');
require('dotenv').config();

async function testBothDatabases() {
  console.log('🔍 Testing both MongoDB databases...');
  
  try {
    // Test ThreeSpeak database
    console.log('\n📡 Testing ThreeSpeak database...');
    const threeSpeakConn = await mongoose.createConnection(process.env.MONGO_URI);
    console.log('✅ ThreeSpeak connection created');
    
    const threeSpeakDb = threeSpeakConn.db;
    const videosCount = await threeSpeakDb.collection('videos').countDocuments();
    console.log(`✅ ThreeSpeak videos: ${videosCount} documents`);
    
    // Test Encoder database
    console.log('\n🔧 Testing Encoder database...');
    const encoderConn = await mongoose.createConnection(process.env.ENCODER_MONGO_URI);
    console.log('✅ Encoder connection created');
    
    const encoderDb = encoderConn.db;
    const jobsCount = await encoderDb.collection('jobs').countDocuments();
    console.log(`✅ Encoder jobs: ${jobsCount} documents`);
    
    // Test creating models on specific connections
    console.log('\n📝 Testing model creation...');
    
    // Simple schema for testing
    const videoSchema = new mongoose.Schema({
      _id: String,
      title: String,
      owner: String
    });
    
    const jobSchema = new mongoose.Schema({
      _id: String,
      status: String,
      video_id: String
    });
    
    // Create models on specific connections
    const Video = threeSpeakConn.model('videos', videoSchema);
    const Job = encoderConn.model('jobs', jobSchema);
    
    console.log('✅ Models created successfully');
    
    // Test a simple insert operation
    console.log('\n💾 Testing insert operation...');
    const testVideo = new Video({
      _id: 'test-' + Date.now(),
      title: 'Connection Test',
      owner: 'test-user'
    });
    
    await testVideo.save();
    console.log('✅ Test video inserted');
    
    // Clean up test data
    await Video.deleteOne({ _id: testVideo._id });
    console.log('✅ Test data cleaned up');
    
    // Close connections
    await threeSpeakConn.close();
    await encoderConn.close();
    console.log('✅ All connections closed');
    
    console.log('\n🎉 All database tests passed! The connection pattern works.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testBothDatabases();