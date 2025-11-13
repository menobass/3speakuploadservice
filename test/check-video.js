const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkVideo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const video = await db.collection('videos').findOne(
      { permlink: 'oeq4e0fs' },
      { projection: { thumbnail: 1, app: 1, status: 1, beneficiaries: 1, donations: 1, _id: 0 } }
    );
    
    console.log('\n=== Video Document ===');
    console.log(JSON.stringify(video, null, 2));
    
    if (video) {
      console.log('\n=== Field Types ===');
      console.log(`thumbnail: ${typeof video.thumbnail} = ${JSON.stringify(video.thumbnail)}`);
      console.log(`app: ${typeof video.app} = ${JSON.stringify(video.app)}`);
      console.log(`status: ${typeof video.status} = ${JSON.stringify(video.status)}`);
      console.log(`beneficiaries: ${typeof video.beneficiaries} = ${JSON.stringify(video.beneficiaries)}`);
      console.log(`donations: ${typeof video.donations} = ${JSON.stringify(video.donations)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkVideo();
