var knex = require('./connector');


module.exports = {
    getCsvUnverifiedReport: function (today, yesterday) { 
        today = today+' 09:00:00';
        yesterday = yesterday+' 09:00:00';
        query = "SELECT dqr.question_text AS LrNo, dqr.created_at AS Pod_Uploaded_date_time, 'NO' AS Is_verified, cs.device_print AS Reported_by, ca.answer_text AS POD_image_link FROM `dynamic_question_response` dqr INNER JOIN chatbot_sessions cs ON cs.id = dqr.session_id INNER JOIN chatbot_answers ca ON ca.session_id = cs.id WHERE dqr.question_id = '329007' AND dqr.question_text LIKE '%LR no. *%' AND ca.answer_text LIKE 'https%' AND dqr.created_at BETWEEN ? AND ?  GROUP BY cs.device_print ORDER BY dqr.created_at DESC ";
        //query = "SELECT dqr.question_text,cs.device_print, ca.answer_text, dqr.session_id FROM `dynamic_question_response` dqr INNER JOIN chatbot_sessions cs ON cs.id = dqr.session_id INNER JOIN chatbot_answers ca ON ca.session_id = cs.id WHERE dqr.question_id=? GROUP BY cs.device_print ORDER BY dqr.created_at DESC";
        console.log(query)
        return new Promise(function(resolve, reject) {
            knex.raw(query, [yesterday, today]).then(function(result) {
                resolve(result[0]);
            });
        });       
            
    },
    getCsvBotFailedReport: function (today, yesterday) { 
        //q_id = 69719;
        today = today+' 09:00:00';
        yesterday = yesterday+' 09:00:00';
        console.log(today, "Today date")
        console.log(yesterday, "yesterday date")
        query = "SELECT cs.device_print AS Reported_by, dqr.created_at AS Pod_date_time, dqr.question_text AS Reason_of_Rejection, ca.answer_text AS POD_image_link FROM `dynamic_question_response` dqr INNER JOIN chatbot_sessions cs ON cs.id = dqr.session_id INNER JOIN chatbot_answers ca ON ca.session_id = cs.id WHERE dqr.question_id IN(227265,329007) AND dqr.question_text LIKE '%upload is failed%' AND ca.answer_text LIKE 'https%' AND dqr.created_at BETWEEN ? AND ? GROUP BY cs.device_print ORDER BY dqr.created_at DESC ";
     
        console.log(query)
        return new Promise(function(resolve, reject) {
            knex.raw(query, [yesterday, today]).then(function(result) {
                resolve(result[0]);
            });
        });           
    },
    getCsvBotSuccessReport: function (today, yesterday) { 
        //q_id = 69719;
        today = today+' 09:00:00';
        yesterday = yesterday+' 09:00:00';
        console.log(today, "Today date")
        console.log(yesterday, "yesterday date")
        query = "SELECT dqr.question_text AS LrNo, dqr.created_at AS Pod_date_time, 'YES' AS Is_verified, cs.device_print AS Reported_by FROM `dynamic_question_response` dqr INNER JOIN chatbot_sessions cs ON cs.id = dqr.session_id INNER JOIN chatbot_answers ca ON ca.session_id = cs.id WHERE dqr.question_id = '227265' AND dqr.question_text LIKE '%upload is failed%' AND ca.answer_text LIKE 'https%' AND dqr.created_at BETWEEN ? AND ? GROUP BY cs.device_print ORDER BY dqr.created_at DESC ";
     
        console.log(query)
        return new Promise(function(resolve, reject) {
            knex.raw(query, [yesterday, today]).then(function(result) {
                resolve(result[0]);
            });
        });           
    },
}