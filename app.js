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
// {
//   area: {
//     min: xxx,
//     max: xxx
//   },
//   price: {
//     min: xxx,
//     max: xxx
//   },
//   date: {
//     fromDate
//   }
// }
app.get('/posts', async (req, res) => {
  const {
    minArea,
    maxArea,
    minPrice,
    maxPrice,
    city,
    district,
    fromDate,
    toDate,
    lat,
    lng,
    distance
  } = req.query
  const posts = await knex
    .select(
      'post.*',
      'post_schedule.from_date as fromDate',
      'post_schedule.to_date as toDate'
    )
    .from('post')
    .leftJoin('post_schedule', 'post.post_id', 'post_schedule.post_id')
    .modify((queryBuilder) => {
      if (minArea) queryBuilder.where('area', '>=', minArea)
      if (minPrice) queryBuilder.where('price', '>=', minPrice)
      if (maxPrice) queryBuilder.where('price', '<=', maxPrice)
      if (maxArea) queryBuilder.where('area', '<=', maxArea)
      if (city) queryBuilder.where('city', city)
      if (district) queryBuilder.where('district', district)
      if (maxArea) queryBuilder.where('area', '<=', maxArea)
      if (fromDate)
        queryBuilder.whereRaw(`post.post_id not in (
          select post_id from post_schedule 
            where (from_date between ? and ? )
            or (to_date between ? and ?)
            or ((? between from_date and to_date) and (? between from_date and to_date)))`, [fromDate, toDate, fromDate, toDate, fromDate, toDate])
      if (lat && lng && distance) {
        queryBuilder
          .select(
            knex.raw(
              `6371 * ACOS(COS(RADIANS(?))
                * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?))+ SIN(RADIANS(?))
                * SIN(RADIANS(lat))) as distance`,
              [lat, lng, lat]
            )
          )
          .having('distance', '<=', distance)
          .orderBy('distance', 'asc')
      }
    })
    .groupBy('post.post_id')
  res.send(posts.map((x) => camelize(x)))
})

// get by id
app.get('/posts/:id', async (req, res) => {
  const id = req.params.id
  let post = await knex
    .select('post.*')
    .from('post')
    .where('post.post_id', parseInt(id))
    .first()
  const urlImages = await knex
    .select('url_image')
    .from('image')
    .where('image.post_id', parseInt(id))
  const today = new Date().toISOString().split('T')[0]
  const schedule = await knex
    .select('from_date as fromDate', 'to_date as toDate')
    .from('post_schedule')
    .where('post_id', parseInt(id))
    .andWhere('to_date', '>=', today)
  const [{ totalReview }] = await knex('post_schedule')
    .count('schedule_id as totalReview')
    .whereNotNull('rating')
    .andWhere('post_id', parseInt(id))
  const [{ totalScore }] = await knex('post_schedule')
    .sum({ totalScore: 'rating' })
    .where('post_id', parseInt(id))
  const avgScore = totalScore / totalReview
  post.urlImages = urlImages.map((x) => x.url_image)
  post.schedule = schedule
  post.totalReview = totalReview
  post.avgScore = avgScore
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

//get list post by id: xem danh sach tin dang
app.get('/list/:userId', async (req, res) => {
  const userId = req.params.userId
  let posts = await knex
    .select('post.*')
    .from('post')
    .where('post.post_by', parseInt(userId))
  res.send(posts)
})

//get schedule by userid: xem lich su thue
app.get('/schedule/:userId', async (req, res) => {
  const userId = req.params.userId
  let schedules = await knex
    .select('post_schedule.*')
    .from('post_schedule')
    .where('post_schedule.user_id', parseInt(userId))
  res.send(schedules)
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
  res.send(post)
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
  res.send({ userId })
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
  res.send(userInfo)
})
// booking
app.post('/posts/:id/booking', async (req, res) => {
  const postId = req.params.id
  const { fromDate, toDate, userId } = req.body
  await knex('post_schedule').insert([
    {
      post_id: postId,
      from_date: fromDate,
      to_date: toDate,
      user_id: userId,
    },
  ])
  res.send({ postId })
})

//rating
app.post('/posts/:scheduleId/rating', async (req, res) => {
  const scheduleId = req.params.scheduleId
  const { score } = req.body
  await knex('post_schedule')
    .where('schedule_id', scheduleId)
    .update('rating', score)
  res.sendStatus({ scheduleId })
})

const port = process.env.PORT || 5000
const host = process.env.HOST || 'localhost'

app.listen(port, function () {
  console.log(`Example app listening on port http://${host}:${port}`)
})
