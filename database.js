const setupPaginator = require('knex-paginator')
const config = require('./config')

const connection = {
  user: 'root',
  password: '',
  database: 'guest_home',
  charset: 'utf8',
  typeCast: function (field, next) {
    if (field.type === 'JSON') {
      return JSON.parse(field.string())
    }
    return next()
  },
}

if (config.mode === 'development') {
  connection.host = 'localhost'
  connection.port = '3307'
} else {
  connection.password = config.mysql.password
  connection.socketPath = config.mysql.socketpath
}
const knex = require('knex')({
  client: 'mysql',
  connection,
})
setupPaginator(knex)

module.exports = knex
