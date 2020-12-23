const setupPaginator = require('knex-paginator')
const config = require('./config')

const connection = {
  user: 'root',
  password: '',
  // password: 'password',
  database: 'guest_home',
  charset: 'utf8',
  typeCast: function (field, next) {
    if (field.type === 'JSON') {
      return JSON.parse(field.string())
    }
    return next()
  },
}

connection.host = 'localhost'
connection.port = '3307'
// connection.port = '3306'
const knex = require('knex')({
  client: 'mysql',
  connection,
})
setupPaginator(knex)

module.exports = knex
