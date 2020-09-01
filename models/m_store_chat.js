var knex = require('./connector');

module.exports = {
	storeChat: function(session_id,customer_id,text,type,agent_name=""){
		if(session_id){
			query = "INSERT INTO chats (session_id,customer_id,text,type,agent_name) VALUES (?,?,?,?,?)";
			return new Promise(function (resolve, reject){
				knex.raw(query, [session_id,"205",text,type,agent_name]).then(function (result){
					resolve(result);
				});
			});
		}
	},

	getCustomerId: function(bot_id){
		query ="SELECT c.id AS customer_id FROM chatbots cb INNER JOIN customer_profiles cp ON cp.id=cb.customer_profile_id INNER JOIN customers c ON c.id=cp.customer_id WHERE cb.id=?";
		return new Promise(function (resolve, reject){
			knex.raw(query, [bot_id]).then(function (result){
				resolve(result[0]);
			});
		});
	},
	checkSession: function(session_id){
		query = "SELECT * FROM live_chat_sessions WHERE session_id=?";
		return new Promise(function (resolve, reject){
			knex.raw(query, [session_id]).then(function (result){
				resolve(result);
			});
		});
	},
	getWhatsappDetails: function(bot_id){
		query = "SELECT product_token AS product_token,cm_number AS cm_number FROM whatsapp_bots WHERE chatbot_id=?";
		return knex.select('product_token','cm_number').from('whatsapp_bots').where('chatbot_id',bot_id).then(data => data[0])
		// return knex.raw(query,[bot_id]).then(function (resp){
		// 	// console.log(resp[0])
		// 	resp[0]
		// })
	},
	setSession: function(bot_id,session_id,ip_address="",user_location="",user_url=""){
		query = "INSERT INTO live_chat_sessions (chatbot_id,session_id,ip_address,user_location,user_url) VALUES (?,?,?,?,?)";
		console.log("inserting session");
		return new Promise(function (resolve, reject){
			knex.raw(query, [bot_id,session_id,ip_address,user_location,user_url]).then(function (result){
				resolve(result);
			});
		});
	},
	setAgentname: function(bot_id,session_id,name,agent_id){
		query = "UPDATE live_chat_sessions SET agent_name=?,agent_ids=? WHERE chatbot_id=? AND session_id=?";
		console.log("updating agent name");
		return new Promise(function (resolve, reject){
			knex.raw(query, [name,agent_id,bot_id,session_id]).then(function (result){
				resolve(result);
			});
		});
	},
	updateCounter: function(session_id){
		query = "UPDATE live_chat_sessions SET unread_messages_count=unread_messages_count+1 WHERE session_id=?";
		console.log("updating counter query ",query)
		return new Promise(function (resolve, reject){
			knex.raw(query, [session_id]).then(function (result){
				resolve(result);
			});
		});
	},
	updateAgentname: function(session_id,agent_id){
		query = "UPDATE live_chat_sessions SET agent_ids=concat(agent_ids,?) WHERE session_id=?";
		agent_id = ","+agent_id
		console.log("updating assigned agent_id");
		return new Promise(function (resolve, reject){
			knex.raw(query, [agent_id,session_id]).then(function (result){
				resolve(result);
			});
		});
	},
	saveFeedback: function(session_id,rating){
		query = "UPDATE live_chat_sessions SET session_feedback=? WHERE session_id=?";
		console.log("updating session feedback");
		return new Promise(function (resolve, reject){
			knex.raw(query, [rating,session_id]).then(function (result){
				resolve(result);
			});
		});
	},
	closeSession: function(session_id){
		query = "UPDATE live_chat_sessions SET is_closed='1' WHERE session_id=?";
		return new Promise(function (resolve, reject){
			knex.raw(query, [session_id]).then(function (result){
				resolve(result);
			});
		});
	}
}