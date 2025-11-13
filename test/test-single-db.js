const mongoose = require('mongoose');
require('dotenv').config();

async function testSingleConnection() {
  console.log('🔍 Testing single connection with useDb approach...');
  console.log('Using base URI:', process.env.MONGODB_URI);

  try {
    // Single connection to MongoDB server root
    console.log('\n📡 Connecting to MongoDB server...');
    const connection = mongoose.createConnection(process.env.MONGODB_URI);
    await connection.asPromise();
    console.log('✅ Base connection established');

    // Test threespeak database
    console.log('\n📊 Testing threespeak database...');
    const threeSpeakDb = connection.useDb('threespeak');
    const videosCount = await threeSpeakDb.collection('videos').countDocuments();
    console.log(`✅ ThreeSpeak videos: ${videosCount} documents`);

    // Test spk-encoder-gateway database
    console.log('\n🔧 Testing spk-encoder-gateway database...');
    const encoderDb = connection.useDb('spk-encoder-gateway');
    const jobsCount = await encoderDb.collection('jobs').countDocuments();
    console.log(`✅ Encoder jobs: ${jobsCount} documents`);

    // Test model creation
    console.log('\n📝 Testing model creation...');
    
    const videoSchema = new mongoose.Schema({
      _id: String,
      title: String,
      owner: String
    }, { collection: 'videos' });

    const jobSchema = new mongoose.Schema({
      _id: String,
      status: String,
      video_id: String
    }, { collection: 'jobs' });

    // Create models on specific databases
    const VideoModel = threeSpeakDb.model('Video', videoSchema);
    const JobModel = encoderDb.model('Job', jobSchema);

    console.log('✅ Models created successfully');

    // Test a simple operation
    const testId = 'test-single-' + Date.now();
    
    const testVideo = new VideoModel({
      _id: testId,
      title: 'Single Connection Test',
      owner: 'coolmole'
    });

    await testVideo.save();
    console.log('✅ Video saved via single connection');

    const testJob = new JobModel({
      _id: testId + '-job',
      status: 'pending',
      video_id: testId
    });

    await testJob.save();
    console.log('✅ Job saved via single connection');

    // Clean up
    await VideoModel.deleteOne({ _id: testId });
    await JobModel.deleteOne({ _id: testId + '-job' });
    console.log('✅ Test data cleaned up');

    await connection.close();
    console.log('✅ Connection closed');

    console.log('\n🎉 SINGLE CONNECTION WITH useDb() WORKS PERFECTLY!');
    console.log('This is the pattern we should use in our app.');

  } catch (error) {
    console.error('❌ Single connection test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testSingleConnection();