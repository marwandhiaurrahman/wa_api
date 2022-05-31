const { Client, MessageMedia, Buttons } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios');
const mime = require('mime-types');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const SESSION_FILE_PATH = './wa-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
    headless: true,
  },
  session: sessionCfg
});

client.initialize();

// Socket.io
io.on('connection', function (socket) {
  socket.emit('message', 'Connecting...');

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code received, scan please!');
    });
  });

  client.on('ready', () => {
    socket.emit('ready', 'Whatsapp is ready!');
    socket.emit('message', 'Whatsapp is ready!');
    console.log('Client is ready!');
  });

  client.on('authenticated', (session) => {
    socket.emit('authenticated', 'Whatsapp is authenticated!');
    socket.emit('message', 'Whatsapp is authenticated!');
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        return console.log(err);
      }
    });
  });

  client.on('auth_failure', function (session) {
    socket.emit('message', 'Auth failure, restarting...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp is disconnected!');
    client.destroy();
    client.initialize();
  });
});

const checkRegisteredNumber = async function (number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Read message
client.on('message', message => {
  const urlWebhook = 'https://webhook.site/92a80591-443c-4a89-8ca8-19dc1b101c80';
  if (message.type == 'chat' || message.type == 'buttons_response') {
    axios.post(urlWebhook, {
      message
    }).then(function () {
      console.log('Message sent!' + message.id.id);
    })
      .catch(function (error) {
        console.log('Error sending message: ', error);
      });
  }
  if (message.body == 'ping') {
    message.reply('pong');
  } else {
    message.reply('ping');
  }
});
// Send message
app.post('/send_message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.mapped() });
  }
  if (!isRegisteredNumber) {
    return res.status(422).json({ errors: { number: 'Number is not registered' } });
  }

  client.sendMessage(number, message).then(
    response => {
      res.send(response);
    }
  ).catch(
    error => {
      res.send(error);
    }
  );
});
// Send media
app.post('/send_media', [
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req.body.file;
  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.mapped() });
  }
  if (!isRegisteredNumber) {
    return res.status(422).json({ errors: { number: 'Number is not registered' } });
  }

  // const media = MessageMedia.fromFilePath('./info poli.png');

  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);

  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });
  const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});
// Send button
app.post('/send_button', [
  body('number').notEmpty(),
  body('message').notEmpty(),
  body('button').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => msg);
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  const title = req.body.title;
  const footer = req.body.footer;
  // const button_body = ;

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.mapped() });
  }
  if (!isRegisteredNumber) {
    return res.status(422).json({ errors: { number: 'Number is not registered' } });
  }

  let button = new Buttons('Button body', [{ body: 'Button' }], 'title', 'footer');
  client.sendMessage(number, button)
    .then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
});

server.listen(port, function () {
  console.log('App running on http://127.0.0.1:' + port);
});