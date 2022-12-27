var app = require("express")();
const fs = require("fs");
const url = require("url");
const nodemailer = require("nodemailer");
const request = require("request");
const axios = require("axios");
let moment = require("moment-timezone");
let m_storechat = require("./models/m_store_chat");
let timeStamp = require('./utils/timeStamp')
var http = require("https").createServer(
  {
    key: fs.readFileSync("/home/ubuntu/certs/smatbotkey.pem"),
    cert: fs.readFileSync("/home/ubuntu/certs/smatbotcert.pem"),
    ca: fs.readFileSync("/home/ubuntu/certs/smatbotbundle.crt"),
  },
  app
);
const AccessToken = require("twilio").jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
//const nodemailer = require("nodemailer");


const twilioAccountSid = "AC63f423bcdcf304c0c3a8cdc674083708";
const twilioApiKey = "SK5f4cadbd99aa358cee794cd84bd15633";
const twilioApiSecret = "rKSM1dKB5jwc0O1Vw5dSS738HKg6IO6I";
const FCM = require("fcm-node");
const serverKey =
  "AAAAfgKVySk:APA91bHO_OWD39viqnJWknyBLPw2bZnP9HEADKVVxRfXPIpOuZa2yTUdjN09JLX7ZC_neYK528-kl413y3n4D_yzrJtpPU-gwazonUv92MUnZkl7Ork83DMmYMVOhl0r6jD_Ggvhl3Ue";

var io = require("socket.io")(http, {
  pingTimeout: 60000,
  pingInterval: 25000,
  origins: "*:*",
});

var registered_devices = [
  "puZ5rlfa1LQxpsqxMvAicifk3wYiHgSsBeWC1c2QfqNG77uONXNSMoAcN_zt-nKa",
];

const log = require('./utils/logger');

const closeSessionRouter = require('./routes/closeSessions')
app.use(closeSessionRouter)

const closeSessionCron = require('./jobs/closeSessionsCron.js')
closeSessionCron.start()


const redis_client = require('../cinepolis/redis.js');
const { doRequest } = require("./utils/doRequest");


var decrypt = function (text) {
  if (text == null || text.length <= 0 || text == undefined) return;
  var MCrypt = require("mcrypt").MCrypt;
  var rijEcb = new MCrypt("rijndael-128", "cbc");
  console.log("=========>before bufrfer" + text);
  var ivAndCiphertext = new Buffer.from(text, "base64");
  console.log("=========>afret bufrfer" + ivAndCiphertext);

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
  return text.toString().replace(/\0/g, "");
};

users = [];

var if_connected;

function startConnect() {


  io.on("connection", async function (socket) {
    var url_str = socket.handshake.url;
    var queryObj = url.parse(url_str, { parseQueryString: true }).query;
    console.log("socket id is : ", queryObj);

    if (queryObj && queryObj.agentId && queryObj.agentId.length > 0) {
      if (queryObj.type == "agent") {
        console.log(queryObj)
        if (queryObj.agentId) {

          await socket.join(queryObj.agentId);

          console.log(queryObj.agentId)

          let user_sessions = await redis_client.getAsync(queryObj.agentId) //2378 of agent id dashboard agents table id
          console.log(user_sessions)


          if (user_sessions) {

            user_sessions = JSON.parse(user_sessions.set_session)
            if (!Array.isArray(user_sessions)) return

            if (user_sessions) {

              user_sessions.forEach((user_session) => {
                io.to(queryObj.agentId).emit('setsession', user_session)
                io.to(user_session.session_id).emit('setsession', user_session)

              })

            }

          }
          await redis_client.del(queryObj.agentId)

        }

      }
    }
    console.log("A user connected");
    if_connected = true;
    socket.on("start-video", function (data) {
      io.to(data["agent_id"]).emit("start-video", data);
    });
    socket.on("reloadpage", async function (data) {
      console.log("in reload page event", data)

      if (data["channel"] == "whatsapp") {

        // session_id = data['session_id']
        let chatbot_details = await m_storechat.getWhatsappDetails(data['chatbot_id'])
        data['message'] = "This conversation has been auto-closed as there has been no response from both the sides."
        // if (!Array.isArray(chatbot_details)) {
        //   return
        // }
        // chatbot_details = chatbot_details[0]

        if (chatbot_details["provider"] == "cm.com") {
          send_message = send_cmmessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "wati") {
          send_message = send_watimessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "netcore") {
          send_message = send_netcoremessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "360dialog") {
          send_message = send_360message(chatbot_details, data);
        }

        io.to(data["agent_id"]).emit("autoclose", data);

        return

      }
      io.to(data["agent_id"]).emit("autoclose", data);
      io.to(data['session_id']).emit('autoclose', data);

    });
    socket.on("chatclosingreminder", async function (data) {
      console.log("in reminder page event", data)
      if (data["channel"] == "whatsapp") {

        // session_id = data['session_id']
        let chatbot_details = await m_storechat.getWhatsappDetails(data['chatbot_id'])
        data['message'] = "This chat will be closed in 1 min."
        // if (!Array.isArray(chatbot_details)) {
        //   return
        // }
        // chatbot_details = chatbot_details[0]
        console.log(chatbot_details)
        if (chatbot_details["provider"] == "cm.com") {
          send_message = send_cmmessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "wati") {
          send_message = send_watimessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "netcore") {
          send_message = send_netcoremessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "360dialog") {
          send_message = send_360message(chatbot_details, data);
        }
        io.to(data["agent_id"]).emit("chatclosingreminder", data);

        return
      }
      io.to(data["agent_id"]).emit("chatclosingreminder", data);
      io.to(data['session_id']).emit('chatclosingreminder', data);


    });

    socket.on("video-declined", function (data) {
      io.to(data["session_id"]).emit("video-declined", data);
    });
    socket.on("video-disconnect", function (data) {
      io.sockets.emit("video-disconnect", data);
    });

    socket.on("start-screen-share", function (data) {
      io.sockets.emit("start-screen-share", data);
    });
    socket.on("stop-screen-share", function (data) {
      io.sockets.emit("stop-screen-share", data);
    });
    socket.on("agent-received", function (data) {
      io.sockets.emit("agent-received", data);
    });
    socket.on("setagentsession", function (data) {
      socket.join(data["agent_id"]);
      log.info("Joining the agent to room event 'setagentsession' ", JSON.stringify(data))
      console.log("socket id in set agent session ", data);
    });

    socket.on("setUsername", function (data) {
      console.log(users);
      console.log(users.indexOf(data));
      if (users.indexOf(data) == -1) {
        users.push(data);
        console.log(users);
        socket.emit("userSet", {
          username: data,
        });
      } else {
        socket.emit(
          "userExists",
          data + " username is taken! Try some other username. "
        );
      }
    });

    socket.on("msg", function (data) {
      io.sockets.emit("newmsg", data);
    });
    socket.on("testconnect", function (data) {
      console.log("test connect data", data);
      io.sockets.emit("testconnect", data);
    });
    socket.on("sendtoadmin", function (data) {
      io.sockets.emit("sendtoadmin", data);
    });
    socket.on("senddevicetoken", function (data) {
      console.log("registered device token : ", data);
      // registered_devices.push(data['devicetoken']);
      Promise.resolve(
        m_storechat.storeDeviceToken(data["devicetoken"], data["agent_id"])
      ).then(function (result) { });
    });

    socket.on("adminsentmessage", async function (data) {

      let room1 = io.sockets.adapter.rooms;
      let session_id

      log.info("admin sent message :: " + JSON.stringify(data))
      log.info("admin sent message : sending to - " + data["agent_id"] + " : all connected rooms : " + JSON.stringify(room1))


      // console.log(data)




      if (data["channel"] == "whatsapp") {

        session_id = data['session_id']
        let chatbot_details = await m_storechat.getWhatsappDetails(data['chatbot_id'])
        console.log(chatbot_details)
        // if (!Array.isArray(chatbot_details)) {
        //   console.log("===============> in whatsapp")

        //   return
        // }
        // chatbot_details = chatbot_details[0]
        console.log("================>" + JSON.stringify(chatbot_details))
        if (chatbot_details["provider"] == "cm.com") {
          send_message = send_cmmessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "wati") {
          send_message = send_watimessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "netcore") {
          send_message = send_netcoremessage(chatbot_details, data);
        } else if (chatbot_details["provider"] == "360dialog") {
          send_message = send_360message(chatbot_details, data);
        }
        // io.to(data['agent_id']).emit('adminsentmessage', data)


      }
      if (data["channel"] == "website") {
        io.to(data["session_id"]).emit("adminsentmessage", data);

        session_id = decrypt(data['session_id'])
        room1 = io.sockets.adapter.rooms;
        let rooms = Object.keys(room1)
        let flag = false

        rooms.forEach((room) => {

          if (room == data['agent_id']) {

            flag = true

          }

        })
        if (!flag) {



          await socket.join(data['agent_id']);

        }

        let agent_ids
        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          agent_ids = await m_storechat.getAgentId(session_id)
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            return
          }

          data['agent_id'] = agent_ids[0].agent_ids
          console.log(agent_ids)
        }
        // let agent_id = agent_ids[0]

        // io.to(data['agent_id']).emit('adminsentmessage', data)


      }


      // if (data["channel"] == "instagram") {
      //   if (data["message"].includes(".jpg")) {
      //     data["message"] = data["message"].split(";;")[1];
      //   }

      //   console.log(data);
      //   // process.exit();
      //   await instagram_send_message(data["device_print"], data["message"]);
      //   // await reply(data['device_print'],data['message'],)
      // }
      // if (data["channel"] == "messenger") {
      //   if (data["message"].includes(".jpg")) {
      //     data["message"] = data["message"].split(";;")[1];
      //   }

      //   console.log(data);
      //   // process.exit();
      //   await messenger_send_message(data["device_print"], data["message"]);
      //   // await reply(data['device_print'],data['message'],)
      // }

      console.log(session_id, data['agent_id'], data["message"], "customer", data["agent_name"])

      await m_storechat.storeChat(session_id, data['agent_id'], data["message"], "customer", data["agent_name"])


      let date = new Date()

      await redis_client.setAsync(session_id, "last_update", "" + date.getTime())//get the insert 



    })




    socket.on("adminsentmessagetoadmins", function (data) {

      if (data["channel"] == "whatsapp" && data["session_id"].length > 10) {
        console.log("channel is whatsapp and length is mpre than 10");
        session_id = decrypt(data["session_id"]);
      } else if (
        data["channel"] == "whatsapp" &&
        data["session_id"].length < 10
      ) {
        console.log("channel is whatsapp and length is less than 10");
        session_id = data["session_id"];
      } else {
        session_id = decrypt(data["session_id"]);
      }
      console.log("adminsentmessagetoadmins data", data);
      io.sockets.emit("adminsentmessagetoadmins", data);
      var customer_id = "";
      Promise.resolve(m_storechat.getCustomerId(data["chatbot_id"])).then(
        function (result) {
          customer_id = result["customer_id"];
        }
      );
      Promise.resolve(
        m_storechat.storeChat(
          session_id,
          data['agent_id'],
          data["message"],
          "admintoadmin",
          data["agent_name"]
        )
      ).then(function (result) { });
    });




    socket.on("usersentmessage", async function (data) {


      log.info("user sent message :: " + JSON.stringify(data))
      console.log(JSON.stringify(data))
      let session_id = decrypt(data["session_id"]);

      var agent_ids;
      if (data["channel"] == "whatsapp" || data["channel"] == "instagram" ||
        data["channel"] == "messenger") {
        data["session_id"] = session_id;


        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          let agent_ids = await m_storechat.getAgentId(session_id)
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            console.log(agent_ids)
            return
          }

          data['agent_id'] = agent_ids[0].agent_ids
          console.log(agent_ids)
        }
        io.to(data['agent_id']).emit('usersentmessage', data)




      } else {
        session_id = decrypt(data["session_id"]);
        let room1 = io.sockets.adapter.rooms;
        log.info("user sent message : sending to - " + data["agent_id"] + " : all connected rooms : " + JSON.stringify(room1))

        room1 = io.sockets.adapter.rooms;
        let rooms = Object.keys(room1)
        console.log(rooms);
        let flag = false

        rooms.forEach((room) => {

          if (room == data['session_id']) {

            flag = true

          }

        })
        if (!flag) {
          console.log("oin room createion")
          await socket.join(data['session_id']);

        }



        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          let agent_ids = await m_storechat.getAgentId(session_id)
          console.log("in get agent id ==================================>")
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            return
          }
          data['agent_id'] = agent_ids[0].agent_ids
          console.log(agent_ids)
        }

        console.log("===================>event triggered")
        io.to(data['agent_id'].toString()).emit("usersentmessage", data);

      }


      await m_storechat.storeChat(session_id, data['agent_id'], data["message"], "user")


      await m_storechat.updateCounter(session_id)



      if (agent_ids) {

        Promise.resolve(m_storechat.getDeviceTokens(agent_ids[0])).then(
          function (result) {
            var arr = [];
            for (var i = 0; i < result.length; i++) {
              arr.push(result[i].fcm_device_token);
            }
            const fcm = new FCM(serverKey);
            console.log("result from db agent_app details ", arr);
            var message = {
              registration_ids: arr,
              notification: {
                title: "SmatBot - New User",
                body:
                  "A new message came to your " +
                  data["bot_id"] +
                  " live chat from " +
                  data["channel"],
                sound: "default",
                icon: "ic_launcher",
                click_action: "FCM_PLUGIN_ACTIVITY",
                badge: "1",
              },
              priority: "high",
              data: {
                landing_page: "chatmessenger",
                id: agent_ids[0],
              },
            };
            fcm.send(message, (err, response) => {
              if (err) {
                console.log(
                  "Something has gone wrong! push notification : ",
                  JSON.stringify(err)
                );
                // res.send(err);
              } else {
                console.log(
                  "Successfully sent with response: push notification ",
                  response
                );
                // res.send(response)
              }
            });
          }
        );

      }

      const d = new Date();
      let time = d.getTime();

      redis_client.setAsync(session_id, "last_update", "" + time)


    });

    socket.on("admintyping", function (data) {

      log.info("admin typing :: " + JSON.stringify(data))
      io.to(data["session_id"]).emit("admintyping", data);

    });

    socket.on("admintypingstopped", function (data) {

      log.info("admin typing stopped :: " + JSON.stringify(data))


      io.to(data["session_id"]).emit("admintypingstopped", data);
    });

    socket.on("usertyping", function (data) {

      log.info("user typing  :: " + JSON.stringify(data))

      io.to(data["agent_id"]).emit("usertyping", data);
    });

    socket.on("usertypingstopped", function (data) {
      log.info("user typing stopped :: " + JSON.stringify(data))


      io.to(data["agent_id"]).emit("usertypingstopped", data);
    });

    socket.on("requestaccess", function (data) {
      io.sockets.emit("requestaccess", data);
    });

    socket.on("joinbotroom", function (data) {
      //   console.log("join bot room ", data);
      //   if (data["channel"] == "whatsapp") {
      //     data["session_id"] = decrypt(data["session_id"]);
      //   }
      //   socket.join(data["session_id"]);
      //   io.to(data["session_id"]).emit("joinbotroom", data);
    });

    socket.on("setsession", async function (data) {
      session_id = decrypt(data["session_id"]);
      log.info('In set session:: ' + JSON.stringify(data))
      if (data["channel"] == "whatsapp") {

        data["cb_session"] = data["session_id"];
        data["session_id"] = session_id;

        console.log("set session ", data);



      }

      // else if (
      //   data["channel"] == "instagram" ||
      //   data["channel"] == "messenger"
      // ) {
      //   data["cb_session"] = data["session_id"];
      //   data["session_id"] = session_id;
      // }

      else {

        data["ip_address"] = decrypt(data["ip_address"]);
        data["user_location"] = decrypt(data["user_location"]);
        fs.appendFile(
          "/home/ubuntu/live_chat_dev/smatbot_sessions.txt",
          `\n\n${moment().format(
            "DD-MM-YYYY HH:mm:ss"
          )} set session ========> ${JSON.stringify(data)}`,
          () => { }
        );
        console.log("set session ", data);




        await socket.join(data['session_id']);

      }


      let is_agent_available = true;
      let assigned_agent_email = null;
      let assigned_agent_number = null;
      let department_id;
      if (data["department_id"]) {
        department_id = data["department_id"];
      } else {
        department_id = false;
      }

      //    updateAgentAssignedChats = await m_storechat.updateAgentAssignedChats(data['bot_id']);
      //    console.log(updateAgentAssignedChats, "updateAgentAssignedChats")
      get_available_agents = await m_storechat.getAgent(
        data["bot_id"],
        department_id
      );
      log.info(
        "get_available_agents:: " + JSON.stringify(get_available_agents)
      );
      console.log(
        "assigned agents data===========",
        JSON.stringify(get_available_agents)
      );
      if (get_available_agents[0].length > 0) {
        if ((!get_available_agents[0][0]["chats_limit"]) ||
          (get_available_agents[0][0]["chats_limit"] >
            get_available_agents[0][0]["assigned_chats"]) && get_available_agents[0][0]["chats_limit"] != 0) {
          assigned_agent = get_available_agents[0][0]["agent_id"];
          assigned_agent_email = get_available_agents[0][0]["email"];
          assigned_agent_number = get_available_agents[0][0]["phone_number"];
          assigned_agent_name = get_available_agents[0][0]["full_name"];
          data["agent_name"] = assigned_agent_name

          console.log(data)

          log.info('In set session :: assigning agent to : ' + data['session_id'] + 'available rooms : ' + JSON.stringify(io.sockets.adapter.rooms))

          let room1 = io.sockets.adapter.rooms

          let rooms = Object.keys(room1)
          let flag = false

          rooms.forEach((room) => {

            if (room == assigned_agent) {

              flag = true

            }

          })


          log.info('In setsession sending set session event to assigned agent : ' + assigned_agent, ' for user session : ' + data['session_id'])



          io.to(assigned_agent).emit("setsession", data);


          console.log("agentassigned data", {
            agent_id: assigned_agent,
            channel: data["channel"],
            session_id: data["session_id"],
          });

          Promise.resolve(
            m_storechat.setSession(
              data["bot_id"],
              session_id,
              data["ip_address"],
              data["user_location"],
              data["user_url"],
              data["notes"],
              assigned_agent
            )
          ).then(function (result) {
            fs.appendFile(
              "/home/ubuntu/live_chat/smatbot_sessions.txt",
              `\n\n${moment().format(
                "DD-MM-YYYY HH:mm:ss"
              )} set session inserting ========> ${JSON.stringify(result)}`,
              () => { }
            );
          });


          log.info("sending agent assigned event  to user :: " + JSON.stringify({
            agent_id: assigned_agent,
            channel: data["channel"],
            session_id: data["session_id"],
            agent_name: assigned_agent_name,
          }))

          io.to(data["session_id"]).emit("agentassigned", {
            agent_id: assigned_agent,
            channel: data["channel"],
            session_id: data["session_id"],
            agent_name: assigned_agent_name,
          });


          Promise.resolve(
            m_storechat.updateAgentChats(assigned_agent, data["bot_id"], "add")
          ).then(function (result) { });
          Promise.resolve(m_storechat.getDeviceTokens(assigned_agent)).then(
            function (result) {
              var arr = [];
              for (var i = 0; i < result.length; i++) {
                arr.push(result[i].fcm_device_token);
              }
              const fcm = new FCM(serverKey);
              console.log("result from db agent_app details ", arr);
              var message = {
                registration_ids: arr,
                notification: {
                  title: "SmatBot - New User",
                  body:
                    "A new user come to your live chat from " + data["channel"],
                  sound: "default",
                  icon: "ic_launcher",
                  badge: "1",
                  click_action: "FCM_PLUGIN_ACTIVITY",
                },
                data: {
                  landing_page: "active-users",
                  id: assigned_agent,
                },
                priority: "high",
                data: {
                  // action: req.body.actionType, // Action Type
                  // payload: req.body.payload // payload
                },
              };
              fcm.send(message, (err, response) => {
                if (err) {
                  console.log(
                    "Something has gone wrong! push notification : ",
                    JSON.stringify(err)
                  );
                  // res.send(err);
                } else {
                  console.log(
                    "Successfully sent with response: push notification ",
                    response
                  );
                  // res.send(response)
                }
              });
            }
          );


        } else {
          is_agent_available = false;
          console.log("this is else in no agent available", data);
          log.info('In set session :: No agent availabele for session : ' + data['session_id'] + " user data :" + JSON.stringify(data))
          no_agent_data = {
            channel: data["channel"],
            session_id: data["session_id"],
            chatbot_id: data["bot_id"],
          };
          if (data["channel"] == "whatsapp")
            no_agent_data["user_number"] = data["user_number"];

          // if (data["channel"] == "instagram") {


          //   await instagram_send_message(data["device_print"],"No agents are busy please try again after some time");

          // }  
          io.to(data["session_id"]).emit("noagentavailable", no_agent_data);
        }
      } else {
        is_agent_available = false;
        console.log("this is else in no agent available", data);
        no_agent_data = {
          channel: data["channel"],
          session_id: data["session_id"],
          chatbot_id: data["bot_id"],
        };
        if (data["channel"] == "whatsapp")
          no_agent_data["user_number"] = data["user_number"];
        io.to(data["session_id"]).emit("noagentavailable", no_agent_data);


        // if (data["channel"] == "instagram") {


        //   await instagram_send_message(data["device_print"],"No agents are online please try again after some time");

        // }
      }
      if (data["channel"] == "website") {
        Promise.resolve(m_storechat.checkSession(session_id)).then(function (
          result
        ) {
          if (result[0].length > 0) {
            console.log("session already there");
          } else {
            console.log("no session so inserting");

            if (is_agent_available)
              Promise.resolve(
                m_storechat.setAgentname(
                  data["bot_id"],
                  session_id,
                  "",
                  assigned_agent
                )
              ).then(function (result) { });
          }
        });
      }


      // if (data["channel"] == "instagram") {


      //   await instagram_send_message(data["device_print"], data["agent_name"]+" "+data["message"] );

      // }

      if (data["channel"] == "whatsapp") {
        Promise.resolve(m_storechat.checkSession(session_id)).then(function (
          result
        ) {
          if (result[0].length > 0) {
            console.log("session already there");
          } else {
            console.log("no session so inserting");
            // Promise.resolve(
            //   m_storechat.setSession(
            //     data["bot_id"],
            //     session_id,
            //     data["ip_address"],
            //     "",
            //     "",
            //     "",
            //     ""
            //   )
            // ).then(function (result) {
            //   console.log("insertion completed");
            // });
            if (is_agent_available) {
              Promise.resolve(
                m_storechat.setAgentname(
                  data["bot_id"],
                  session_id,
                  "",
                  assigned_agent
                )
              ).then(function (result) {
                console.log("result in set agent name", result);
              });
            }
          }
        });
      }
      if (is_agent_available) {

        console.log(data);

        console.log("in is available");


        setTimeout(async () => {
          // data["agent_name"] = data["full_name"];
          data["message"] = "(---Agent Joined the chat session---)";
          console.log(data);
          if (data['channel'] == "whatsapp") {



            Promise.resolve(m_storechat.getWhatsappDetails(data['bot_id'])).then(
              function (result) {

                if (result["provider"] == "cm.com") {
                  send_message = send_cmmessage(result, data);
                } else if (result["provider"] == "wati") {
                  send_message = send_watimessage(result, data);
                } else if (result["provider"] == "360dialog") {
                  send_message = send_360message(result, data);
                } else if (result["provider"] == "netcore") {
                  send_message = send_netcoremessage(result, data);
                }
              }
            );


          }

        }, 3000);



        Promise.resolve(m_storechat.isWhatsappEnabled(data["bot_id"])).then(
          function (res) {
            is_whatsapp_enabled = res[0]["live_chat_whatsapp_notification"];
            if (is_whatsapp_enabled == "1") {
              // Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(resp){
              // console.log('agents list -----> ',resp);
              // var agents_list = resp[0];
              Promise.resolve(m_storechat.getWhatsappDetails(data["bot_id"])).then(
                function (result) {
                  // for(i=0;i<agents_list.length;i++){
                  sendWhatsappNotification(
                    assigned_agent_number,
                    result,
                    data["bot_name"]
                  );
                  // }
                }
              );
              // })
            }

          }
        );
        Promise.resolve(m_storechat.getCustomerType(data["bot_id"])).then(
          function (res) {
            let customer_type = res;
            if (customer_type[0]["customer_type"] == "reseller_client") {
            } else {
              // Promise.resolve(m_storechat.getAgentsList(data["bot_id"])).then(function(result){
              //   agents_list = result[0];
              //   console.log('agents list email sending---------->',result);
              if (customer_type[0]["id"] == "4473") {
                sendWhitelabelMail(
                  [{ email: assigned_agent_email }],
                  function (error, response) {
                    if (error) {
                      console.log("Talal email sending error", error);
                    } else {
                      console.log("Tala email sending no error");
                    }
                  }
                );
              } else {
                sendGridEmailSending(
                  [{ email: assigned_agent_email }],
                  data["bot_name"],
                  function (error, response) {
                    if (error) {
                      console.log("sendgrid email sending error");
                    } else {
                      console.log("sendgrid email sending no error");
                    }
                  }
                );
              }
              // })
            }
          }
        );



        if (data['channel'] == 'website') {

          let e = await redis_client.setAsync(decrypt(data['session_id']), "session_id", data['session_id'], "channel", "website")


          redis_client.redis_client.expire(data['session_id'], 9000);

        }
        else if (data['channel'] == 'whatsapp') {

          let e = await redis_client.setAsync(data['session_id'], "channel", "whatsapp", "device_print", data['device_print'])

          console.log("============>" + e)
          redis_client.redis_client.expire(data['session_id'], 9000);

        }
      } else {

        setTimeout(async () => {

          if (data['channel'] == "whatsapp") {
            data["message"] = "No agents are available at the moment.";


            Promise.resolve(m_storechat.getWhatsappDetails(data['bot_id'])).then(
              function (result) {

                if (result["provider"] == "cm.com") {
                  send_message = send_cmmessage(result, data);
                } else if (result["provider"] == "wati") {
                  send_message = send_watimessage(result, data);
                } else if (result["provider"] == "360dialog") {
                  send_message = send_360message(result, data);
                } else if (result["provider"] == "netcore") {
                  send_message = send_netcoremessage(result, data);
                }
              }
            );


          }

        }, 3000);

      }

    });

    socket.on("setagentname", function (data) {
      if (data["channel"] == "whatsapp") {
        session_id = data["session_id"];
      } else {
        session_id = decrypt(data["session_id"]);
      }
      console.log("set agent called data ", data);
      io.to(data["session_id"]).emit("setagentname", data);
      if (data["agent_id"] != null || data["agent_id"].length > 0) {
        Promise.resolve(
          m_storechat.setAgentname(
            data["bot_id"],
            session_id,
            data["agent_name"],
            data["agent_id"]
          )
        ).then(function (result) { });
      }
    });

    socket.on("userregistered", function (data) {
      io.sockets.emit("userregistered", data);
    });

    socket.on("disconn", function (data) {
      io.sockets.emit("disconn", data);
    });


    socket.on("assignotheragent", function (data) {
      console.log("assigning to other agent", data);
      if (data["session_id"].length > 10) {
        session_id = decrypt(data["session_id"]);
      } else if (data["session_id"].length < 10) {
        session_id = data["session_id"];
      } else {
        session_id = decrypt(data["session_id"]);
      }
      io.to(data["agent_id"]).emit("setsession", data);
      io.to(data["session_id"]).emit("agentassigned", {
        agent_id: data["agent_id"],
        channel: data["channel"],
        session_id: data["session_id"],


      });
      // io.to(data['session_id']).emit('agentassigned',{agent_id:data['assigned_agent_id'],'channel':data['channel'],'session_id':data['session_id']})
      // io.sockets.emit('assignotheragent', data);
      if (data["agent_id"] != null || data["agent_id"].length > 0) {
        Promise.resolve(
          m_storechat.updateAgentname(session_id, data["agent_id"])
        ).then(function (result) { });
      }
      Promise.resolve(
        m_storechat.updateAgentChats(data["agent_id"], data["bot_id"], "add")
      ).then(function (result) { });
    });






    socket.on("closesession", async function (data) {

      log.info('In close session ', JSON.stringify(data))

      // session_id = decrypt(data["session_id"]);
      console.log("close session called ", data);


      let time = timeStamp()



      if (data["channel"] == "whatsapp" || data["channel"] == "instagram" ||
        data["channel"] == "messenger") {
        session_id = decrypt(data['session_id']);
        data['session_id'] = session_id

        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          let agent_ids = await m_storechat.getAgentId(session_id)
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            return
          }

          data['agent_id'] = agent_ids[0].agent_ids
          console.log(data)
        }
        io.to(data['agent_id'].toString()).emit("closesession", data);

        let update_assigned_chats = await m_storechat.updateAgentChats(data['agent_id'], data['bot_id'], "delete")

        log.info("Updating assigned chats status for agentid :: " + data['agent_id'] + " : for session :: " + session_id + " : result :: " + update_assigned_chats)

      }
      else {
        session_id = decrypt(data["session_id"]);
        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          let agent_ids = await m_storechat.getAgentId(session_id)
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            return
          }

          data['agent_id'] = agent_ids[0].agent_ids
          console.log(agent_ids)
        }

        io.to(data['agent_id'].toString()).emit("closesession", data);


        let update_assigned_chats = await m_storechat.updateAgentChats(data.agent_id, data['bot_id'], "delete")

        log.info("Updating assigned chats status for agentid :: " + data.agent_id + " : for session :: " + session_id + " : result :: " + update_assigned_chats)


      }

      let result = await m_storechat.closeSession(session_id, time)
      log.info("In close session for whatsapp : closing session : " + session_id + " : result : " + JSON.stringify(result) + " : for user : " + JSON.stringify(data))
      await redis_client.del(session_id)

    });



    socket.on("closesessionfromadmin", async function (data) {


      log.info('In close from admin  :: ', JSON.stringify(data))

      let room1 = io.sockets.adapter.rooms;
      let session_id
      log.info("In close session from admin : closeing session - " + data["agent_id"] + " : all connected rooms : " + JSON.stringify(room1))

      room1 = io.sockets.adapter.rooms;
      let rooms = Object.keys(room1)
      console.log(rooms);
      let flag = false

      rooms.forEach((room) => {

        if (room == data['agent_id']) {

          flag = true

        }

      })
      if (!flag) {

        await socket.join(data['agent_id']);

      }


      if (data['channel'] == 'whatsapp') {

        session_id = data['session_id']

        if (data["agent_id"] == null || data["agent_id"] == undefined || data["agent_id"].length == 2) {
          let agent_ids = await m_storechat.getAgentId(session_id)
          if (!Array.isArray(agent_ids)) {
            log.error('Error fetching data from database :: ' + agent_ids)
            return
          }

          data['agent_id'] = agent_ids[0].agent_ids
          console.log(agent_ids)
        }
        io.to(data['agent_id'].toString()).emit("closesessionfromadmin", data);
        let chatbotWhatsappDetails = await m_storechat.getWhatsappDetails(data["bot_id"])

        // if (!Array.isArray(chatbotWhatsappDetails)) {
        //   log.error("Error fetching chatbot details from database :: " + JSON.stringify(chatbotWhatsappDetails))
        //   return
        // }

        log.info("Whatsapp bot details :: " + JSON.stringify(chatbotWhatsappDetails))


        console.log("inside channel whatsapp", chatbotWhatsappDetails["provider"]);


        data["message"] = "(---Agent closed your session---)";


        if (chatbotWhatsappDetails["provider"] == "cm.com") {
          send_message = send_cmmessage(chatbotWhatsappDetails, data);
        } else if (chatbotWhatsappDetails["provider"] == "wati") {
          send_message = send_watimessage(chatbotWhatsappDetails, data);
        } else if (chatbotWhatsappDetails["provider"] == "360dialog") {
          send_message = send_360message(chatbotWhatsappDetails, data);
        } else if (chatbotWhatsappDetails["provider"] == "netcore") {
          send_message = send_netcoremessage(chatbotWhatsappDetails, data);
        }
        let time = timeStamp()
        let result = await m_storechat.closeSession(session_id, time)

        log.info("In close session from admin whatsapp : closing session : " + session_id + " : result : " + JSON.stringify(result) + " : for user : " + JSON.stringify(data))


        let update_assigned_chats = await m_storechat.updateAgentChats(data['agent_id'], data['bot_id'], "delete")

        log.info("Updating assigned chats status for agentid :: " + data['agent_id'] + " : for session :: " + session_id + " : result :: " + update_assigned_chats)

      }
      else if (data["channel"] == "instagram") {
        await instagram_send_message(data["device_print"], "Agent left the chat");

        // await reply(data['device_print'],data['message'],)
      }
      // else if (data["channel"] == "messenger") {
      //   await messenger_send_message(data["device_print"], "Agent left the chat");

      //   // await reply(data['device_print'],data['message'],)
      // }
      else {

        session_id = decrypt(data['session_id'])

        let agent_ids = await m_storechat.getAgentId(data['session_id'])


        if (!Array.isArray(agent_ids)) {
          log.error("Error fetching agent  from database in close session from admin :: " + JSON.stringify(agent_ids))
          return
        }

        agent_ids = agent_ids[0]
        io.to(data['session_id']).emit("closesessionfromadmin", data);

        console.log(agent_ids)

        io.to(data['agent_id'].toString()).emit("closesessionfromadmin", data);

        let time = timeStamp()
        let result = m_storechat.closeSession(session_id, time)

        log.info("In close session from admin : closing session : " + session_id + " : result : " + JSON.stringify(result) + " : for user : " + JSON.stringify(data))


        let update_assigned_chats = await m_storechat.updateAgentChats(data['agent_id'], data['bot_id'], "delete")

        log.info("Updating assigned chats status for agentid :: " + data['agent_id'] + " : for session :: " + session_id + " : result :: " + update_assigned_chats)


      }

      await redis_client.del(session_id)
    });





    socket.on("requestfeedback", async function (data) {
      log.info("In requestfeedback :: " + JSON.stringify(data))

      if (data['channel'] == 'whatsapp') {

        let whatsapp_details = await m_storechat.getWhatsappDetails(data['bot_id'])
        console.log(whatsapp_details)
        let options = {
          'method': 'POST',
          'url': 'https://waba.360dialog.io/v1/messages',
          'headers': {
            'D360-API-KEY': '' + whatsapp_details.product_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "recipient_type": "individual",
            "to": "" + data.device_print,
            "type": "interactive",
            "interactive": {
              "type": "list",
              "body": {
                "text": "Please rate this conversation"
              },
              "action": {
                "button": "view",
                "sections": [
                  {
                    "rows": [
                      {
                        "id": "livechat_Great_5",
                        "title": "⭐⭐⭐⭐⭐"
                      },
                      {
                        "id": "livechat_Good_4",
                        "title": "⭐⭐⭐⭐"
                      },
                      {
                        "id": "livechat_Okay_3",
                        "title": "⭐⭐⭐"
                      },
                      {
                        "id": "livechat_Bad_2",
                        "title": "⭐⭐"
                      },
                      {
                        "id": "livechat_Terrible_1",
                        "title": "⭐"
                      }
                    ]
                  }
                ]
              }
            }
          })

        };
        let resp = await doRequest(options)
        console.log(resp)


      }
      if (data["channel"] == "instagram") {
        let question_text = "How would you rate our company?";
        options = ["Terrible", "Bad", "Okay", "Good", "Great"];

        await instagram_send_message(
          data["device_print"],
          question_text,
          options
        );
      } else if (data["channel"] == "messenger") {
        let question_text = "How would you rate our company?";
        options = ["Terrible", "Bad", "Okay", "Good", "Great"];

        await messenger_send_message(
          data["device_print"],
          question_text,
          options
        );
      }

      io.to(data["session_id"]).emit("requestfeedback", data);


    });

    socket.on("submitfeedbackmessage", function (data) {
      console.log("submitting feedback");
      log.info("In submitfeedbackmessage :: " + JSON.stringify(data))

      session_id = decrypt(data["session_id"]);
      if (data["channel"] == "whatsapp") {

        Promise.resolve(m_storechat.getAgentId(session_id)).then(function (
          result
        ) {
          agent_ids = result[0]["agent_ids"].toString().split(",");
          data["session_id"] = session_id;

          console.log(agent_ids[0], session_id);
          data["agent_id"] = agent_ids[0];
          console.log(data);
          io.to(data["agent_id"]).emit("submitfeedback", data);
          return;
        });

      }
      io.to(data["agent_id"]).emit("submitfeedbackmessage", data);
      Promise.resolve(
        m_storechat.saveFeedbackMessage(session_id, data["message"])
      ).then(function (result) { });
    });

    socket.on("userseenmessage", function (data) {
      console.log("user seen event");
      log.info("In user seen message :: " + JSON.stringify(data))

      session_id = decrypt(data["session_id"]);
      if (data["channel"] == "whatsapp") {
        data["session_id"] = session_id;
      }
      io.to(data["agent_id"]).emit("userseenmessage", data);
      Promise.resolve(m_storechat.userSeenMessage(session_id)).then(function (
        result
      ) { });
    });

    socket.on("agentseenmessage", function (data) {
      log.info("In agent seen message :: " + JSON.stringify(data))
      console.log("user seen event");
      if (data["session_id"].length > 10) {
        session_id = decrypt(data["session_id"]);
      } else {
        session_id = data["session_id"];
      }
      // if (data['channel'] == 'whatsapp') {
      //   data['session_id'] = session_id
      // }
      io.to(data["session_id"]).emit("agentseenmessage", data);
      // io.sockets.emit('agentseenmessage',data)
      Promise.resolve(m_storechat.agentSeenMessage(session_id)).then(function (
        result
      ) { });
    });






    socket.on("markresolved", async function (data) {
      console.log("marking resolved");

      log.info('In marked resolved  :: ' + JSON.stringify(data))



      if (data["session_id"].length > 10) {
        session_id = decrypt(data["session_id"]);
      } else if (data["session_id"].length < 10) {
        session_id = data["session_id"];
      } else {
        session_id = decrypt(data["session_id"]);
      }

      io.to(data["session_id"]).emit("markresolved", data);

      Promise.resolve(m_storechat.markResolved(session_id)).then(async function (
        result
      ) {
        await redis_client.del(session_id)

        log.info('In marked resolved  :: ' + 'saving the session : ' + data['session-id'] + 'as resolved : user data : ' + JSON.stringify(data))


      });
      Promise.resolve(m_storechat.getAgentId(session_id)).then(function (
        result
      ) {
        console.log("mark resolved ----->", result);
        agent_ids = result[0]["agent_ids"]
          ? result[0]["agent_ids"].toString().split(",")
          : [];
        console.log("mark resolved agents ", agent_ids);
        agent_ids.forEach((agent_id) => {

          io.to(agent_id).emit("markresolved", data);


        });
        agent_ids.forEach((agent_id) => {
          Promise.resolve(
            m_storechat.updateAgentChats(agent_id, data["bot_id"], "delete")
          ).then(function (result) {
            log.info("In mark as resolved : updating agent chats for : " + agent_id + " : result : " + JSON.stringify(result) + " : for user : " + JSON.stringify(data))

          });
        });
        let time = timeStamp()
        Promise.resolve(m_storechat.closeSession(session_id, time)).then(function (
          result
        ) {

          // log.info("In mark as resolved : updating agent chats for : " + agent_id + " : result : " + JSON.stringify(result) + " : for user : " + JSON.stringify(data))

        });
      });

      if (data["channel"] == "instagram") {
        await instagram_send_message(
          data["device_print"],
          "Agent closed the chat"
        );
      }

      if (data["channel"] == "whatsapp") {
        console.log(data)
        Promise.resolve(m_storechat.getWhatsappDetails(data["bot_id"])).then(
          function (result) {
            console.log("inside channel whatsapp", result);

            data["message"] = "(---Agent resolved your session---)";
            if (result["provider"] == "cm.com") {
              send_message = send_cmmessage(result, data);
            } else if (result["provider"] == "wati") {
              send_message = send_watimessage(result, data);
            } else if (result["provider"] == "360dialog") {
              send_message = send_360message(result, data);
            } else if (result["provider"] == "netcore") {
              send_message = send_netcoremessage(result, data);
            }
          }
        );
      }


    });

    socket.on("submitfeedback", function (data) {
      console.log("submitfeedback data", data);
      log.info('In submitfeedback :: ' + JSON.stringify(data))
      if (data["channel"] == "whatsapp") {
        let session_id = decrypt(data["session_id"]);

        Promise.resolve(m_storechat.getAgentId(session_id)).then(function (
          result
        ) {
          agent_ids = result[0]["agent_ids"].toString().split(",");
          data["session_id"] = session_id;

          console.log(agent_ids[0], session_id);
          data["agent_id"] = agent_ids[0];
          console.log(data);
          io.to(data["agent_id"]).emit("submitfeedback", data);
          return;
        });
      }
      if (data["channel"] == "instagram" || data["channel"] == "messenger") {
        let session_id = decrypt(data["session_id"]);

        Promise.resolve(m_storechat.getAgentId(session_id)).then(function (
          result
        ) {
          agent_ids = result[0]["agent_ids"].toString().split(",");
          data["session_id"] = session_id;

          console.log(agent_ids[0], session_id);
          data["agent_id"] = agent_ids[0];
          console.log(data);
          io.to(data["agent_id"]).emit("submitfeedback", data);
          return;
        });
      }
      if (data["session_id"].length > 10) {
        session_id = decrypt(data["session_id"]);
      } else if (data["session_id"].length < 10) {
        session_id = data["session_id"];
      } else {
        session_id = decrypt(data["session_id"]);
      }
      io.to(data["agent_id"]).emit("submitfeedback", data);
      Promise.resolve(
        m_storechat.saveFeedback(session_id, data["rating"])
      ).then(function (result) { });
    });

    socket.on("setstatus", function (data) {
      log.info('In setstatus :: ' + JSON.stringify(data))

      io.sockets.emit("setstatus", data);
      if (data["assigned_sessions"]) {
        let assigned_sessions = data["assigned_sessions"].split(",");
        assigned_sessions.forEach((assigned_session) => {
          io.to(assigned_session).emit("setstatus", data);
        });
      }
      // else{
      //     io.sockets.emit('setstatus', data);
      // }
      Promise.resolve(
        m_storechat.saveAgentStatus(data["agent_id"], data["status"])
      ).then(function (result) { });
    });

    socket.on("banip", function (data) {
      io.to(data["session_id"]).emit("banip", data);
    });

    socket.on("unbanip", function (data) {
      io.to(data["session_id"]).emit("unbanip", data);
    });

    socket.on("resetusermessages", function (data) {
      io.sockets.emit("resetusermessages", data);
    });

    socket.on("start-video-call", function (data) {
      var obj = data;
      obj.id = socket.id;
      io.sockets.emit("start-video-call", obj);
    });

    socket.on("answer-video-call", function (data) {
      io.sockets.emit("answer-video-call", data);
    });

    socket.on("make-answer", function (data) {
      io.sockets.emit("make-answer", data);
    });


  });




}




















app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});


app.get("/getToken", function (req, res) {
  var token = new AccessToken(twilioAccountSid, twilioApiKey, twilioApiSecret);
  log.info("get_available_agents:: 451" + JSON.stringify(token));
  token.identity = req.query.identity;
  const videoGrant = new VideoGrant({
    room: req.query.room,
  });
  token.addGrant(videoGrant);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ token_twilio: token.toJwt() });
});

app.get("/status", (req, res) => {
  res.sendStatus(200);
});

app.post("/simvolyWebhook", async (req, res) => {
  try {
    console.log("Post webhook call");
    console.log(req.query);
    res.sendStatus(200);
  } catch (err) {
    console.log(err, "errrrrr");
  }
});



async function sendWhatsappNotification(number, data, bot_name) {

  number = ""+number.split('-').join('').split('+').join('')

  let options = {
    method: "POST",
    url: "https://www.smatbot.com:8006/sendSingleTemplateMessage",
    body: {
      message: "Testing template",
      template_name: "livechat",
      chatbot_id: "5354",
      number:  number,
      header_params: [],
      body_params: [bot_name],
      button_params: [],
      language: "en",
    },
    json:true
  }
  console.log(options)
  let resp = await doRequest(options)
  console.log(resp)
  log.info("Send template notification request :: " + JSON.stringify(options) + " :: response " + JSON.stringify(resp))
}

function send_360message(result, data) {
  console.log("inside 360 msg");
  console.log(data)
  var access_token = result["product_token"];
  var cm_number = result["cm_number"];
  let message
  if (data['agent_name'] != null) {

    message = `*${data["agent_name"]}*\n${data["message"]}`;

  }
  else {

    message = data["message"]

  }

  const headers = {
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": access_token,
    },
  };
  const body = {
    to: data["device_print"] || data["user_number"],
    type: "text",
    text: {
      body: message,
    },
  };
  axios
    .post("https://waba.360dialog.io/v1/messages", body, headers)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log("Body: ", res.data);
    })
    .catch((err) => {
      console.log(err);
    });
}

function send_watimessage(result, data) {
  console.log("inside wati message");
  var access_token = result["product_token"];
  var cm_number = result["cm_number"];
  const headers = {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + access_token,
    },
  };
  console.log("provider ", result["provider"]);
  console.log("endpoint ", result["endpoint"]);
  const body = {
    to: data["device_print"] || data["user_number"],
    type: "text",
    text: {
      body: data["message"],
    },
  };
  console.log("body in wati", body);
  axios
    .post(result["endpoint"] + "/v1/messages", body, headers)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log("Body: ", res.data);
    })
    .catch((err) => {
      console.log(err);
    });
}

function send_netcoremessage(result, data) {
  console.log("inside netcore message");
  const headers = {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + result["product_token"],
    },
  };
  const body = {
    message: [
      {
        recipient_whatsapp: data["user_number"],
        recipient_type: "individual",
        message_type: "text",
        type_text: [{ content: data["message"] }],
      },
    ],
  };
  axios
    .post(result["endpoint"], body, headers)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log("Body: ", res.data);
    })
    .catch((err) => {
      console.error(err);
    });
}

function send_cmmessage(result, data) {
  var access_token = result["product_token"];
  var cm_number = result["cm_number"];
  console.log("access_token ", access_token);
  console.log("cm_number ", cm_number);
  console.log("user_number ", data["user_number"]);
  console.log("message ", data["message"]);
  const body = {
    messages: {
      authentication: {
        productToken: access_token,
      },
      msg: [
        {
          body: {
            type: "auto",
            content: "Fallback text for SMS",
          },
          to: [
            {
              number: data["device_print"],
            },
          ],
          from: cm_number,
          allowedChannels: ["WhatsApp"],
          richContent: {
            conversation: [
              {
                text: data["message"],
              },
            ],
          },
        },
      ],
    },
  };
  axios
    .post("https://gw.cmtelecom.com/v1.0/message", body)
    .then((res) => {
      console.log(`Status: ${res.status}`);
      console.log("Body: ", res.data);
    })
    .catch((err) => {
      console.error(err);
    });
}

function sendWhitelabelMail(agents_list) {
  var tomail = [];
  for (var i = 0; i < agents_list.length; i++) {
    tomail.push(agents_list[i]["email"]);
  }
  let transport = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    auth: {
      user: "hrcare@taleed.com.sa",
      pass: "T@leed4321",
    },
  });
  const message = {
    from: "hrcare@taleed.com.sa", // Sender address
    to: tomail, // List of recipients
    subject: "You have a user waiting for you in Live Chat!!!", // Subject line
    html: '<div style="float:left;width:100%">Dear HR<br><br>A user is waiting for you to connect with him on Chatbot. Please <a href="https://www.app.smatbot.com/bot?tab=live_chat&bot_id=5625&profile_id=4239" target="_blank">click here</a> to join the live chat.<br><br>Thank you</div>', // Plain text body
  };
  transport.sendMail(message, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log(info);
    }
  });
}

function sendGridEmailSending(agents_list, bot_name, value, subject) {
  var tomail = [];
  for (var i = 0; i < agents_list.length; i++) {
    var object = {};
    object.email_address = {};
    object.email_address.address = agents_list[i]["email"];
    object.email_address.name = "";
    tomail.push(object);
  }
  console.log("to emails");
  console.log(tomail);
  let default_value =
    '<div style="width: 70%;margin-right: auto;margin-left: auto;float: none"><div style="float: left;margin-left: auto;margin-right: auto;width:100%;margin:0;font-family:trebuchet MS;border:1px solid lightgray"><div style="float: left;width:100%"><div style="width:100%;background:white;float:left;border-bottom: 1px solid lightgray"><div style="float:left;width:100%"><h2 style="float: left;min-width:98%;text-align: center;margin-left: 1%;margin-top:10px;margin-bottom:10px;margin-left:10px" class="logo"><img src="https://s3.ap-south-1.amazonaws.com/custpostimages/sb_images/SB_logo_horizontal_text.png" height="60" alt=""></h2></div></div><div style="float: left;width:100%;background:#1094d126;font-size:16px"><div style="width:90%;margin-left:5%;margin-right:5%;display:block;float:left;padding:10px;margin-top: 25px;margin-bottom: 25px;box-sizing: border-box"><label style="float:left;width:100%">Dear Customer,</label><label style="margin-top:15px;float:left;width:100%">A user is waiting for you to connect with them on ' +
    bot_name +
    ' SmatBot.</label><label style="margin-top:15px;float:left;width:100%">Please check immediately.</label><label style="margin-top:25px;float:left;width:100%">Thank you,<br>SmatBot Team</label></div></div></div></div></div>';
  let default_subject =
    "You have a user waiting for you in " + bot_name + " Live Chat!!!";
  var options = {
    method: "POST",
    url: "https://api.zeptomail.com/v1.1/email",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization:
        "Zoho-enczapikey wSsVR61z8xb1Xf9+yjWoIug5zFwDVQ/2Q0wo2lvw7HGpSK3Cocdtw0bNV1L2GPgbRzVpFjoR8bouzB5T0TNf3d57yFBSASiF9mqRe1U4J3x17qnvhDzJXmhZlRaLKIoKwwxrn2JgFMgr+g==", // process.env.ENV
    },
    body: {
      bounce_address: "bounce@bounce.smatbot.com",
      from: {
        address: "info@smatbot.com",
        name: "SmatBot",
      },
      to: tomail,
      subject: default_subject,
      htmlbody: default_value,
    },
    json: true,
  };
  // if (value) {
  //   console.log("inside if")
  //   console.log(value)
  //   options.body.content[0].value = value
  // };
  // if (subject) options.body.subject = subject;
  return new Promise(function (resolve, reject) {
    request(options, function (error, response, body) {
      if (error) {
        console.log(
          "sendgrid email sending failed for response:" + JSON.stringify(error)
        );
        resolve(true);
      } else {
        console.log("sendgrid email sent to response:" + JSON.stringify(body));
        resolve(true);
      }
    });
  });
}

function sendGridEmailSendingOld(agents_list, bot_name) {
  var tomail = [];
  for (var i = 0; i < agents_list.length; i++) {
    tomail.push({ email: agents_list[i]["email"] });
  }
  console.log("to emails");
  console.log(tomail);
  var options = {
    method: "POST",
    url: "https://api.sendgrid.com/v3/mail/send",
    headers: {
      "cache-control": "no-cache",
      "Content-Type": "application/json",
      authorization:
        "Bearer SG.CvzTCxcrTCCCIHRQWQvIVg.-vwJ38rXDDX9xzX-LyyNogZKNmIL-WyLWJCIsrMsi4Y", // process.env.ENV
    },

    body: {
      personalizations: [{ to: tomail }],
      from: { email: "info@smatbot.com" },
      subject:
        "You have a user waiting for you in " + bot_name + " Live Chat!!!",
      content: [
        {
          type: "text/html",
          value:
            '<div style="width: 70%;margin-right: auto;margin-left: auto;float: none"><div style="float: left;margin-left: auto;margin-right: auto;width:100%;margin:0;font-family:trebuchet MS;border:1px solid lightgray"><div style="float: left;width:100%"><div style="width:100%;background:white;float:left;border-bottom: 1px solid lightgray"><div style="float:left;width:100%"><h2 style="float: left;min-width:98%;text-align: center;margin-left: 1%;margin-top:10px;margin-bottom:10px;margin-left:10px" class="logo"><img src="https://s3.ap-south-1.amazonaws.com/custpostimages/sb_images/SB_logo_horizontal_text.png" height="60" alt=""></h2></div></div><div style="float: left;width:100%;background:#1094d126;font-size:16px"><div style="width:90%;margin-left:5%;margin-right:5%;display:block;float:left;padding:10px;margin-top: 25px;margin-bottom: 25px;box-sizing: border-box"><label style="float:left;width:100%">Dear Customer,</label><label style="margin-top:15px;float:left;width:100%">A user is waiting for you to connect with them on ' +
            bot_name +
            ' SmatBot.</label><label style="margin-top:15px;float:left;width:100%">Please check immediately.</label><label style="margin-top:25px;float:left;width:100%">Thank you,<br>SmatBot Team</label></div></div></div></div></div>',
        },
      ],
    },
    json: true,
  };
  return new Promise(function (resolve, reject) {
    request(options, function (error, response, body) {
      if (error) {
        console.log(
          "sendgrid email sending failed for response:" + JSON.stringify(error)
        );
        resolve(true);
      } else {
        console.log("sendgrid email sent to response:" + JSON.stringify(body));
        resolve(true);
      }
    });
  });
}

async function instagram_send_message(sender_id, message, options) {
  Promise.resolve(m_storechat.getInstagramAccessToken(sender_id)).then(
    async function (result) {
      instagram_access_token = result[0].page_access_token;

      console.log(sender_id, message, instagram_access_token);
      if (options) {
        await instagram_utils.reactions(
          sender_id,
          message,
          options,
          instagram_access_token,
          true
        );
        return;
      }
      await instagram_utils.reply(sender_id, message, instagram_access_token);
    }
  );
  return;
}

async function messenger_send_message(sender_id, message, options) {
  Promise.resolve(m_storechat.getMessengerAccessToken(sender_id)).then(
    async function (result) {
      messenger_access_token = result[0].page_access_token;

      if (options) {
        console.log(sender_id, message, messenger_access_token);

        await messenger_utils.reactions(
          sender_id,
          message,
          options,
          messenger_access_token,
          true
        );
        return;
      }
      await messenger_utils.reply(sender_id, message, messenger_access_token);
    }
  );
  return;
}



io.on("close", function (socket) {
  setInterval(function () {
    if (!if_connected) {
      startConnect();
    }
  }, 1000);
});

startConnect();

http.listen(8000, function () {
  console.log("listening on *:8007");
});
