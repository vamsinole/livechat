var mysql      = require('mysql');
var knex = require('knex')({
    client: 'mysql',
    connection: {
        host     : 'rdsmumbai.cqn51gees35x.ap-south-1.rds.amazonaws.com',
        user     : 'Livechat_user',
        password : 'L1vech@t#32',
        database : 'smatbot_main',
        charset : 'utf8mb4'
    }
});

module.exports = knex;
