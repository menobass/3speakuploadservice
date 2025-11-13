const mongoose = require('mongoose');
require('dotenv').config();

async function testCorrectConnections() {
  console.log('🔍 Testing correct MongoDB connections...');
  
  try {
    // Test ThreeSpeak database (videos)
    console.log('\n📡 Testing ThreeSpeak database...');
    const threeSpeakConn = mongoose.createConnection('mongodb://3speak-admin:gJTe63FNQkL7aNZQ@185.130.44.183:27017/threespeak');
    await threeSpeakConn.asPromise();
    console.log('✅ ThreeSpeak connection established');
    
    const videosCount = await threeSpeakConn.db.collection('videos').countDocuments();
    console.log(`✅ ThreeSpeak videos: ${videosCount} documents`);
    
    // Test SPK Encoder Gateway database (jobs)
    console.log('\n🔧 Testing SPK Encoder Gateway database...');
    const encoderConn = mongoose.createConnection('mongodb://3speak-admin:gJTe63FNQkL7aNZQ@185.130.44.183:27017/spk-encoder-gateway');
    await encoderConn.asPromise();
    console.log('✅ SPK Encoder Gateway connection established');
    
    const jobsCount = await encoderConn.db.collection('jobs').countDocuments();
    console.log(`✅ Encoder jobs: ${jobsCount} documents`);
    
    // Test model creation and operations
    console.log('\n📝 Testing models and operations...');
    
    const videoSchema = new mongoose.Schema({
      _id: String,
      title: String,
      owner: String,
      created: Date
    }, { collection: 'videos' });
    
    const jobSchema = new mongoose.Schema({
      _id: String,
      status: String,
      video_id: String,
      created: Date
    }, { collection: 'jobs' });
    
    const Video = threeSpeakConn.model('Video', videoSchema);
    const Job = encoderConn.model('Job', jobSchema);
    
    console.log('✅ Models created successfully');
    
    // Test operations
    const testId = 'test-' + Date.now();
    
    // Create test video
    const testVideo = new Video({
      _id: testId,
      title: 'Connection Test',
      owner: 'coolmole',
      created: new Date()
    });
    
    await testVideo.save();
    console.log('✅ Test video created in threespeak database');
    
    // Create test job
    const testJob = new Job({
      _id: testId + '-job',
      status: 'pending',
      video_id: testId,
      created: new Date()
    });
    
    await testJob.save();
    console.log('✅ Test job created in spk-encoder-gateway database');
    
    // Clean up
    await Video.deleteOne({ _id: testId });
    await Job.deleteOne({ _id: testId + '-job' });
    console.log('✅ Test data cleaned up');
    
    await threeSpeakConn.close();
    await encoderConn.close();
    console.log('✅ All connections closed');
    
    console.log('\n🎉 Perfect! Both databases work correctly.');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testCorrectConnections();