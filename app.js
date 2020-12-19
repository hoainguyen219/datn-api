const express = require('express')
const app = express()
const knex = require('./database')
const cors = require('cors')
const bodyParser = require('body-parser')
const multer = require('multer')
const admin = require('./storage')
const config = require('./config')

const { camelize } = require('./util')

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
  const {
    minArea,
    maxArea,
    city,
    district,
    minPrice,
    maxPrice,
    fromDate,
    toDate,
  } = req.query
  const posts = await knex
    .select(
      'post.*',
      'post_schedule.from_date as fromDate',
      'post_schedule.to_date as toDate'
    )
    .from('post')
    .join('post_schedule', 'post.post_id', 'post_schedule.post_id')
    .modify((queryBuilder) => {
      if (minArea) queryBuilder.where('area', '>=', minArea)
      if (minPrice) queryBuilder.where('price', '>=', minPrice)
      if (maxPrice) queryBuilder.where('price', '<=', maxPrice)
      if (maxArea) queryBuilder.where('area', '<=', maxArea)
      if (city) queryBuilder.where('city', city)
      if (district) queryBuilder.where('district', district)
      if (maxArea) queryBuilder.where('area', '<=', maxArea)
      if (fromDate)
        queryBuilder.where('post_schedule.from_date', '>=', fromDate)
      if (toDate) queryBuilder.where('post_schedule.to_date', '<=', toDate)
    })
  res.send(posts.map(x => camelize(x)))
})

// get by id
app.get('/posts/:id', async (req, res) => {
  const id = req.params.id
  const post = await knex.select('*').from('post').where('post_id', id).first()
  res.send(camelize(post))
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
  const files = req.files
  const filesUploaded = []
  const filesUrls = []
  const bucket = admin.storage().bucket()

  if (files) {
    const numFiles = files.length
    for (let i = 0; i < numFiles; i++) {
      const currentFile = files[i]
      const time = new Date().getTime()
      const fileName = `images/${time}-${currentFile.originalname}`
      filesUploaded.push(bucket.file(fileName).save(currentFile.buffer))
      filesUrls.push(
        `https://storage.cloud.google.com/datn-a7520.appspot.com/${fileName}`
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
      air_condition: newPost.utilities.air_condition ? 1 : 0,
      wc: newPost.utilities.wc ? 1 : 0,
      garage: newPost.utilities.garage ? 1 : 0,
      electric_water_heater: newPost.utilities.electric_water_heater ? 1 : 0,
      status: 0,
    },
  ])
  await knex('image').insert(
    filesUrls.map((item) => {
      return { url_image: item, post_id: post }
    })
  )
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
// login
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const userInfo = await knex
    .select('*')
    .from('user')
    .where('account', username)
    .andWhere('password', password)
    .first()
  return userInfo
})
// book
app.post('/posts/:id/book', async (req,res) => {
  const postId = req.params.id
  const { fromDate, toDate, userId } = req.body
  await knex('post_schedule').insert([
    {
      post_id: postId,
      from_date: fromDate,
      to_date: toDate,
      user_id: userId
    }
  ])
  res.sendStatus(200)
})

const port = process.env.PORT || 5000
const host = process.env.HOST || 'localhost'

app.listen(port, function () {
  console.log(`Example app listening on port http://${host}:${port}`)
})
