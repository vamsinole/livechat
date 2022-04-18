var knex = require("./connector");
const fs = require("fs");

module.exports = {
  storeChat: function (session_id, customer_id, text, type, agent_name = "") {
    if (session_id) {
      query =
        "INSERT INTO chats (session_id,customer_id,text,type,agent_name) VALUES (?,?,?,?,?)";
      return new Promise(function (resolve, reject) {
        knex
          .raw(query, [session_id, customer_id, text, type, agent_name])
          .then(function (result) {
            resolve(result);
          });
      });
    }
  },

  updateAgentAssignedChats: function (bot_id) {
    query =
      "UPDATE agents_to_bots as atb,(SELECT agent_ids, COUNT(*) as assignedCount FROM `live_chat_sessions` WHERE chatbot_id = ? AND agent_ids IS NOT NULL AND `is_closed` = '0' GROUP BY agent_ids ORDER BY created_at  DESC ) as lcs SET atb.assigned_chats = (CASE WHEN atb.agent_id = lcs.agent_ids THEN lcs.assignedCount ELSE 0 END) WHERE atb.chatbot_id = ?";
    console.log(query, "UPDATE query");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [bot_id, bot_id]).then(function (result) {
        resolve(result);
      });
    });
  },

  getAgent: function (bot_id, department_id) {
    console.log("department_id checking", department_id);
    console.log("bot_id checking", bot_id);
    if (department_id) {
      query =
        "SELECT atb.agent_id,c.agent_status,c.email,c.phone_number,SUM(assigned_chats) as assigned_chats,c.chats_limit,c.full_name from agents_to_bots atb INNER JOIN customers c ON c.id=atb.agent_id WHERE agent_id in (SELECT ab.agent_id FROM agents_to_bots ab INNER JOIN customers cr ON cr.id=ab.agent_id WHERE cr.agent_status='online' AND chatbot_id=? AND cr.department_id=?) GROUP BY agent_id ORDER BY assigned_chats LIMIT 1";
      return new Promise(function (resolve, reject) {
        knex.raw(query, [bot_id, department_id]).then(function (result) {
          resolve(result);
        });
      });
    } else {
      query =
        "SELECT atb.agent_id,c.agent_status,c.full_name,c.email,c.phone_number,SUM(assigned_chats) as assigned_chats,c.chats_limit,c.full_name from agents_to_bots atb INNER JOIN customers c ON c.id=atb.agent_id WHERE agent_id in (SELECT ab.agent_id FROM agents_to_bots ab INNER JOIN customers cr ON cr.id=ab.agent_id WHERE cr.agent_status='online' AND chatbot_id=?) GROUP BY agent_id ORDER BY assigned_chats LIMIT 1";
      return new Promise(function (resolve, reject) {
        knex.raw(query, [bot_id]).then(function (result) {
          resolve(result);
        });
      });
    }
    // query = "SELECT atb.agent_id,c.agent_status,c.email,c.phone_number,SUM(assigned_chats) as assigned_chats,c.chats_limit from agents_to_bots atb INNER JOIN customers c ON c.id=atb.agent_id WHERE agent_id in (SELECT ab.agent_id FROM agents_to_bots ab INNER JOIN customers cr ON cr.id=ab.agent_id WHERE cr.agent_status='online' AND chatbot_id=?) GROUP BY agent_id ORDER BY assigned_chats LIMIT 1"
    // query = "SELECT ab.agent_id,cr.agent_status,cr.email,cr.phone_number FROM agents_to_bots ab INNER JOIN customers cr ON cr.id=ab.agent_id WHERE cr.agent_status='online' AND chatbot_id=? AND (ab.assigned_chats < cr.chats_limit) ORDER BY ab.assigned_chats ASC LIMIT 1";
  },
  getCustomerId: function (bot_id) {
    query =
      "SELECT c.id AS customer_id FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [bot_id]).then(function (result) {
        resolve(result[0]);
      });
    });
  },
  getAgentId: function (session_id) {
    console.log("session id ------>", session_id);
    query = "SELECT agent_ids FROM live_chat_sessions WHERE session_id=?";
    console.log(query);
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        console.log(result);
        resolve(result[0]);
      });
    });
  },
  storeDeviceToken: function (device_token, agent_id) {
    console.log("Device Token ------>", device_token);
    var first_check_query = "SELECT * from agent_app_details where agent_id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(first_check_query, [agent_id]).then(function (result) {
        result[0] = result[0] || {};
        console.log(result[0]);
        if (result[0] && result[0].length > 0) {
          console.log("already exists ->", result[0]);
          if (result[0][0].fcm_device_token == device_token) {
            console.log("same thing so leaving it as it is");
          } else {
            if (device_token && device_token.length > 0) {
              query =
                "UPDATE agent_app_details SET fcm_device_token=? where agent_id=?";
              return new Promise(function (resolve, reject) {
                knex
                  .raw(query, [device_token, agent_id])
                  .then(function (result) {
                    resolve(result[0]);
                  });
              });
            }
          }
        } else {
          query =
            "INSERT INTO agent_app_details (agent_id,fcm_device_token) VALUES (?,?)";
          return new Promise(function (resolve, reject) {
            knex.raw(query, [agent_id, device_token]).then(function (result) {
              resolve(result[0]);
            });
          });
        }
      });
    });
  },
  getDeviceTokens: function (agent_id) {
    console.log("Agent Id ------>", agent_id);
    query = "SELECT fcm_device_token from agent_app_details where agent_id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [agent_id]).then(function (result) {
        resolve(result[0]);
      });
    });
  },
  checkSession: function (session_id) {
    query = "SELECT * FROM live_chat_sessions WHERE session_id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  checkIsClosed: function (session_id) {
    query =
      "SELECT * FROM live_chat_sessions WHERE is_closed='1' AND session_id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  getWhatsappDetails: function (bot_id) {
    query =
      "SELECT product_token,provider,endpoint AS product_token,cm_number AS cm_number FROM whatsapp_bots WHERE chatbot_id=?";
    return knex
      .select("product_token", "cm_number", "provider", "endpoint")
      .from("whatsapp_bots")
      .where("chatbot_id", bot_id)
      .then((data) => data[0]);
    // return knex.raw(query,[bot_id]).then(function (resp){
    // 	// console.log(resp[0])
    // 	resp[0]
    // })
  },
  setSession: function (
    bot_id,
    session_id,
    ip_address = "",
    user_location = "",
    user_url = "",
    notes = "",
    agent_id
  ) {
    query =
      "INSERT INTO live_chat_sessions (chatbot_id,session_id,ip_address,user_location,user_url,notes,agent_ids) VALUES (?,?,?,?,?,?,?)";
    console.log("inserting session");
    return new Promise(function (resolve, reject) {
      knex
        .raw(query, [
          bot_id,
          session_id,
          ip_address,
          user_location,
          user_url,
          notes,
          agent_id,
        ])
        .then(function (result) {
          resolve(result);
        });
    });
  },
  setAgentname: function (bot_id, session_id, name, agent_id) {
    query =
      "UPDATE live_chat_sessions SET agent_name=?,agent_ids=? WHERE chatbot_id=? AND session_id=?";
    console.log("updating agent name agent_id", agent_id);
    return new Promise(function (resolve, reject) {
      knex
        .raw(query, [name, agent_id, bot_id, session_id])
        .then(function (result) {
          resolve(result);
        });
    });
  },
  saveAgentStatus: function (agent_id, status) {
    query = "UPDATE customers SET agent_status=? WHERE id=?";
    console.log("updating agent status");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [agent_id, status]).then(function (result) {
        resolve(result);
      });
    });
  },
  updateCounter: function (session_id) {
    query =
      "UPDATE live_chat_sessions SET unread_messages_count=unread_messages_count+1 WHERE session_id=?";
    console.log("updating counter query ", query);
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  updateAgentChats: function (agent_id, chatbot_id, action) {
    console.log("update chat---->", agent_id, chatbot_id, action);
    if (action == "add") {
      query =
        "UPDATE agents_to_bots SET assigned_chats=assigned_chats+1 WHERE agent_id=? AND chatbot_id=?";
    } else if (action == "delete") {
      query =
        "UPDATE agents_to_bots SET assigned_chats= CASE WHEN assigned_chats>0 THEN assigned_chats-1 ELSE 0 END WHERE agent_id=? AND chatbot_id=?";
    }
    console.log(query);
    return new Promise(function (resolve, reject) {
      knex.raw(query, [agent_id, chatbot_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  updateAgentname: function (session_id, agent_id) {
    query =
      "UPDATE live_chat_sessions SET agent_ids=concat(agent_ids,?) WHERE session_id=?";
    agent_id = "," + agent_id;
    console.log("updating assigned agent_id updateAgentname", agent_id);
    return new Promise(function (resolve, reject) {
      knex.raw(query, [agent_id, session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  saveFeedback: function (session_id, rating) {
    query =
      "UPDATE live_chat_sessions SET session_feedback=? WHERE session_id=?";
    console.log("updating session feedback");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [rating, session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  saveFeedbackMessage: function (session_id, message) {
    query =
      "UPDATE live_chat_sessions SET feedback_message=? WHERE session_id=?";
    console.log("updating session feedback message");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [message, session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  userSeenMessage: function (session_id) {
    query = "UPDATE chats SET is_seen='1' WHERE type='user' AND session_id=?";
    console.log("user seen message event");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  agentSeenMessage: function (session_id) {
    query =
      "UPDATE chats SET is_seen='1' WHERE type='customer' AND session_id=?";
    console.log("agent seen message event");
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  markResolved: function (session_id) {
    query =
      "UPDATE live_chat_sessions SET is_resolved='1',is_closed='1' WHERE session_id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  getAgentsList: function (bot_id) {
    query =
      "SELECT c.email,c.phone_number FROM customer_roles cr INNER JOIN customers c ON c.id=cr.role_customer_id WHERE admin_customer_id=(SELECT c.id FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?) UNION SELECT c.email,c.phone_number FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [bot_id, bot_id]).then(function (result) {
        resolve(result);
      });
    });
  },
  getCustomerType: function (bot_id) {
    query =
      "SELECT c.id,c.customer_type FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [bot_id]).then(function (result) {
        resolve(result[0]);
      });
    });
  },
  isWhatsappEnabled: function (bot_id) {
    query =
      "SELECT c.live_chat_whatsapp_notification FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?";
    return new Promise(function (resolve, reject) {
      knex.raw(query, [bot_id]).then(function (result) {
        resolve(result[0]);
      });
    });
  },
  closeSession: function (session_id,time) {
    console.log(session_id,time)
    let query = `UPDATE live_chat_sessions SET is_closed='1',chat_closed_at='${time}' WHERE session_id=${session_id};`;
    console.log(query)
    return new Promise(function (resolve, reject) {
      knex.raw(query).then(function (result) {
      
        resolve(result);
      });
    });
  },
  getOpenSessions: async function () {
    query =
      "SELECT session_id ,agent_ids,chatbot_id,created_at from live_chat_sessions where is_closed='0' and is_resolved='0' ORDER BY `created_at` DESC";
    // console.log(query);
    return new Promise(function (resolve, reject) {
      knex.raw(query, []).then(function (result) {
        // console.log(result);
        // amqp_channel.publish(update_exchange, '', Buffer.from(JSON.stringify(data)));
        resolve(result[0]);
      });
    });
  },
  getSessionChats: async function (session_id) {
    query =
      "SELECT type,created_at from chats where session_id=?  ORDER BY `created_at` DESC limit 1 ";
    // console.log(query);
    return new Promise(function (resolve, reject) {
      knex.raw(query, [session_id]).then(function (result) {
        console.log("==============" + session_id)
        // console.log(result);
        // amqp_channel.publish(update_exchange, '', Buffer.from(JSON.stringify(data)));
        resolve(result[0]);
      });
    });
  },
  closeOpenSession: async function (session_id) {
    let timestamp = timeStamp().toString()
    query =
      `UPDATE live_chat_sessions SET is_closed='2',chat_closed_at='${timestamp}' where session_id=${session_id}`;
    console.log(query)

    return new Promise(function (resolve, reject) {
      knex.raw(query, []).then(function (result) {
        console.log("==============>" + session_id)
        console.log(query)
        // console.log(result);
        // amqp_channel.publish(update_exchange, '', Buffer.from(JSON.stringify(data)));
        resolve(result[0]);
      });
    });
  }
};
