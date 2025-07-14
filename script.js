// Changelog:
// 2025-05-13: Fixed HTML form structure, checkbox ID, date-time input
// 2025-05-13: Enhanced Spots error handling, added data validation
// 2025-05-13: Ensured UI visibility for all authenticated users
// 2025-05-13: Fixed % Match rendering with session validation
// 2025-05-13: Aligned with updated HTML, fixed permission errors
// 2025-05-14: Fixed submission handler for custom spots
// 2025-05-14: Added populateForecastSpotSelector
// 2025-05-14: Fixed fetchWeekForecast windSpeed typo
// 2025-05-14: Fixed syntax error (missing } in populateSessionSpotSelector)
// 2025-05-14: Removed 2-second delay in onAuthStateChanged
// 2025-05-14: Added null checks for DOM elements

// Firebase assumed initialized
let isAuthenticated = false;

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.querySelector("#login-btn");
  const logoutBtn = document.querySelector("#logout-btn");
  const authStatus = document.querySelector("#auth-status");
  const logSessionSection = document.querySelector("#log-session-section");
  const sessionHistorySection = document.querySelector("#session-history-section");

  async function fetchWithCount(url, options, type) {
  apiCallCount++;
  console.log(`API Call #${apiCallCount}: ${type} - ${url.split("?")[0]}`);
  return await fetch(url, options);
}
  
  // Global caches
  const sevenDayAveragesCache = new Map();
  const sessionAveragesCache = new Map();
  let apiCallCount = 0;

  // Storm Glass API Key
  const STORMGLASS_API_KEY = "ad075498-b81a-11ee-8b92-0242ac130002-ad075542-b81a-11ee-8b92-0242ac130002";

  // Predefined surf spots
  const surfSpots = [
    { name: "onrus", lat: -34.4132, lng: 19.1718 },
    { name: "stilbaai", lat: -34.3789, lng: 21.4208 },
    { name: "jeffreys bay", lat: -34.0507, lng: 24.9187 },
    { name: "muizenberg", lat: -34.1076, lng: 18.4712 }
  ];

  // Weights
  const WEIGHTS_NON_BEACH_BREAK = {
    swellHeight: 0.175, swellPeriod: 0.175, swellDirection: 0.175,
    windSpeed: 0.125, windDirection: 0.125, tideHeight: 0.175, tideMovement: 0.075
  };
  const WEIGHTS_BEACH_BREAK = {
    sevenDaySwellHeight: 0.2, sevenDaySwellPeriod: 0.2, sevenDaySwellDirection: 0.2,
    sevenDayWindSpeed: 0.1, sevenDayWindDirection: 0.1, sevenDayTideDifference: 0.1,
    season: 0.1
  };

  // Utility functions
  function convertToKnots(metersPerSecond) {
    return metersPerSecond * 1.94384;
  }

  function getSeason(date) {
    const month = date.getMonth();
    if (month >= 8 && month <= 10) return "spring";
    if (month >= 11 || month <= 1) return "summer";
    if (month >= 2 && month <= 4) return "autumn";
    return "winter";
  }

  function getColorForPercentage(percentage) {
    const red = Math.round(255 * (1 - percentage / 100));
    const green = Math.round(255 * (percentage / 100));
    return `rgb(${red}, ${green}, 0)`;
  }

  function calculateSwellHeightSimilarity(forecast, session) {
    const maxHeight = 5;
    const diff = Math.abs(forecast - session);
    return 1 - (diff / maxHeight);
  }

  function calculateSwellPeriodSimilarity(forecast, session) {
    const maxPeriod = 20;
    const diff = Math.abs(forecast - session);
    return 1 - (diff / maxPeriod);
  }

  function calculateDirectionSimilarity(forecast, session) {
    const diff = Math.abs(forecast - session);
    const normalizedDiff = diff > 180 ? 360 - diff : diff;
    return 1 - (normalizedDiff / 180);
  }

  function calculateWindSpeedSimilarity(forecast, session) {
    const maxSpeed = 40;
    const diff = Math.abs(forecast - session);
    return 1 - (diff / maxSpeed);
  }

  function calculateTideHeightSimilarity(forecast, session) {
    const maxHeight = 5;
    const diff = Math.abs(forecast - session);
    return 1 - (diff / maxHeight);
  }

  function calculateTideDifferenceSimilarity(forecast, session) {
    const maxDiff = 2;
    const diff = Math.abs(forecast - session);
    return 1 - (diff / maxDiff);
  }

  function calculateSeasonSimilarity(forecast, session) {
    return forecast === session ? 1 : 0;
  }

  function calculateTideMovementSimilarity(movement1, movement2) {
    if (movement1 === "unknown" || movement2 === "unknown") return 0.5;
    return movement1 === movement2 ? 1 : 0;
  }

async function calculatePercentageMatch(forecastSlot, session, isBeachBreak = false) {
  const similarities = {};

  // Early returns
  if (!session.weather) {
    console.warn(`Session ${session.id} missing weather data`);
    return { currentConditions: { percentage: 0, similarities: {} }, beachBreak: { percentage: 0, similarities: {} } };
  }
  if (!forecastSlot.sevenDaySwellAverages) {
    console.warn(`Forecast slot ${forecastSlot.time} missing 7-day averages`);
    return { currentConditions: { percentage: 0, similarities: {} }, beachBreak: { percentage: 0, similarities: {} } };
  }

  // Current conditions similarities (all sessions)
  similarities.swellHeight = calculateSwellHeightSimilarity(
    forecastSlot.swellHeight !== "N/A" && typeof forecastSlot.swellHeight === "number" ? forecastSlot.swellHeight : 0,
    session.weather.swellHeight !== "N/A" && typeof session.weather.swellHeight === "number" ? session.weather.swellHeight : 0
  );
  similarities.swellPeriod = calculateSwellPeriodSimilarity(
    forecastSlot.swellPeriod !== "N/A" && typeof forecastSlot.swellPeriod === "number" ? forecastSlot.swellPeriod : 0,
    session.weather.swellPeriod !== "N/A" && typeof session.weather.swellPeriod === "number" ? session.weather.swellPeriod : 0
  );
  similarities.swellDirection = calculateDirectionSimilarity(
    forecastSlot.swellDirection !== "N/A" && typeof forecastSlot.swellDirection === "number" ? forecastSlot.swellDirection : 0,
    session.weather.swellDirection !== "N/A" && typeof session.weather.swellDirection === "number" ? session.weather.swellDirection : 0
  );
  similarities.windSpeed = calculateWindSpeedSimilarity(
    forecastSlot.windSpeed !== "N/A" && typeof forecastSlot.windSpeed === "number" ? forecastSlot.windSpeed : 0,
    session.weather.windSpeed !== "N/A" && typeof session.weather.windSpeed === "number" ? session.weather.windSpeed : 0
  );
  similarities.windDirection = calculateDirectionSimilarity(
    forecastSlot.windDirection !== "N/A" && typeof forecastSlot.windDirection === "number" ? forecastSlot.windDirection : 0,
    session.weather.windDirection !== "N/A" && typeof session.weather.windDirection === "number" ? session.weather.windDirection : 0
  );
  similarities.tideHeight = calculateTideHeightSimilarity(
    forecastSlot.tideHeight !== "N/A" && typeof forecastSlot.tideHeight === "number" ? forecastSlot.tideHeight : 0,
    session.weather.tideHeight !== "N/A" && (typeof session.weather.tideHeight === "number" || (typeof session.weather.tideHeight === "string" && !isNaN(parseFloat(session.weather.tideHeight)))) ? parseFloat(session.weather.tideHeight) : 0
  );
  similarities.tideMovement = calculateTideMovementSimilarity(
    forecastSlot.tideMovement || "unknown",
    session.weather.tideMovement || "unknown"
  );

  // Calculate current conditions percentage (all sessions)
  const currentConditionsWeights = WEIGHTS_NON_BEACH_BREAK;
  let currentConditionsSum = 0;
  for (const metric of ["swellHeight", "swellPeriod", "swellDirection", "windSpeed", "windDirection", "tideHeight", "tideMovement"]) {
    if (similarities[metric] !== undefined && !isNaN(similarities[metric])) {
      currentConditionsSum += similarities[metric] * currentConditionsWeights[metric];
    }
  }
  const currentConditionsPercentage = isNaN(currentConditionsSum) ? 0 : currentConditionsSum * 100;

  // Beach break similarities (only for beach break sessions)
  let beachBreakPercentage = 0;
  const beachBreakSimilarities = {};
  if (session.isBeachBreak === true) {
    const sessionKey = session.id || session.dateTime;
    let sessionAverages = sessionAveragesCache.get(sessionKey);
    if (!sessionAverages) {
      const sessionDate = session.dateTime instanceof Date ? session.dateTime : session.dateTime.toDate();
      if (!sessionDate || isNaN(sessionDate.getTime())) {
        console.warn(`Invalid session date for ${sessionKey}, using defaults`);
        sessionAverages = { swellHeight: 0, swellPeriod: 0, swellDirection: 0, windSpeed: 0, windDirection: 0, tideDifference: 0 };
      } else if (session.weather.sevenDaySwellAverages) {
        sessionAverages = session.weather.sevenDaySwellAverages;
      } else {
        console.log(`Fetching 7-day averages for beach break session ${sessionKey}`);
        const cacheKey = `${session.spot.lat}_${session.spot.lng}_${sessionDate.toISOString()}`;
        if (!window.pendingFetches) window.pendingFetches = {};
        if (window.pendingFetches[cacheKey]) {
          console.log(`Reusing pending fetch for ${cacheKey}`);
          sessionAverages = await window.pendingFetches[cacheKey];
        } else {
          const promise = calculateSevenDayAverages(session.spot, new Date(sessionDate.getTime() - 7 * 24 * 60 * 60 * 1000), sessionDate)
            .then(averages => {
              sessionAveragesCache.set(sessionKey, averages);
              delete window.pendingFetches[cacheKey];
              return averages;
            })
            .catch(err => {
              console.error(`Fetch error for ${cacheKey}:`, err);
              delete window.pendingFetches[cacheKey];
              return { swellHeight: 0, swellPeriod: 0, swellDirection: 0, windSpeed: 0, windDirection: 0, tideDifference: 0 };
            });
          window.pendingFetches[cacheKey] = promise;
          sessionAverages = await promise;
        }
      }
      sessionAveragesCache.set(sessionKey, sessionAverages);
    }
    session.weather.sevenDaySwellAverages = sessionAverages;

    if (session.weather.sevenDaySwellAverages) {
      beachBreakSimilarities.sevenDaySwellHeight = calculateSwellHeightSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.swellHeight === "number" ? forecastSlot.sevenDaySwellAverages.swellHeight : 0,
        typeof session.weather.sevenDaySwellAverages.swellHeight === "number" ? session.weather.sevenDaySwellAverages.swellHeight : 0
      );
      beachBreakSimilarities.sevenDaySwellPeriod = calculateSwellPeriodSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.swellPeriod === "number" ? forecastSlot.sevenDaySwellAverages.swellPeriod : 0,
        typeof session.weather.sevenDaySwellAverages.swellPeriod === "number" ? session.weather.sevenDaySwellAverages.swellPeriod : 0
      );
      beachBreakSimilarities.sevenDaySwellDirection = calculateDirectionSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.swellDirection === "number" ? forecastSlot.sevenDaySwellAverages.swellDirection : 0,
        typeof session.weather.sevenDaySwellAverages.swellDirection === "number" ? session.weather.sevenDaySwellAverages.swellDirection : 0
      );
      beachBreakSimilarities.sevenDayWindSpeed = calculateWindSpeedSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.windSpeed === "number" ? forecastSlot.sevenDaySwellAverages.windSpeed : 0,
        typeof session.weather.sevenDaySwellAverages.windSpeed === "number" ? session.weather.sevenDaySwellAverages.windSpeed : 0
      );
      beachBreakSimilarities.sevenDayWindDirection = calculateDirectionSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.windDirection === "number" ? forecastSlot.sevenDaySwellAverages.windDirection : 0,
        typeof session.weather.sevenDaySwellAverages.windDirection === "number" ? session.weather.sevenDaySwellAverages.windDirection : 0
      );
      beachBreakSimilarities.sevenDayTideDifference = calculateTideDifferenceSimilarity(
        typeof forecastSlot.sevenDaySwellAverages.tideDifference === "number" ? forecastSlot.sevenDaySwellAverages.tideDifference : 0,
        typeof session.weather.sevenDaySwellAverages.tideDifference === "number" ? session.weather.sevenDaySwellAverages.tideDifference : 0
      );
      beachBreakSimilarities.season = calculateSeasonSimilarity(
        forecastSlot.season || getSeason(new Date()),
        session.weather.season || getSeason(session.dateTime instanceof Date ? session.dateTime : session.dateTime.toDate())
      );

// Calculate beach break percentage
const beachBreakWeights = WEIGHTS_BEACH_BREAK;
let beachBreakSum = 0;
for (const metric of ["sevenDaySwellHeight", "sevenDaySwellPeriod", "sevenDaySwellDirection", "sevenDayWindSpeed", "sevenDayWindDirection", "sevenDayTideDifference", "season"]) {
  if (beachBreakSimilarities[metric] !== undefined && !isNaN(beachBreakSimilarities[metric])) {
    const contribution = beachBreakSimilarities[metric] * beachBreakWeights[metric];
    console.log(`Beach break metric ${metric} for session ${session.id}: similarity=${beachBreakSimilarities[metric]}, weight=${beachBreakWeights[metric]}, contribution=${contribution}`);
    beachBreakSum += contribution;
  }
}
console.log(`Beach break weighted sum for session ${session.id}: ${beachBreakSum}`);
beachBreakPercentage = isNaN(beachBreakSum) ? 0 : beachBreakSum * 100;
console.log(`Calculated beach break percentage for session ${session.id}: ${beachBreakPercentage}%`, {
  beachBreakSum,
  beachBreakSimilarities,
  beachBreakWeights
});
if (beachBreakPercentage < 10) {
  console.log(`Low beach break percentage warning for session ${session.id}: ${beachBreakPercentage}%`, {
    beachBreakSum,
    beachBreakSimilarities,
    beachBreakWeights
  });
}
    }
  } else {
    console.log(`Skipping 7-day averages for non-beach break session ${session.id}`);
  }
if (isBeachBreak) {
  console.log(`Beach break calc for ${session.id}:`, {
    sessionAverages: session.weather.sevenDaySwellAverages,
    forecastAverages: forecastSlot.sevenDaySwellAverages,
    similarities: similarities,
    seasonSimilarity: calculateSeasonSimilarity(forecastSlot.time, session.dateTime),
    weights: WEIGHTS_BEACH_BREAK
  });
}
  return {
    currentConditions: { percentage: currentConditionsPercentage, similarities },
    beachBreak: { percentage: beachBreakPercentage, similarities: beachBreakSimilarities }
  };
}

  async function calculateSevenDayAverages(spot, startDate, endDate) {
  const startDateUTC = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
  const endDateUTC = new Date(endDate.getTime() - 2 * 60 * 60 * 1000);
  const cacheKey = `${spot.lat}_${spot.lng}_${startDate.toISOString()}_${endDate.toISOString()}`;
  const localStorageKey = `sevenDayAverages_${cacheKey}`;
  const CACHE_DURATION = 24 * 60 * 60 * 1000;

  // Log in-memory cache hit
  if (sevenDayAveragesCache.has(cacheKey)) {
    const cached = sevenDayAveragesCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Cache hit (in-memory) for 7-day averages: ${cacheKey}`);
      return cached.data;
    }
    console.log(`Cache expired (in-memory) for 7-day averages: ${cacheKey}`);
    sevenDayAveragesCache.delete(cacheKey);
  }

  // Log localStorage cache hit
  const cachedData = localStorage.getItem(localStorageKey);
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        console.log(`Cache hit (localStorage) for 7-day averages: ${cacheKey}`);
        sevenDayAveragesCache.set(cacheKey, parsed);
        return parsed.data;
      }
      console.log(`Cache expired (localStorage) for 7-day averages: ${cacheKey}`);
      localStorage.removeItem(localStorageKey);
    } catch (e) {
      console.warn(`Error parsing cached averages for ${cacheKey}:`, e);
      localStorage.removeItem(localStorageKey);
    }
  }

  console.log(`Fetching new 7-day averages: ${cacheKey}`);
  const source = "noaa";
  const params = ["swellHeight", "swellPeriod", "swellDirection", "windSpeed", "windDirection"].join(",");
  const weatherUrl = `https://api.stormglass.io/v2/weather/point?lat=${spot.lat}&lng=${spot.lng}&params=${params}&start=${startDateUTC.toISOString()}&end=${endDateUTC.toISOString()}&source=${source}`;
  let swellHeightSum = 0, swellPeriodSum = 0, swellDirectionSum = 0, windSpeedSum = 0, windDirectionSum = 0, count = 0;

  try {
    const response = await fetchWithCount(weatherUrl, { headers: { Authorization: STORMGLASS_API_KEY } }, 'weather');
    console.log(`API Call: weather - ${weatherUrl}`); // Confirm API call
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    const data = await response.json();
    if (data.hours) {
      for (const hour of data.hours) {
        if (hour.swellHeight?.[source] && hour.swellPeriod?.[source] && hour.swellDirection?.[source] &&
            hour.windSpeed?.[source] && hour.windDirection?.[source]) {
          swellHeightSum += hour.swellHeight[source];
          swellPeriodSum += hour.swellPeriod[source];
          swellDirectionSum += hour.swellDirection[source];
          windSpeedSum += convertToKnots(hour.windSpeed[source]);
          windDirectionSum += hour.windDirection[source];
          count++;
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching weather averages for ${cacheKey}:`, error);
  }

  let averageTideDifference = 0;
  try {
    const tideUrl = `https://api.stormglass.io/v2/tide/extremes/point?lat=${spot.lat}&lng=${spot.lng}&start=${startDateUTC.toISOString()}&end=${endDateUTC.toISOString()}`;
    const response = await fetchWithCount(tideUrl, { headers: { Authorization: STORMGLASS_API_KEY } }, 'tide_extremes');
    console.log(`API Call: tide_extremes - ${tideUrl}`); // Confirm API call
    if (!response.ok) throw new Error(`Tide API error: ${response.status}`);
    const data = await response.json();
    if (data.data) {
      const tideDifferences = [];
      for (let i = 0; i < data.data.length - 1; i++) {
        if (data.data[i].height != null && data.data[i + 1].height != null) {
          tideDifferences.push(Math.abs(data.data[i].height - data.data[i + 1].height));
        }
      }
      if (tideDifferences.length) {
        averageTideDifference = tideDifferences.reduce((sum, diff) => sum + diff, 0) / tideDifferences.length;
      }
    }
  } catch (error) {
    console.error(`Error fetching tide averages for ${cacheKey}:`, error);
  }

  const averages = {
    swellHeight: count > 0 ? swellHeightSum / count : 0,
    swellPeriod: count > 0 ? swellPeriodSum / count : 0,
    swellDirection: count > 0 ? swellDirectionSum / count : 0,
    windSpeed: count > 0 ? windSpeedSum / count : 0,
    windDirection: count > 0 ? windDirectionSum / count : 0,
    tideDifference: averageTideDifference
  };

  const cacheEntry = { timestamp: Date.now(), data: averages };
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(cacheEntry));
    sevenDayAveragesCache.set(cacheKey, cacheEntry);
    console.log(`Cached 7-day averages for ${cacheKey}`);
  } catch (e) {
    console.warn(`Error saving to localStorage for ${cacheKey}:`, e);
  }
  return averages;
}
  async function fetchWeatherDataForSession(spot, sessionDateTime) {
    const sessionDateTimeUTC = new Date(sessionDateTime.getTime() - 2 * 60 * 60 * 1000);
    const startDate = new Date(sessionDateTimeUTC.getTime() - 60 * 60 * 1000);
    const endDate = new Date(sessionDateTimeUTC.getTime() + 60 * 60 * 1000);
    const source = "noaa";
    const params = ["swellHeight", "swellPeriod", "swellDirection", "windSpeed", "windDirection"].join(",");
    const weatherUrl = `https://api.stormglass.io/v2/weather/point?lat=${spot.lat}&lng=${spot.lng}&params=${params}&start=${startDate.toISOString()}&end=${endDate.toISOString()}&source=${source}`;
    let weather = {};

    try {
      const response = await fetch(weatherUrl, { headers: { Authorization: STORMGLASS_API_KEY } });
      if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
      const data = await response.json();
      if (!data.hours?.length) throw new Error("No weather data");
      const hourData = data.hours.reduce((closest, hour) => {
        const diff = Math.abs(new Date(hour.time).getTime() - sessionDateTimeUTC.getTime());
        const closestDiff = closest ? Math.abs(new Date(closest.time).getTime() - sessionDateTimeUTC.getTime()) : Infinity;
        return diff < closestDiff ? hour : closest;
      }, null);
      weather = {
        swellHeight: hourData.swellHeight?.[source] ?? "N/A",
        swellPeriod: hourData.swellPeriod?.[source] ?? "N/A",
        swellDirection: hourData.swellDirection?.[source] ?? "N/A",
        windSpeed: hourData.windSpeed?.[source] ? convertToKnots(hourData.windSpeed[source]) : "N/A",
        windDirection: hourData.windDirection?.[source] ?? "N/A"
      };
    } catch (error) {
      console.error("Error fetching weather:", error);
      weather = { swellHeight: "N/A", swellPeriod: "N/A", swellDirection: "N/A", windSpeed: "N/A", windDirection: "N/A" };
    }

    const tideSeaLevelUrl = `https://api.stormglass.io/v2/tide/sea-level/point?lat=${spot.lat}&lng=${spot.lng}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    const tideExtremesUrl = `https://api.stormglass.io/v2/tide/extremes/point?lat=${spot.lat}&lng=${spot.lng}&start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    let tideHeight = "N/A", tideMovement = "unknown", tideExtremes = [];

    try {
      const response = await fetch(tideSeaLevelUrl, { headers: { Authorization: STORMGLASS_API_KEY } });
      if (response.ok) {
        const data = await response.json();
        if (data.data?.length) {
          const closestTide = data.data.reduce((closest, entry) => {
            const diff = Math.abs(new Date(entry.time).getTime() - sessionDateTimeUTC.getTime());
            const closestDiff = Math.abs(new Date(closest.time).getTime() - sessionDateTimeUTC.getTime());
            return diff < closestDiff ? entry : closest;
          }, data.data[0]);
          tideHeight = parseFloat(closestTide.sg).toFixed(2);
          const sortedData = data.data.sort((a, b) => new Date(a.time) - new Date(b.time));
          if (sortedData.length >= 2) {
            const firstHeight = parseFloat(sortedData[0].sg);
            const lastHeight = parseFloat(sortedData[sortedData.length - 1].sg);
            tideMovement = lastHeight > firstHeight ? "rising" : lastHeight < firstHeight ? "dropping" : "stable";
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tide sea level:", error);
    }

    try {
      const response = await fetch(tideExtremesUrl, { headers: { Authorization: STORMGLASS_API_KEY } });
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          tideExtremes = data.data.map(tide => ({
            time: new Date(new Date(tide.time).getTime() + 2 * 60 * 60 * 1000).toISOString(),
            type: tide.type,
            height: tide.height
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching tide extremes:", error);
    }

    return { ...weather, tideHeight, tideMovement, tideExtremes };
  }

async function fetchWeekForecast(spot, startDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start at midnight today
  if (startDate < today) {
    console.warn("Using midnight today as start date");
    startDate = new Date(today);
  }
  const apiStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // Start 1 day earlier (UTC)
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const source = "noaa";
  const forecastData = {}, tideData = {};
  const tideHeights = new Array(112).fill("N/A");
  const tideMovements = new Array(112).fill("unknown");
  const slots = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 5; hour <= 20; hour++) {
      const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      date.setHours(hour, 0, 0, 0);
      slots.push({
        time: date,
        [`${source}_swellHeight`]: [],
        [`${source}_swellPeriod`]: [],
        [`${source}_swellDirection`]: [],
        [`${source}_windSpeed`]: [],
        [`${source}_windDirection`]: []
      });
    }
  }
  const params = ["swellHeight", "swellPeriod", "swellDirection", "windSpeed", "windDirection"].join(",");
  const weatherUrl = `https://api.stormglass.io/v2/weather/point?lat=${spot.lat}&lng=${spot.lng}&params=${params}&start=${apiStartDate.toISOString()}&end=${endDate.toISOString()}&source=${source}`;
  try {
    //console.log("Fetching weather from:", weatherUrl);
   const response = await fetchWithCount(weatherUrl, { headers: { Authorization: STORMGLASS_API_KEY } }, 'weather');
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    const data = await response.json();
    //console.log("Storm Glass weather response (raw, first 20 hours):", JSON.stringify(data.hours?.slice(0, 20), null, 2));
    //console.log("Storm Glass hours count:", data.hours?.length || 0);
    const filteredHours = data.hours?.filter(hour => {
      const utcTime = new Date(hour.time);
      const sastHour = utcTime.getUTCHours() + 2;
      return sastHour >= 5 && sastHour <= 20;
    }) || [];
       /* console.log("Filtered hours (first 20):", filteredHours.slice(0, 20).map(h => ({
      utcTime: h.time,
      sastHour: new Date(h.time).getUTCHours() + 2,
      swellHeight: h.swellHeight?.[source]
    })));*/
    for (const hour of filteredHours) {
      const utcTime = new Date(hour.time);
      const date = utcTime.toISOString().split("T")[0];
      forecastData[date] = forecastData[date] || [];
      forecastData[date].push({
        time: hour.time,
        swellHeight: hour.swellHeight?.[source] ?? "N/A",
        swellPeriod: hour.swellPeriod?.[source] ?? "N/A",
        swellDirection: hour.swellDirection?.[source] ?? "N/A",
        windSpeed: hour.windSpeed?.[source] ? convertToKnots(hour.windSpeed[source]) : "N/A",
        windDirection: hour.windDirection?.[source] ?? "N/A"
      });
    }
   // console.log("Forecast data keys:", Object.keys(forecastData));
  //  console.log("Forecast data for 2025-05-16:", forecastData["2025-05-16"]?.map(d => ({
   //   utcTime: d.time,
   //   sastHour: new Date(d.time).getUTCHours() + 2,
   //   swellHeight: d.swellHeight
   // })));
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const slotTime = slot.time; // SAST
      const utcSlotTime = slotTime; // Use slotTime directly, as it's already UTC
      const date = utcSlotTime.toISOString().split("T")[0];
      const expectedTime = utcSlotTime.toISOString().split(".")[0] + "+00:00"; // e.g., 2025-05-17T03:00:00+00:00 for 5 AM SAST
      const dayData = forecastData[date] || [];
      const timeWindow = 30 * 60 * 1000; // ±30 minutes
      const matchingHour = dayData.find(data => {
        const dataTime = new Date(data.time).getTime();
        const expectedTimeMs = utcSlotTime.getTime();
        return Math.abs(dataTime - expectedTimeMs) <= timeWindow;
      }) || dayData.find(data => data.time === expectedTime);
      if (matchingHour && matchingHour.swellHeight !== "N/A") {
        slot[`${source}_swellHeight`].push(matchingHour.swellHeight);
        slot[`${source}_swellPeriod`].push(matchingHour.swellPeriod);
        slot[`${source}_swellDirection`].push(matchingHour.swellDirection);
        slot[`${source}_windSpeed`].push(matchingHour.windSpeed);
        slot[`${source}_windDirection`].push(matchingHour.windDirection);
      } else {
        console.warn(`No matching weather data for slot ${slotTime.toISOString()} (UTC: ${expectedTime})`);
        // Interpolate if possible
        const prevHour = dayData
          .filter(d => new Date(d.time).getTime() < utcSlotTime.getTime() && d.swellHeight !== "N/A")
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
        const nextHour = dayData
          .filter(d => new Date(d.time).getTime() > utcSlotTime.getTime() && d.swellHeight !== "N/A")
          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0];
        if (prevHour && nextHour) {
          const prevTime = new Date(prevHour.time).getTime();
          const nextTime = new Date(nextHour.time).getTime();
          const t = (utcSlotTime.getTime() - prevTime) / (nextTime - prevTime);
          const interpolate = (prev, next) => prev + (next - prev) * t;
          slot[`${source}_swellHeight`].push(interpolate(parseFloat(prevHour.swellHeight), parseFloat(nextHour.swellHeight)).toFixed(2));
          slot[`${source}_swellPeriod`].push(interpolate(parseFloat(prevHour.swellPeriod), parseFloat(nextHour.swellPeriod)).toFixed(2));
          slot[`${source}_swellDirection`].push(interpolate(parseFloat(prevHour.swellDirection), parseFloat(nextHour.swellDirection)).toFixed(2));
          slot[`${source}_windSpeed`].push(interpolate(parseFloat(prevHour.windSpeed), parseFloat(nextHour.windSpeed)).toFixed(2));
          slot[`${source}_windDirection`].push(interpolate(parseFloat(prevHour.windDirection), parseFloat(nextHour.windDirection)).toFixed(2));
  //        console.log(`Interpolated weather for ${slotTime.toISOString()}:`, slot);
        } else {
          slot[`${source}_swellHeight`].push("N/A");
          slot[`${source}_swellPeriod`].push("N/A");
          slot[`${source}_swellDirection`].push("N/A");
          slot[`${source}_windSpeed`].push("N/A");
          slot[`${source}_windDirection`].push("N/A");
        }
      }
    }
  } catch (error) {
    console.error("Error fetching weather:", error);
    return { slots: [], processedSlots: [], tideData, tideHeights, tideMovements, startDate };
  }

  const tideExtremesUrl = `https://api.stormglass.io/v2/tide/extremes/point?lat=${spot.lat}&lng=${spot.lng}&start=${apiStartDate.toISOString()}&end=${endDate.toISOString()}`;
  try {
    const response = await fetchWithCount(tideExtremesUrl, { headers: { Authorization: STORMGLASS_API_KEY } }, 'tide_extremes');
    if (!response.ok) throw new Error(`Tide extremes API error: ${response.status}`);
    const data = await response.json();
  //  console.log("Storm Glass tide extremes response (first 10):", data.data?.slice(0, 10));
    for (const tide of data.data || []) {
      const utcTime = new Date(tide.time);
      const date = utcTime.toISOString().split("T")[0];
      tideData[date] = tideData[date] || [];
      tideData[date].push({ time: tide.time, type: tide.type, height: tide.height });
    }
  } catch (error) {
    console.error("Error fetching tide extremes:", error);
  }

  const tideSeaLevelUrl = `https://api.stormglass.io/v2/tide/sea-level/point?lat=${spot.lat}&lng=${spot.lng}&start=${apiStartDate.toISOString()}&end=${endDate.toISOString()}`;
  try {
    const response = await fetchWithCount(tideSeaLevelUrl, { headers: { Authorization: STORMGLASS_API_KEY } }, 'tide_sea_level');
    if (!response.ok) throw new Error(`Tide sea level API error: ${response.status}`);
    const data = await response.json();
   /* console.log("Storm Glass tide sea level response (first 20):", data.data?.slice(0, 20));
    console.log("Storm Glass tide sea level response (May 25):", data.data?.filter(d => d.time.startsWith("2025-05-25")).map(d => ({
  utcTime: d.time,
  sg: d.sg
})));*/
    const filteredData = data.data?.filter(entry => {
      const utcTime = new Date(entry.time);
      const sastHour = utcTime.getUTCHours() + 2;
      return sastHour >= 5 && sastHour <= 20;
    }) || [];
 /*   console.log("filteredData for 2025-05-25:", filteredData.filter(d => d.time.startsWith("2025-05-25")).map(d => ({
  utcTime: d.time,
  sastHour: new Date(d.time).getUTCHours() + 2,
  sg: d.sg
})));
    console.log("Filtered tide data (first 20):", filteredData.slice(0, 20).map(d => ({
    
      utcTime: d.time,
      sastHour: new Date(d.time).getUTCHours() + 2,
      sg: d.sg
    })));  */
// Start of tide sea level processing
let prevTideHeight = null;
for (let i = 0; i < slots.length; i++) {
  const slotTime = slots[i].time; // SAST (e.g., 2025-05-25T17:00:00+02:00)
 // console.log(`Processing slot ${i}: slotTime=${slotTime.toISOString()}, local=${slotTime.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}`);
  const utcSlotTime = new Date(slotTime.getTime()); // SAST to UTC (e.g., 2025-05-25T15:00:00Z)
  const date = utcSlotTime.toISOString().split("T")[0];
  const expectedTime = utcSlotTime.toISOString().split(".")[0] + "+00:00";
  const timeWindow = 15 * 60 * 1000; // ±15 minutes

 // console.log(`Searching for tide entry: utcSlotTime=${utcSlotTime.toISOString()}, expectedTime=${expectedTime}, window=${timeWindow / 60000} min`);

  const tideEntry = filteredData.find(entry => {
    const entryTime = new Date(entry.time).getTime();
    const expectedTimeMs = utcSlotTime.getTime();
    const diff = Math.abs(entryTime - expectedTimeMs);
//    console.log(`Checking entry: ${entry.time}, diff=${diff / 60000} min, within window=${diff <= timeWindow}`);
    return diff <= timeWindow;
  }) || filteredData.find(entry => entry.time === expectedTime);

  // Check if sg is a number (including 0), not just truthy
  if (tideEntry && typeof tideEntry.sg === 'number') {
    tideHeights[i] = parseFloat(tideEntry.sg).toFixed(2);
 //   console.log(`Matched tide entry: ${tideEntry.time}, sg=${tideEntry.sg}, tideHeight=${tideHeights[i]}`);
    if (prevTideHeight !== null && tideHeights[i] !== "N/A") {
      const currentHeight = parseFloat(tideHeights[i]);
      tideMovements[i] = currentHeight > prevTideHeight ? "rising" : currentHeight < prevTideHeight ? "dropping" : "stable";
    } else {
      tideMovements[i] = "unknown";
    }
    prevTideHeight = parseFloat(tideHeights[i]);
  } else {
    console.warn(`No valid tide entry for ${slotTime.toISOString()} (UTC: ${expectedTime}). tideEntry=`, tideEntry, `Closest entries:`, filteredData.map(d => ({ time: d.time, sg: d.sg })));
    const prevTide = filteredData
      .filter(d => new Date(d.time).getTime() < utcSlotTime.getTime() && typeof d.sg === 'number')
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
    const nextTide = filteredData
      .filter(d => new Date(d.time).getTime() > utcSlotTime.getTime() && typeof d.sg === 'number')
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0];
 //   console.log(`Interpolation attempt: prevTide=`, prevTide ? { time: prevTide.time, sg: prevTide.sg } : null, `nextTide=`, nextTide ? { time: nextTide.time, sg: nextTide.sg } : null);
    if (prevTide && typeof prevTide.sg === 'number' && nextTide && typeof nextTide.sg === 'number') {
      const prevTime = new Date(prevTide.time).getTime();
      const nextTime = new Date(nextTide.time).getTime();
      const t = (utcSlotTime.getTime() - prevTime) / (nextTime - prevTime);
      tideHeights[i] = (parseFloat(prevTide.sg) + (parseFloat(nextTide.sg) - parseFloat(prevTide.sg)) * t).toFixed(2);
      if (prevTideHeight !== null && tideHeights[i] !== "N/A") {
        const currentHeight = parseFloat(tideHeights[i]);
        tideMovements[i] = currentHeight > prevTideHeight ? "rising" : currentHeight < prevTideHeight ? "dropping" : "stable";
      } else {
        tideMovements[i] = "unknown";
      }
      prevTideHeight = parseFloat(tideHeights[i]);
 //     console.log(`Interpolated: tideHeight=${tideHeights[i]}, tideMovement=${tideMovements[i]}`);
    } else {
      console.warn(`Cannot interpolate for ${slotTime.toISOString()}: prevTide=${prevTide?.time}, nextTide=${nextTide?.time}`);
      tideHeights[i] = "N/A";
      tideMovements[i] = "unknown";
    }
  }
}
// End of tide sea level processing
  } catch (error) {
    console.error("Error fetching tide sea level:", error);
  }

  const processedSlots = slots.map((slot, i) => ({
    time: slot.time,
    swellHeight: slot[`${source}_swellHeight`][0] !== "N/A" ? parseFloat(slot[`${source}_swellHeight`][0]) : "N/A",
    swellPeriod: slot[`${source}_swellPeriod`][0] !== "N/A" ? parseFloat(slot[`${source}_swellPeriod`][0]) : "N/A",
    swellDirection: slot[`${source}_swellDirection`][0] !== "N/A" ? parseFloat(slot[`${source}_swellDirection`][0]) : "N/A",
    windSpeed: slot[`${source}_windSpeed`][0] !== "N/A" ? parseFloat(slot[`${source}_windSpeed`][0]) : "N/A",
    windDirection: slot[`${source}_windDirection`][0] !== "N/A" ? parseFloat(slot[`${source}_windDirection`][0]) : "N/A",
    tideHeight: tideHeights[i] !== "N/A" ? parseFloat(tideHeights[i]) : "N/A",
    tideMovement: tideMovements[i],
    season: getSeason(slot.time)
  }));
/*  console.log("Processed slots (first 16, May 16):", processedSlots.slice(0, 16).map(s => ({
    time: s.time.toISOString(),
    swellHeight: s.swellHeight,
    swellPeriod: s.swellPeriod,
    swellDirection: s.swellDirection,
    windSpeed: s.windSpeed,
    windDirection: s.windDirection,
    tideHeight: s.tideHeight,
    tideMovement: s.tideMovement
  }))); */
  return { slots, processedSlots, tideData, tideHeights, tideMovements, startDate };
}
 let renderCount = 0;
async function renderForecastTable(spot, startDate) {
  console.log(`Spot details for ${spot.name}:`, { isBeachBreak: spot.isBeachBreak, ...spot });
  console.log(`Rendering forecast table #${++renderCount} for ${spot.name}`);
  const table = document.querySelector("#week-forecast");
  if (!table) {
    console.error("Error: #week-forecast not found");
    return;
  }
  let thead = table.querySelector("thead") || document.createElement("thead");
  let tbody = table.querySelector("tbody") || document.createElement("tbody");
  table.prepend(thead);
  table.appendChild(tbody);
  thead.innerHTML = "";
  tbody.innerHTML = "";

  let processedSlots = [];
  try {
    const { processedSlots: slots } = await fetchWeekForecast(spot, startDate);
    processedSlots = slots;
    const startDateMidnight = new Date(startDate);
    startDateMidnight.setHours(0, 0, 0, 0);
    const sevenDayStart = new Date(startDateMidnight.getTime() - 7 * 24 * 60 * 60 * 1000);
    const averages = await calculateSevenDayAverages(spot, sevenDayStart, startDateMidnight);
    processedSlots.forEach(slot => {
      slot.sevenDaySwellAverages = averages;
    });
    console.log("Processed slots with 7-day averages:", processedSlots);
  } catch (error) {
    console.error("Error fetching forecast data:", error);
    return;
  }

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = "<th>Metric</th>";
  processedSlots.forEach(slot => {
    const th = document.createElement("th");
    th.textContent = `${new Date(slot.time).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })} ${new Date(slot.time).getHours()}:00`;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const user = firebase.auth().currentUser;
  let sessions = [];
  if (user && isAuthenticated) {
    try {
      const sessionsSnapshot = await firebase.firestore()
        .collection("sessions")
        .where("userId", "==", user.uid)
        .where("spot.name", "==", spot.name)
        .get();
      sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching sessions:", error.message);
    }
  }

  sessions = sessions.filter(session => {
    const isValid = session.weather &&
      session.spot &&
      session.weather.swellHeight !== "N/A" && (typeof session.weather.swellHeight === "number" || !isNaN(parseFloat(session.weather.swellHeight))) &&
      session.weather.swellPeriod !== "N/A" && (typeof session.weather.swellPeriod === "number" || !isNaN(parseFloat(session.weather.swellPeriod))) &&
      session.weather.swellDirection !== "N/A" && (typeof session.weather.swellDirection === "number" || !isNaN(parseFloat(session.weather.swellDirection))) &&
      session.weather.windSpeed !== "N/A" && (typeof session.weather.windSpeed === "number" || !isNaN(parseFloat(session.weather.windSpeed))) &&
      session.weather.windDirection !== "N/A" && (typeof session.weather.windDirection === "number" || !isNaN(parseFloat(session.weather.windDirection))) &&
      session.weather.tideHeight !== "N/A" && (typeof session.weather.tideHeight === "number" || (typeof session.weather.tideHeight === "string" && !isNaN(parseFloat(session.weather.tideHeight)))) &&
      typeof session.weather.tideMovement === "string";
    if (!isValid) console.warn("Invalid session filtered:", session);
    return isValid;
  });

  // Log sessions once
  sessions.forEach(session => {
    if (session.weather && session.weather.sevenDaySwellAverages) {
      console.log(`Processing beach break session ${session.id}, has sevenDaySwellAverages: ${!!session.weather.sevenDaySwellAverages}`);
    } else {
      console.log(`Session ${session.id} missing sevenDaySwellAverages, non-beach break: ${session.isBeachBreak !== true}`);
    }
  });

  const beachBreakCount = sessions.filter(s => s.isBeachBreak === true).length;
  const useBeachBreakWeights = beachBreakCount > sessions.length - beachBreakCount;

  const metrics = [
    { name: "Swell Height (m)", key: "swellHeight" },
    { name: "Swell Period (s)", key: "swellPeriod" },
    { name: "Swell Direction (°)", key: "swellDirection" },
    { name: "Wind Speed (knots)", key: "windSpeed" },
    { name: "Wind Direction (°)", key: "windDirection" },
    { name: "Tide Height (m)", key: "tideHeight" },
    { name: "Tide Movement", key: "tideMovement" },
    { name: "Match (%)", key: "match" },
    { name: "Beach Break Match (%)", key: "beachBreakMatch" }
  ];

  const percentageMatches = await Promise.all(processedSlots.map(async (slot, index) => {
    if (!sessions.length) {
      console.log(`No sessions for slot ${slot.time}, defaulting match to 0%`);
      return { session: null, match: { currentConditions: { percentage: 0, similarities: {} }, beachBreak: { percentage: 0, similarities: {} } } };
    }
    try {
      const matches = await Promise.all(sessions.map(async session => {
        const sessionKey = session.id || session.dateTime;
        const matchKey = `${sessionKey}_${slot.time.toISOString()}`;
        if (!window.pendingMatches) window.pendingMatches = {};
        if (window.pendingMatches[matchKey]) {
          console.log(`Reusing pending match for ${matchKey}`);
          return await window.pendingMatches[matchKey];
        }
        const promise = calculatePercentageMatch(slot, session, useBeachBreakWeights)
          .then(match => ({ session, match }))
          .catch(err => {
            console.error(`Error calculating match for ${matchKey}:`, err);
            return { session, match: { currentConditions: { percentage: 0, similarities: {} }, beachBreak: { percentage: 0, similarities: {} } } };
          });
        window.pendingMatches[matchKey] = promise;
        const result = await promise;
        delete window.pendingMatches[matchKey];
        return result;
      }));
      const bestMatch = matches.reduce((best, current) => (
        (current.match.currentConditions.percentage || 0) > (best.match.currentConditions.percentage || 0) ? current : best
      ), matches[0]);
      return bestMatch;
    } catch (error) {
      console.error("Error calculating match for slot:", slot.time, error);
      return { session: null, match: { currentConditions: { percentage: 0, similarities: {} }, beachBreak: { percentage: 0, similarities: {} } } };
    }
  }));

  console.log("Percentage matches sample:", percentageMatches.slice(0, 3).map(m => ({
    sessionId: m.session?.id,
    isBeachBreak: m.session?.isBeachBreak,
    currentConditionsPercentage: m.match.currentConditions.percentage,
    beachBreakPercentage: m.match.beachBreak.percentage
  })));

  for (const metric of metrics) {
    const row = document.createElement("tr");
    const metricCell = document.createElement("td");
    metricCell.textContent = metric.name + (metric.key === "match" && useBeachBreakWeights ? " (with Beach Break)" : "");
    row.appendChild(metricCell);
    for (let i = 0; i < processedSlots.length; i++) {
      const slot = processedSlots[i];
      const cell = document.createElement("td");
      let value = slot[metric.key] !== undefined && slot[metric.key] !== null ? slot[metric.key] : "N/A";
      if (metric.key === "match") {
        const match = percentageMatches[i];
        if (match && typeof match.match?.currentConditions?.percentage === "number" && !isNaN(match.match.currentConditions.percentage)) {
          value = match.match.currentConditions.percentage.toFixed(1);
          cell.style.backgroundColor = getColorForPercentage(match.match.currentConditions.percentage);
        } else {
          value = "N/A";
          cell.style.backgroundColor = "";
          console.warn(`No valid percentage for slot ${slot.time}:`, match);
        }
        if (match && match.session) {
          const session = match.session;
          const date = session.dateTime instanceof firebase.firestore.Timestamp
            ? session.dateTime.toDate().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
            : new Date(session.dateTime).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
          const weather = session.weather || {};
          const tideHeight = typeof weather.tideHeight === "string" ? parseFloat(weather.tideHeight) : weather.tideHeight;
          const tooltip = `Best Match (Current Conditions):\nDate: ${date}\nScore: ${session.score || "N/A"}/10\nSwell Height: ${weather.swellHeight !== "N/A" && typeof weather.swellHeight === "number" ? weather.swellHeight.toFixed(2) : "N/A"} m\nSwell Period: ${weather.swellPeriod !== "N/A" && typeof weather.swellPeriod === "number" ? weather.swellPeriod.toFixed(2) : "N/A"} s\nSwell Direction: ${weather.swellDirection !== "N/A" && typeof weather.swellDirection === "number" ? Math.round(weather.swellDirection) : "N/A"}°\nWind Speed: ${weather.windSpeed !== "N/A" && typeof weather.windSpeed === "number" ? Math.round(weather.windSpeed) : "N/A"} knots\nWind Direction: ${weather.windDirection !== "N/A" && typeof weather.windDirection === "number" ? Math.round(weather.windDirection) : "N/A"}°\nTide Height: ${tideHeight !== "N/A" && typeof tideHeight === "number" && !isNaN(tideHeight) ? tideHeight.toFixed(2) : "N/A"} m\nTide Movement: ${weather.tideMovement || "unknown"}`;
          cell.setAttribute("title", tooltip);
        } else {
          cell.setAttribute("title", "No past sessions");
        }
} else if (metric.key === "beachBreakMatch") {
  const match = percentageMatches[i];
  if (match && match.session?.isBeachBreak === true && typeof match.match?.beachBreak?.percentage === "number" && !isNaN(match.match.beachBreak.percentage)) {
    value = match.match.beachBreak.percentage.toFixed(1);
    cell.style.backgroundColor = getColorForPercentage(match.match.beachBreak.percentage);
  } else {
    value = "N/A";
    cell.style.backgroundColor = "";
    console.log(`No valid beach break percentage for slot ${slot.time}:`, match);
  }
        if (match && match.session) {
          const session = match.session;
          const date = session.dateTime instanceof firebase.firestore.Timestamp
            ? session.dateTime.toDate().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
            : new Date(session.dateTime).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
          const weather = session.weather || {};
          const tideHeight = typeof weather.tideHeight === "string" ? parseFloat(weather.tideHeight) : weather.tideHeight;
          const tooltip = `Best Match (Beach Break):\nDate: ${date}\nScore: ${session.score || "N/A"}/10\nSwell Height: ${weather.swellHeight !== "N/A" && typeof weather.swellHeight === "number" ? weather.swellHeight.toFixed(2) : "N/A"} m\nSwell Period: ${weather.swellPeriod !== "N/A" && typeof weather.swellPeriod === "number" ? weather.swellPeriod.toFixed(2) : "N/A"} s\nSwell Direction: ${weather.swellDirection !== "N/A" && typeof weather.swellDirection === "number" ? Math.round(weather.swellDirection) : "N/A"}°\nWind Speed: ${weather.windSpeed !== "N/A" && typeof weather.windSpeed === "number" ? Math.round(weather.windSpeed) : "N/A"} knots\nWind Direction: ${weather.windDirection !== "N/A" && typeof weather.windDirection === "number" ? Math.round(weather.windDirection) : "N/A"}°\nTide Height: ${tideHeight !== "N/A" && typeof tideHeight === "number" && !isNaN(tideHeight) ? tideHeight.toFixed(2) : "N/A"} m\nTide Movement: ${weather.tideMovement || "unknown"}`;
          cell.setAttribute("title", tooltip);
        } else {
          cell.setAttribute("title", "No past sessions");
        }
      } else if (value !== "N/A" && metric.key !== "tideMovement") {
        if (metric.key === "swellHeight" && typeof value === "number" && !isNaN(value)) value = value.toFixed(1);
        else if (metric.key === "tideHeight" && typeof value === "number" && !isNaN(value)) value = value.toFixed(2);
        else if (metric.key !== "match" && metric.key !== "beachBreakMatch" && typeof value === "number" && !isNaN(value)) value = Math.round(value);
      }
      cell.textContent = value;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
}

  async function renderSessionHistory() {
    const user = firebase.auth().currentUser;
    if (!user || !isAuthenticated) {
      console.warn("User not authenticated");
      return;
    }
    const tbody = document.querySelector("#session-history-table tbody");
    if (!tbody) {
      console.warn("Session history table tbody not found");
      return;
    }
    tbody.innerHTML = "";
    try {
      const sessionsSnapshot = await firebase.firestore()
        .collection("sessions")
        .where("userId", "==", user.uid)
        .orderBy("dateTime", "desc")
        .get();
      if (sessionsSnapshot.empty) {
        console.log("No sessions found for user");
        tbody.innerHTML = '<tr><td colspan="13">No sessions logged</td></tr>';
        return;
      }
   //   console.log("Sessions count:", sessionsSnapshot.size);
   //   console.log("Sessions data:", sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        const sessionId = doc.id;
        const row = document.createElement("tr");
        const weather = session.weather || {};
        row.innerHTML = `
          <td>${session.dateTime.toDate().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</td>
          <td>${session.spot?.name || "Unknown"}</td>
          <td>${session.score || "N/A"}</td>
          <td>${weather.swellHeight !== "N/A" && typeof weather.swellHeight === "number" ? weather.swellHeight.toFixed(2) : "N/A"}</td>
          <td>${weather.swellPeriod !== "N/A" && typeof weather.swellPeriod === "number" ? weather.swellPeriod.toFixed(2) : "N/A"}</td>
          <td>${weather.swellDirection !== "N/A" && typeof weather.swellDirection === "number" ? Math.round(weather.swellDirection) : "N/A"}</td>
          <td>${weather.windSpeed !== "N/A" && typeof weather.windSpeed === "number" ? Math.round(weather.windSpeed) : "N/A"}</td>
          <td>${weather.windDirection !== "N/A" && typeof weather.windDirection === "number" ? Math.round(weather.windDirection) : "N/A"}</td>
          <td>${weather.tideHeight !== "N/A" && (typeof weather.tideHeight === "number" || (typeof weather.tideHeight === "string" && !isNaN(parseFloat(weather.tideHeight)))) ? parseFloat(weather.tideHeight).toFixed(2) : "N/A"}</td>
          <td>${weather.tideMovement || "unknown"}</td>
          <td>${session.isBeachBreak ? "Yes" : "No"}</td>
          <td>${session.comments || "-"}</td>
        `;
        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
          if (confirm("Delete this session?")) {
            try {
              await firebase.firestore().collection("sessions").doc(sessionId).delete();
              alert("Session deleted");
              renderSessionHistory();
            } catch (error) {
              console.error("Error deleting session:", error);
              alert("Error deleting session: " + error.message);
            }
          }
        });
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error("Error rendering session history:", error.message);
      tbody.innerHTML = `<tr><td colspan="13">Error loading sessions: ${error.message}</td></tr>`;
    }
  }

  async function fetchCustomSpots(user) {
    const allSpots = [...surfSpots];
    const predefinedNames = surfSpots.map(s => s.name);
    let retries = 3;
    while (retries > 0) {
      try {
        const spotsSnapshot = await firebase.firestore()
          .collection("Users")
          .doc(user.uid)
          .collection("Spots")
          .get();
  //      console.log("Spots count:", spotsSnapshot.size);
   //     console.log("Spots data:", spotsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        spotsSnapshot.forEach(doc => {
          const spot = doc.data();
          if (
            spot.type === "custom" &&
            spot.name &&
            typeof spot.lat === "number" &&
            typeof spot.lng === "number" &&
            !allSpots.some(s => s.name === spot.name && s.lat === spot.lat && s.lng === spot.lng)
          ) {
            allSpots.push({ name: spot.name, lat: spot.lat, lng: spot.lng });
          } else {
            console.warn(`Invalid spot (ID: ${doc.id}):`, spot);
          }
        });
        return allSpots;
      } catch (error) {
        console.error(`Error fetching custom spots (attempt ${4 - retries}):`, error.message);
        retries--;
        if (retries === 0) console.warn("Failed to fetch custom spots after retries");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.log("Falling back to predefined spots");
    return allSpots;
  }

  async function populateSessionSpotSelector() {
    const select = document.querySelector("#session-spot");
    if (!select) {
      console.warn("Session spot selector not found");
      return;
    }
    select.innerHTML = `
      <option value="">Select a spot</option>
      <option value="onrus">Onrus</option>
      <option value="stilbaai">Stilbaai</option>
      <option value="jeffreys bay">Jeffreys Bay</option>
      <option value="muizenberg">Muizenberg</option>
      <option value="add-new-spot">Add New Spot</option>
    `;

    const user = firebase.auth().currentUser;
    if (user && isAuthenticated) {
      const spots = await fetchCustomSpots(user);
  //    console.log("Populating session spot selector with spots:", spots);
      spots.forEach(spot => {
        if (!surfSpots.some(s => s.name === spot.name)) {
          const option = document.createElement("option");
          option.value = spot.name;
          option.textContent = spot.name + " (Custom)";
          select.insertBefore(option, select.lastElementChild); // Before "Add New Spot"
        }
      });
    }

    // Show/hide custom spot section
    select.addEventListener("change", () => {
      const customSection = document.querySelector("#custom-spot-section");
      const dataSource = document.querySelector("#custom-spot-data-source");
      const predefinedSection = document.querySelector("#custom-spot-predefined-section");
      const coordinatesSection = document.querySelector("#custom-spot-coordinates-section");
      if (select.value === "add-new-spot") {
        customSection.style.display = "block";
        dataSource.value = "manual";
        predefinedSection.style.display = "none";
        coordinatesSection.style.display = "block";
      } else {
        customSection.style.display = "none";
      }
    });

    // Toggle predefined vs. manual coordinates
    const dataSource = document.querySelector("#custom-spot-data-source");
    if (dataSource) {
      dataSource.addEventListener("change", () => {
        const predefinedSection = document.querySelector("#custom-spot-predefined-section");
        const coordinatesSection = document.querySelector("#custom-spot-coordinates-section");
        predefinedSection.style.display = dataSource.value === "predefined" ? "block" : "none";
        coordinatesSection.style.display = dataSource.value === "manual" ? "block" : "none";
      });
    }
  }

  async function populateForecastSpotSelector() {
    const select = document.querySelector("#forecast-spot");
    if (!select) {
      console.warn("Forecast spot selector not found");
      return;
    }
    select.innerHTML = `<option value="">Select a spot</option>`;
    const user = firebase.auth().currentUser;
    let spots = [...surfSpots];
    if (user && isAuthenticated) {
      spots = await fetchCustomSpots(user);
    }
//    console.log("Populating forecast spot selector with spots:", spots);
    spots.forEach(spot => {
      const option = document.createElement("option");
      option.value = JSON.stringify(spot);
      option.textContent = spot.name + (surfSpots.some(s => s.name === spot.name) ? "" : " (Custom)");
      select.appendChild(option);
    });
    select.addEventListener("change", async () => {
      if (select.value) {
        try {
          const spot = JSON.parse(select.value);
          await renderForecastTable(spot, new Date());
        } catch (error) {
          console.error("Error rendering forecast:", error);
          const tbody = document.querySelector("#week-forecast tbody");
          if (tbody) tbody.innerHTML = `<tr><td colspan="113">Error loading forecast: ${error.message}</td></tr>`;
        }
      }
    });
  }

const logSessionForm = document.querySelector("#log-session-form");
if (logSessionForm) {
  logSessionForm.addEventListener("submit", async e => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user || !isAuthenticated) {
      alert("Please sign in to log a session");
      return;
    }

    const sessionSpot = document.querySelector("#session-spot").value;
    const customSpotName = document.querySelector("#custom-spot-name")?.value?.trim();
    const dataSource = document.querySelector("#custom-spot-data-source")?.value;
    const predefinedSpot = document.querySelector("#custom-spot-predefined")?.value;
    const customLat = document.querySelector("#custom-spot-lat")?.value;
    const customLng = document.querySelector("#custom-spot-lng")?.value;
    const dateTime = document.querySelector("#session-date").value;
    const score = document.querySelector("#session-score").value;
    const isBeachBreak = document.querySelector("#session-is-beach-break").checked;
    const comments = document.querySelector("#session-comments").value;

    let spot;
    if (sessionSpot === "add-new-spot") {
      if (!customSpotName || !dataSource) {
        alert("Please enter a custom spot name and select a data source.");
        return;
      }
      const predefinedNames = surfSpots.map(s => s.name);
      if (predefinedNames.includes(customSpotName)) {
        alert(`Spot name "${customSpotName}" is a predefined spot. Please choose a unique name (e.g., "My ${customSpotName}").`);
        return;
      }
      if (dataSource === "predefined") {
        if (!predefinedSpot) {
          alert("Please select a predefined spot for coordinates.");
          return;
        }
        const selectedSpot = surfSpots.find(s => s.name === predefinedSpot);
        if (!selectedSpot) {
          alert("Invalid predefined spot selected.");
          return;
        }
        spot = { name: customSpotName, lat: selectedSpot.lat, lng: selectedSpot.lng };
      } else {
        if (!customLat || !customLng) {
          alert("Please enter latitude and longitude for the custom spot.");
          return;
        }
        const lat = parseFloat(customLat);
        const lng = parseFloat(customLng);
        if (isNaN(lat) || isNaN(lng)) {
          alert("Please enter valid latitude and longitude.");
          return;
        }
        spot = { name: customSpotName, lat, lng };
      }
      try {
        await firebase.firestore()
          .collection("Users")
          .doc(user.uid)
          .collection("Spots")
          .add({ name: customSpotName, lat: spot.lat, lng: spot.lng, type: "custom" });
        console.log("Saved custom spot:", spot);
        await populateSessionSpotSelector();
      } catch (error) {
        console.error("Error saving custom spot:", error);
        alert("Error saving custom spot: " + error.message);
        return;
      }
    } else {
      if (!sessionSpot) {
        alert("Please select a spot.");
        return;
      }
      spot = surfSpots.find(s => s.name === sessionSpot);
      if (!spot) {
        const userSpots = await fetchCustomSpots(user);
        spot = userSpots.find(s => s.name === sessionSpot);
        if (!spot) {
          alert("Invalid spot selected.");
          return;
        }
      }
    }

    if (!dateTime || !score) {
      alert("Please fill in all required fields.");
      return;
    }

    // Fetch weather and tide data
    let weather = {};
    try {
      const sessionDateTime = new Date(dateTime);
      const startDateTime = new Date(sessionDateTime.getTime() - 30 * 60 * 1000); // -30 minutes
      const endDateTime = new Date(sessionDateTime.getTime() + 30 * 60 * 1000); // +30 minutes
      console.log("Fetching weather with:", {
        url: `https://api.stormglass.io/v2/weather/point?lat=${spot.lat}&lng=${spot.lng}&params=swellHeight,swellPeriod,swellDirection,windSpeed,windDirection&start=${startDateTime.toISOString()}&end=${endDateTime.toISOString()}&source=noaa`,
        spot: { lat: spot.lat, lng: spot.lng },
        dateTime: dateTime,
        isoDateTime: sessionDateTime.toISOString()
      });

      // Weather API call
      const weatherResponse = await fetch(
        `https://api.stormglass.io/v2/weather/point?lat=${spot.lat}&lng=${spot.lng}&params=swellHeight,swellPeriod,swellDirection,windSpeed,windDirection&start=${startDateTime.toISOString()}&end=${endDateTime.toISOString()}&source=noaa`,
        { headers: { Authorization: STORMGLASS_API_KEY } }
      );
      console.log("Weather API response:", {
        status: weatherResponse.status,
        statusText: weatherResponse.statusText,
        ok: weatherResponse.ok
      });
      if (!weatherResponse.ok) throw new Error(`Weather API error: ${weatherResponse.status}`);
      const weatherData = await weatherResponse.json();
      console.log("Raw weather API data:", weatherData);

      // Select the hour closest to sessionDateTime
      const closestHour = weatherData.hours.reduce((closest, hour) => {
        const hourTime = new Date(hour.time).getTime();
        const sessionTime = sessionDateTime.getTime();
        const diff = Math.abs(hourTime - sessionTime);
        if (!closest || diff < closest.diff) {
          return { hour, diff };
        }
        return closest;
      }, null)?.hour;
      if (!closestHour) throw new Error("No weather data for the requested time");

      weather = {
        swellHeight: closestHour.swellHeight?.noaa ?? "N/A",
        swellPeriod: closestHour.swellPeriod?.noaa ?? "N/A",
        swellDirection: closestHour.swellDirection?.noaa ?? "N/A",
        windSpeed: closestHour.windSpeed?.noaa ? convertToKnots(closestHour.windSpeed.noaa) : "N/A",
        windDirection: closestHour.windDirection?.noaa ?? "N/A"
      };
      console.log("Weather data for session:", weather);

      // Tide API call
      console.log("Fetching tide with:", {
        url: `https://api.stormglass.io/v2/tide/sea-level/point?lat=${spot.lat}&lng=${spot.lng}&start=${startDateTime.toISOString()}&end=${endDateTime.toISOString()}`,
        spot: { lat: spot.lat, lng: spot.lng },
        dateTime: dateTime
      });
      const tideResponse = await fetch(
        `https://api.stormglass.io/v2/tide/sea-level/point?lat=${spot.lat}&lng=${spot.lng}&start=${startDateTime.toISOString()}&end=${endDateTime.toISOString()}`,
        { headers: { Authorization: STORMGLASS_API_KEY } }
      );
      console.log("Tide API response:", {
        status: tideResponse.status,
        statusText: tideResponse.statusText,
        ok: tideResponse.ok
      });
      if (!tideResponse.ok) throw new Error(`Tide API error: ${tideResponse.status}`);
      const tideData = await tideResponse.json();
      console.log("Raw tide API data:", tideData);

      // Select the tide entry closest to sessionDateTime
      const closestTide = tideData.data?.reduce((closest, entry) => {
        const entryTime = new Date(entry.time).getTime();
        const sessionTime = sessionDateTime.getTime();
        const diff = Math.abs(entryTime - sessionTime);
        if (!closest || diff < closest.diff) {
          return { entry, diff };
        }
        return closest;
      }, null)?.entry;
      if (closestTide && typeof closestTide.sg === "number") {
        weather.tideHeight = parseFloat(closestTide.sg).toFixed(2);
        const prevTide = tideData.data.find(d => new Date(d.time).getTime() < new Date(closestTide.time).getTime());
        weather.tideMovement = prevTide?.sg && closestTide.sg
          ? parseFloat(closestTide.sg) > parseFloat(prevTide.sg) ? "rising" : parseFloat(closestTide.sg) < parseFloat(prevTide.sg) ? "dropping" : "stable"
          : "unknown";
      } else {
        weather.tideHeight = "N/A";
        weather.tideMovement = "unknown";
      }
      console.log("Tide data for session:", { tideHeight: weather.tideHeight, tideMovement: weather.tideMovement });

    } catch (error) {
      console.error("Error fetching weather/tide data:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      alert("Error fetching weather/tide data. Session will be logged with partial data.");
      weather = {
        swellHeight: "N/A",
        swellPeriod: "N/A",
        swellDirection: "N/A",
        windSpeed: "N/A",
        windDirection: "N/A",
        tideHeight: "N/A",
        tideMovement: "unknown"
      };
    }

    // Fetch beach break parameters
    if (isBeachBreak) {
      try {
        const sessionDateTime = new Date(dateTime);
        const sevenDayStart = new Date(sessionDateTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sevenDayAverages = await calculateSevenDayAverages(spot, sevenDayStart, sessionDateTime);
        weather = {
          ...weather,
          sevenDaySwellAverages: sevenDayAverages,
          season: getSeason(sessionDateTime)
        };
        console.log("Beach break parameters:", { sevenDaySwellAverages: sevenDayAverages, season: getSeason(sessionDateTime) });
      } catch (error) {
        console.error("Error fetching beach break parameters:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        alert("Error fetching beach break parameters. Using fallback data.");
        weather = {
          ...weather,
          sevenDaySwellAverages: { swellHeight: 0, swellPeriod: 0, swellDirection: 0, windSpeed: 0, windDirection: 0, tideDifference: 0 },
          season: getSeason(new Date(dateTime))
        };
      }
    }

    // Save session
    try {
      const sessionData = {
        userId: user.uid,
        spot,
        dateTime: firebase.firestore.Timestamp.fromDate(new Date(dateTime)),
        score: parseInt(score),
        weather,
        isBeachBreak,
        comments: comments || ""
      };
      console.log("Attempting to log session:", sessionData);
      const docRef = await firebase.firestore().collection("sessions").add(sessionData);
      console.log("Session logged successfully, ID:", docRef.id);
      alert("Session logged successfully");
      e.target.reset();
      document.querySelector("#custom-spot-section").style.display = "none";
      await Promise.all([renderSessionHistory(), populateSessionSpotSelector()]);
    } catch (error) {
      console.error("Error logging session:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      alert("Error logging session: " + error.message);
    }
  });
}
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).catch(error => {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
      });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut().then(() => {
        alert("Signed out");
      }).catch(error => {
        console.error("Sign out error:", error);
        alert("Sign out failed: " + error.message);
      });
    });
  }

  firebase.auth().onAuthStateChanged(async user => {
    isAuthenticated = !!user;
    authStatus.textContent = user ? `Signed in as ${user.displayName}` : "Not signed in";
    loginBtn.style.display = user ? "none" : "inline";
    logoutBtn.style.display = user ? "inline" : "none";

    console.log("Auth state changed:", user ? user.uid : "No user");
    if (logSessionSection) {
      logSessionSection.style.display = user ? "block" : "none";
      console.log("log-session-section display:", logSessionSection.style.display);
    }
    if (sessionHistorySection) {
      sessionHistorySection.style.display = user ? "block" : "none";
      console.log("session-history-section display:", sessionHistorySection.style.display);
    }

    if (user) {
      try {
        await Promise.all([
          populateSessionSpotSelector(),
          populateForecastSpotSelector(),
          renderSessionHistory()
        ]);
      } catch (error) {
        console.error("Error initializing authenticated UI:", error);
      }
    } else {
      const sessionTbody = document.querySelector("#session-history-table tbody");
      if (sessionTbody) sessionTbody.innerHTML = "";
      const forecastTbody = document.querySelector("#week-forecast tbody");
      if (forecastTbody) forecastTbody.innerHTML = "";
    }
  });
});