const express = require('express')
const app = express()
const knex = require('./database')
const cors = require('cors')
const bodyParser = require('body-parser')

app.use(cors())

app.use(
  bodyParser.urlencoded({ extended: true }),
  bodyParser.json(),
  bodyParser.text()
)
// get list
app.get('/posts', async (req, res) => {
  const posts = await knex.select('*').from('post')
  res.send(posts)
})

// get by id
app.get('/posts/:id', async (req, res) => {
  const id = req.params.id
  const post = await knex.select('*').from('post').where('post_id', id).first()
  res.send(post)
})

// get all cities
app.get('/cities', async (req, res) => {
  const cities = await knex.select('*').from('city')
  res.send(cities)
})

// get all districts
app.get('/cities/:cityId', async (req, res) => {
  const cityId = req.params.cityId
  const districts = await knex
    .select('*')
    .from('district')
    .where('code', cityId)
  res.send(districts)
})

// post
app.post('/posts', async (req, res) => {
  const newPost = req.body
  const post = await knex('post').insert([
    {
      ...newPost,
    },
  ])
  res.send(post)
})

const port = process.env.PORT || 5000
const host = process.env.HOST || 'localhost'

app.listen(port, function () {
  console.log('Example app listening on port 3000!')
})
