const express = require('express')
const app = express()
const knex = require('./database')
const cors = require('cors')
const bodyParser = require('body-parser')
const multer = require('multer')
const admin = require('./storage')
const config = require('./config')

const uploads = multer({
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
}).any()

app.use(cors())
app.use(function (req, res, next) {
  uploads(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        statusCode: 400,
        error: err.message,
      })
    } else {
      next()
    }
  })
})

app.use(
  bodyParser.json({ limit: '50mb' }),
  bodyParser.urlencoded({ limit: '50mb' }),
  bodyParser.text()
)
// get list
app.get('/posts', async (req, res) => {
  const posts = await knex.select('*').from('post').where('status', 1)
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
  console.log(67, req.body);
  const files = req.files
  const filesUploaded = []
  const filesUrl = []
  const bucket = admin.storage().bucket(config.firestore.bucketName)

  if (files) {
    const numFiles = files.length
    for (let i = 0; i < numFiles; i++) {
      const currentFile = files[i]
      const fileName = `images/${currentFile.originalname}`
      filesUploaded.push(bucket.file(fileName).save(currentFile.buffer))
      filesUrl.push(
        `https://storage.googleapis.com/${config.firestore.bucketName}/${fileName}`
      )
    }
  }

  const newPost = req.body
  const [post] = await knex('post').insert([
    {
      title: newPost.title,
      area: newPost.area,
      address: newPost.address,
      bathroom: newPost.bathroom,
      city: newPost.city,
      district: newPost.district,
      lat: newPost.lat,
      lng: newPost.lng,
      description: newPost.description,
      price: newPost.price,
      bedroom: newPost.bedroom,
      // air_condition: newPost.utilities.air_condition ? 1 : 0,
      // wc: newPost.utilities.wc ? 1 : 0,
      // garage: newPost.utilities.garage ? 1 : 0,
      // electric_water_heater: newPost.utilities.electric_water_heater ? 1 : 0,
      status: 0,
    },
  ])
  res.sendStatus(200)
})
// register
app.post('/register', async (req, res) => {
  const user = req.body
  const [userId] = await knex('user').insert([
    {
      ...user,
      role: 1,
    },
  ])
  res.send(userId)
})

const port = process.env.PORT || 5000
const host = process.env.HOST || 'localhost'

app.listen(port, function () {
  console.log(`Example app listening on port http://${host}:${port}`)
})
