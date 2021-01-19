var app = require('express')();
const fs = require('fs');
const nodemailer = require('nodemailer');
const request = require('request')
const axios = require('axios');
let m_storechat = require('./models/m_store_chat');
var http = require('https').createServer({
  key: fs.readFileSync('/home/ubuntu/certs/smatbotkey.pem'),
  cert: fs.readFileSync('/home/ubuntu/certs/smatbotcert.pem'),
  ca: fs.readFileSync('/home/ubuntu/certs/smatbotbundle.crt')
}, app);
var dir_name = '/home/ubuntu/live_chat/'
const AccessToken = require('twilio').jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioAccountSid = 'AC63f423bcdcf304c0c3a8cdc674083708';
const twilioApiKey = 'SK5f4cadbd99aa358cee794cd84bd15633';
const twilioApiSecret = 'rKSM1dKB5jwc0O1Vw5dSS738HKg6IO6I';

var io = require('socket.io')(http, {
  pingTimeout: 60000,
  pingInterval: 25000,
  origins: '*:*'
});

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/getToken',function(req,res){
  var token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret);
  token.identity = req.query.identity;
  const videoGrant = new VideoGrant({
      room: req.query.room
  });
  token.addGrant(videoGrant);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({token_twilio : token.toJwt()})
})

var decrypt = function(text) {
  var MCrypt = require('mcrypt').MCrypt;
  var rijEcb = new MCrypt('rijndael-128', 'cbc');
  var ivAndCiphertext = new Buffer.from(text, 'base64');
  // var iv = rijEcb.generateIv();
  var ivSize = rijEcb.getIvSize();
  var iv = new Buffer.allocUnsafe(ivSize);

  // rijEcb.validateIvSize(true);

  var cipherText = new Buffer.allocUnsafe(ivAndCiphertext.length - ivSize);
  ivAndCiphertext.copy(iv, 0, 0, ivSize);
  ivAndCiphertext.copy(cipherText, 0, ivSize);
  rijEcb.open("blivmivr5o5m@nvr", iv);
  // text = text.substr(ivSize,text.length-ivSize);
  var text = rijEcb.decrypt(cipherText);
  return text.toString().replace(/\0/g, '');
};

users = [];

var if_connected;
function startConnect() {
  io.on('connection', function(socket) {

  console.log('A user connected');
  if_connected = true;
  socket.on('start-video', function(data) {
    io.sockets.emit('start-video', data);
  })
  socket.on('video-declined', function(data) {
    io.sockets.emit('video-declined', data);
  })
  socket.on('video-disconnect', function(data) {
    io.sockets.emit('video-disconnect', data);
  })
  socket.on('start-screen-share', function(data) {
    io.sockets.emit('start-screen-share', data);
  })
  socket.on('stop-screen-share', function(data) {
    io.sockets.emit('stop-screen-share', data);
  })
  socket.on('agent-received', function(data) {
    io.sockets.emit('agent-received', data);
  })
  socket.on('setagentsession', function(data) {
    socket.join(data['bot_id']);
  })
  socket.on('setUsername', function(data) {
    console.log(users);
    console.log(users.indexOf(data));
    if (users.indexOf(data) == -1) {
      users.push(data);
      console.log(users);
      socket.emit('userSet', {
        username: data
      });
    } else {
      socket.emit('userExists', data + ' username is taken! Try some other username.');
    }
  })
  socket.on('msg', function(data) {
    io.sockets.emit('newmsg', data);
  })
  socket.on('testconnect', function(data) {
    console.log('test connect data',data)
    io.sockets.emit('testconnect', data);
  })
  socket.on('sendtoadmin', function(data) {
    io.sockets.emit('sendtoadmin', data);
  })
  socket.on('adminsentmessage', function(data) {
    if (data["channel"] == "whatsapp" && data["session_id"].length > 10) {
      console.log("channel is whatsapp and length is mpre than 10")
      session_id = decrypt(data["session_id"]);
    } else if (data["channel"] == "whatsapp" && data["session_id"].length < 10) {
      console.log("channel is whatsapp and length is less than 10")
      session_id = data["session_id"]
    } else {
      session_id = decrypt(data["session_id"]);
    }
    console.log("admin message bot id ", data)
    io.to(data['chatbot_id']).emit('adminsentmessage', data);
    // io.sockets.emit('adminsentmessage', data);
    var customer_id = "";
    Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(function(result) {
      customer_id = result["customer_id"];
    })
    Promise.resolve(m_storechat.storeChat(session_id, customer_id, data["message"], "customer", data["agent_name"])).then(function(result) {

    })
    if (data["channel"] == 'whatsapp') {
      Promise.resolve(m_storechat.getWhatsappDetails(data['chatbot_id'])).then(function(result) {
        console.log("inside channel whatsapp",result['provider'])
        if(result['provider'] == "cm.com"){
          send_message = send_cmmessage(result,data)
        }
        else if(result['provider'] == "wati"){
          send_message = send_watimessage(result,data)
        }

      })
    }
  })
  socket.on('adminsentmessagetoadmins', function(data) {
    if (data["channel"] == "whatsapp" && data["session_id"].length > 10) {
      console.log("channel is whatsapp and length is mpre than 10")
      session_id = decrypt(data["session_id"]);
    } else if (data["channel"] == "whatsapp" && data["session_id"].length < 10) {
      console.log("channel is whatsapp and length is less than 10")
      session_id = data["session_id"]
    } else {
      session_id = decrypt(data["session_id"]);
    }
    console.log('adminsentmessagetoadmins data', data)
    io.sockets.emit('adminsentmessagetoadmins', data)
    var customer_id = ""
    Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(function(result) {
      customer_id = result["customer_id"];
    })
    Promise.resolve(m_storechat.storeChat(session_id, customer_id, data["message"], "admintoadmin", data["agent_name"])).then(function(result) {

    })
  })
  socket.on('usersentmessage', function(data) {
    session_id = decrypt(data["session_id"]);

    if (data['channel'] == 'whatsapp') {
      data["session_id"] = session_id
    }
    console.log("user message data ", data)
    io.to(data['bot_id']).emit('usersentmessage', data);
    // io.sockets.emit('usersentmessage', data);
    var customer_id = "";
    Promise.resolve(m_storechat.getCustomerId(data["bot_id"])).then(function(result) {
      customer_id = result["customer_id"];
    })
    Promise.resolve(m_storechat.storeChat(session_id, customer_id, data["message"], "user")).then(function(result) {

    })
    Promise.resolve(m_storechat.updateCounter(session_id)).then(function(result) {

    })
  })
  socket.on('admintyping', function(data) {
    io.sockets.emit('admintyping', data);
  })
  socket.on('usertyping', function(data) {
    io.sockets.emit('usertyping', data);
  })
  socket.on('requestaccess', function(data) {
    io.sockets.emit('requestaccess', data);
  })
  socket.on('setsession', function(data) {
    session_id = decrypt(data["session_id"]);
    socket.join(data['bot_id']);
    if (data['channel'] == 'whatsapp') {
      data['cb_session'] = data['session_id']
      data['session_id'] = session_id
      console.log("set session ", data)
      io.to(data['bot_id']).emit('setsession', data);
      // io.sockets.emit('setsession', data);
      Promise.resolve(m_storechat.checkSession(session_id)).then(function(result) {
        if (result[0].length > 0) {
          console.log("session already there")
        } else {
          console.log("no session so inserting")
          Promise.resolve(m_storechat.setSession(data["bot_id"], session_id)).then(function(result) {

          })
        }
      })
    }else{
      data['ip_address'] = decrypt(data['ip_address'])
      data['user_location'] = decrypt(data['user_location'])
      console.log("set session ", data)
      io.to(data['bot_id']).emit('setsession', data);
      // io.sockets.emit('setsession', data);
      Promise.resolve(m_storechat.checkSession(session_id)).then(function(result) {
        if (result[0].length > 0) {
          console.log("session already there")
        } else {
          console.log("no session so inserting")
          Promise.resolve(m_storechat.setSession(data["bot_id"], session_id, data["ip_address"], data["user_location"], data["user_url"],data['notes'])).then(function(result) {

          })
        }
      })
    }
    Promise.resolve(m_storechat.isWhatsappEnabled(data['bot_id'])).then(function(res){
      is_whatsapp_enabled = res[0]['live_chat_whatsapp_notification']
      if(is_whatsapp_enabled == '1'){
        Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(resp){
          var agents_list = resp;
          Promise.resolve(m_storechat.getWhatsappDetails("5354")).then(function(result){
            for(i=0;i<agents_list.length;i++){
              sendWhatsappNotification(agents_list[i]['phone_number'],result,data['bot_name'])
            }
          })
        })
      }
    })
    Promise.resolve(m_storechat.getCustomerType(data['bot_id'])).then(function(res){
      let customer_type = res
      if(customer_type[0]['customer_type'] == 'reseller_client'){

      }
      else{
        Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(result){
          agents_list = result;
          if(customer_type[0]['id'] == '4473'){
            sendWhitelabelMail(agents_list,function(error, response){
              if(error){
                console.log("Talal email sending error");
              }
              else{
                console.log("Tala email sending no error");
              }
            })
          }
          else{
            sendGridEmailSending(agents_list,data['bot_name'],function (error, response){
              if(error){
                console.log("sendgrid email sending error");
              }
              else{
                console.log("sendgrid email sending no error");
              }
            })
          }
        })
      }
    })
    if (data['bot_id'] == '203') {
      const body = {
        messages: {
          authentication: {
            productToken: '545295AE-59E3-467A-8119-FFA961B1F853'
          },
          msg: [{
            body: {
              type: 'auto',
              content: 'Fallback text for SMS'
            },
            to: [{
                number: "00917306649123"
              },
              {
                number: '00917897336949'
              },
              {
                number: '00918897670321'
              },
              {
                number: '00918500660020'
              }
            ],
            from: '0031762011571',
            allowedChannels: ["WhatsApp"],
            richContent: {
              conversation: [{
                text: "You have got a customer waiting for you with live interaction please respond to him *ASAP*"
              }]
            }
          }]
        }
      }
      axios.post('https://gw.cmtelecom.com/v1.0/message', body)
        .then((res) => {
          console.log(`Status: ${res.status}`);
          console.log('Body: ', res.data);
        }).catch((err) => {
          console.error(err);
        });
    }
  })
  socket.on('setagentname', function(data) {
    if (data["channel"] == "whatsapp") {
      session_id = data["session_id"];
    } else {
      session_id = decrypt(data["session_id"])
    }
    console.log("set agent called data ", data)
    io.sockets.emit('setagentname', data);
    Promise.resolve(m_storechat.setAgentname(data["bot_id"], session_id, data["agent_name"], data["agent_id"])).then(function(result) {

    })
  })
  socket.on('agent_noo', function(data) {
    io.sockets.emit('agent_noo', data);
  })
  socket.on('agent_yess', function(data) {
    io.sockets.emit('agent_yess', data);
  })
  socket.on('userregistered', function(data) {
    io.sockets.emit('userregistered', data);
  })
  socket.on('disconn', function(data) {
    io.sockets.emit('disconn', data);
  })
  socket.on('assignotheragent', function(data) {
    console.log("assigning to other agent", data)
    if (data["session_id"].length > 10) {
      session_id = decrypt(data["session_id"]);
    } else if (data["session_id"].length < 10) {
      session_id = data["session_id"]
    } else {
      session_id = decrypt(data["session_id"]);
    }
    io.sockets.emit('assignotheragent', data);
    Promise.resolve(m_storechat.updateAgentname(session_id, data["agent_id"])).then(function(result) {

    })
  })
  socket.on('closesession', function(data) {
    session_id = decrypt(data["session_id"]);
    if (data['channel'] == 'whatsapp') {
      data['session_id'] = session_id
    }
    console.log("close session called ", data)
    io.sockets.emit('closesession', data);
    Promise.resolve(m_storechat.closeSession(session_id)).then(function(result) {

    })
  })
  socket.on('closesessionfromadmin', function(data) {
    session_id = decrypt(data["session_id"]);
    if (data['channel'] == 'whatsapp') {
      data['session_id'] = session_id
    }
    console.log("close session from admin called ", data)
    io.sockets.emit('closesessionfromadmin', data);
    Promise.resolve(m_storechat.closeSession(session_id)).then(function(result) {

    })
  })
  socket.on('requestfeedback', function(data) {
    io.sockets.emit('requestfeedback', data)
  })
  socket.on('submitfeedbackmessage',function(data){
    console.log("submitting feedback")
    session_id = decrypt(data["session_id"])
    if (data['channel'] == 'whatsapp') {
      data['session_id'] = session_id
    }
    io.sockets.emit('submitfeedbackmessage',data)
    Promise.resolve(m_storechat.saveFeedbackMessage(session_id,data['message'])).then(function(result) {

    })
  })
  socket.on('userseenmessage', function(data){
    console.log("user seen event")
    session_id = decrypt(data["session_id"])
    if (data['channel'] == 'whatsapp') {
      data['session_id'] = session_id
    }
    io.sockets.emit('userseenmessage',data)
    Promise.resolve(m_storechat.userSeenMessage(session_id)).then(function(result) {

    })
  })
  socket.on('agentseenmessage', function(data){
    console.log("user seen event")
    session_id = decrypt(data["session_id"])
    // if (data['channel'] == 'whatsapp') {
    //   data['session_id'] = session_id
    // }
    io.sockets.emit('agentseenmessage',data)
    Promise.resolve(m_storechat.agentSeenMessage(session_id)).then(function(result) {

    })
  })
  socket.on('markresolved', function(data){
    console.log("marking resolved")
    if (data["session_id"].length > 10) {
      session_id = decrypt(data["session_id"]);
    } else if (data["session_id"].length < 10) {
      session_id = data["session_id"]
    } else {
      session_id = decrypt(data["session_id"]);
    }
    io.sockets.emit('markresolved',data)
    Promise.resolve(m_storechat.markResolved(session_id)).then(function(result) {

    })
  })
  socket.on('submitfeedback', function(data) {
    console.log('submitfeedback data', data)
    if (data["session_id"].length > 10) {
      session_id = decrypt(data["session_id"]);
    } else if (data["session_id"].length < 10) {
      session_id = data["session_id"]
    } else {
      session_id = decrypt(data["session_id"]);
    }
    io.sockets.emit('submitfeedback', data)
    Promise.resolve(m_storechat.saveFeedback(session_id, data['rating'])).then(function(result) {

    })
  })
  socket.on('setstatus', function(data) {
    io.sockets.emit('setstatus', data)
    Promise.resolve(m_storechat.saveAgentStatus(data['agent_id'], data['status'])).then(function(result) {

    })
  })
  socket.on('banip', function(data) {
    io.sockets.emit('banip', data)
  })
  socket.on('unbanip', function(data) {
    io.sockets.emit('unbanip', data)
  })
  socket.on('resetusermessages', function(data) {
    io.sockets.emit('resetusermessages', data)
  })
  socket.on('start-video-call', function(data) {
    var obj = data;
    obj.id = socket.id;
    io.sockets.emit('start-video-call', obj);
  })
  socket.on('answer-video-call', function(data) {
    io.sockets.emit('answer-video-call', data)
  })
  socket.on('make-answer', function(data) {
    io.sockets.emit('make-answer', data)
  })
})
}

function sendWhatsappNotification(number,data,bot_name){
  var access_token = data['product_token']
  const headers = {
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+access_token
    }
  }
  console.log("whatsapp number",number)
  number = number.replace("+","");
  number = number.replace("-","");
  const body = {
    to:number,
    type:"template",
    template:{
      namespace:"46827356_1e8f_4347_88fb_3ed5f42cbce7",
      name:"live_chat",
      language:{
        policy:"deterministic",
        code:"en_US"
      },
      components:[
      {
        type:"body",
        parameters:[
        {
          type:"text",
          text:"*"+bot_name+"*"
        }
        ]
      }
      ]
    }
  }
  axios.post('https://whatsapp-api-491.clare.ai/v1/messages/',body,headers)
    .then((res) => {
      console.log(`Notification Status: ${res.status}`);
      console.log('Notification Body: ', res.data);
    }).catch((err) => {
      console.error(err);
    });
}

function send_watimessage(result,data){
  console.log("inside wati message")
  var access_token = result['product_token']
  var cm_number = result['cm_number']
  const headers = {
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+access_token
    }
  }
  console.log("provider ",result['provider'])
  console.log("endpoint ",result['endpoint'])
  const body = {
    to:data['user_number'],
    type:"text",
    text : {
      body:data['message']
    }
  }
  axios.post(result['endpoint']+'/v1/messages',body,headers)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log('Body: ', res.data);
    }).catch((err) => {
      console.error(err);
    });
}

function send_cmmessage(result,data){
  var access_token = result['product_token']
  var cm_number = result['cm_number']
  console.log("access_token ", access_token)
  console.log('cm_number ', cm_number)
  console.log('user_number ', data['user_number'])
  console.log('message ', data['message'])
  const body = {
    messages: {
      authentication: {
        productToken: access_token
      },
      msg: [{
        body: {
          type: 'auto',
          content: 'Fallback text for SMS'
        },
        to: [{
          number: data['device_print']
        }],
        from: cm_number,
        allowedChannels: ["WhatsApp"],
        richContent: {
          conversation: [{
            text: data["message"]
          }]
        }
      }]
    }
  }
  axios.post('https://gw.cmtelecom.com/v1.0/message', body)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log('Body: ', res.data);
    }).catch((err) => {
      console.error(err);
    });
}

function sendWhitelabelMail($agents_list){
  var tomail = [];
  for (var i = 0; i < agents_list.length; i++) {
    tomail.push(agents_list[i]['email']);
  }
  let transport = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      auth: {
         user: 'ecare@taleed.com.sa',
         pass: 'T@leed#2021'
      }
  });
  const message = {
      from: 'ecare@taleed.com.sa', // Sender address
      to: tomail,         // List of recipients
      subject: 'You have a user waiting for you in Live Chat!!!', // Subject line
      html: '<div style="width: 70%;margin-right: auto;margin-left: auto;float: none"><div style="float: left;margin-left: auto;margin-right: auto;width:100%;margin:0;font-family:trebuchet MS;border:1px solid lightgray"><div style="float: left;width:100%"><div style="width:100%;background:white;float:left;border-bottom: 1px solid lightgray"><div style="float:left;width:100%"><h2 style="float: left;min-width:98%;text-align: center;margin-left: 1%;margin-top:10px;margin-bottom:10px;margin-left:10px" class="logo"></h2></div></div><div style="float: left;width:100%;background:#1094d126;font-size:16px"><div style="width:90%;margin-left:5%;margin-right:5%;display:block;float:left;padding:10px;margin-top: 25px;margin-bottom: 25px;box-sizing: border-box"><label style="float:left;width:100%">Dear Customer,</label><label style="margin-top:15px;float:left;width:100%">A user is waiting for you to connect with them on Chatbot.</label><label style="margin-top:15px;float:left;width:100%">Please check <a href="https://www.app.smatbot.com/bot?tab=live_chat&bot_id=5625&profile_id=4239" target="_blank">here</a> immediately.</label><label style="margin-top:25px;float:left;width:100%">Thank you.<br></label></div></div></div></div></div>'// Plain text body
  };
  transport.sendMail(message, function(err, info) {
      if (err) {
        console.log(err)
      } else {
        console.log(info);
      }
  });
}

function sendGridEmailSending(agents_list,bot_name){
  var tomail = [];
  for(var i = 0; i < agents_list.length; i++){
    tomail.push({ email: agents_list[i]['email']});
  }
  console.log("to emails")
  console.log(tomail)
  var options = {
    method: 'POST',
    url: 'https://api.sendgrid.com/v3/mail/send',
    headers: {
       'cache-control': 'no-cache',
       'Content-Type': 'application/json',
       'authorization': 'Bearer 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' // process.env.ENV
    },



    body: {

      personalizations: [ { to: tomail }],
      from: { email: 'info@smatbot.com' },
      subject: 'You have a user waiting for you in '+bot_name+' Live Chat!!!',
      content: [
          {
              type: 'text/html',
              value: '<div style="width: 70%;margin-right: auto;margin-left: auto;float: none"><div style="float: left;margin-left: auto;margin-right: auto;width:100%;margin:0;font-family:trebuchet MS;border:1px solid lightgray"><div style="float: left;width:100%"><div style="width:100%;background:white;float:left;border-bottom: 1px solid lightgray"><div style="float:left;width:100%"><h2 style="float: left;min-width:98%;text-align: center;margin-left: 1%;margin-top:10px;margin-bottom:10px;margin-left:10px" class="logo"><img src="https://s3.ap-south-1.amazonaws.com/custpostimages/sb_images/SB_logo_horizontal_text.png" height="60" alt=""></h2></div></div><div style="float: left;width:100%;background:#1094d126;font-size:16px"><div style="width:90%;margin-left:5%;margin-right:5%;display:block;float:left;padding:10px;margin-top: 25px;margin-bottom: 25px;box-sizing: border-box"><label style="float:left;width:100%">Dear Customer,</label><label style="margin-top:15px;float:left;width:100%">A user is waiting for you to connect with them on '+ bot_name +' SmatBot.</label><label style="margin-top:15px;float:left;width:100%">Please check immediately.</label><label style="margin-top:25px;float:left;width:100%">Thank you,<br>SmatBot Team</label></div></div></div></div></div>'
          }
      ]
    },
    json: true
  };
  return new Promise(function(resolve,reject){
    request(options, function (error, response, body) {
        if (error) {
            console.log('sendgrid email sending failed for response:'+JSON.stringify(error))
            resolve(true)
        }else{
            console.log('sendgrid email sent to response:'+JSON.stringify(body))
            resolve(true)
        }
    })
  })
}

io.on('close', function(socket) {
  setInterval(function() {
    if (!if_connected) {
      startConnect()
    }
  },1000)
})

startConnect();

http.listen(8000, function() {
  console.log('listening on *:8000');
});
