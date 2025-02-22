// server.js
const https = require('http');
const express = require('express');
const socketIo = require('socket.io');
const SimplePeer = require('simple-peer');
const wrtc = require('wrtc');

const app = express();
const server = https.createServer(app);

app.use(express.static('public'));

const io = socketIo(server);

const peers = {};

const streams = {};

const meetings = {};

//const usernames = {};

io.on('connection', (socket) => {
  console.log('A user connected', socket.id);

  peers[socket.id] = new SimplePeer({
    initiator: false,
    trickle: true,
    wrtc,
    objectMode: true,
  });

  peers[socket.id].on('connect', () => {
    //console.log('Peer connected');
  });

  peers[socket.id].on('signal', (data) => {
    //console.log('Sending signal:', socket.id);
    socket.emit('signal', data);
  });

  peers[socket.id].on('stream', (stream) => {
    // console.log('Received data:', socket.id, stream);


    for (const id in peers) {
      if (id !== socket.id) {
        //console.log('Send stream to all user in the meeting from ', socket.id, ' to ', id);
        try {
          const newStream = new wrtc.MediaStream();
          stream.getTracks().forEach((track) => {
            const clonedTrack = track.clone();
            newStream.addTrack(clonedTrack);
            peers[id].addTrack(clonedTrack, newStream);
          });
        } catch (error) {
          console.error('Error handling stream:', error);
        }
      }
    }

    if (Object.keys(streams).length === 3) return;

    for (const id in streams) {
      if (id !== socket.id) {
        console.log('Get stream of users in your meeting:', id, ' for ', socket.id);
        try {
          const newStream = new wrtc.MediaStream();
          streams[id].getTracks().forEach((track) => {
            const clonedTrack = track.clone();
            newStream.addTrack(clonedTrack);
            peers[socket.id].addTrack(clonedTrack, newStream);
          });
        } catch (error) {
          console.error('Error handling stream:', error);
        }
      }
    }

    streams[socket.id] = stream;
  });

  socket.on('signal', (data) => {
    // console.log('Received signal');
    peers[socket.id].signal(data);
  });

  socket.on('message', (data) => {
    console.log('Received message: ', data);
    socket.broadcast.emit('message', data);
  });

  socket.on('create_meeting', (data) => {
    //console.log('create_meeting', data);
    meetings[data.meetingId] = socket.id;
  });

  socket.on('join_meeting', (data) => {
    //console.log('join_meeting', data);
    const ownerId = meetings[data.meetingId];

    socket.to(ownerId).emit('request_meeting', { participantId: socket.id });
  });

  socket.on('accept_meeting', (data) => {
    //console.log('accept_meeting', data);
    socket.to(data.participantId).emit('accept_meeting', data);
  });

  // socket.on('start_webcam', (data) => {
  //console.log('start_webcam', data);
  //socket.broadcast.emit('start_webcam', data)
  //});

  socket.on('disconnect', () => {
    console.log('User disconnected');

    peers[socket.id] && peers[socket.id].destroy();
    delete peers[socket.id];
    delete streams[socket.id];
    delete meetings[socket.id];
  });
});

const PORT = 3005;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
