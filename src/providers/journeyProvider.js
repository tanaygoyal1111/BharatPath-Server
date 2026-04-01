const logger = require('../utils/logger');
const masterMap = require('../data/master_map.json');

class JourneyProvider {
  /**
   * Fetch live journey data for a PNR.
   * In production, this calls the real train tracking API.
   * Falls back to rich mock data when no API key is configured.
   */
  async fetchJourneyData(pnr) {
    logger.info(`Fetching journey data for PNR: ${pnr}`);

    // In production: call real API here
    // For now: return structured mock data matching frontend contract
    return this._getMockJourneyData(pnr);
  }

  _getMockJourneyData(pnr) {
    const now = new Date();
    const departureTime = new Date(now);
    departureTime.setHours(departureTime.getHours() - 4);

    const arrivalTime = new Date(now);
    arrivalTime.setHours(arrivalTime.getHours() + 8);

    // Simulate progress along NDLS → SDAH route
    const routeStations = ['NDLS', 'ALJ', 'TDL', 'CNB', 'PRYJ', 'DDU', 'PNBE', 'KIUL', 'JHAJ', 'ASN', 'SDAH'];
    const currentStationIndex = 3; // Currently near CNB (Kanpur)
    const nextStationIndex = 4;    // Heading to PRYJ

    const currentStationCode = routeStations[currentStationIndex];
    const nextStationCode = routeStations[nextStationIndex];

    const currentStation = masterMap[currentStationCode] || {};
    const nextStation = masterMap[nextStationCode] || {};
    const destination = masterMap['SDAH'] || {};

    // Calculate simulated ETA to next station
    const etaToNext = new Date(now);
    etaToNext.setMinutes(etaToNext.getMinutes() + 147); // ~2.5 hours to PRYJ

    return {
      pnr: pnr,
      trainNumber: '12259',
      trainName: 'SEALDAH DURONTO',
      status: 'RUNNING',
      currentSpeed: 84, // km/h
      delayInMinutes: 15,
      platform: '3',
      journeyDate: now.toISOString().split('T')[0],
      departureTime: departureTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      currentStation: {
        code: currentStationCode,
        name: currentStation.name || 'UNKNOWN',
        lat: currentStation.lat || null,
        lng: currentStation.lng || null
      },
      nextStation: {
        code: nextStationCode,
        name: nextStation.name || 'UNKNOWN',
        lat: nextStation.lat || null,
        lng: nextStation.lng || null,
        distanceKm: 194,
        eta: etaToNext.toISOString()
      },
      destination: {
        code: 'SDAH',
        name: destination.name || 'SEALDAH',
        lat: destination.lat || null,
        lng: destination.lng || null
      },
      distanceToDestination: 1089, // km remaining
      routeStations: routeStations.map((code, i) => {
        const station = masterMap[code] || {};
        let stationStatus = 'FUTURE';
        if (i < currentStationIndex) stationStatus = 'PASSED';
        else if (i === currentStationIndex) stationStatus = 'CURRENT';
        else if (i === nextStationIndex) stationStatus = 'NEXT';
        else if (i === routeStations.length - 1) stationStatus = 'DESTINATION';

        return {
          code,
          name: station.name || code,
          lat: station.lat || null,
          lng: station.lng || null,
          status: stationStatus
        };
      })
    };
  }
}

module.exports = new JourneyProvider();
