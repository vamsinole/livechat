const express = require('express')

const router = new express.Router()
const SocketIO = require("socket.io-client");
const redis_client = require('../../cinepolis/redis');


const m_storechat = require("../models/m_store_chat");

const IO = SocketIO.connect("https://www.smatbot.com:8000", {
    transports: ["websocket"], reconnect: true
});


router.get('/closeSessions', async (req, res) => {

    let d = new Date()
    let currentTime = d.getTime()

    res.send('ok')

    let openSessions = await m_storechat.getOpenSessions()
    if (!Array.isArray(openSessions)) {

        return;

    }

    openSessions.forEach(async (openSession) => {

        console.log(openSession)

        let open_session_last_chat = await redis_client.readCache("" + openSession.session_id, "last_update")
        console.log("==========>in open ses" + open_session_last_chat)
        if (open_session_last_chat) {

            let timeDiff = Math.abs(parseInt(open_session_last_chat) - currentTime)
            console.log(timeDiff)
            if (timeDiff > 300000) {


                if (openSession) {
                    let e = await m_storechat.closeOpenSession(openSession.session_id,)
                    console.log(e)
                    if (openSession.agent_ids) {
                        await m_storechat.updateAgentChats(openSession.agent_ids, openSession.chatbot_id, "delete")
                        let data = await redis_client.getAsync("" + openSession.session_id)
                        data["agent_id"] = openSession.agent_ids
                        data['chatbot_id'] = openSession.chatbot_id
                        if (data['channel'] == 'whatsapp') {


                            data['session_id'] = openSession.session_id
        
                        }

                        // data['session_id'] = await redis_client.readCache("" + openSession.session_id, "session_id") || openSession.session_id
                        // data['channel']= await redis_client.readCache("" + openSession.session_id, "channel")
                        IO.emit('reloadpage', data)

                    }
                    await redis_client.del("" + openSession.session_id)

                }

            } else if (timeDiff > 230000 && timeDiff < 300000) {

                let data = await redis_client.getAsync("" + openSession.session_id)
                data['chatbot_id'] = openSession.chatbot_id
                data['agent_id'] = openSession.agent_ids
                if (data['channel'] == 'whatsapp') {


                    data['session_id'] = openSession.session_id

                }

                console.log("entered else if cate", data)
                IO.emit('chatclosingreminder', data)


            }

        }
        // else {

        //     let chats = await m_storechat.getSessionChats(openSession.session_id)

        //     if (!Array.isArray(chats)) {
        //         return
        //     }
        //     chats = chats[0]
        //     console.log(chats)
        //     if (chats) {
        //         let sessionDate = new Date(chats.created_at)
        //         let sessionTime = sessionDate.getTime()
        //         console.log(sessionTime, currentTime)
        //         let timeDiff = Math.abs(sessionTime - currentTime)
        //         console.log(timeDiff)
        //         if (timeDiff > 300000) {


        //             if (openSession) {
        //                 let e = await m_storechat.closeOpenSession(openSession.session_id,)
        //                 console.log(e)
        //                 if (openSession.agent_ids) {
        //                     await m_storechat.updateAgentChats(openSession.agent_ids, openSession.chatbot_id, "delete")
        //                     let data = {}
        //                     data["agent_id"] = openSession.agent_ids


        //                     IO.emit('reloadpage', data)
        //                 }
        //             }

        //         }
        //     }
        //     else {

        //         let sessionDate = new Date(openSession.created_at)
        //         let sessionTime = sessionDate.getTime()
        //         console.log(sessionTime, currentTime)
        //         let timeDiff = Math.abs(sessionTime - currentTime)
        //         if (openSession.agent_ids) {

        //             if (timeDiff > 300000) {

        //                 let e = await m_storechat.closeOpenSession(openSession.session_id)

        //                 if (openSession.agent_ids) {
        //                     await m_storechat.updateAgentChats(openSession.agent_ids, openSession.chatbot_id, "delete")

        //                     let data = {}
        //                     data["agent_id"] = openSession.agent_ids


        //                     IO.emit('reloadpage', data)

        //                 }
        //             }
        //         }
        //         else {

        //             let e = await m_storechat.closeOpenSession(openSession.session_id)

        //         }

        //     }

        // }

        return
    })




})




module.exports = router
