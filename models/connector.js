var mysql      = require('mysql');
var knex = require('knex')({
    client: 'mysql',
    connection: {
        host     : 'database-1.cg2r5ldsrbwr.us-east-1.rds.amazonaws.com',
        user     : 'smatbot',
        password : 'Botdbpass$456',
        database : 'smatbot_main'
    }
});

module.exports = knex;