const axios = require('axios')

const launches = require('./launches.mongo')
const planets = require('./planets.mongo')

const DEFAULT_FLIGHT_NUMBER = 100

const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query'

async function populateLaunches() {
  console.log('Downloading launches...')
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: 'rocket',
          select: {
            name: 1,
          },
        },
        {
          path: 'payloads',
          select: {
            customers: 1,
          },
        },
      ],
    },
  })

  if (response.status !== 200) {
    console.log('Problem downloading launch data')
    throw new Error('Launch data  download failed')
  }

  const launchDocs = response.data.docs

  for (const launchDoc of launchDocs) {
    const payloads = launchDoc.payloads
    const customers = payloads.flatMap((payload) => payload['customers'])

    const launch = {
      flightNumber: launchDoc['flight_number'],
      mission: launchDoc['name'],
      rocket: launchDoc['rocket']['name'],
      launchDate: launchDoc['date_local'],
      success: launchDoc['success'],
      upcoming: launchDoc['upcoming'],
      customers,
    }
    await saveLaunch(launch)
  }
  console.log('Launch data loaded!')
}

async function loadLaunchesData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: 'Falcon 1',
    mission: 'FalconSat',
  })
  if (firstLaunch) {
    console.log('Launch data already loaded!')
    return
  }
  await populateLaunches()
}

async function findLaunch(filter) {
  return await launches.findOne(filter)
}

async function isExistsLaunchWithId(launchId) {
  return await launches.exists({ flightNumber: launchId })
}

async function getLatestFlightNumber() {
  const latestLaunch = await launches.findOne().sort('-flightNumber')
  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER
  }
  return latestLaunch.flightNumber
}

async function getAllLaunches(skip, limit) {
  return await launches
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit)
}

async function saveLaunch(launch) {
  await launches.findOneAndUpdate(
    { flightNumber: launch.flightNumber },
    launch,
    {
      upsert: true,
    }
  )
}

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({ keplerName: launch.target })

  if (!planet) {
    throw new Error('No matching planet found')
  }
  const newFlightNumber = (await getLatestFlightNumber()) + 1
  const newLaunch = Object.assign(launch, {
    upcoming: true,
    success: true,
    customer: ['Zero to Mastery', 'NASA'],
    flightNumber: newFlightNumber,
  })

  await saveLaunch(newLaunch)
}

async function abortLaunchWithId(launchId) {
  const aborted = await launches.updateOne(
    { flightNumber: launchId },
    { upcoming: false, success: false }
  )

  return aborted.ok === 1 && aborted.nModified === 1
}

module.exports = {
  loadLaunchesData,
  getAllLaunches,
  isExistsLaunchWithId,
  abortLaunchWithId,
  scheduleNewLaunch,
}
