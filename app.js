var app = require('express')();
const fs = require('fs');
const request = require('request')
const axios = require('axios');
let m_storechat = require('./models/m_store_chat');
var http = require('https').createServer({
  key: fs.readFileSync('/home/ubuntu/key.pem'),
  cert: fs.readFileSync('/home/ubuntu/cert.pem')
},app);
var dir_name = '/home/ubuntu/test-project/'

var io = require('socket.io')(http,{pingTimeout: 0, pingInterval: 500, origins: '*:*'});

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var decrypt = function (text) {
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
    rijEcb.open("blivmivr5o5m@nvr",iv);
    // text = text.substr(ivSize,text.length-ivSize);
    var text = rijEcb.decrypt(cipherText);
    return text.toString().replace(/\0/g, '');
};

users = [];
io.on('connection', function(socket) {

  console.log('A user connected');
   socket.on('setUsername', function(data) {
     console.log(users);
     console.log(users.indexOf(data));
      if(users.indexOf(data) == -1) {
         users.push(data);
         console.log(users);
         socket.emit('userSet', {username: data});
      } else {
         socket.emit('userExists', data + ' username is taken! Try some other username.');
      }
   })
   socket.on('msg', function(data) {
      io.sockets.emit('newmsg', data);
   })
   socket.on('sendtoadmin', function(data) {
      io.sockets.emit('sendtoadmin', data);
   })
   socket.on('adminsentmessage', function(data) {
      if(data["channel"] == "whatsapp" && data["session_id"].length > 10){
        console.log("channel is whatsapp and length is mpre than 10")
        session_id = decrypt(data["session_id"]);
      }
      else if(data["channel"] == "whatsapp" && data["session_id"].length < 10){
        console.log("channel is whatsapp and length is less than 10")
        session_id = data["session_id"]
      }
      else{
        session_id = decrypt(data["session_id"]);
      }
      console.log("admin message bot id ",data)
      io.sockets.emit('adminsentmessage', data);
      var customer_id="";
      Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(function(result){
        customer_id = result["customer_id"];
      })
      Promise.resolve(m_storechat.storeChat(session_id,customer_id,data["message"],"customer",data["agent_name"])).then(function(result){

      })
      if(data["channel"] == 'whatsapp'){
        Promise.resolve(m_storechat.getWhatsappDetails(data['chatbot_id'])).then(function(result){
          var access_token = result['product_token']
          var cm_number = result['cm_number']
          console.log("access_token ",access_token)
          console.log('cm_number ',cm_number)
          console.log('user_number ',data['user_number'])
          console.log('message ',data['message'])
          console.log('chatbot_id ',data['chatbot_id'])
          const body = {
            messages:{
              authentication:{
                productToken:access_token
              },
              msg:[{
                body:{
                  type:'auto',
                  content:'Fallback text for SMS'
                },
                to:[{
                  number:data['device_print']
                }],
                from:cm_number,
                allowedChannels:["WhatsApp"],
                richContent:{
                  conversation:[{
                    text:data["message"]
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
        })
      }
   })
   socket.on('adminsentmessagetoadmins', function(data) {
      if(data["channel"] == "whatsapp" && data["session_id"].length > 10){
        console.log("channel is whatsapp and length is mpre than 10")
        session_id = decrypt(data["session_id"]);
      }
      else if(data["channel"] == "whatsapp" && data["session_id"].length < 10){
        console.log("channel is whatsapp and length is less than 10")
        session_id = data["session_id"]
      }
      else{
        session_id = decrypt(data["session_id"]);
      }
      io.sockets.emit('adminsentmessagetoadmins ', data)
      var customer_id=""
      Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(function(result){
        customer_id = result["customer_id"];
      })
      Promise.resolve(m_storechat.storeChat(session_id,customer_id,data["message"],"admintoadmin",data["agent_name"])).then(function(result){

      })
   })
   socket.on('usersentmessage', function(data) {
      session_id = decrypt(data["session_id"]);
      
      if(data['channel'] == 'whatsapp'){
        data["session_id"] = session_id
      }
      console.log("user message data ",data)
      io.sockets.emit('usersentmessage', data);
      var customer_id="";
      Promise.resolve(m_storechat.getCustomerId(data["bot_id"])).then(function(result){
        customer_id = result["customer_id"];
      })
      Promise.resolve(m_storechat.storeChat(session_id,customer_id,data["message"],"user")).then(function(result){

      })
      Promise.resolve(m_storechat.updateCounter(session_id)).then(function(result){

      })
   })
   socket.on('admintyping', function(data) {
      io.sockets.emit('admintyping', data);
   })
   socket.on('usertyping', function(data) {
      io.sockets.emit('usertyping', data);
   })
   socket.on('setsession', function(data) {
      session_id = decrypt(data["session_id"]);
      if(data['channel']=='whatsapp'){
        data['cb_session'] = data['session_id']
        data['session_id'] = session_id
        console.log("set session ",data)
        io.sockets.emit('setsession', data);
        Promise.resolve(m_storechat.setSession(data["bot_id"],session_id)).then(function(result){

        })
      }
      else{
        console.log("set session ",data)
        io.sockets.emit('setsession', data);
        Promise.resolve(m_storechat.setSession(data["bot_id"],session_id,data["ip_address"],data["user_location"],data["user_url"])).then(function(result){

        })
      }
      if(data['bot_id'] == '203')
      {
        const body = {
          messages:{
            authentication:{
              productToken:'545295AE-59E3-467A-8119-FFA961B1F853'
            },
            msg:[{
              body:{
                type:'auto',
                content:'Fallback text for SMS'
              },
              to:[{
                number:"00917306649123"
              },
              {
                number:'00917897336949'
              },
              {
                number:'00918897670321'
              },
              {
                number:'00918500660020'
              }],
              from:'0031762011571',
              allowedChannels:["WhatsApp"],
              richContent:{
                conversation:[{
                  text:"You have got a customer waiting for you with live interaction please respond to him *ASAP*"
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
   socket.on('setagentname',function(data) {
    if(data["channel"] == "whatsapp"){
      session_id = data["session_id"];
    }
    else{
      session_id = decrypt(data["session_id"])
    }
    console.log("set agent called data ",data)
    io.sockets.emit('setagentname', data);
    Promise.resolve(m_storechat.setAgentname(data["bot_id"],session_id,data["agent_name"],data["agent_id"])).then(function(result){

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
    console.log("assigning to other agent",data)
      if(data["session_id"].length > 10){
        session_id = decrypt(data["session_id"]);
      }
      else if(data["session_id"].length < 10){
        session_id = data["session_id"]
      }
      else{
        session_id = decrypt(data["session_id"]);
      }
      io.sockets.emit('assignotheragent', data);
      Promise.resolve(m_storechat.updateAgentname(session_id,data["agent_id"])).then(function(result){

      })
   })
   socket.on('closesession',function(data){
      session_id = decrypt(data["session_id"]);
      if(data['channel'] == 'whatsapp'){
        data['session_id'] = session_id
      }
      console.log("close session called ",data)
      io.sockets.emit('closesession',data);
      Promise.resolve(m_storechat.closeSession(session_id)).then(function(result){

      })
   })
   socket.on('closesessionfromadmin',function(data){
      session_id = decrypt(data["session_id"]);
      if(data['channel'] == 'whatsapp'){
        data['session_id'] = session_id
      }
      console.log("close session from admin called ",data)
      io.sockets.emit('closesessionfromadmin',data);
      Promise.resolve(m_storechat.closeSession(session_id)).then(function(result){

      })
   })
   socket.on('resetusermessages',function(data){
    io.sockets.emit('resetusermessages',data)
   })
})

http.listen(8000, function() {
  console.log('listening on *:8000');
});
