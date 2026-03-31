const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // Allow up to 100MB payloads for photos
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Simple JSON Database
const DB_FILE = path.join(__dirname, 'db.json');
let db = {
  users: [],
  photos: [],
  friendships: [],
  comments: [],
  messages: []
};

// Load DB
if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
    console.log('Database loaded.');
  } catch (e) {
    console.error('Error reading db.json', e);
  }
}

// Save DB function
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// REST API for initial load
app.get('/api/data', (req, res) => {
  res.json(db);
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send initial data to the newly connected client
  socket.emit('initial_data', db);

  // User Actions
  socket.on('register_user', (user) => {
    db.users.push(user);
    saveDB();
    io.emit('user_added', user);
  });

  socket.on('update_user', (updatedUser) => {
    const idx = db.users.findIndex(u => u.id === updatedUser.id);
    if (idx !== -1) {
      db.users[idx] = updatedUser;
      saveDB();
      io.emit('user_updated', updatedUser);
    }
  });

  // Photo Actions
  socket.on('add_photo', (photo) => {
    db.photos.push(photo);
    saveDB();
    io.emit('photo_added', photo);
  });

  socket.on('delete_photo', (photoId) => {
    db.photos = db.photos.filter(p => p.id !== photoId);
    saveDB();
    io.emit('photo_deleted', photoId);
  });

  // Friendship Actions
  socket.on('add_friendship', (friendship) => {
    db.friendships.push(friendship);
    saveDB();
    io.emit('friendship_added', friendship);
  });

  socket.on('update_friendship', (updatedFriendship) => {
    const idx = db.friendships.findIndex(f => f.id === updatedFriendship.id);
    if (idx !== -1) {
      db.friendships[idx] = updatedFriendship;
      saveDB();
      io.emit('friendship_updated', updatedFriendship);
    }
  });

  socket.on('delete_friendship', (friendshipId) => {
    db.friendships = db.friendships.filter(f => f.id !== friendshipId);
    saveDB();
    io.emit('friendship_deleted', friendshipId);
  });

  // Comment Actions
  socket.on('add_comment', (comment) => {
    db.comments.push(comment);
    saveDB();
    io.emit('comment_added', comment);
  });

  // Message Actions
  socket.on('add_message', (message) => {
    db.messages.push(message);
    saveDB();
    io.emit('message_added', message);
  });

  socket.on('mark_messages_read', ({ from, to }) => {
    let updated = false;
    db.messages.forEach(m => {
      if (m.from === from && m.to === to && !m.read) {
        m.read = true;
        updated = true;
      }
    });
    if (updated) {
      saveDB();
      io.emit('messages_read', { from, to });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`NoteLock Server is running on port ${PORT}`);
  console.log(`Connect your app to http://<YOUR_WIFI_IP>:${PORT}`);
});
