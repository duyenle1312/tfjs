'use strict';

const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const {spawn} = require('child_process');
const request = require('request');
const path = require('path');
var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  //console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);   
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  
  request({
    url: "https://graph.facebook.com/" + senderID + "?",
    qs: {
      access_token: process.env.PAGE_ACCESS_TOKEN
    },
    headers: {
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8',
        'User-Agent': 'test-bot'
    },
    method: "GET",
    json: true,
    time: true
  }, 
  function(error, res, faceUserInfo) {
   console.log("faceUserInfo ", faceUserInfo);
   console.log(`Receive a message from user: ${faceUserInfo.first_name} ${faceUserInfo.last_name}`);
   var first_name = faceUserInfo.first_name;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;
    
  if (messageText) {
    console.log(messageText);
    
    let text = messageText;
    let tokenizer, corpus;
    let file = "";
    // Tokenizer
    tokenizer = text.split(/\W+/);
    corpus = [];
    for (let i = 0; i < tokenizer.length; i++) {
      if (tokenizer[i] == "") continue;
      else corpus[i] = tokenizer[i].toLowerCase();
    }
    console.log("Corpus: ", corpus);
    file = "./word_index_en.json";
    
    // padding='post', max_len=20, truncate='post'
  let padding = [];    
  
  fs.readFile('word_index_en.json', (err, data) => {
      if (err) throw err;
      let info = JSON.parse(data);
      //console.log(info);
    
      var words = info;
      for (let i = 0; i < 20; i++) {
        if (i >= corpus.length) padding[i] = 0;
        // if text not in data
        else if (!words.hasOwnProperty(corpus[i])) padding[i] = 1;
        else padding[i] = words[corpus[i]];
      }
      console.log("Padding: ", padding);
      //findLabel(padding);
    
      // Replying to the user on Messenger
      let dataToSend = padding.toString();
      sendTextMessage(senderID, dataToSend);
  });

  console.log('This is after the read call');
  
  /*fetch(file) //path should be in public
  .then(response => { 
        //console.log(response);
        return response.json();
  })
  .then(data => {
        //console.log(data); // already a json object, no need to parse
        var words = data;
        for (let i = 0; i < 20; i++) {
        if (i >= corpus.length) padding[i] = 0;
        // if text not in data
        else if (!words.hasOwnProperty(corpus[i])) padding[i] = 1;
        else padding[i] = words[corpus[i]];
      }
      console.log("Padding: ", padding);
      //findLabel(padding);
  })
  .catch(err => {
        // Do something for an error here
        console.log("Error Reading data " + err);
  });*/
    
  }  

 else if (messageAttachments) {
    sendTextMessage(senderID, "Your photo is great but I can't tell what it is yet!");
  }
  }
);

}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent a message with id %s to recipient %s", messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});