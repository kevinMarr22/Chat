const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Utilizamos Middleware para verificar la IP del Usuario
app.use((req, res, next) => {
  const clientIp = req.connection.remoteAddress.replace('::ffff:', ''); 
  const allowedIpRange = '192.168.249.'; 

  // Aca se verifica si la IP del usuario pertenece a la red local
  if (clientIp.startsWith(allowedIpRange)) {
    next(); 
  } else {
    res.status(403).send('Acceso denegado: Solo los dispositivos conectados a la red local pueden acceder.');
  }
});

//Imagenes

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});
const upload = multer({ storage });76

app.use(express.static('public'));

let users = {};
let messages = [];

app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// Socket.io 
io.on('connection', (socket) => {
  console.log('Usuario conectado');

  
  socket.emit('previousMessages', messages);

  
  socket.on('join', (name) => {
    socket.username = name;
    users[socket.id] = name; 
    socket.broadcast.emit('message', { user: 'Sistema', text: `${name} se ha unido al chat` });
  });

  // Mensajes enviados
  socket.on('chatMessage', (msg) => {
    const message = { user: socket.username, text: msg };
    messages.push(message); 
    io.emit('message', message); 
  });
  // Envio de imagenes
  socket.on('imageMessage', (imageUrl) => {
    const message = { user: socket.username, imageUrl: imageUrl };
    messages.push(message); 
    io.emit('image', message); 
  });
  // Envio de mensajes por privado
  socket.on('privateMessage', ({ recipient, msg }) => {
    const message = { user: socket.username, text: msg };
    const recipientSocketId = Object.keys(users).find(key => users[key] === recipient);

    if (recipientSocketId) {
      socket.to(recipientSocketId).emit('privateMessage', message); 
    } else {
      socket.emit('message', { user: 'Sistema', text: `${recipient} no está conectado.` }); 
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id]; 
    io.emit('message', { user: 'Sistema', text: `${socket.username} ha dejado el chat` });
  });
});

// Iniciamos el servidor en el puerto 300 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
