const request = require('supertest')

const app = require('../../app')
const { mongoConnect, mongoDisconnect } = require('../../services/mongo')

const { loadPlanetsData } = require('../../models/planets.model')

describe('Launches API', () => {
  beforeAll(async () => {
    await mongoConnect()
    await loadPlanetsData()
  })

  afterAll(async () => {
    await mongoDisconnect()
  })

  describe('Test GET /launches', () => {
    test('It should respond with 200 success', async () => {
      await request(app)
        .get('/v1/launches')
        .expect('Content-Type', /json/)
        .expect(200)
    })
  })

  describe('Test POST /launches', () => {
    const launchDataWithoutDate = {
      mission: 'ZTM155',
      rocket: 'ZTM Experimental IS1',
      target: 'Kepler-62 f',
    }

    const completeLaunchData = {
      ...launchDataWithoutDate,
      launchDate: 'January 1, 2030',
    }

    const launchDataWithInvalidDate = {
      ...launchDataWithoutDate,
      launchDate: 'shoot',
    }

    test('It should respond with 201 created', async () => {
      const response = await request(app)
        .post('/v1/launches')
        .send(completeLaunchData)
        .expect('Content-Type', /json/)
        .expect(201)

      const requestDate = new Date(completeLaunchData.launchDate).valueOf()
      const responseDate = new Date(response.body.launchDate).valueOf()
      expect(responseDate).toBe(requestDate)

      expect(response.body).toMatchObject(launchDataWithoutDate)
    })

    test('It should catch missing required properties', async () => {
      const response = await request(app)
        .post('/v1/launches')
        .send(launchDataWithoutDate)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toMatchInlineSnapshot(`
        Object {
          "error": "Missing required launch property",
        }
      `)
    })

    test('It should catch invalid dates', async () => {
      const response = await request(app)
        .post('/v1/launches')
        .send(launchDataWithInvalidDate)
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toMatchInlineSnapshot(`
        Object {
          "error": "Invalid launch date",
        }
      `)
    })
  })
})
