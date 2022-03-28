const { Client, MessageMedia, Buttons } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const axios = require('axios');
const mime = require('mime-types');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

const SESSION_FILE_PATH = './wa-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
    res.sendFile('index.html', {
        root: __dirname
    });
});


// const client = new Client({
//     puppeteer: {
//         args: [
//             '--no-sandbox',
//             '--disable-setuid-sandbox',
//             '--disable-dev-shm-usage',
//             '--disable-accelerated-2d-canvas',
//             '--no-first-run',
//             '--no-zygote',
//             '--single-process', // <- this one doesn't works in Windows
//             '--disable-gpu'
//         ],
//         headless: true,
//     },
//     session: sessionCfg
// });

client.initialize();
// client.on('authenticated', (session) => {
//     console.log('AUTHENTICATED', session);
//     sessionCfg = session;
//     fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
//         if (err) {
//             return console.log(err);
//         }
//     });
// });
// Socket.io
// io.on('connection', function (socket) {
//     socket.emit('message', 'Connecting...');

//     client.on('qr', (qr) => {
//         console.log('QR RECEIVED', qr);
//         qrcode.toDataURL(qr, (err, url) => {
//             socket.emit('qr', url);
//             socket.emit('message', 'QR Code received, scan please!');
//         });
//     });

//     client.on('ready', () => {
//         socket.emit('ready', 'Whatsapp is ready!');
//         socket.emit('message', 'Whatsapp is ready!');
//         console.log('Client is ready!');
//     });

//     client.on('authenticated', (session) => {
//         socket.emit('authenticated', 'Whatsapp is authenticated!');
//         socket.emit('message', 'Whatsapp is authenticated!');
//         console.log('AUTHENTICATED', session);
//         sessionCfg = session;
//         fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
//             if (err) {
//                 return console.log(err);
//             }
//         });
//     });

//     client.on('auth_failure', function (session) {
//         socket.emit('message', 'Auth failure, restarting...');
//     });

//     client.on('disconnected', (reason) => {
//         socket.emit('message', 'Whatsapp is disconnected!');
//         client.destroy();
//         client.initialize();
//     });
// });
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
});
// Send message
app.post('/send-message', (req, res) => {
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

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

server.listen(8000, function () {
    console.log('listening on 8000');
});