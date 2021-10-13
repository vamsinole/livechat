var app = require('express')();
const fs = require('fs');
const url = require('url');
const nodemailer = require('nodemailer');
const request = require('request')
const axios = require('axios');
let moment = require('moment-timezone');
let m_storechat = require('./models/m_store_chat');

var http = require('https').createServer({
    key: fs.readFileSync('/home/ubuntu/certs/smatbotkey.pem'),
    cert: fs.readFileSync('/home/ubuntu/certs/smatbotcert.pem'),
    ca: fs.readFileSync('/home/ubuntu/certs/smatbotbundle.crt')
}, app);
var dir_name = '/home/ubuntu/live_chat_dev/'
const AccessToken = require('twilio').jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
//const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  // host: "smtp.ethereal.email",
  // port: 587,
  // auth: {
  //   user: "<email>",
  //   pass: "<password>",
  // },
    host: 'smtp.office365.com',
    port: 587,
    auth: {
        user: 'hrcare@taleed.com.sa',
        pass: 'T@leed4321'
    }
});
const Json2csvParser = require('json2csv').Parser;

const twilioAccountSid = 'AC63f423bcdcf304c0c3a8cdc674083708';
const twilioApiKey = 'SK5f4cadbd99aa358cee794cd84bd15633';
const twilioApiSecret = 'rKSM1dKB5jwc0O1Vw5dSS738HKg6IO6I';
const FCM = require('fcm-node');
const serverKey = 'AAAAGbCwI70:APA91bH8LHf64_AUb_hWFUIfcXi4L10X30a2CL9it6CiPG84uJXB2j1YBw5uFKWN0rorNuGR6wdDz2XcxTO6nwVUkm1Nte1AN4KzmWP5GpjxWIQUZeGw-CKmMniO4CEyr7IERAsVNIfm'
var io = require('socket.io')(http, {
    pingTimeout: 60000,
    pingInterval: 25000,
    origins: '*:*'
});
var registered_devices = ['puZ5rlfa1LQxpsqxMvAicifk3wYiHgSsBeWC1c2QfqNG77uONXNSMoAcN_zt-nKa'];

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/getToken', function(req, res) {
    var token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret);
    token.identity = req.query.identity;
    const videoGrant = new VideoGrant({
        room: req.query.room
    });
    token.addGrant(videoGrant);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ token_twilio: token.toJwt() })
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
        var url_str = socket.handshake.url;
        var queryObj = url.parse(url_str, { parseQueryString: true }).query;
        if (queryObj && queryObj.sId && queryObj.sId.length > 0) {
            // socket.id = queryObj.sId;
            // Logic for Storing

            // End of Logic for Storing
        }
        console.log('A user connected');
        if_connected = true;
        socket.on('start-video', function(data) {
            io.to(data['agent_id']).emit('start-video', data);
        })
        socket.on('video-declined', function(data) {
            io.to(data['session_id']).emit('video-declined', data);
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
            // socket.join(data['bot_id']);
            socket.join(data['agent_id']);
            // io.sockets.emit('agent-received', data);
            console.log("socket id in set agent session ", data);
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
            console.log('test connect data', data)
            io.sockets.emit('testconnect', data);
        })
        socket.on('sendtoadmin', function(data) {
            io.sockets.emit('sendtoadmin', data);
        })
        socket.on('senddevicetoken', function(data) {
          console.log("registered device token : ", data)
          // registered_devices.push(data['devicetoken']);
          Promise.resolve(m_storechat.storeDeviceToken(data['devicetoken'],data['agent_id'])).then(function(result) {
          })
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
            if (data['channel'] == 'website') {
                io.to(data['session_id']).emit('adminsentmessage', data);
                Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                    agent_ids = result[0]["agent_ids"].toString().split(",");
                    agent_ids.forEach(agent_id => {
                        if (agent_id != data['agent_id']) {
                            io.to(agent_id).emit('adminsentmessage', data);
                        }
                    })
                })
            }
            // io.sockets.emit('adminsentmessage', data);
            var customer_id = "";
            Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(function(result) {
                customer_id = result["customer_id"];
            })
            Promise.resolve(m_storechat.storeChat(session_id, '205', data["message"], "customer", data["agent_name"])).then(function(result) {

            })
            if (data["channel"] == 'whatsapp') {
                Promise.resolve(m_storechat.getWhatsappDetails(data['chatbot_id'])).then(function(result) {
                    console.log("inside channel whatsapp", result)
                    if (result['provider'] == "cm.com") {
                        send_message = send_cmmessage(result, data)
                    } else if (result['provider'] == "wati") {
                        send_message = send_watimessage(result, data)
                    } else if (result['provider'] == "netcore") {
                        send_message = send_netcoremessage(result, data)
                    } else if(result['provider'] == "360dialog") {
                        send_message = send_360message(result, data)
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
            Promise.resolve(m_storechat.storeChat(session_id, '205', data["message"], "admintoadmin", data["agent_name"])).then(function(result) {

            })
        })
        socket.on('usersentmessage', function(data) {
            session_id = decrypt(data["session_id"]);
            console.log("user message data ", data);
            var agent_ids;
            if (data['channel'] == 'whatsapp') {
                data["session_id"] = session_id;
                Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                    agent_ids = result[0]["agent_ids"].toString().split(",");
                    agent_ids.forEach(agent_id => {
                        io.to(agent_id).emit('usersentmessage', data);
                    })
                })
            } else {
                agent_ids = data['agent_id'].toString().split(",");
                agent_ids.forEach(agent_id => {
                    io.to(agent_id).emit('usersentmessage', data);
                })
            }
            // io.to(socket.id).emit('usersentmessage', data);
            // io.sockets.emit('usersentmessage', data);
            var customer_id = "";
            Promise.resolve(m_storechat.getCustomerId(data["bot_id"])).then(function(result) {
                customer_id = result["customer_id"];
            })
            Promise.resolve(m_storechat.storeChat(session_id, '205', data["message"], "user")).then(function(result) {

            })
            Promise.resolve(m_storechat.updateCounter(session_id)).then(function(result) {

            })
            if (agent_ids) {
              Promise.resolve(m_storechat.getDeviceTokens(agent_ids[0])).then(function(result) {
                var arr = [];
                for (var i = 0; i < result.length; i++) {
                  arr.push(result[i].fcm_device_token);
                }
                const fcm = new FCM(serverKey);
                console.log('result from db agent_app details ',arr);
                var message = {
                  registration_ids: arr,
                  notification: {
                    title: 'SmatBot - New User',
                    body: 'A new message came to your ' + data["bot_id"] + ' live chat from ' + data['channel'],
                    sound: "default",
                    icon: "ic_launcher",
                    click_action:"FCM_PLUGIN_ACTIVITY",
                    badge: "1"
                  },
                  priority: 'high',
                  data:{
                    landing_page:"chatmessenger",
                    id: agent_ids[0]
                  },
                }
                fcm.send(message, (err, response) => {
                  if (err) {
                    console.log("Something has gone wrong! push notification : ", JSON.stringify(err));
                    // res.send(err);
                  } else {
                    console.log("Successfully sent with response: push notification ", response);
                    // res.send(response)
                  }
                })
              })
            }
        })
        socket.on('admintyping', function(data) {
            io.to(data['session_id']).emit('admintyping', data);
        })
        socket.on('admintypingstopped', function(data) {
            io.to(data['session_id']).emit('admintypingstopped', data);
        })
        socket.on('usertyping', function(data) {
            io.to(data['agent_id']).emit('usertyping', data);
        })
        socket.on('usertypingstopped', function(data) {
            io.to(data['agent_id']).emit('usertypingstopped', data);
        })
        socket.on('requestaccess', function(data) {
            io.sockets.emit('requestaccess', data);
        })
        socket.on('joinbotroom', function(data) {
            if (data['channel'] == 'whatsapp') {
                data['session_id'] = decrypt(data['session_id'])
            }
            socket.join(data['session_id']);
            io.to(data['session_id']).emit('joinbotroom', data);
        })
        socket.on('setsession', async function(data) {
            session_id = decrypt(data["session_id"]);
            if (data['channel'] == 'whatsapp') {
                data['cb_session'] = data['session_id']
                data['session_id'] = session_id
                // Promise.resolve(m_storechat.getWhatsappDetails(data['bot_id'])).then(function(result) {
                //     data.CHATBOT_URL = result['endpoint'];
                //     data.CHATBOT_PROVIDER = result['provider'];
                //     data.CHATBOT_ACCESS_TOKEN = result['product_token'];
                //     data.sender_id  = result['cm_number'].substring(2);
                //     data.question_text = "hello from live chat";
                // })
                console.log("set session ", data)
                // io.sockets.emit('setsession', data);
            } else {
                data['ip_address'] = decrypt(data['ip_address'])
                data['user_location'] = decrypt(data['user_location'])
                fs.appendFile('/home/ubuntu/live_chat_dev/smatbot_sessions.txt', `\n\n${moment().format('DD-MM-YYYY HH:mm:ss')} set session ========> ${JSON.stringify(data)}`, () => {});
                console.log("set session ", data)
            }
            let is_agent_available = true;
            let assigned_agent_email = null;
            let assigned_agent_number = null;
            let department_id;
            if (data['department_id']) {
                department_id = data['department_id'];
            } else {
                department_id = false;
            }
            get_available_agents = await m_storechat.getAgent(data['bot_id'], department_id);
            console.log('assigned agents length===========', get_available_agents);
            if (get_available_agents[0].length > 0) {
                if (!get_available_agents[0][0]['chats_limit'] || (get_available_agents[0][0]['chats_limit'] > get_available_agents[0][0]['assigned_chats'])) {
                    assigned_agent = get_available_agents[0][0]['agent_id'];
                    assigned_agent_email = get_available_agents[0][0]['email'];
                    assigned_agent_number = get_available_agents[0][0]['phone_number'];
                    io.to(assigned_agent).emit('setsession', data);
                    console.log('agentassigned data ', { agent_id: assigned_agent, 'channel': data['channel'], 'session_id': data['session_id'] })
                    io.to(data['session_id']).emit('agentassigned', { agent_id: assigned_agent, 'channel': data['channel'], 'session_id': data['session_id'] })
                    Promise.resolve(m_storechat.updateAgentChats(assigned_agent, data['bot_id'], 'add')).then(function(result) {})
                    Promise.resolve(m_storechat.getDeviceTokens(assigned_agent)).then(function(result) {
                      var arr = [];
                      for (var i = 0; i < result.length; i++) {
                        arr.push(result[i].fcm_device_token);
                      }
                      const fcm = new FCM(serverKey);
                      console.log('result from db agent_app details ',arr);
                      var message = {
                        registration_ids: arr,
                        notification: {
                          title: 'SmatBot - New User',
                          body: 'A new user come to your live chat from ' + data['channel'],
                          sound: "default",
                          icon: "ic_launcher",
                          badge: "1",
                          click_action:"FCM_PLUGIN_ACTIVITY",
                        },
                        data:{
                          landing_page:"active-users",
                          id: assigned_agent
                        },
                        priority: 'high',
                        data: {
                          // action: req.body.actionType, // Action Type
                          // payload: req.body.payload // payload
                        }
                      }
                      fcm.send(message, (err, response) => {
                        if (err) {
                          console.log("Something has gone wrong! push notification : ", JSON.stringify(err));
                          // res.send(err);
                        } else {
                          console.log("Successfully sent with response: push notification ", response);
                          // res.send(response)
                        }
                      })
                    })
                } else {
                    is_agent_available = false;
                    console.log("this is else in no agent available", data);
                    no_agent_data = { 'channel': data['channel'], 'session_id': data['session_id'], chatbot_id: data['bot_id'] }
                    if (data['channel'] == 'whatsapp') no_agent_data['user_number'] = data['user_number']
                    io.to(data['session_id']).emit('noagentavailable', no_agent_data);
                }
            } else {
                is_agent_available = false;
                console.log("this is else in no agent available", data);
                no_agent_data = { 'channel': data['channel'], 'session_id': data['session_id'], chatbot_id: data['bot_id'] }
                if (data['channel'] == 'whatsapp') no_agent_data['user_number'] = data['user_number']
                io.to(data['session_id']).emit('noagentavailable', no_agent_data);
            }
            // if (data['channel'] == 'whatsapp') {
            //   data['cb_session'] = data['session_id']
            //   data['session_id'] = session_id
            //   console.log("set session ", data)
            //   io.sockets.emit('setsession', data);
            //   // io.sockets.emit('setsession', data);
            //   Promise.resolve(m_storechat.checkSession(session_id)).then(function(result) {
            //     if (result[0].length > 0) {
            //       console.log("session already there")
            //     } else {
            //       console.log("no session so inserting")
            //       Promise.resolve(m_storechat.setSession(data["bot_id"], session_id)).then(function(result) {

            //       })
            //     }
            //   })
            // }
            if (data['channel'] == 'website') {
                Promise.resolve(m_storechat.checkSession(session_id)).then(function(result) {
                    if (result[0].length > 0) {
                        console.log("session already there")
                    } else {
                        console.log("no session so inserting")
                        Promise.resolve(m_storechat.setSession(data["bot_id"], session_id, data["ip_address"], data["user_location"], data["user_url"], data['notes'])).then(function(result) {

                        })
                        if (is_agent_available) Promise.resolve(m_storechat.setAgentname(data["bot_id"], session_id, '', assigned_agent)).then(function(result) {})
                    }
                })
            }
            if (data['channel'] == 'whatsapp') {
                Promise.resolve(m_storechat.checkSession(session_id)).then(function(result) {
                    if (result[0].length > 0) {
                        console.log("session already there")
                    } else {
                        console.log("no session so inserting")
                        Promise.resolve(m_storechat.setSession(data["bot_id"], session_id)).then(function(result) {
                            console.log('insertion completed');
                        })
                        if (is_agent_available) {
                            Promise.resolve(m_storechat.setAgentname(data["bot_id"], session_id, '', assigned_agent)).then(function(result) {
                                console.log('result in set agent name', result)
                            })
                        }
                    }
                })
            }
            if (is_agent_available) {
                Promise.resolve(m_storechat.isWhatsappEnabled(data['bot_id'])).then(function(res) {
                    is_whatsapp_enabled = res[0]['live_chat_whatsapp_notification']
                    if (is_whatsapp_enabled == '1') {
                        // Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(resp){
                        // console.log('agents list -----> ',resp);
                        // var agents_list = resp[0];
                        Promise.resolve(m_storechat.getWhatsappDetails("5354")).then(function(result) {
                            // for(i=0;i<agents_list.length;i++){
                            sendWhatsappNotification(assigned_agent_number, result, data['bot_name'])
                            // }
                        })
                        // })
                    }
                })
                Promise.resolve(m_storechat.getCustomerType(data['bot_id'])).then(function(res) {
                    let customer_type = res
                    if (customer_type[0]['customer_type'] == 'reseller_client') {

                    } else {
                        // Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(result){
                        //   agents_list = result[0];
                        //   console.log('agents list email sending---------->',result);
                        if (customer_type[0]['id'] == '4473') {
                            sendWhitelabelMail([{ email: assigned_agent_email }], function(error, response) {
                                if (error) {
                                    console.log("Talal email sending error",error);
                                } else {
                                    console.log("Tala email sending no error");
                                }
                            })
                        } else {
                            sendGridEmailSending([{ email: assigned_agent_email }], data['bot_name'], function(error, response) {
                                if (error) {
                                    console.log("sendgrid email sending error");
                                } else {
                                    console.log("sendgrid email sending no error");
                                }
                            })
                        }
                        // })
                    }
                })
            }
            // if (data['bot_id'] == '203') {
            //   const body = {
            //     messages: {
            //       authentication: {
            //         productToken: '545295AE-59E3-467A-8119-FFA961B1F853'
            //       },
            //       msg: [{
            //         body: {
            //           type: 'auto',
            //           content: 'Fallback text for SMS'
            //         },
            //         to: [{
            //             number: "00917306649123"
            //           },
            //           {
            //             number: '00917897336949'
            //           },
            //           {
            //             number: '00918897670321'
            //           },
            //           {
            //             number: '00918500660020'
            //           }
            //         ],
            //         from: '0031762011571',
            //         allowedChannels: ["WhatsApp"],
            //         richContent: {
            //           conversation: [{
            //             text: "You have got a customer waiting for you with live interaction please respond to him *ASAP*"
            //           }]
            //         }
            //       }]
            //     }
            //   }
            //   axios.post('https://gw.cmtelecom.com/v1.0/message', body)
            //     .then((res) => {
            //       console.log(`Status: ${res.status}`);
            //       console.log('Body: ', res.data);
            //     }).catch((err) => {
            //       console.error(err);
            //     });
            // }
        })
        socket.on('setagentname', function(data) {
            if (data["channel"] == "whatsapp") {
                session_id = data["session_id"];
            } else {
                session_id = decrypt(data["session_id"])
            }
            console.log("set agent called data ", data)
            io.to(data["session_id"]).emit('setagentname', data);
            Promise.resolve(m_storechat.setAgentname(data["bot_id"], session_id, data["agent_name"], data["agent_id"])).then(function(result) {

            })
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
            io.to(data["agent_id"]).emit('setsession', data);
            io.to(data['session_id']).emit('agentassigned', { agent_id: data["agent_id"], 'channel': data['channel'], 'session_id': data['session_id'] })
            // io.to(data['session_id']).emit('agentassigned',{agent_id:data['assigned_agent_id'],'channel':data['channel'],'session_id':data['session_id']})
            // io.sockets.emit('assignotheragent', data);
            Promise.resolve(m_storechat.updateAgentname(session_id, data["agent_id"])).then(function(result) {

            })
            Promise.resolve(m_storechat.updateAgentChats(data["agent_id"], data['bot_id'], 'add')).then(function(result) {})
        })
        socket.on('closesession', function(data) {
            session_id = decrypt(data["session_id"]);
            if (data['channel'] == 'whatsapp') {
                data['session_id'] = session_id
                Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                    console.log('close session result ----->', result)
                    agent_ids = result[0]["agent_ids"] ? result[0]["agent_ids"].toString().split(",") : [];
                    agent_ids.forEach(agent_id => {
                        io.to(agent_id).emit('closesession', data);
                    })
                    Promise.resolve(m_storechat.checkIsClosed(session_id)).then(function(res) {
                        if (res[0].length > 0) {

                        } else {
                            agent_ids.forEach(agent_id => {
                                Promise.resolve(m_storechat.updateAgentChats(agent_id, data['bot_id'], 'delete')).then(function(result) {})
                            })
                        }
                    })
                })
            } else {

                Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                    console.log('close session result ----->', result)
                    agent_ids = result[0]["agent_ids"].toString().split(",");
                    agent_ids.forEach(agent_id => {
                        io.to(agent_id).emit('closesession', data);
                    })
                    Promise.resolve(m_storechat.checkIsClosed(session_id)).then(function(res) {
                        if (res[0].length > 0) {

                        } else {
                            agent_ids.forEach(agent_id => {
                                Promise.resolve(m_storechat.updateAgentChats(agent_id, data['bot_id'], 'delete')).then(function(result) {})
                            })
                        }
                    })
                })
            }
            console.log("close session called ", data)
            Promise.resolve(m_storechat.closeSession(session_id)).then(function(result) {

            })
        })
        socket.on('closesessionfromadmin', function(data) {
            // session_id = decrypt(data["session_id"]);
            if (data["session_id"].length > 10) {
                session_id = decrypt(data["session_id"]);
            } else if (data["session_id"].length < 10) {
                session_id = data["session_id"]
            } else {
                session_id = decrypt(data["session_id"]);
            }
            console.log("close session from admin called ", data)
            io.to(session_id).emit('closesessionfromadmin', data);
            Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                console.log('close session result ----->', result)
                agent_ids = result[0]["agent_ids"] ? result[0]["agent_ids"].toString().split(",") : [];
                console.log("agent ids in close session admin ", agent_ids);
                agent_ids.forEach(agent_id => {
                    io.to(agent_id).emit('closesessionfromadmin', data);
                })
                agent_ids.forEach(agent_id => {
                    Promise.resolve(m_storechat.updateAgentChats(agent_id, data['bot_id'], 'delete')).then(function(result) {})
                })
                Promise.resolve(m_storechat.closeSession(session_id)).then(function(result) {

                })
            })
        })
        socket.on('requestfeedback', function(data) {
            io.to(data['session_id']).emit('requestfeedback', data)
        })
        socket.on('submitfeedbackmessage', function(data) {
            console.log("submitting feedback")
            session_id = decrypt(data["session_id"])
            if (data['channel'] == 'whatsapp') {
                data['session_id'] = session_id
            }
            io.to(data['agent_id']).emit('submitfeedbackmessage', data)
            Promise.resolve(m_storechat.saveFeedbackMessage(session_id, data['message'])).then(function(result) {

            })
        })
        socket.on('userseenmessage', function(data) {
            console.log("user seen event")
            session_id = decrypt(data["session_id"])
            if (data['channel'] == 'whatsapp') {
                data['session_id'] = session_id
            }
            io.to(data['agent_id']).emit('userseenmessage', data)
            Promise.resolve(m_storechat.userSeenMessage(session_id)).then(function(result) {

            })
        })
        socket.on('agentseenmessage', function(data) {
            console.log("user seen event")
            if (data['session_id'].length > 10) {
                session_id = decrypt(data["session_id"])
            } else {
                session_id = data['session_id'];
            }
            // if (data['channel'] == 'whatsapp') {
            //   data['session_id'] = session_id
            // }
            io.to(data['session_id']).emit('agentseenmessage', data);
            // io.sockets.emit('agentseenmessage',data)
            Promise.resolve(m_storechat.agentSeenMessage(session_id)).then(function(result) {

            })
        })
        socket.on('markresolved', function(data) {
            console.log("marking resolved")
            if (data["session_id"].length > 10) {
                session_id = decrypt(data["session_id"]);
            } else if (data["session_id"].length < 10) {
                session_id = data["session_id"]
            } else {
                session_id = decrypt(data["session_id"]);
            }
            io.to(data['session_id']).emit('markresolved', data)
            Promise.resolve(m_storechat.markResolved(session_id)).then(function(result) {

            })
            Promise.resolve(m_storechat.getAgentId(session_id)).then(function(result) {
                console.log('mark resolved ----->', result)
                agent_ids = result[0]["agent_ids"] ? result[0]["agent_ids"].toString().split(",") : [];
                console.log("mark resolved agents ", agent_ids);
                agent_ids.forEach(agent_id => {
                    io.to(agent_id).emit('markresolved', data);
                })
                agent_ids.forEach(agent_id => {
                    Promise.resolve(m_storechat.updateAgentChats(agent_id, data['bot_id'], 'delete')).then(function(result) {})
                })
                Promise.resolve(m_storechat.closeSession(session_id)).then(function(result) {

                })
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
            io.to(data['agent_id']).emit('submitfeedback', data)
            Promise.resolve(m_storechat.saveFeedback(session_id, data['rating'])).then(function(result) {

            })
        })
        socket.on('setstatus', function(data) {
            io.sockets.emit('setstatus', data)
            if (data['assigned_sessions']) {
                let assigned_sessions = data['assigned_sessions'].split(",");
                assigned_sessions.forEach(assigned_session => {
                    io.to(assigned_session).emit('setstatus', data)
                })
            }
            // else{
            //     io.sockets.emit('setstatus', data);
            // }
            Promise.resolve(m_storechat.saveAgentStatus(data['agent_id'], data['status'])).then(function(result) {

            })
        })
        socket.on('banip', function(data) {
            io.to(data['session_id']).emit('banip', data)
        })
        socket.on('unbanip', function(data) {
            io.to(data['session_id']).emit('unbanip', data)
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

function sendWhatsappNotification(number, data, bot_name) {
    var access_token = data['product_token']
    const headers = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + access_token
        }
    }
    console.log("whatsapp number", number)
    number = number.replace("+", "");
    number = number.replace("-", "");
    const body = {
        to: number,
        type: "template",
        template: {
            namespace: "46827356_1e8f_4347_88fb_3ed5f42cbce7",
            name: "live_chat",
            language: {
                policy: "deterministic",
                code: "en_US"
            },
            components: [{
                type: "body",
                parameters: [{
                    type: "text",
                    text: "*" + bot_name + "*"
                }]
            }]
        }
    }
    axios.post('https://whatsapp-api-491.clare.ai/v1/messages/', body, headers)
        .then((res) => {
            console.log(`Notification Status: ${res.status}`);
            console.log('Notification Body: ', res.data);
        }).catch((err) => {
            console.error(err);
        });
}

function send_360message(result,data) {
    console.log("inside 360 msg");
    var access_token = result['product_token'];
    var cm_number = result['cm_number'];
    const headers = {
        headers : {
            'Content-Type':'application/json',
            'D360-API-KEY':access_token
        }
    }
    const body = {
        to: data['device_print'] || data['user_number'],
        type: "text",
        text: {
            body: data['message']
        }
    }
    console.log("body in 360", body);
    axios.post('https://waba.360dialog.io/v1/messages', body, headers)
        .then((res) => {
            console.log(`Status: ${res.status}`);
            console.log('Body: ', res.data);
        }).catch((err) => {
            console.log(err);
        });
}

function send_watimessage(result, data) {
    console.log("inside wati message")
    var access_token = result['product_token']
    var cm_number = result['cm_number']
    const headers = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + access_token
        }
    }
    console.log("provider ", result['provider'])
    console.log("endpoint ", result['endpoint'])
    const body = {
        to: data['device_print'] || data['user_number'],
        type: "text",
        text: {
            body: data['message']
        }
    }
    console.log("body in wati", body);
    axios.post(result['endpoint'] + '/v1/messages', body, headers)
        .then((res) => {
            console.log(`Status: ${res.status}`);
            console.log('Body: ', res.data);
        }).catch((err) => {
            console.log(err);
        });
}

function send_netcoremessage(result, data) {
    console.log("inside netcore message")
    const headers = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + result['product_token']
        }
    }
    const body = {
        message: [{ "recipient_whatsapp": data['user_number'], "recipient_type": "individual", "message_type": "text", "type_text": [{ "content": data['message'] }] }]
    }
    axios.post(result['endpoint'], body, headers)
        .then((res) => {
            console.log(`Status: ${res.status}`);
            console.log('Body: ', res.data);
        }).catch((err) => {
            console.error(err);
        });
}


function send_cmmessage(result, data) {
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

function sendWhitelabelMail(agents_list) {
    var tomail = [];
    for (var i = 0; i < agents_list.length; i++) {
        tomail.push(agents_list[i]['email']);
    }
    let transport = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        auth: {
            user: 'hrcare@taleed.com.sa',
            pass: 'T@leed4321'
        }
    });
    const message = {
        from: 'hrcare@taleed.com.sa', // Sender address
        to: tomail, // List of recipients
        subject: 'You have a user waiting for you in Live Chat!!!', // Subject line
        html: '<div style="float:left;width:100%">Dear HR<br><br>A user is waiting for you to connect with him on Chatbot. Please <a href="https://www.app.smatbot.com/bot?tab=live_chat&bot_id=5625&profile_id=4239" target="_blank">click here</a> to join the live chat.<br><br>Thank you</div>' // Plain text body
    };
    transport.sendMail(message, function(err, info) {
        if (err) {
            console.log(err)
        } else {
            console.log(info);
        }
    });
}

function sendGridEmailSending(agents_list, bot_name) {
    var tomail = [];
    for (var i = 0; i < agents_list.length; i++) {
        tomail.push({ email: agents_list[i]['email'] });
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

            personalizations: [{ to: tomail }],
            from: { email: 'info@smatbot.com' },
            subject: 'You have a user waiting for you in ' + bot_name + ' Live Chat!!!',
            content: [{
                type: 'text/html',
                value: '<div style="width: 70%;margin-right: auto;margin-left: auto;float: none"><div style="float: left;margin-left: auto;margin-right: auto;width:100%;margin:0;font-family:trebuchet MS;border:1px solid lightgray"><div style="float: left;width:100%"><div style="width:100%;background:white;float:left;border-bottom: 1px solid lightgray"><div style="float:left;width:100%"><h2 style="float: left;min-width:98%;text-align: center;margin-left: 1%;margin-top:10px;margin-bottom:10px;margin-left:10px" class="logo"><img src="https://s3.ap-south-1.amazonaws.com/custpostimages/sb_images/SB_logo_horizontal_text.png" height="60" alt=""></h2></div></div><div style="float: left;width:100%;background:#1094d126;font-size:16px"><div style="width:90%;margin-left:5%;margin-right:5%;display:block;float:left;padding:10px;margin-top: 25px;margin-bottom: 25px;box-sizing: border-box"><label style="float:left;width:100%">Dear Customer,</label><label style="margin-top:15px;float:left;width:100%">A user is waiting for you to connect with them on ' + bot_name + ' SmatBot.</label><label style="margin-top:15px;float:left;width:100%">Please check immediately.</label><label style="margin-top:25px;float:left;width:100%">Thank you,<br>SmatBot Team</label></div></div></div></div></div>'
            }]
        },
        json: true
    };
    return new Promise(function(resolve, reject) {
        request(options, function(error, response, body) {
            if (error) {
                console.log('sendgrid email sending failed for response:' + JSON.stringify(error))
                resolve(true)
            } else {
                console.log('sendgrid email sent to response:' + JSON.stringify(body))
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
    }, 1000)
})

startConnect();

http.listen(8000, function() {
    console.log('listening on *:8000');
});
